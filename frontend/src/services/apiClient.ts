import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import { runtimeConfig } from '../config/runtime';
import { authEventsService } from './auth-events.service';
import { authService } from './auth.service';
import { storageService } from './storage.service';

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface QueuedPromise {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}

let isRefreshing = false;
let failedQueue: QueuedPromise[] = [];

function processQueue(error: unknown, token: string | null = null): void {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });

  failedQueue = [];
}

const BASE_URL = `${runtimeConfig.defaultApiUrl}/api`;

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Adiciona token JWT e atualiza baseURL
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await storageService.getToken();

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const server = await storageService.getServer();
    if (server) {
      config.baseURL = `${server.url}/api`;
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Trata erros 401 com renovação silenciosa via Refresh Token
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig | undefined;

    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const requestUrl = originalRequest.url || '';
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/logout');

    if (isAuthEndpoint || originalRequest._retry) {
      await storageService.clearAll();
      authEventsService.emitUnauthorized();
      return Promise.reject(error);
    }

    const refreshToken = await storageService.getRefreshToken();
    if (!refreshToken) {
      await storageService.clearAll();
      authEventsService.emitUnauthorized();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const authData = await authService.refresh(refreshToken);
      await storageService.saveAuthTokens(authData.token, authData.refreshToken);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${authData.token}`;
      }

      processQueue(null, authData.token);
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      await storageService.clearAll();
      authEventsService.emitUnauthorized();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;
