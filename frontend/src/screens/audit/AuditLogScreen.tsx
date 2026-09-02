import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Shield,
  ArrowLeft,
  RefreshCw,
  Search,
  Play,
  Square,
  Terminal,
  Trash2,
  PlusCircle,
  Code,
  CheckCircle,
  AlertCircle,
  User,
  Globe,
} from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { useAuditLogsQuery } from '../../hooks/queries';
import type { AuditLogEntry } from '../../types/audit.types';

const monoFont = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const ACTION_FILTERS = [
  { label: 'Todos', value: '' },
  { label: 'Start', value: 'CONTAINER_START' },
  { label: 'Stop', value: 'CONTAINER_STOP' },
  { label: 'Terminal', value: 'TERMINAL_SESSION_START' },
  { label: 'Exec', value: 'CONTAINER_EXEC' },
  { label: 'Create', value: 'CONTAINER_CREATE' },
  { label: 'Delete', value: 'CONTAINER_DELETE' },
];

function formatTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export default function AuditLogScreen() {
  const router = useRouter();
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const {
    data: logs = [],
    isLoading: loading,
    refetch,
  } = useAuditLogsQuery(selectedAction ? { action: selectedAction, limit: 150 } : { limit: 150 });

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (log) =>
        log.username.toLowerCase().includes(q) ||
        log.resourceId.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.clientIp.toLowerCase().includes(q)
    );
  }, [logs, searchQuery]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CONTAINER_START':
        return {
          icon: <Play size={12} color={Colors.success} />,
          bg: 'rgba(74, 222, 128, 0.15)',
          color: Colors.success,
          label: 'Start Container',
        };
      case 'CONTAINER_STOP':
        return {
          icon: <Square size={12} color={Colors.error} />,
          bg: 'rgba(239, 68, 68, 0.15)',
          color: Colors.error,
          label: 'Stop Container',
        };
      case 'TERMINAL_SESSION_START':
        return {
          icon: <Terminal size={12} color={Colors.primary} />,
          bg: 'rgba(162, 201, 255, 0.15)',
          color: Colors.primary,
          label: 'Sessão Terminal',
        };
      case 'CONTAINER_EXEC':
        return {
          icon: <Code size={12} color={Colors.warning} />,
          bg: 'rgba(245, 158, 11, 0.15)',
          color: Colors.warning,
          label: 'Executar Comando',
        };
      case 'CONTAINER_CREATE':
        return {
          icon: <PlusCircle size={12} color={Colors.primaryContainer} />,
          bg: 'rgba(88, 166, 255, 0.15)',
          color: Colors.primaryContainer,
          label: 'Criar Container',
        };
      case 'CONTAINER_DELETE':
        return {
          icon: <Trash2 size={12} color={Colors.error} />,
          bg: 'rgba(239, 68, 68, 0.15)',
          color: Colors.error,
          label: 'Remover Container',
        };
      default:
        return {
          icon: <Shield size={12} color={Colors.textMuted} />,
          bg: 'rgba(148, 163, 184, 0.15)',
          color: Colors.textMuted,
          label: action,
        };
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <ArrowLeft size={22} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Trilha de Auditoria (Audit Trail)</Text>
          <Text style={styles.subtitle}>Registro imutável de ações operacionais</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={() => refetch()} disabled={loading}>
          <RefreshCw size={18} color={Colors.onSurface} />
        </TouchableOpacity>
      </View>

      {/* Barra de Busca */}
      <View style={styles.searchBarRow}>
        <Search size={16} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Filtrar por usuário, ID de container ou IP..."
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
        />
      </View>

      {/* Chips de Ação */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filtersRow}>
          {ACTION_FILTERS.map((f) => {
            const isActive = selectedAction === f.value;
            return (
              <TouchableOpacity
                key={f.label}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedAction(f.value)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Lista de Registros de Auditoria */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Eventos Registrados ({filteredLogs.length})</Text>
      </View>

      {loading && logs.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Carregando trilha de auditoria...</Text>
        </View>
      ) : filteredLogs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Shield size={36} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Nenhum evento encontrado</Text>
          <Text style={styles.emptySubtitle}>
            Ações como paradas de container e comandos executados aparecerão aqui automaticamente.
          </Text>
        </View>
      ) : (
        filteredLogs.map((item: AuditLogEntry) => {
          const badge = getActionBadge(item.action);
          const isSuccess = item.status === 'SUCCESS';

          return (
            <View key={item.id} style={styles.logCard}>
              <View style={styles.logCardHeader}>
                <View style={[styles.actionBadge, { backgroundColor: badge.bg }]}>
                  {badge.icon}
                  <Text style={[styles.actionBadgeText, { color: badge.color }]}>{badge.label}</Text>
                </View>
                <Text style={styles.timestampText}>{formatTimestamp(item.timestamp)}</Text>
              </View>

              <View style={styles.logBody}>
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <User size={13} color={Colors.secondary} />
                    <Text style={styles.metaText}>{item.username}</Text>
                  </View>

                  <View style={styles.metaItem}>
                    <Globe size={13} color={Colors.textMuted} />
                    <Text style={styles.metaTextMuted}>{item.clientIp}</Text>
                  </View>

                  <View style={styles.statusBadge}>
                    {isSuccess ? (
                      <CheckCircle size={12} color={Colors.success} />
                    ) : (
                      <AlertCircle size={12} color={Colors.error} />
                    )}
                    <Text
                      style={[
                        styles.statusText,
                        { color: isSuccess ? Colors.success : Colors.error },
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.resourceRow}>
                  <Text style={styles.resourceLabel}>Recurso ({item.resourceType}):</Text>
                  <Text style={styles.resourceValue}>{item.resourceId}</Text>
                </View>

                {item.details ? (
                  <View style={styles.detailsBox}>
                    <Text style={styles.detailsText}>{item.details}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  refreshButton: {
    padding: 8,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.onSurface,
    paddingVertical: 10,
    fontSize: 13,
  },
  filterScroll: {
    marginBottom: 16,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.surfaceVariant,
    borderColor: Colors.primary,
  },
  filterChipText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: Colors.textMuted,
    fontSize: 14,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    color: Colors.onSurface,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 10,
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  logCard: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timestampText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: monoFont,
  },
  logBody: {
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: '600',
  },
  metaTextMuted: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: monoFont,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  resourceLabel: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  resourceValue: {
    color: Colors.onSurface,
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: '600',
  },
  detailsBox: {
    backgroundColor: Colors.surfaceVariant,
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  detailsText: {
    color: Colors.secondary,
    fontSize: 11,
    fontFamily: monoFont,
    lineHeight: 16,
  },
});
