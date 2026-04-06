import axios, { isAxiosError } from "axios";
import type { ApiSuccess } from "../../../shared/types/api";
import {
  LoginCredentials,
  AuthResponse,
} from "../types/auth.types";
import { storageService } from "./storage.service";

// Para login, precisamos criar uma instância sem interceptor
// que ainda não tenha token configurado
const loginClient = axios.create({
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

class AuthService {
  /**
   * Fazer login com username/password ou API token
   */
  async login(
    credentials: LoginCredentials,
    serverUrl: string,
  ): Promise<AuthResponse> {
    // Configurar URL do servidor para este request
    loginClient.defaults.baseURL = `${serverUrl}/api`;

    const response = await loginClient.post<ApiSuccess<AuthResponse>>(
      "/auth/login",
      credentials,
    );
    return response.data.data;
  }

  /**
   * Validar token atual
   */
  async validateToken(serverUrl: string, token?: string): Promise<boolean> {
    try {
      const authToken = token || (await storageService.getToken());
      loginClient.defaults.baseURL = `${serverUrl}/api`;
      const response = await loginClient.get<ApiSuccess<{ valid: boolean }>>("/auth/validate", {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      return response.status === 200 && response.data.data.valid === true;
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
      const normalizedUrl = serverUrl.trim().replace(/\/$/, "");
      await axios.get(`${normalizedUrl}/health`, { timeout: 5000 });
      return { success: true, message: "Conexão estabelecida com sucesso" };
    } catch (error) {
      if (isAxiosError(error)) {
        if (error.code === "ECONNREFUSED") {
          return { success: false, message: "Servidor não encontrado" };
        }
        if (error.code === "ETIMEDOUT") {
          return { success: false, message: "Timeout de conexão" };
        }
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
