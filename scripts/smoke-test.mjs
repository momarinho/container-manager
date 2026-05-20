#!/usr/bin/env node

const backendUrl = normalizeBaseUrl(
  process.env.BACKEND_URL ?? "http://127.0.0.1:3000",
);
const frontendUrl = normalizeBaseUrl(
  process.env.FRONTEND_URL ?? "http://127.0.0.1:8081",
);
const requestTimeoutMs = parseInteger(
  process.env.SMOKE_TIMEOUT_MS,
  120_000,
);
const readinessTimeoutMs = parseInteger(
  process.env.SMOKE_READY_TIMEOUT_MS,
  180_000,
);
const wsTimeoutMs = parseInteger(process.env.SMOKE_WS_TIMEOUT_MS, 15_000);
const containerName = `containermaster-smoke-${Date.now()}`;

if (typeof WebSocket !== "function") {
  throw new Error("Global WebSocket client is unavailable in this Node runtime");
}

let authToken = "";
let containerId = "";

main().catch(async (error) => {
  console.error(
    `Smoke test failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exitCode = 1;
  await cleanup();
});

async function main() {
  console.log(`Waiting for frontend at ${frontendUrl}`);
  await waitForHttp(`${frontendUrl}/`, "frontend");

  console.log(`Waiting for backend at ${backendUrl}`);
  await waitForHttp(`${backendUrl}/health`, "backend");

  authToken = await login();
  await getTunnelStatus();
  containerId = await createContainer();

  try {
    await assertContainerListed();
    await restartContainer();
    await assertContainerState("running");
    await assertLogsStream();
    await assertTerminalSession();
    await stopContainer();
    await assertContainerState("exited");
    await startContainer();
    await assertContainerState("running");
    console.log("Smoke test passed");
  } finally {
    await cleanup();
  }
}

async function cleanup() {
  if (!containerId || !authToken) {
    return;
  }

  try {
    await apiRequest(`/api/containers/${containerId}`, {
      method: "DELETE",
      query: { force: "true" },
    });
    console.log(`Removed smoke container ${containerId}`);
    containerId = "";
  } catch (error) {
    console.error(
      `Cleanup failed for ${containerId}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function login() {
  const response = await apiRequest("/api/auth/login", {
    method: "POST",
    body: {
      username: "alice",
      password: "password123",
    },
    includeAuth: false,
  });
  const token = response?.data?.token;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("Login succeeded without token payload");
  }
  console.log("Authenticated with local test credentials");
  return token;
}

async function getTunnelStatus() {
  const response = await apiRequest("/api/tunnel/status");
  const state = response?.data?.state;
  console.log(`Tunnel status: ${state ?? "unknown"}`);
}

async function createContainer() {
  const response = await apiRequest("/api/containers", {
    method: "POST",
    body: {
      name: containerName,
      image: "busybox:1.36",
      command: [
        "sh",
        "-c",
        "echo smoke-ready && trap 'exit 0' TERM INT; while true; do sleep 1; done",
      ],
      autoStart: true,
      pullImage: true,
    },
  });
  const id = response?.data?.container?.id;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Container creation response did not include an id");
  }
  console.log(`Created smoke container ${id}`);
  return id;
}

async function assertContainerListed() {
  const response = await apiRequest("/api/containers", {
    query: { name: containerName, all: "true" },
  });
  const containers = Array.isArray(response?.data) ? response.data : [];
  const exists = containers.some((container) => container?.id === containerId);
  if (!exists) {
    throw new Error(`Smoke container ${containerId} not found in list endpoint`);
  }
  console.log("List endpoint returned the smoke container");
}

async function restartContainer() {
  await apiRequest(`/api/containers/${containerId}/restart`, { method: "POST" });
  console.log("Restarted smoke container");
}

async function stopContainer() {
  await apiRequest(`/api/containers/${containerId}/stop`, { method: "POST" });
  console.log("Stopped smoke container");
}

async function startContainer() {
  await apiRequest(`/api/containers/${containerId}/start`, { method: "POST" });
  console.log("Started smoke container");
}

async function assertContainerState(expectedState) {
  await waitFor(async () => {
    const response = await apiRequest(`/api/containers/${containerId}`);
    const state = response?.data?.state;
    if (state !== expectedState) {
      throw new Error(
        `Container state is ${state ?? "unknown"}, expected ${expectedState}`,
      );
    }
  }, `container to reach state ${expectedState}`);
}

async function assertLogsStream() {
  const websocket = await openWebSocket(
    toWebSocketUrl(`/ws/logs/${containerId}`, { token: authToken }),
  );

  try {
    const connected = await receiveJson(websocket);
    if (connected.type !== "connected") {
      throw new Error(
        `Unexpected logs websocket handshake: ${JSON.stringify(connected)}`,
      );
    }

    let sawReadyLog = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const message = await receiveJson(websocket);
      if (message.type === "log" && String(message.data).includes("smoke-ready")) {
        sawReadyLog = true;
        break;
      }
    }

    if (!sawReadyLog) {
      throw new Error("Did not receive expected smoke-ready log line");
    }

    try {
      websocket.send(JSON.stringify({ action: "unsubscribe" }));
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const message = await receiveJson(websocket);
        if (message.type === "unsubscribed") {
          break;
        }
      }
    } catch {
      // The backend may close the stream as soon as the live log iterator ends.
    }

    console.log("Logs websocket streamed container output");
  } finally {
    await closeWebSocket(websocket);
  }
}

