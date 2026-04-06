export function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export async function testServerConnection(url: string): Promise<{
  success: boolean;
  message: string;
}> {
  const baseUrl = normalizeServerUrl(url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout

    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        message: `Server responded with status ${response.status}`,
      };
    }

    return { success: true, message: "Connection successful" };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, message: "Connection timed out" };
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Connection failed: ${errorMessage}` };
    }
  }
}
