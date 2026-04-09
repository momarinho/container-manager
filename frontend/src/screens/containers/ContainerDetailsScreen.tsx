import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Pause,
  Play,
  RotateCw,
  Square,
  X,
} from "lucide-react-native";
import { Colors } from "../../../constants/Colors";
import ActionFeedbackBanner from "../../components/ActionFeedbackBanner";
import { useContainerAction } from "../../hooks/useContainerAction";
import { useWebSocket } from "../../hooks/useWebSocket";
import { containersService } from "../../services/containers.service";
import type { ContainerDetails, ContainerStats } from "../../types/container.types";

const monoFont = Platform.OS === "ios" ? "Menlo" : "monospace";

type ContainerAction = "start" | "stop" | "restart" | "pause" | "unpause";
type ContainerView = "overview" | "logs" | "actions";

interface Props {
  containerId: string;
}

interface QuickAction {
  action: ContainerAction;
  label: string;
  tone: "primary" | "danger" | "success";
  description: string;
}

function formatBytes(value: number): string {
  if (!value) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const size = value / 1024 ** exponent;

  return `${size.toFixed(size >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatAge(createdAt: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - createdAt);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatUptime(status: string, state: string): string {
  if (state !== "running" && state !== "paused") {
    return "Stopped";
  }

  const cleanedStatus = status.replace(/^Up\s+/i, "");
  return cleanedStatus || "Running";
}

function getStatusTone(state: string): string {
  if (state === "running") {
    return Colors.success;
  }

  if (state === "paused") {
    return Colors.warning;
  }

  return Colors.error;
}

function buildQuickActions(state: string): QuickAction[] {
  if (state === "running") {
    return [
      {
        action: "restart",
        label: "Restart",
        tone: "primary",
        description: "Reinicia o processo principal e sincroniza o estado na volta.",
      },
      {
        action: "pause",
        label: "Pause",
        tone: "primary",
        description: "Congela a execução sem parar o container.",
      },
      {
        action: "stop",
        label: "Stop",
        tone: "danger",
        description: "Encerra o container e atualiza o dashboard ao voltar.",
      },
    ];
  }

  if (state === "paused") {
    return [
      {
        action: "unpause",
        label: "Resume",
        tone: "success",
        description: "Retoma a execução do container pausado.",
      },
      {
        action: "stop",
        label: "Stop",
        tone: "danger",
        description: "Encerra o container a partir do estado pausado.",
      },
    ];
  }

  return [
    {
      action: "start",
      label: "Start",
      tone: "success",
      description: "Inicia o container e recarrega as métricas logo em seguida.",
    },
  ];
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function KeyValue({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, multiline && styles.infoValueMultiline]}>
        {value}
      </Text>
    </View>
  );
}

export default function ContainerDetailsScreen({ containerId }: Props) {
  const router = useRouter();
  const {
    clearFeedback,
    feedback,
    pendingAction,
    runAction,
  } = useContainerAction();

  const [details, setDetails] = useState<ContainerDetails | null>(null);
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statsUnavailable, setStatsUnavailable] = useState(false);
  const [activeView, setActiveView] = useState<ContainerView>("overview");
  const [logLines, setLogLines] = useState<string[]>([]);

  const loadData = useCallback(
    async (showSpinner: boolean) => {
      try {
        if (showSpinner) {
          setLoading(true);
        }

        setLoadError(null);
        setStats(null);
        setStatsUnavailable(false);

        const detailsResult = await containersService.get(containerId);
        setDetails(detailsResult);
        setLoading(false);

        try {
          const statsResult = await containersService.getStats(containerId);
          setStats(statsResult);
        } catch (statsError) {
          console.error("Error loading container stats:", statsError);
          setStatsUnavailable(true);
        }
      } catch (error) {
        console.error("Error loading container details:", error);
        setDetails(null);
        setLoadError("Nao foi possivel carregar os detalhes do container.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [containerId],
  );

  useEffect(() => {
    if (!containerId) {
      setLoadError("Container invalido.");
      setLoading(false);
      return;
    }

    void loadData(true);
  }, [containerId, loadData]);

  useEffect(() => {
    setLogLines([]);
  }, [containerId]);

  const logsEnabled = Boolean(containerId) && activeView === "logs";
  const { isConnected: logsConnected, error: logsError } = useWebSocket<string>(
    `/logs/${containerId}`,
    (chunk) => {
      const lines = chunk
        .replace(/\u0000/g, "")
        .split(/\r?\n/)
        .filter((line) => line.length > 0);

      if (lines.length === 0) {
        return;
      }

      setLogLines((current) => [...current, ...lines].slice(-200));
    },
    logsEnabled,
  );

  const primaryName = details?.names[0]?.replace(/^\//, "") || "Unnamed container";
  const quickActions = useMemo(
    () => buildQuickActions(details?.state ?? "exited"),
    [details?.state],
  );

  const mappedPorts = useMemo(() => {
    if (!details?.hostConfig.portBindings) {
      return [];
    }

    return Object.entries(details.hostConfig.portBindings).flatMap(
      ([containerPort, bindings]) => {
        if (!bindings?.length) {
          return [{ host: "internal", container: containerPort }];
        }

        return bindings.map((binding) => ({
          host: `${binding.HostIp || "0.0.0.0"}:${binding.HostPort}`,
          container: containerPort,
        }));
      },
    );
  }, [details?.hostConfig.portBindings]);

  const handleRefresh = async () => {
    clearFeedback();
    setRefreshing(true);
    await loadData(false);
  };

  const performAction = async (action: ContainerAction) => {
    await runAction({
      action,
      containerId,
      onCompleted: () => loadData(false),
    });
  };

  const confirmAction = (action: ContainerAction) => {
    clearFeedback();

    const needsConfirmation = action === "stop" || action === "restart";

    if (!needsConfirmation) {
      void performAction(action);
      return;
    }

    const title = action === "restart" ? "Reiniciar container" : "Parar container";
    const message =
      action === "restart"
        ? `Deseja reiniciar "${primaryName}"?`
        : `Deseja parar "${primaryName}"?`;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm(message)) {
        void performAction(action);
      }
      return;
    }

    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel" },
      {
        text: action === "restart" ? "Reiniciar" : "Parar",
        style: "destructive",
        onPress: () => void performAction(action),
      },
    ]);
  };

  if (loading && !details) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Carregando container...</Text>
      </View>
    );
  }

  if (!details) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>
          {loadError || "Container nao encontrado."}
        </Text>
        <TouchableOpacity
          style={styles.backButtonStandalone}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonStandaloneText}>Fechar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerBody}>
            <Text style={styles.eyebrow}>CONTAINER_DETAIL</Text>
            <Text style={styles.title}>{primaryName}</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: getStatusTone(details.state) },
                ]}
              />
              <Text style={styles.statusText}>{details.status}</Text>
              <Text style={styles.statusMeta}>ID {details.id.slice(0, 12)}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <X size={18} color={Colors.onSurface} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.metricGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>STATE</Text>
              <Text style={styles.metricValue}>{details.state.toUpperCase()}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>UPTIME</Text>
              <Text style={styles.metricValue}>
                {formatUptime(details.status, details.state)}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>PORTS</Text>
              <Text style={styles.metricValue}>{String(mappedPorts.length)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>VOLUMES</Text>
              <Text style={styles.metricValue}>{String(details.mounts.length)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>CPU</Text>
              <Text style={styles.metricValue}>
                {stats ? formatPercent(stats.cpuPercent) : "--"}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>MEM</Text>
              <Text style={styles.metricValue}>
                {stats ? formatPercent(stats.memoryPercent) : "--"}
              </Text>
            </View>
          </View>

          <ActionFeedbackBanner feedback={feedback} />

          {loadError ? (
            <View style={styles.loadErrorCard}>
              <Text style={styles.loadErrorText}>{loadError}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.tabBar}>
        {(["overview", "logs", "actions"] as ContainerView[]).map((view) => (
          <TouchableOpacity
            key={view}
            style={[styles.tabButton, activeView === view && styles.tabButtonActive]}
            onPress={() => setActiveView(view)}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeView === view && styles.tabButtonTextActive,
              ]}
            >
              {view === "overview"
                ? "Overview"
                : view === "logs"
                  ? "Logs"
                  : "Actions"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeView === "overview" ? (
        <>
          <Section title="Runtime">
            <KeyValue label="Imagem" value={details.image} multiline />
            <KeyValue label="Image ID" value={details.imageId.slice(0, 24)} />
            <KeyValue label="Estado" value={details.status} multiline />
            <KeyValue label="Criado ha" value={formatAge(details.created)} />
            <KeyValue label="Comando" value={details.command || "N/A"} multiline />
            <KeyValue
              label="Working Dir"
              value={details.config.workingDir || "/"}
            />
            <KeyValue label="Usuario" value={details.config.user || "default"} />
            <KeyValue
              label="Restart Policy"
              value={details.hostConfig.restartPolicy?.Name || "no"}
            />
          </Section>

          <Section title="Resource Stats">
            {stats ? (
              <>
                <KeyValue label="CPU" value={formatPercent(stats.cpuPercent)} />
                <KeyValue
                  label="Memoria"
                  value={`${formatBytes(stats.memoryUsage)} / ${formatBytes(
                    stats.memoryLimit,
                  )}`}
                />
                <KeyValue label="Rede RX" value={formatBytes(stats.netRx)} />
                <KeyValue label="Rede TX" value={formatBytes(stats.netTx)} />
                <KeyValue label="Disco Read" value={formatBytes(stats.blockRead)} />
                <KeyValue
                  label="Disco Write"
                  value={formatBytes(stats.blockWrite)}
                />
              </>
            ) : (
              <Text style={styles.emptySectionText}>
                {statsUnavailable
                  ? "Stats indisponiveis para o estado atual do container."
                  : "Sem estatisticas carregadas."}
              </Text>
            )}
          </Section>

          <Section title="Ports">
            {mappedPorts.length > 0 ? (
              mappedPorts.map((port) => (
                <KeyValue
                  key={`${port.host}-${port.container}`}
                  label={port.host}
                  value={port.container}
                />
              ))
            ) : (
              <Text style={styles.emptySectionText}>
                Nenhuma porta publicada.
              </Text>
            )}
          </Section>

          <Section title="Volumes">
            {details.mounts.length > 0 ? (
              details.mounts.map((mount) => (
                <View
                  key={`${mount.destination}-${mount.source || "anonymous"}`}
                  style={styles.stackBlock}
                >
                  <Text style={styles.stackTitle}>{mount.destination}</Text>
                  <Text style={styles.stackValue}>
                    {mount.source || "anonymous volume"}
                  </Text>
                  <Text style={styles.stackMeta}>
                    {mount.type} • {mount.rw ? "rw" : "ro"} •{" "}
                    {mount.mode || "default"}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptySectionText}>Nenhum volume montado.</Text>
            )}
          </Section>

          <Section title="Networks">
            {details.networkSettings.networks &&
            Object.keys(details.networkSettings.networks).length > 0 ? (
              Object.entries(details.networkSettings.networks).map(
                ([name, network]) => (
                  <View key={name} style={styles.stackBlock}>
                    <Text style={styles.stackTitle}>{name}</Text>
                    <Text style={styles.stackValue}>
                      IP {network.ipAddress || "N/A"}
                    </Text>
                    <Text style={styles.stackMeta}>
                      Gateway {network.gateway || "N/A"} • MAC{" "}
                      {network.macAddress || "N/A"}
                    </Text>
                  </View>
                ),
              )
            ) : (
              <Text style={styles.emptySectionText}>
                Nenhuma rede conectada.
              </Text>
            )}
          </Section>

          <Section title="Environment">
            {details.config.env && details.config.env.length > 0 ? (
              details.config.env.map((entry) => (
                <Text key={entry} style={styles.codeLine}>
                  {entry}
                </Text>
              ))
            ) : (
              <Text style={styles.emptySectionText}>
                Sem variaveis expostas.
              </Text>
            )}
          </Section>

          <Section title="Labels">
            {Object.keys(details.labels).length > 0 ? (
              Object.entries(details.labels).map(([key, value]) => (
                <KeyValue key={key} label={key} value={value} multiline />
              ))
            ) : (
              <Text style={styles.emptySectionText}>
                Nenhuma label configurada.
              </Text>
            )}
          </Section>
        </>
      ) : null}

      {activeView === "logs" ? (
        <Section title="Live Logs">
          <View style={styles.logsHeader}>
            <View style={styles.logsStatusBadge}>
              <View
                style={[
                  styles.logsStatusDot,
                  {
                    backgroundColor: logsConnected
                      ? Colors.success
                      : Colors.outline,
                  },
                ]}
              />
              <Text style={styles.logsStatusText}>
                {logsConnected ? "STREAMING" : "WAITING_CONNECTION"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.logsClearButton}
              onPress={() => setLogLines([])}
            >
              <Text style={styles.logsClearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>

          {logsError ? (
            <Text style={styles.logsErrorText}>{logsError}</Text>
          ) : null}

          <View style={styles.logsPanel}>
            {logLines.length > 0 ? (
              logLines.map((line, index) => (
                <Text key={`${index}-${line}`} style={styles.logLine}>
                  {line}
                </Text>
              ))
            ) : (
              <Text style={styles.logsEmptyText}>
                {logsConnected
                  ? "Aguardando novas linhas de log..."
                  : "Abra esta aba para iniciar o stream e aguarde a conexao."}
              </Text>
            )}
          </View>
        </Section>
      ) : null}

      {activeView === "actions" ? (
        <Section title="Container Actions">
          {quickActions.map((item) => (
            <View key={item.action} style={styles.actionCard}>
              <View style={styles.actionCardCopy}>
                <Text style={styles.actionCardTitle}>{item.label}</Text>
                <Text style={styles.actionCardDescription}>
                  {item.description}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  item.tone === "danger" && styles.actionButtonDanger,
                  item.tone === "success" && styles.actionButtonSuccess,
                ]}
                onPress={() => confirmAction(item.action)}
                disabled={pendingAction !== null}
              >
                {pendingAction === item.action ? (
                  <ActivityIndicator size="small" color={Colors.onSurface} />
                ) : (
                  <>
                    {item.action === "start" ? (
                      <Play size={14} color={Colors.onSurface} />
                    ) : null}
                    {item.action === "stop" ? (
                      <Square size={14} color={Colors.onSurface} />
                    ) : null}
                    {item.action === "restart" ? (
                      <RotateCw size={14} color={Colors.onSurface} />
                    ) : null}
                    {item.action === "pause" ? (
                      <Pause size={14} color={Colors.onSurface} />
                    ) : null}
                    {item.action === "unpause" ? (
                      <Play size={14} color={Colors.onSurface} />
                    ) : null}
                    <Text style={styles.actionButtonText}>{item.label}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </Section>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 32,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.onSurface,
    fontSize: 14,
    textAlign: "center",
  },
  backButtonStandalone: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 10,
  },
  backButtonStandaloneText: {
    color: Colors.onSurface,
    fontWeight: "600",
  },
  header: {
    gap: 14,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  headerBody: {
    flex: 1,
    gap: 6,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  eyebrow: {
    color: Colors.primary,
    fontSize: 11,
    fontFamily: monoFont,
    letterSpacing: 1.5,
  },
  title: {
    color: Colors.onSurface,
    fontSize: 28,
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  statusMeta: {
    color: Colors.textSubtle,
    fontSize: 12,
    fontFamily: monoFont,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    minWidth: "47%",
    flexGrow: 1,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  metricLabel: {
    color: Colors.textSubtle,
    fontSize: 11,
    fontFamily: monoFont,
    letterSpacing: 1.2,
  },
  metricValue: {
    color: Colors.onSurface,
    fontSize: 18,
    fontWeight: "700",
  },
  loadErrorCard: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255, 180, 171, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 180, 171, 0.2)",
  },
  loadErrorText: {
    color: Colors.error,
    fontSize: 13,
  },
  tabBar: {
    flexDirection: "row",
    gap: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
  },
  tabButtonActive: {
    backgroundColor: Colors.primaryContainer,
  },
  tabButtonText: {
    color: Colors.textMuted,
    fontWeight: "600",
    fontSize: 13,
  },
  tabButtonTextActive: {
    color: Colors.onSurface,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: Colors.textSubtle,
    fontSize: 11,
    fontFamily: monoFont,
    letterSpacing: 1.5,
    paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  infoRow: {
    gap: 4,
  },
  infoLabel: {
    color: Colors.textSubtle,
    fontSize: 11,
    fontFamily: monoFont,
    letterSpacing: 1.1,
  },
  infoValue: {
    color: Colors.onSurface,
    fontSize: 14,
    fontWeight: "500",
  },
  infoValueMultiline: {
    lineHeight: 20,
  },
  emptySectionText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  stackBlock: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.surfaceHigh,
    gap: 4,
  },
  stackTitle: {
    color: Colors.onSurface,
    fontSize: 14,
    fontWeight: "700",
  },
  stackValue: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: monoFont,
  },
  stackMeta: {
    color: Colors.textSubtle,
    fontSize: 12,
  },
  codeLine: {
    color: Colors.onSurface,
    fontSize: 13,
    fontFamily: monoFont,
    lineHeight: 20,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  logsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  logsStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logsStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  logsStatusText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: monoFont,
    letterSpacing: 1.1,
  },
  logsClearButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.surfaceHigh,
  },
  logsClearButtonText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  logsErrorText: {
    color: Colors.error,
    fontSize: 12,
  },
  logsPanel: {
    minHeight: 280,
    maxHeight: 420,
    borderRadius: 14,
    backgroundColor: "#0b0f14",
    padding: 14,
    gap: 8,
    overflow: "scroll",
  },
  logLine: {
    color: "#c9f1d5",
    fontSize: 12,
    fontFamily: monoFont,
    lineHeight: 18,
  },
  logsEmptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  actionCard: {
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surfaceHigh,
  },
  actionCardCopy: {
    gap: 6,
  },
  actionCardTitle: {
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: "700",
  },
  actionCardDescription: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primaryContainer,
    justifyContent: "center",
  },
  actionButtonDanger: {
    backgroundColor: "#7f1d1d",
  },
  actionButtonSuccess: {
    backgroundColor: "#166534",
  },
  actionButtonText: {
    color: Colors.onSurface,
    fontWeight: "700",
    fontSize: 13,
  },
});
