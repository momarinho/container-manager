import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Shield, Wifi, WifiOff } from "lucide-react-native";
import { Colors } from "../../../constants/Colors";
import ActionFeedbackBanner, {
  type ActionFeedback,
} from "../../components/ActionFeedbackBanner";
import { useAuth } from "../../contexts/AuthContext";
import { useWebSocket } from "../../hooks/useWebSocket";
import { tunnelService } from "../../services/tunnel.service";
import type { TunnelStatus } from "../../types/tunnel.types";

function formatUpdatedAt(timestamp: number | null): string {
  if (!timestamp) {
    return "Nunca";
  }

  return new Date(timestamp).toLocaleTimeString();
}

function getStatusColor(status: TunnelStatus | null): string {
  if (!status) {
    return Colors.outline;
  }

  if (status.connected) {
    return Colors.tertiary;
  }

  if (status.state === "connecting") {
    return Colors.warning;
  }

  if (status.state === "needs_login" || status.state === "error") {
    return Colors.error;
  }

  return Colors.outline;
}

function getStatusLabel(status: TunnelStatus | null): string {
  if (!status) {
    return "UNKNOWN";
  }

  if (status.connected) {
    return "CONNECTED";
  }

  if (status.state === "connecting") {
    return "CONNECTING";
  }

  if (status.state === "needs_login") {
    return "NEEDS_LOGIN";
  }

  if (status.state === "error") {
    return "ERROR";
  }

  return "DISCONNECTED";
}

function KeyValueRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.keyValueRow}>
      <Text style={styles.keyLabel}>{label}</Text>
      <Text style={styles.keyValue}>{value}</Text>
    </View>
  );
}

