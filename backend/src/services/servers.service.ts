import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ServerConfig, CreateServerRequest } from "../types/server.types";
import {
  normalizeServerUrl,
  testServerConnection,
} from "./serverConnection.service";

const DATA_DIR = path.resolve(process.cwd(), "data");
const SERVERS_FILE = path.join(DATA_DIR, "servers.json");

async function ensureStorage(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(SERVERS_FILE);
  } catch {
    await fs.writeFile(SERVERS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

async function readServers(): Promise<ServerConfig[]> {
  await ensureStorage();
  const raw = await fs.readFile(SERVERS_FILE, "utf-8");
  return JSON.parse(raw) as ServerConfig[];
}

async function writeServers(servers: ServerConfig[]): Promise<void> {
  await ensureStorage();
  await fs.writeFile(SERVERS_FILE, JSON.stringify(servers, null, 2), "utf-8");
}

export const serversService = {
  async list(): Promise<ServerConfig[]> {
    return readServers();
  },

  async create(input: CreateServerRequest): Promise<{
    server: ServerConfig;
    connection: { success: boolean; message: string };
  }> {
    const servers = await readServers();
    const normalizedUrl = normalizeServerUrl(input.url);

    const connection = await testServerConnection(normalizedUrl);
    if (!connection.success) {
      return {
        server: null as unknown as ServerConfig,
        connection,
      };
    }

    const now = new Date().toISOString();
    const server: ServerConfig = {
      id: randomUUID(),
      name: input.name.trim(),
      url: normalizedUrl,
      isDefault: servers.length === 0,
      createdAt: now,
      updatedAt: now,
    };

    await writeServers([...servers, server]);

    return { server, connection };
  },

  async remove(id: string): Promise<boolean> {
    const servers = await readServers();
    const next = servers.filter((server) => server.id !== id);

    if (next.length === servers.length) {
      return false;
    }

    await writeServers(next);
    return true;
  },
};
