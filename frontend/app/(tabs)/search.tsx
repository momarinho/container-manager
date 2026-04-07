import React, {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ExternalLink,
  Search as SearchIcon,
  Server,
} from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { containersService } from "../../src/services/containers.service";
import type { Container } from "../../src/types/container.types";

type StatusFilter = "all" | "running" | "exited" | "paused";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "ALL" },
  { value: "running", label: "RUNNING" },
  { value: "exited", label: "STOPPED" },
  { value: "paused", label: "PAUSED" },
];

const STATUS_COLORS: Record<string, string> = {
  running: Colors.tertiary,
  paused: Colors.warning,
  exited: Colors.outline,
  created: Colors.primary,
};

function formatRelativeAge(created: number): string {
  const createdAt = created * 1000;
  const diffMs = Date.now() - createdAt;
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));

  if (diffHours < 1) {
    const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `${diffMinutes}m ago`;
  }

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const days = Math.floor(diffHours / 24);
  const hours = diffHours % 24;
  return hours > 0 ? `${days}d ${hours}h ago` : `${days}d ago`;
}

function getPrimaryName(container: Container): string {
  return container.names[0]?.replace(/^\//, "") || container.id.slice(0, 12);
}

export default function SearchScreen() {
  const router = useRouter();
  const hasLoadedOnFocusRef = useRef(false);

  const [containers, setContainers] = useState<Container[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const loadContainers = useCallback(async (showSpinner: boolean) => {
    try {
      if (showSpinner) {
        setLoading(true);
      }

      setError(null);
      const data = await containersService.list({ all: true });
      setContainers(data);
    } catch (loadError) {
      console.error("Error loading search data:", loadError);
      setError("Nao foi possivel carregar os containers.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const showSpinner = !hasLoadedOnFocusRef.current;
      hasLoadedOnFocusRef.current = true;
      void loadContainers(showSpinner);
    }, [loadContainers]),
  );

  const filteredContainers = useMemo(() => {
    return containers.filter((container) => {
      const matchesStatus =
        statusFilter === "all" || container.state === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!deferredQuery) {
        return true;
      }

      const primaryName = getPrimaryName(container).toLowerCase();
      const names = container.names.join(" ").toLowerCase();
      const image = container.image.toLowerCase();
      const status = container.status.toLowerCase();
      const state = container.state.toLowerCase();

      return (
        primaryName.includes(deferredQuery) ||
        names.includes(deferredQuery) ||
        image.includes(deferredQuery) ||
        status.includes(deferredQuery) ||
        state.includes(deferredQuery)
      );
    });
  }, [containers, deferredQuery, statusFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadContainers(false);
  };

  const openContainer = (containerId: string) => {
    router.push(`/container/${containerId}`);
  };

  const summaryLabel =
    filteredContainers.length === 1
      ? "1 RESULT"
      : `${filteredContainers.length} RESULTS`;

  if (loading && containers.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Carregando indice de containers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>COMMAND_QUERY</Text>
          <View style={styles.headerLine} />
        </View>

        <View style={styles.searchWrapper}>
          <SearchIcon
            style={styles.searchIcon}
            color={Colors.textPlaceholder}
            size={20}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search containers by name, image or state"
            placeholderTextColor={Colors.textPlaceholder}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {STATUS_OPTIONS.map((option) => {
            const selected = option.value === statusFilter;

            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterChip,
                  selected && styles.filterChipActive,
                ]}
                onPress={() => setStatusFilter(option.value)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selected && styles.filterChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>{summaryLabel}</Text>
          <Text style={styles.summaryHint}>LIVE CONTAINER INDEX</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {error ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>Search unavailable</Text>
            <Text style={styles.messageText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => void loadContainers(true)}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!error && filteredContainers.length === 0 ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>No matching containers</Text>
            <Text style={styles.messageText}>
              Ajuste a busca ou troque o filtro de status para ampliar os
              resultados.
            </Text>
          </View>
        ) : null}

        <View style={styles.resultsContainer}>
          {filteredContainers.map((container) => {
            const primaryName = getPrimaryName(container);
            const statusColor = STATUS_COLORS[container.state] || Colors.primary;

            return (
              <TouchableOpacity
                key={container.id}
                style={styles.resultCard}
                onPress={() => openContainer(container.id)}
              >
                <View
                  style={[styles.cardAccent, { backgroundColor: statusColor }]}
                />

                <View style={styles.cardContent}>
                  <View style={styles.iconBox}>
                    <Server color={statusColor} size={22} />
                  </View>

                  <View style={styles.infoCol}>
                    <View style={styles.titleRow}>
                      <Text style={styles.title}>{primaryName}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: `${statusColor}1A` },
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: statusColor },
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusText,
                            { color: statusColor },
                          ]}
                        >
                          {container.state.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.subtitle}>{container.image}</Text>
                    <Text style={styles.metaText}>
                      ID {container.id.slice(0, 12)} • Created{" "}
                      {formatRelativeAge(container.created)} •{" "}
                      {container.ports.length} port
                      {container.ports.length === 1 ? "" : "s"}
                    </Text>
                  </View>

                  <ExternalLink color={Colors.primary} size={18} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 48,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  header: {
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 20,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 2,
    color: Colors.primary,
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(65, 71, 82, 0.2)",
  },
  searchWrapper: {
    position: "relative",
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  searchIcon: {
    position: "absolute",
    left: 18,
    top: 18,
    zIndex: 1,
  },
  searchInput: {
    paddingVertical: 16,
    paddingLeft: 52,
    paddingRight: 20,
    fontSize: 16,
    color: Colors.onSurface,
  },
  filterRow: {
    gap: 10,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1.2,
  },
  filterChipTextActive: {
    color: Colors.background,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryText: {
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1.2,
  },
  summaryHint: {
    color: Colors.textSubtle,
    fontSize: 11,
    letterSpacing: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 16,
  },
  resultsContainer: {
    gap: 14,
  },
  resultCard: {
    backgroundColor: Colors.surfaceLow,
    padding: 18,
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(65, 71, 82, 0.18)",
  },
  cardAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 4,
    height: "100%",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(65, 71, 82, 0.18)",
  },
  infoCol: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 17,
    fontWeight: "bold",
    color: Colors.onSurface,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  metaText: {
    fontSize: 11,
    color: Colors.textSubtle,
    fontFamily: "monospace",
  },
  messageCard: {
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: Colors.outline,
    padding: 20,
    gap: 8,
  },
  messageTitle: {
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: "bold",
  },
  messageText: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: Colors.background,
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1,
  },
});