export default function TunnelScreen() {
  const { server } = useAuth();
  const [status, setStatus] = useState<TunnelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authKey, setAuthKey] = useState("");
  const [hostname, setHostname] = useState("");
  const [acceptStoredHostname, setAcceptStoredHostname] = useState(true);

  const loadStatus = useCallback(async (showSpinner: boolean) => {
    if (!server) {
      setStatus(null);
      setLoadError("Selecione um servidor antes de monitorar o tunnel.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (showSpinner) {
        setLoading(true);
      }

      setLoadError(null);
      const nextStatus = await tunnelService.getStatus();
      setStatus(nextStatus);
    } catch (error: any) {
      console.error("Error loading tunnel status:", error);
      setLoadError(
        error.response?.data?.error?.message ||
          error.message ||
          "Nao foi possivel carregar o status do tunnel.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [server]);

  useFocusEffect(
    useCallback(() => {
      void loadStatus(true);
    }, [loadStatus]),
  );

  useEffect(() => {
    if (!acceptStoredHostname || hostname.trim().length > 0 || !status?.hostname) {
      return;
    }

    setHostname(status.hostname);
  }, [acceptStoredHostname, hostname, status?.hostname]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setFeedback(null);
    }, 2500);

    return () => clearTimeout(timeoutId);
  }, [feedback]);

  const wsEnabled = Boolean(server);
  const { isConnected: wsConnected, error: wsError } = useWebSocket<TunnelStatus>(
    "/tunnel",
    (nextStatus) => {
      setStatus(nextStatus);
      setLoadError(null);
    },
    wsEnabled,
  );

  const liveHealth = useMemo(
    () => (status?.health ?? []).filter((entry) => entry.trim().length > 0),
    [status?.health],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStatus(false);
  };

  const handleConnect = async () => {
    try {
      setFeedback({
        tone: "loading",
        message: "Solicitando conexao do tunnel...",
      });

      const nextStatus = await tunnelService.connect({
        provider: "tailscale",
        authKey: authKey.trim() || undefined,
        hostname: hostname.trim() || undefined,
      });

      setStatus(nextStatus);
      setAuthKey("");
      setFeedback({
        tone: "success",
        message: nextStatus.connected
          ? "Tunnel conectado com sucesso."
          : "Comando enviado. Aguardando atualizacao do provider.",
      });
    } catch (error: any) {
      console.error("Error connecting tunnel:", error);
      setFeedback({
        tone: "error",
        message:
          error.response?.data?.error?.message ||
          error.message ||
          "Falha ao conectar o tunnel.",
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      setFeedback({
        tone: "loading",
        message: "Encerrando conexao do tunnel...",
      });

      const nextStatus = await tunnelService.disconnect();
      setStatus(nextStatus);
      setFeedback({
        tone: "success",
        message: "Tunnel desconectado.",
      });
    } catch (error: any) {
      console.error("Error disconnecting tunnel:", error);
      setFeedback({
        tone: "error",
        message:
          error.response?.data?.error?.message ||
          error.message ||
          "Falha ao desconectar o tunnel.",
      });
    }
  };

  if (loading && !status) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Carregando tunnel...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Shield size={18} color={Colors.primary} />
          <Text style={styles.headerEyebrow}>REMOTE_TUNNEL</Text>
          <View style={styles.headerLine} />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Tunnel</Text>
              <Text style={styles.heroSubtitle}>
                Monitore e controle o provider remoto em tempo real.
              </Text>
            </View>

            <View style={styles.liveBadge}>
              {wsConnected ? (
                <Wifi size={14} color={Colors.tertiary} />
              ) : (
                <WifiOff size={14} color={Colors.outline} />
              )}
              <Text style={styles.liveBadgeText}>
                {wsConnected ? "LIVE_WS" : "REST_ONLY"}
              </Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>ACTIVE_SERVER</Text>
              <Text style={styles.metricValue}>{server?.name ?? "NONE"}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>STATE</Text>
              <Text style={[styles.metricValue, { color: getStatusColor(status) }]}>
                {getStatusLabel(status)}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>PROVIDER</Text>
              <Text style={styles.metricValue}>
                {status?.provider?.toUpperCase() ?? "TAILSCALE"}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>UPDATED</Text>
              <Text style={styles.metricValue}>
                {formatUpdatedAt(status?.updatedAt ?? null)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ActionFeedbackBanner feedback={feedback} />

      {loadError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Tunnel unavailable</Text>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      ) : null}

      {wsError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>WebSocket</Text>
          <Text style={styles.errorText}>{wsError}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status</Text>
        <View style={styles.sectionCard}>
          <KeyValueRow label="BACKEND_STATE" value={status?.backendState ?? "Unknown"} />
          <KeyValueRow label="HOSTNAME" value={status?.hostname ?? "N/A"} />
          <KeyValueRow label="MAGIC_DNS" value={status?.magicDnsName ?? "N/A"} />
          <KeyValueRow label="TAILNET" value={status?.tailnet ?? "N/A"} />
          <KeyValueRow label="IP" value={status?.ip ?? "N/A"} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Control</Text>
        <View style={styles.sectionCard}>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>HOSTNAME</Text>
            <TextInput
              style={styles.input}
              value={hostname}
              onChangeText={setHostname}
              placeholder="container-manager"
              placeholderTextColor={Colors.textPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>AUTH_KEY</Text>
            <TextInput
              style={styles.input}
              value={authKey}
              onChangeText={setAuthKey}
              placeholder="tskey-auth-..."
              placeholderTextColor={Colors.textPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>AUTO_FILL_HOSTNAME_FROM_STATUS</Text>
            <Switch
              value={acceptStoredHostname}
              onValueChange={setAcceptStoredHostname}
              trackColor={{ false: Colors.outline, true: Colors.primaryContainer }}
            />
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.primaryButton, !server && styles.buttonDisabled]}
              onPress={() => void handleConnect()}
              disabled={!server}
            >
              <Text style={styles.primaryButtonText}>Connect</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, !server && styles.buttonDisabled]}
              onPress={() => void loadStatus(true)}
              disabled={!server}
            >
              <Text style={styles.secondaryButtonText}>Refresh</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dangerButton, !server && styles.buttonDisabled]}
              onPress={() => void handleDisconnect()}
              disabled={!server}
            >
              <Text style={styles.dangerButtonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Health</Text>
        <View style={styles.sectionCard}>
          {liveHealth.length === 0 ? (
            <Text style={styles.emptyText}>
              Nenhum alerta reportado pelo provider no momento.
            </Text>
          ) : (
            liveHealth.map((entry, index) => (
              <View key={`${entry}-${index}`} style={styles.healthRow}>
                <View style={styles.healthDot} />
                <Text style={styles.healthText}>{entry}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 15,
  },
  header: {
    gap: 12,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerEyebrow: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(65, 71, 82, 0.2)",
  },
  heroCard: {
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: Colors.outline,
    padding: 18,
    gap: 18,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    color: Colors.onSurface,
    fontSize: 28,
    fontWeight: "700",
  },
  heroSubtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outline,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  liveBadgeText: {
    color: Colors.onSurface,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    minWidth: "47%",
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outline,
    padding: 12,
    gap: 6,
  },
  metricLabel: {
    color: Colors.textSubtle,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
  metricValue: {
    color: Colors.onSurface,
    fontSize: 15,
    fontWeight: "700",
  },
  errorCard: {
    backgroundColor: "rgba(255, 180, 171, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 180, 171, 0.2)",
    padding: 14,
    gap: 6,
  },
  errorTitle: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  errorText: {
    color: Colors.onSurface,
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: "700",
  },
  sectionCard: {
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: Colors.outline,
    padding: 16,
    gap: 12,
  },
  keyValueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  keyLabel: {
    color: Colors.textSubtle,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  keyValue: {
    flex: 1,
    color: Colors.onSurface,
    fontSize: 13,
    textAlign: "right",
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    color: Colors.textSubtle,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
  input: {
    minHeight: 48,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outline,
    color: Colors.onSurface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outline,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 16,
  },
  switchLabel: {
    flex: 1,
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: "600",
  },
  actionsRow: {
    gap: 10,
  },
  primaryButton: {
    minHeight: 48,
    backgroundColor: Colors.primaryContainer,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: 48,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outline,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  dangerButton: {
    minHeight: 48,
    backgroundColor: "rgba(255, 180, 171, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 180, 171, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  dangerButtonText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  healthRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    backgroundColor: Colors.warning,
  },
  healthText: {
    flex: 1,
    color: Colors.onSurface,
    fontSize: 13,
    lineHeight: 18,
  },
});
