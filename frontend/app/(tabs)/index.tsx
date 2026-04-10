import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  LogOut,
  Plus,
  Play,
  RotateCw,
  Search as SearchIcon,
  Settings,
  Square,
} from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../src/contexts/AuthContext";
import ActionFeedbackBanner from "../../src/components/ActionFeedbackBanner";
import { useContainerAction } from "../../src/hooks/useContainerAction";
import { useWebSocket } from "../../src/hooks/useWebSocket";
import { containersService } from "../../src/services/containers.service";
import { systemService } from "../../src/services/system.service";
import type { Container } from "../../src/types/container.types";
import type { SystemStats } from "../../src/types/system.types";

type QuickAction = "start" | "stop" | "restart";

function formatUptime(hours: number): string {
  if (hours < 24) {
    return `${hours}H`;
  }

  const days = Math.floor(hours / 24);
  const remainder = hours % 24;
  return `${days}D ${remainder}H`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const {
    clearFeedback,
    feedback,
    pendingAction,
    pendingContainerId,
    runAction,
  } = useContainerAction();

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasLoadedOnFocusRef = useRef(false);

  const loadData = useCallback(async (showSpinner: boolean) => {
    try {
      if (showSpinner) {
        setLoading(true);
      }

      setLoadError(null);

      let statsFailed = false;
      try {
        const statsData = await systemService.getStats();
        setStats(statsData);
      } catch (error) {
        console.error("Error loading dashboard stats:", error);
        setStats(null);
        statsFailed = true;
      }

      let containersFailed = false;
      try {
        const containersData = await containersService.list({ all: true });
        setContainers(containersData);
      } catch (error) {
        console.error("Error loading dashboard containers:", error);
        containersFailed = true;
      }

      if (statsFailed && containersFailed) {
        setLoadError("Falha ao carregar os dados do ambiente atual.");
      } else if (statsFailed) {
        setLoadError(
          "Metricas indisponiveis no momento. Exibindo containers carregados.",
        );
      } else if (containersFailed) {
        setLoadError("Falha ao carregar a lista de containers.");
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setLoadError("Falha ao carregar os dados do ambiente atual.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const showSpinner = !hasLoadedOnFocusRef.current;
      hasLoadedOnFocusRef.current = true;
      void loadData(showSpinner);
    }, [loadData]),
  );

  const { isConnected } = useWebSocket<SystemStats>(
    "/stats",
    (data) => {
      if (autoRefresh) {
        setStats(data);
      }
    },
    autoRefresh,
  );

  const filteredContainers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return containers;
    }

    return containers.filter(
      (container) =>
        container.names.some((name) => name.toLowerCase().includes(query)) ||
        container.image.toLowerCase().includes(query),
    );
  }, [containers, searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(false);
  }, [loadData]);

  const confirmAndLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const handleLogout = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm("Deseja realmente sair?")) {
        void confirmAndLogout();
      }
      return;
    }

    Alert.alert("Logout", "Deseja realmente sair?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: () => void confirmAndLogout(),
      },
    ]);
  };

  const executeQuickAction = async (
    containerId: string,
    action: QuickAction,
  ) => {
    await runAction({
      action,
      containerId,
      onCompleted: () => loadData(false),
    });
  };

  const confirmQuickAction = (
    containerId: string,
    containerName: string,
    action: QuickAction,
  ) => {
    clearFeedback();

    if (action === "start") {
      void executeQuickAction(containerId, action);
      return;
    }

    const title =
      action === "restart" ? "Reiniciar container" : "Parar container";
    const message =
      action === "restart"
        ? `Deseja reiniciar "${containerName}"?`
        : `Deseja parar "${containerName}"?`;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm(message)) {
        void executeQuickAction(containerId, action);
      }
      return;
    }

    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel" },
      {
        text: action === "restart" ? "Reiniciar" : "Parar",
        style: "destructive",
        onPress: () => void executeQuickAction(containerId, action),
      },
    ]);
  };

  const getStatusColor = (value: number): string => {
    if (value >= 90) {
      return Colors.error;
    }
    if (value >= 70) {
      return Colors.warning;
    }
    return Colors.success;
  };

  const getContainerStatusColor = (state: string): string => {
    if (state === "running") {
      return Colors.success;
    }
    if (state === "paused") {
      return Colors.warning;
    }
    return Colors.outline;
  };

  if (loading && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Carregando ambiente...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Container Manager</Text>
          <Text style={styles.subtitle}>
            {stats
              ? `SYSTEM_STATUS // RUNNING ${String(
                  stats.containers.running,
                ).padStart(2, "0")}`
              : "SYSTEM_STATUS // OFFLINE"}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push("/container/create" as any)}
          >
            <Plus size={20} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleLogout}>
            <LogOut size={20} color={Colors.outline} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push("/(tabs)/servers")}
          >
            <Settings size={20} color={Colors.outline} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <SearchIcon
            size={16}
            color={Colors.outline}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome ou imagem..."
            placeholderTextColor={Colors.outline}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {loadError ? (
          <View style={styles.loadErrorCard}>
            <Text style={styles.loadErrorText}>{loadError}</Text>
          </View>
        ) : null}

        {stats ? (
          <>
            <View style={styles.autoRefreshContainer}>
              <Text style={styles.autoRefreshLabel}>
                Atualização automática
              </Text>
              <Switch
                value={autoRefresh}
                onValueChange={setAutoRefresh}
                trackColor={{ false: "#374151", true: Colors.primary }}
                thumbColor="#fff"
              />
              {isConnected && autoRefresh ? (
                <View style={styles.connectedDot} />
              ) : null}
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>CPU</Text>
                <View style={styles.statValueContainer}>
                  <Text
                    style={[
                      styles.statValue,
                      { color: getStatusColor(stats.cpu) },
                    ]}
                  >
                    {stats.cpu.toFixed(1)}
                  </Text>
                  <Text style={styles.statUnit}>%</Text>
                </View>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>MEMORY</Text>
                <View style={styles.statValueContainer}>
                  <Text
                    style={[
                      styles.statValue,
                      { color: getStatusColor(stats.memory) },
                    ]}
                  >
                    {stats.memory.toFixed(0)}
                  </Text>
                  <Text style={styles.statUnit}>%</Text>
                </View>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>DISK</Text>
                <View style={styles.statValueContainer}>
                  <Text
                    style={[
                      styles.statValue,
                      { color: getStatusColor(stats.disk) },
                    ]}
                  >
                    {stats.disk.toFixed(0)}
                  </Text>
                  <Text style={styles.statUnit}>%</Text>
                </View>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>UPTIME</Text>
                <View style={styles.statValueContainer}>
                  <Text style={[styles.statValue, { color: Colors.onSurface }]}>
                    {formatUptime(Math.floor(stats.uptime / 3600))}
                  </Text>
                </View>
              </View>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ACTIVE RUNTIME INSTANCES</Text>
          <Text style={styles.sectionHint}>
            {filteredContainers.length} exibidos
          </Text>
        </View>

        <ActionFeedbackBanner feedback={feedback} />

        {filteredContainers.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum container encontrado.</Text>
        ) : (
          filteredContainers.map((container) => {
            const name =
              container.names[0]?.replace(/^\//, "") || "Unnamed container";
            const isPending = pendingContainerId === container.id;

            return (
              <TouchableOpacity
                key={container.id}
                style={[
                  styles.card,
                  container.state === "running"
                    ? styles.cardRunning
                    : styles.cardStopped,
                ]}
                activeOpacity={0.9}
                onPress={() => router.push(`/container/${container.id}`)}
              >
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: getContainerStatusColor(
                          container.state,
                        ),
                      },
                    ]}
                  />

                  <View style={styles.cardHeaderBody}>
                    <Text style={styles.cardTitle}>{name}</Text>
                    <Text style={styles.cardId}>
                      ID {container.id.substring(0, 12)}
                    </Text>
                  </View>

                  <View style={styles.detailsBadge}>
                    <Text style={styles.detailsBadgeText}>DETAILS</Text>
                  </View>
                </View>

                <View style={styles.cardMetrics}>
                  <Text style={styles.cardMetric}>
                    Image: {container.image}
                  </Text>
                  <Text style={styles.cardMetric}>
                    State: {container.status}
                  </Text>
                </View>

                <View style={styles.cardActions}>
                  {container.state === "running" ? (
                    <>
                      <TouchableOpacity
                        style={styles.actionButton}
                        disabled={pendingAction !== null}
                        onPress={() =>
                          confirmQuickAction(container.id, name, "restart")
                        }
                      >
                        {isPending && pendingAction === "restart" ? (
                          <ActivityIndicator
                            size="small"
                            color={Colors.primary}
                          />
                        ) : (
                          <RotateCw size={16} color={Colors.primary} />
                        )}
                        <Text style={styles.actionButtonText}>Restart</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionButton}
                        disabled={pendingAction !== null}
                        onPress={() =>
                          confirmQuickAction(container.id, name, "stop")
                        }
                      >
                        {isPending && pendingAction === "stop" ? (
                          <ActivityIndicator
                            size="small"
                            color={Colors.error}
                          />
                        ) : (
                          <Square size={16} color={Colors.error} />
                        )}
                        <Text style={styles.actionButtonText}>Stop</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={styles.actionButton}
                      disabled={pendingAction !== null}
                      onPress={() =>
                        confirmQuickAction(container.id, name, "start")
                      }
                    >
                      {isPending && pendingAction === "start" ? (
                        <ActivityIndicator
                          size="small"
                          color={Colors.success}
                        />
                      ) : (
                        <Play size={16} color={Colors.success} />
                      )}
                      <Text style={styles.actionButtonText}>Start</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
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
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.onSurface,
    fontSize: 14,
  },
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    gap: 12,
  },
  titleContainer: {
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.onSurface,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: Colors.textSubtle,
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  headerActions: {
    position: "absolute",
    top: 48,
    right: 16,
    flexDirection: "row",
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.surfaceVariant,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.onSurface,
    fontSize: 14,
  },
  loadErrorCard: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255, 180, 171, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 180, 171, 0.2)",
  },
  loadErrorText: {
    color: Colors.error,
    fontSize: 13,
  },
  autoRefreshContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  autoRefreshLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 8,
    padding: 12,
  },
  statLabel: {
    fontSize: 9,
    color: Colors.textSubtle,
    fontFamily: "monospace",
    letterSpacing: 1,
    marginBottom: 8,
  },
  statValueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  statUnit: {
    fontSize: 10,
    color: Colors.textMuted,
    marginLeft: 2,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 11,
    color: Colors.textSubtle,
    fontFamily: "monospace",
    letterSpacing: 1.5,
  },
  sectionHint: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  emptyText: {
    textAlign: "center",
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 24,
  },
  card: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 3,
    gap: 14,
  },
  cardRunning: {
    borderLeftColor: Colors.success,
  },
  cardStopped: {
    borderLeftColor: Colors.outline,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardHeaderBody: {
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.onSurface,
    marginBottom: 2,
  },
  cardId: {
    fontSize: 11,
    color: Colors.textSubtle,
    fontFamily: "monospace",
  },
  detailsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.surface,
  },
  detailsBadgeText: {
    color: Colors.primary,
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 1.1,
  },
  cardMetrics: {
    gap: 4,
  },
  cardMetric: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  actionButtonText: {
    fontSize: 12,
    color: Colors.onSurface,
    fontWeight: "500",
  },
});
