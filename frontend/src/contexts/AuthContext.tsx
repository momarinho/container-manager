import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AuthState, AuthAction, LoginCredentials, ServerConfig } from '../types/auth.types';
import { storageService } from '../services/storage.service';
import { authService } from '../services/auth.service';

const initialState: AuthState = {
  isAuthenticated: false,
  token: null,
  user: null,
  server: null,
  isLoading: true,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        token: action.payload.token,
        user: action.payload.user,
        server: action.payload.server,
        isLoading: false,
      };
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    case 'SET_SERVER':
      return {
        ...state,
        server: action.payload,
      };
    default:
      return state;
  }
}

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials, serverUrl: string, serverName: string) => Promise<void>;
  logout: () => Promise<void>;
  setServer: (server: ServerConfig) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Carregar dados salvos ao iniciar
  useEffect(() => {
    loadStoredAuth();

    // Ouvir evento de unauthorized do interceptor
    const handleUnauthorized = () => {
      dispatch({ type: 'LOGOUT' });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth:unauthorized', handleUnauthorized);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth:unauthorized', handleUnauthorized);
      }
    };
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [token, user, server] = await Promise.all([
        storageService.getToken(),
        storageService.getUser(),
        storageService.getServer(),
      ]);

      if (token && user && server) {
        // Validar token com o servidor
        const isValid = await authService.validateToken(server.url);

        if (isValid) {
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: { token, user, server },
          });
        } else {
          // Token inválido, limpar tudo
          await storageService.clearAll();
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    } catch (error) {
      console.error('Erro ao carregar autenticação:', error);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const login = async (
    credentials: LoginCredentials,
    serverUrl: string,
    serverName: string
  ) => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response = await authService.login(credentials, serverUrl);

      const serverConfig: ServerConfig = {
        id: Date.now().toString(),
        name: serverName,
        url: serverUrl,
        isDefault: true,
      };

      // Salvar tudo localmente
      await Promise.all([
        storageService.saveToken(response.token),
        storageService.saveUser(response.user),
        storageService.saveServer(serverConfig),
      ]);

      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          token: response.token,
          user: response.user,
          server: serverConfig,
        },
      });
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw error;
    }
  };

  const logout = async () => {
    await authService.logout();
    await storageService.clearAll();
    dispatch({ type: 'LOGOUT' });
  };

  const setServer = async (server: ServerConfig) => {
    await storageService.saveServer(server);
    dispatch({ type: 'SET_SERVER', payload: server });
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        setServer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
