import axios from 'axios';
import { LoginCredentials, AuthResponse, ServerConfig } from '../types/auth.types';

// Para login, precisamos criar uma instância sem interceptor
// que ainda não tenha token configurado
const loginClient = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

class AuthService {
  /**
   * Fazer login com username/password ou API token
   */
  async login(
    credentials: LoginCredentials,
    serverUrl: string
  ): Promise<AuthResponse> {
    // Configurar URL do servidor para este request
    loginClient.defaults.baseURL = `${serverUrl}/api`;

    const response = await loginClient.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  }

  /**
   * Validar token atual
   */
  async validateToken(serverUrl: string): Promise<boolean> {
    try {
      loginClient.defaults.baseURL = `${serverUrl}/api`;
      const response = await loginClient.get('/auth/validate');
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Testar conexão com servidor
   */
  async testConnection(serverUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      loginClient.defaults.baseURL = `${serverUrl}/api`;
      await loginClient.get('/health', { timeout: 5000 });
      return { success: true, message: 'Conexão estabelecida com sucesso' };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          return { success: false, message: 'Servidor não encontrado' };
        }
        if (error.code === 'ETIMEDOUT') {
          return { success: false, message: 'Timeout de conexão' };
        }
        return { success: false, message: error.message || 'Erro ao conectar' };
      }
      return { success: false, message: 'Erro desconhecido' };
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
