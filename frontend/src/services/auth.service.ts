import type { ApiSuccess } from "../../../shared/types/api";
import {
  LoginCredentials,
  AuthResponse,
} from "../types/auth.types";
import { storageService } from "./storage.service";

function normalizeServerUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/$/, "");
}

async function requestJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message =
        typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof (payload as { error?: { message?: unknown } }).error?.message ===
          "string"
          ? (payload as { error: { message: string } }).error.message
          : `Request failed with status ${response.status}`;

      throw new Error(message);
    }

    return payload as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

class AuthService {
  /**
   * Fazer login com username/password ou API token
   */
  async login(
    credentials: LoginCredentials,
    serverUrl: string,
  ): Promise<AuthResponse> {
    const baseUrl = normalizeServerUrl(serverUrl);
    const response = await requestJson<ApiSuccess<AuthResponse>>(
      `${baseUrl}/api/auth/login`,
      {
        method: "POST",
        body: JSON.stringify(credentials),
      },
    );
    return response.data;
  }

  /**
   * Validar token atual
   */
  async validateToken(serverUrl: string, token?: string): Promise<boolean> {
    try {
      const authToken = token || (await storageService.getToken());
      const baseUrl = normalizeServerUrl(serverUrl);
      const response = await requestJson<ApiSuccess<{ valid: boolean }>>(
        `${baseUrl}/api/auth/validate`,
        {
          method: "GET",
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        },
      );
      return response.data.valid === true;
    } catch {
      return false;
    }
  }

  /**
   * Testar conexão com servidor
   */
  async testConnection(
    serverUrl: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const normalizedUrl = normalizeServerUrl(serverUrl);
      await requestJson<{ success: true; data: { status: string } }>(
        `${normalizedUrl}/health`,
      );
      return { success: true, message: "Conexão estabelecida com sucesso" };
    } catch (error) {
      if (error instanceof Error) {
        return { success: false, message: error.message || "Erro ao conectar" };
      }
      return { success: false, message: "Erro desconhecido" };
    }
  }

  /**
   * Fazer logout
   */
  async logout(): Promise<void> {
    // Aqui você poderia chamar um endpoint de logout no backend se necessário
    // Por enquanto, apenas limpa os dados locais
  }
}

export const authService = new AuthService();
export default authService;
