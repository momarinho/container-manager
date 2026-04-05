import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { storageService } from './storage.service';

// URL base padrão - será sobrescrita pela configuração do servidor
const BASE_URL = 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Adiciona token JWT
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await storageService.getToken();

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Atualizar baseURL se tiver configuração de servidor
    const server = await storageService.getServer();
    if (server && config.baseURL) {
      config.baseURL = `${server.url}/api`;
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Trata erros e expiração de token
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    // Token expirado ou inválido (401)
    if (error.response?.status === 401) {
      // Limpar dados autenticados
      await storageService.clearAll();

      // Disparar evento para redirecionar para login
      // (o AuthContext vai ouvir esse evento)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
