import AsyncStorage from "@react-native-async-storage/async-storage";
import SInfo from "react-native-sensitive-info";
import type { ServerConfig, AuthResponse } from "../types/auth.types";

const STORAGE_KEYS = {
  TOKEN: "@containermaster_token",
  SERVER: "@containermaster_server",
  USER: "@containermaster_user",
};

// Para iOS/Android - usa Keychain/Keystore
// Para Web/Expo Go - usa AsyncStorage (menos seguro)
const useSecureStorage = __DEV__ ? false : true;

const SensitiveInfoOptions = {
  sharedPreferencesName: "ContainerMaster",
  keychainService: "ContainerMasterKeychain",
};

export const storageService = {
  // Salvar token (secure em produção)
  async saveToken(token: string): Promise<void> {
    if (useSecureStorage) {
      await SInfo.setItem(STORAGE_KEYS.TOKEN, token, SensitiveInfoOptions);
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
    }
  },

  // Recuperar token
  async getToken(): Promise<string | null> {
    if (useSecureStorage) {
      try {
        return await SInfo.getItem(STORAGE_KEYS.TOKEN, SensitiveInfoOptions);
      } catch {
        return null;
      }
    }
    return AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
  },

  // Remover token
  async removeToken(): Promise<void> {
    if (useSecureStorage) {
      await SInfo.deleteItem(STORAGE_KEYS.TOKEN, SensitiveInfoOptions);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
    }
  },

  // Salvar configuração do servidor
  async saveServer(server: ServerConfig): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.SERVER, JSON.stringify(server));
  },

  async getServer(): Promise<ServerConfig | null> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SERVER);
    return data ? JSON.parse(data) : null;
  },

  async removeServer(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.SERVER);
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

  // Limpar todos os dados (logout)
  async clearAll(): Promise<void> {
    await this.removeToken();
    await this.removeServer();
    await this.removeUser();
  },
};
