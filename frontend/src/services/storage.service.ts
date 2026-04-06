import AsyncStorage from "@react-native-async-storage/async-storage";
import SInfo from "react-native-sensitive-info";
import type { ServerConfig, AuthResponse } from "../types/auth.types";

const STORAGE_KEYS = {
  TOKEN: "@containermaster_token",
  SERVER: "@containermaster_server",
  SERVERS: "@containermaster_servers",
  ACTIVE_SERVER_ID: "@containermaster_active_server_id",
  USER: "@containermaster_user",
};

// Para iOS/Android - usa Keychain/Keystore
// Para Web/Expo Go - usa AsyncStorage (menos seguro)
const useSecureStorage = __DEV__ ? false : true;

const SensitiveInfoOptions = {
  sharedPreferencesName: "ContainerMaster",
  keychainService: "ContainerMasterKeychain",
};

async function readJson<T>(key: string): Promise<T | null> {
  const data = await AsyncStorage.getItem(key);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

async function readLegacyServer(): Promise<ServerConfig | null> {
  return readJson<ServerConfig>(STORAGE_KEYS.SERVER);
}

async function readServerList(): Promise<ServerConfig[]> {
  const servers = await readJson<ServerConfig[]>(STORAGE_KEYS.SERVERS);

  if (servers && Array.isArray(servers)) {
    return servers;
  }

  const legacyServer = await readLegacyServer();
  return legacyServer ? [legacyServer] : [];
}

export const storageService = {
  // Salvar token (secure em produção)
  async saveToken(token: string): Promise<void> {
    if (useSecureStorage) {
      await SInfo.setItem(STORAGE_KEYS.TOKEN, token, SensitiveInfoOptions);
    }

    await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
  },

  // Recuperar token
  async getToken(): Promise<string | null> {
    if (useSecureStorage) {
      try {
        const secureToken = await SInfo.getItem(
          STORAGE_KEYS.TOKEN,
          SensitiveInfoOptions,
        );

        if (secureToken) {
          return secureToken;
        }
      } catch {
        // fallback para AsyncStorage abaixo
      }
    }

    return AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
  },

  // Remover token
  async removeToken(): Promise<void> {
    await Promise.allSettled([
      AsyncStorage.removeItem(STORAGE_KEYS.TOKEN),
      SInfo.deleteItem(STORAGE_KEYS.TOKEN, SensitiveInfoOptions),
    ]);
  },

  // Salvar configuração do servidor
  async saveServer(server: ServerConfig): Promise<void> {
    await this.saveServers([server]);
    await this.saveActiveServerId(server.id);
  },

  async getServer(): Promise<ServerConfig | null> {
    const [servers, activeServerId] = await Promise.all([
      readServerList(),
      this.getActiveServerId(),
    ]);

    return servers.find((server) => server.id === activeServerId) ?? servers[0] ?? null;
  },

  async removeServer(): Promise<void> {
    await this.removeServers();
  },

  async saveServers(servers: ServerConfig[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.SERVERS, JSON.stringify(servers));

    if (servers.length > 0) {
      await AsyncStorage.setItem(STORAGE_KEYS.SERVER, JSON.stringify(servers[0]));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.SERVER);
    }
  },

  async getServers(): Promise<ServerConfig[]> {
    return readServerList();
  },

  async saveActiveServerId(serverId: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SERVER_ID, serverId);
  },

  async getActiveServerId(): Promise<string | null> {
    const activeServerId = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SERVER_ID);

    if (activeServerId) {
      return activeServerId;
    }

    const legacyServer = await readLegacyServer();
    return legacyServer?.id ?? null;
  },

  async removeActiveServerId(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SERVER_ID);
  },

  async removeServers(): Promise<void> {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.SERVERS),
      AsyncStorage.removeItem(STORAGE_KEYS.SERVER),
      AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SERVER_ID),
    ]);
  },

  // Salvar dados do usuário
  async saveUser(user: AuthResponse["user"]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  async getUser(): Promise<AuthResponse["user"] | null> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : null;
  },

  async removeUser(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER);
  },

  // Limpar apenas dados autenticados (logout)
  async clearAll(): Promise<void> {
    await Promise.all([
      this.removeToken(),
      this.removeUser(),
    ]);
  },
};
