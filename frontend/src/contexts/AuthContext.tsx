import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from "react";
import {
  AuthState,
  AuthAction,
  LoginCredentials,
  ServerConfig,
} from "../types/auth.types";
import { storageService } from "../services/storage.service";
import { authService } from "../services/auth.service";

const initialState: AuthState = {
  isAuthenticated: false,
  token: null,
  user: null,
  server: null,
  servers: [],
  activeServerId: null,
  isLoading: true,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "LOGIN_SUCCESS":
      return {
        ...state,
        isAuthenticated: true,
        token: action.payload.token,
        user: action.payload.user,
        server: action.payload.server,
        servers: action.payload.servers,
        activeServerId: action.payload.server.id,
        isLoading: false,
      };
    case "LOGOUT":
      return {
        ...initialState,
        isLoading: false,
      };
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };
    case "SET_SERVER":
      return {
        ...state,
        server: action.payload,
        activeServerId: action.payload.id,
      };
    case "SET_SERVERS":
      return {
        ...state,
        servers: action.payload,
      };
    case "SET_ACTIVE_SERVER_ID": {
      const server =
        state.servers.find((item) => item.id === action.payload) ?? null;

      return {
        ...state,
        activeServerId: action.payload,
        server,
      };
    }
    case "CLEAR_ACTIVE_SERVER":
      return {
        ...state,
        server: null,
        activeServerId: null,
      };
    default:
      return state;
  }
}

interface AuthContextType extends AuthState {
  login: (
    credentials: LoginCredentials,
    serverUrl: string,
    serverName: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  setServer: (server: ServerConfig) => Promise<void>;
  setServers: (servers: ServerConfig[]) => Promise<void>;
  clearActiveServer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Carregar dados salvos ao iniciar
  useEffect(() => {
    loadStoredAuth();

    // Ouvir evento de unauthorized do interceptor
    const handleUnauthorized = () => {
      dispatch({ type: "LOGOUT" });
    };

    if (typeof window !== "undefined") {
      window.addEventListener("auth:unauthorized", handleUnauthorized);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("auth:unauthorized", handleUnauthorized);
      }
    };
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [token, user, servers, activeServerId] = await Promise.all([
        storageService.getToken(),
        storageService.getUser(),
        storageService.getServers(),
        storageService.getActiveServerId(),
      ]);

      const activeServer =
        servers.find((item) => item.id === activeServerId) ??
        servers[0] ??
        null;

      dispatch({ type: "SET_SERVERS", payload: servers });
      dispatch({
        type: "SET_ACTIVE_SERVER_ID",
        payload: activeServer?.id ?? null,
      });

      if (token && user && activeServer) {
        // Validar token com o servidor
        const isValid = await authService.validateToken(
          activeServer.url,
          token,
        );

        if (isValid) {
          dispatch({
            type: "LOGIN_SUCCESS",
            payload: { token, user, server: activeServer, servers },
          });
          return;
        } else {
          // Token inválido, limpar tudo
          await storageService.clearAll();
        }
      }

      dispatch({ type: "SET_LOADING", payload: false });
    } catch (error) {
      console.error("Erro ao carregar autenticação:", error);
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const login = async (
    credentials: LoginCredentials,
    serverUrl: string,
    serverName: string,
  ) => {
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const response = await authService.login(credentials, serverUrl);
      const normalizedServerUrl = serverUrl.trim().replace(/\/$/, "");
      const storedServers = await storageService.getServers();
      const existingServer = storedServers.find(
        (item) => item.url.trim().replace(/\/$/, "") === normalizedServerUrl,
      );

      const serverConfig: ServerConfig = existingServer ?? {
        id: Date.now().toString(),
        name: serverName,
        url: normalizedServerUrl,
        isDefault: storedServers.length === 0,
      };

      const nextServers = existingServer
        ? storedServers.map((item) =>
            item.id === existingServer.id
              ? { ...item, name: serverName, url: normalizedServerUrl }
              : item,
          )
        : [...storedServers, serverConfig];

      // Salvar tudo localmente
      await Promise.all([
        storageService.saveToken(response.token),
        storageService.saveUser(response.user),
        storageService.saveServers(nextServers),
        storageService.saveActiveServerId(serverConfig.id),
      ]);

      dispatch({
        type: "LOGIN_SUCCESS",
        payload: {
          token: response.token,
          user: response.user,
          server: serverConfig,
          servers: nextServers,
        },
      });
    } catch (error) {
      dispatch({ type: "SET_LOADING", payload: false });
      throw error;
    }
  };

  const logout = async () => {
    await authService.logout();
    await storageService.clearAll();
    dispatch({ type: "LOGOUT" });
  };

  const setServer = async (server: ServerConfig) => {
    await storageService.saveActiveServerId(server.id);
    dispatch({ type: "SET_SERVER", payload: server });
  };

  const setServers = async (servers: ServerConfig[]) => {
    await storageService.saveServers(servers);
    dispatch({ type: "SET_SERVERS", payload: servers });

    const activeServer =
      servers.find((item) => item.id === state.activeServerId) ??
      servers[0] ??
      null;

    if (activeServer) {
      await storageService.saveActiveServerId(activeServer.id);
      dispatch({ type: "SET_ACTIVE_SERVER_ID", payload: activeServer.id });
    } else {
      await storageService.removeActiveServerId();
      dispatch({ type: "CLEAR_ACTIVE_SERVER" });
    }
  };

  const clearActiveServer = async () => {
    await storageService.removeActiveServerId();
    dispatch({ type: "CLEAR_ACTIVE_SERVER" });
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        setServer,
        setServers,
        clearActiveServer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
