import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Lock,
  LogIn,
  Server,
  Check,
  Settings,
  Terminal,
  Shield,
} from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { LoginCredentials, ServerConfig } from "../../types/auth.types";

const COLORS = {
  background: "#10141a",
  surface: "#10141a",
  surfaceContainer: "#1c2026",
  surfaceContainerLow: "#181c22",
  surfaceContainerLowest: "#0a0e14",
  surfaceContainerHigh: "#262a31",
  primary: "#a2c9ff",
  primaryContainer: "#58a6ff",
  primaryFixedDim: "#a2c9ff",
  onPrimary: "#00315c",
  onPrimaryContainer: "#003a6b",
  onPrimaryFixed: "#001c38",
  secondary: "#c1c7d0",
  onSecondary: "#2b3138",
  onSecondaryContainer: "#b0b5be",
  tertiary: "#67df70",
  tertiaryContainer: "#40ba51",
  onTertiary: "#00390d",
  onTertiaryContainer: "#004411",
  outline: "#8b919d",
  outlineVariant: "#414752",
  onSurface: "#dfe2eb",
  onBackground: "#dfe2eb",
  error: "#ffb4ab",
};

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, servers, server: activeServer } = useAuth();

  const [serverUrl, setServerUrl] = useState("http://localhost:3000");
  const [serverName, setServerName] = useState("Local Server");
  const loginType: "password" | "token" = "password";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [rememberServer, setRememberServer] = useState(true);
  const serverConfigRoute = "/server-config" as any;

  useEffect(() => {
    const preferredServer = activeServer ?? servers[0];

    if (!preferredServer) {
      return;
    }

    setServerUrl(preferredServer.url);
    setServerName(preferredServer.name);
  }, [activeServer, servers]);

  const handleLogin = async () => {
    if (!serverUrl) {
      Alert.alert("Error", "Enter server endpoint");
      return;
    }

    if (loginType === "password") {
      if (!username || !password) {
        Alert.alert("Error", "Enter username and password");
        return;
      }
    } else {
      if (!apiToken) {
        Alert.alert("Error", "Enter API Token");
        return;
      }
    }

    try {
      const credentials: LoginCredentials =
        loginType === "password" ? { username, password } : { apiToken };

      await login(credentials, serverUrl, serverName);
    } catch (error: any) {
      const message =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        "Login failed";
      Alert.alert("Login Error", message);
    }
  };

  const handleServerSelect = (selectedServer: ServerConfig) => {
    setServerUrl(selectedServer.url);
    setServerName(selectedServer.name);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top App Bar */}
        <View style={styles.topAppBar}>
          <View style={styles.titleContainer}>
            <Terminal size={20} color={COLORS.primary} />
            <Text style={styles.appTitle}>KINETIC_INFRA</Text>
          </View>
          <TouchableOpacity onPress={() => router.push(serverConfigRoute)}>
            <Settings size={20} color={COLORS.secondary} />
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Authenticate Session Card */}
          <View style={styles.cardSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>AUTHENTICATE_SESSION</Text>
              <View style={styles.sectionDivider} />
            </View>

            <View style={styles.formCard}>
              {/* Server Endpoint */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>SERVER_ENDPOINT</Text>
                <View style={styles.inputContainer}>
                  <Server
                    size={16}
                    color={COLORS.primaryFixedDim}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="https://10.0.0.1:2375"
                    placeholderTextColor={COLORS.outlineVariant}
                    value={serverUrl}
                    onChangeText={setServerUrl}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </View>
                <Text style={styles.helperText}>
                  Use `localhost` apenas no mesmo computador. Em celular fisico, use o IP da maquina que roda o backend.
                </Text>
              </View>

              {/* Username / Access Token */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>
                  {loginType === "password"
                    ? "USERNAME / ACCESS_TOKEN"
                    : "ACCESS_TOKEN"}
                </Text>
                <View style={styles.inputContainer}>
                  <LogIn
                    size={16}
                    color={COLORS.primaryFixedDim}
                    style={styles.inputIcon}
                  />
                  {loginType === "password" ? (
                    <TextInput
                      style={styles.input}
                      placeholder="root_admin"
                      placeholderTextColor={COLORS.outlineVariant}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  ) : (
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your API token"
                      placeholderTextColor={COLORS.outlineVariant}
                      value={apiToken}
                      onChangeText={setApiToken}
                      autoCapitalize="none"
                      secureTextEntry
                    />
                  )}
                </View>
              </View>

              {/* Password / Private Key */}
              {loginType === "password" && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>PASSWORD / PRIVATE_KEY</Text>
                  <View style={styles.inputContainer}>
                    <Lock
                      size={16}
                      color={COLORS.primaryFixedDim}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••••••"
                      placeholderTextColor={COLORS.outlineVariant}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />
                  </View>
                </View>
              )}

              {/* Remember Checkbox */}
              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    rememberServer && styles.checkboxChecked,
                  ]}
                  onPress={() => setRememberServer(!rememberServer)}
                >
                  {rememberServer && <Check size={14} color={COLORS.primary} />}
                </TouchableOpacity>
                <Text style={styles.checkboxLabel}>REMEMBER_ENDPOINT</Text>
              </View>

              {/* Connect Button */}
              <TouchableOpacity
                style={[
                  styles.connectButton,
                  isLoading && styles.connectButtonDisabled,
                ]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.onPrimary} />
                ) : (
                  <Text style={styles.connectButtonText}>
                    [ CONNECT_TO_INFRA ]
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.manageServersButton}
                onPress={() => router.push(serverConfigRoute)}
              >
                <Text style={styles.manageServersButtonText}>
                  [ MANAGE_SAVED_SERVERS ]
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Saved Servers Section */}
          <View style={styles.nodesSection}>
            <View style={styles.nodesHeader}>
              <Text style={styles.nodesTitle}>SAVED_SERVERS</Text>
              <Text style={styles.nodesCount}>
                {String(servers.length).padStart(2, "0")}
              </Text>
            </View>

            {servers.length === 0 ? (
              <View style={[styles.nodeCard, styles.nodeCardOffline]}>
                <View style={styles.nodeInfo}>
                  <Text style={styles.nodeName}>Nenhum servidor salvo</Text>
                  <Text style={styles.nodeUrl}>
                    Abra o registro para adicionar e validar endpoints.
                  </Text>
                </View>
              </View>
            ) : (
              servers.map((savedServer) => {
                const isSelected = serverUrl === savedServer.url;
                const isActive = activeServer?.id === savedServer.id;

                return (
                  <TouchableOpacity
                    key={savedServer.id}
                    style={[
                      styles.nodeCard,
                      isSelected ? styles.nodeCardOnline : styles.nodeCardOffline,
                    ]}
                    onPress={() => handleServerSelect(savedServer)}
                  >
                    <View style={styles.nodeInfo}>
                      <Text style={styles.nodeName}>{savedServer.name}</Text>
                      <Text style={styles.nodeUrl}>{savedServer.url}</Text>
                    </View>
                    <View style={styles.nodeStatus}>
                      <View
                        style={[
                          styles.statusDot,
                          isSelected && styles.statusDotOnline,
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          isSelected
                            ? styles.statusTextOnline
                            : styles.statusTextOffline,
                        ]}
                      >
                        {isActive
                          ? "ACTIVE"
                          : isSelected
                            ? "SELECTED"
                            : "SAVED"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <View style={styles.footerContent}>
            <View style={styles.footerItem}>
              <Shield size={14} color={COLORS.outline} />
              <Text style={styles.footerText}>SSL_ENCRYPTED</Text>
            </View>
            <View style={styles.footerItem}>
              <View style={styles.versionBadge}>
                <Text style={styles.versionText}>v2.4.0-stable</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: "100%",
  },
  topAppBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: COLORS.surfaceContainerLow,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.primary,
    letterSpacing: -0.5,
    textTransform: "uppercase",
  },
  mainContent: {
    padding: 24,
    gap: 32,
    maxWidth: 500,
    alignSelf: "center",
    width: "100%",
  },
  cardSection: {
    gap: 24,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.primaryFixedDim,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  sectionDivider: {
    height: 2,
    width: 48,
    backgroundColor: COLORS.primaryContainer,
  },
  formCard: {
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 8,
    padding: 24,
    gap: 20,
    borderWidth: 1,
    borderColor: "rgba(65, 71, 82, 0.1)",
  },
  fieldContainer: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.secondary,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  inputContainer: {
    backgroundColor: COLORS.surfaceContainerLowest,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 48,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: COLORS.primaryFixedDim,
    fontSize: 14,
  },
  helperText: {
    color: COLORS.outline,
    fontSize: 11,
    lineHeight: 16,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.secondary,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  connectButton: {
    backgroundColor: COLORS.primaryContainer,
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 4,
    boxShadow: "0px 4px 8px rgba(88, 166, 255, 0.1)",
    elevation: 4,
  },
  connectButtonDisabled: {
    opacity: 0.6,
  },
  connectButtonText: {
    color: COLORS.onPrimary,
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: -0.5,
    textTransform: "uppercase",
  },
  manageServersButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    backgroundColor: COLORS.surfaceContainerLow,
  },
  manageServersButtonText: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  nodesSection: {
    gap: 16,
  },
  nodesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nodesTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.secondary,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  nodesCount: {
    fontSize: 10,
    color: COLORS.outline,
    fontWeight: "bold",
    letterSpacing: 1.2,
  },
  nodeCard: {
    backgroundColor: COLORS.surfaceContainerLow,
    padding: 16,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderLeftWidth: 2,
  },
  nodeCardOnline: {
    borderLeftColor: COLORS.tertiary,
  },
  nodeCardOffline: {
    borderLeftColor: COLORS.outlineVariant,
  },
  nodeInfo: {
    gap: 4,
  },
  nodeName: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.onSurface,
  },
  nodeUrl: {
    fontSize: 10,
    color: COLORS.outline,
  },
  nodeStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.outlineVariant,
  },
  statusDotOnline: {
    backgroundColor: COLORS.tertiary,
    boxShadow: "0px 0px 8px rgba(103, 223, 112, 0.6)",
    elevation: 4,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "bold",
  },
  statusTextOnline: {
    color: COLORS.tertiary,
  },
  statusTextOffline: {
    color: COLORS.outline,
  },
  footer: {
    marginTop: "auto",
    padding: 24,
    gap: 16,
  },
  footerDivider: {
    height: 1,
    backgroundColor: "rgba(65, 71, 82, 0.1)",
    width: "100%",
  },
  footerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footerText: {
    fontSize: 10,
    color: COLORS.outline,

    fontWeight: "500",
    letterSpacing: 1,
  },
  versionBadge: {
    backgroundColor: COLORS.surfaceContainerHigh,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  versionText: {
    fontSize: 10,
    color: COLORS.secondary,
    fontWeight: "500",
  },
});