async function assertTerminalSession() {
  const websocket = await openWebSocket(
    toWebSocketUrl(`/ws/terminal/${containerId}`, { token: authToken }),
  );

  try {
    const ready = await receiveJson(websocket);
    if (ready.type !== "ready") {
      throw new Error(`Unexpected terminal handshake: ${JSON.stringify(ready)}`);
    }

    websocket.send(
      JSON.stringify({
        action: "start",
        shell: "/bin/sh",
        cols: 100,
        rows: 30,
      }),
    );
    const started = await receiveJson(websocket);
    if (started.type !== "started") {
      throw new Error(
        `Unexpected terminal start payload: ${JSON.stringify(started)}`,
      );
    }

    websocket.send(
      JSON.stringify({ action: "input", input: "echo smoke-terminal\n" }),
    );

    let sawOutput = false;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const message = await receiveJson(websocket);
      if (
        message.type === "output" &&
        String(message.data).includes("smoke-terminal")
      ) {
        sawOutput = true;
        break;
      }
      if (message.type === "error") {
        throw new Error(`Terminal websocket error: ${message.message}`);
      }
    }

    if (!sawOutput) {
      throw new Error("Did not receive expected terminal output");
    }

    websocket.send(JSON.stringify({ action: "close" }));
    let closed = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const message = await receiveJson(websocket);
      if (message.type === "closed") {
        closed = true;
        break;
      }
      if (message.type === "error") {
        throw new Error(`Terminal websocket error: ${message.message}`);
      }
    }
    if (!closed) {
      throw new Error("Terminal websocket did not report closure");
    }

    console.log("Terminal websocket executed a command successfully");
  } finally {
    await closeWebSocket(websocket);
  }
}

async function apiRequest(path, options = {}) {
  const url = new URL(path, backendUrl);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.includeAuth === false
      ? {}
      : { Authorization: `Bearer ${authToken}` }),
    ...(options.headers ?? {}),
  };

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const payload = await parseJson(response);
    if (!response.ok) {
      const message =
        payload?.error?.message ??
        `Request to ${url.pathname} failed with status ${response.status}`;
      throw new Error(message);
    }
    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function waitForHttp(url, label) {
  await waitFor(async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${label} responded with status ${response.status}`);
    }
  }, `${label} readiness`);
}

async function waitFor(task, label) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < readinessTimeoutMs) {
    try {
      await task();
      return;
    } catch (error) {
      lastError = error;
      await sleep(2_000);
    }
  }

  const details =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Timed out waiting for ${label}: ${details}`);
}

async function openWebSocket(url) {
  return await new Promise((resolve, reject) => {
    const websocket = new WebSocket(url);
    const timer = setTimeout(() => {
      websocket.close();
      reject(new Error(`Timed out opening websocket ${url}`));
    }, wsTimeoutMs);

    websocket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve(websocket);
    });
    websocket.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error(`WebSocket connection failed for ${url}`));
    });
  });
}

async function receiveJson(websocket) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for websocket message"));
    }, wsTimeoutMs);

    const handleMessage = (event) => {
      cleanupListeners();
      try {
        resolve(JSON.parse(String(event.data)));
      } catch (error) {
        reject(error);
      }
    };
    const handleClose = () => {
      cleanupListeners();
      reject(new Error("WebSocket closed before delivering expected message"));
    };
    const handleError = () => {
      cleanupListeners();
      reject(new Error("WebSocket error while waiting for message"));
    };
    const cleanupListeners = () => {
      clearTimeout(timer);
      websocket.removeEventListener("message", handleMessage);
      websocket.removeEventListener("close", handleClose);
      websocket.removeEventListener("error", handleError);
    };

    websocket.addEventListener("message", handleMessage);
    websocket.addEventListener("close", handleClose);
    websocket.addEventListener("error", handleError);
  });
}

async function closeWebSocket(websocket) {
  if (websocket.readyState >= WebSocket.CLOSING) {
    return;
  }

  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2_000);
    websocket.addEventListener(
      "close",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    websocket.close();
  });
}

function toWebSocketUrl(path, query = {}) {
  const base = backendUrl.replace(/^http/, "ws");
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function normalizeBaseUrl(value) {
  return String(value).trim().replace(/\/$/, "");
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function sleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
