import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { ArrowLeft, Pause, Play, RotateCw, Square } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { containersService } from '../../services/containers.service';
import type { ContainerDetails, ContainerStats } from '../../types/container.types';

const monoFont = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

type ContainerAction = 'start' | 'stop' | 'restart' | 'pause' | 'unpause';

interface Props {
  containerId: string;
}

interface QuickAction {
  action: ContainerAction;
  label: string;
  tone: 'primary' | 'danger' | 'success';
}

function formatBytes(value: number): string {
  if (!value) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
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

function getStatusTone(state: string): string {
  if (state === 'running') {
    return Colors.success;
  }

  if (state === 'paused') {
    return Colors.warning;
  }

  return Colors.error;
}

function buildQuickActions(state: string): QuickAction[] {
  if (state === 'running') {
    return [
      { action: 'restart', label: 'Restart', tone: 'primary' },
      { action: 'pause', label: 'Pause', tone: 'primary' },
      { action: 'stop', label: 'Stop', tone: 'danger' },
    ];
  }

  if (state === 'paused') {
    return [
      { action: 'unpause', label: 'Resume', tone: 'success' },
      { action: 'stop', label: 'Stop', tone: 'danger' },
    ];
  }

  return [{ action: 'start', label: 'Start', tone: 'success' }];
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
      <Text style={[styles.infoValue, multiline && styles.infoValueMultiline]}>{value}</Text>
    </View>
  );
}

export default function ContainerDetailsScreen({ containerId }: Props) {
  const router = useRouter();
  const [details, setDetails] = useState<ContainerDetails | null>(null);
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<ContainerAction | null>(null);
  const [statsUnavailable, setStatsUnavailable] = useState(false);

  const loadData = useCallback(async (showSpinner: boolean) => {
    try {
      if (showSpinner) {
        setLoading(true);
      }

      const [detailsResult, statsResult] = await Promise.allSettled([
        containersService.get(containerId),
        containersService.getStats(containerId),
      ]);

      if (detailsResult.status === 'rejected') {
        throw detailsResult.reason;
      }

      setDetails(detailsResult.value);

      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value);
        setStatsUnavailable(false);
      } else {
        setStats(null);
        setStatsUnavailable(true);
      }
    } catch (error) {
      console.error('Error loading container details:', error);
      Alert.alert('Erro', 'Não foi possível carregar os detalhes do container');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [containerId]);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  const primaryName = details?.names[0] ?? 'Unnamed container';
  const quickActions = useMemo(
    () => buildQuickActions(details?.state ?? 'exited'),
    [details?.state]
  );

  const mappedPorts = useMemo(() => {
    if (!details?.hostConfig.portBindings) {
      return [];
    }

    return Object.entries(details.hostConfig.portBindings).flatMap(([containerPort, bindings]) => {
      if (!bindings?.length) {
        return [{ host: 'internal', container: containerPort }];
      }

      return bindings.map((binding) => ({
        host: `${binding.HostIp || '0.0.0.0'}:${binding.HostPort}`,
        container: containerPort,
      }));
    });
  }, [details?.hostConfig.portBindings]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(false);
  };

  const runAction = async (action: ContainerAction) => {
    try {
      setActionLoading(action);

      switch (action) {
        case 'start':
          await containersService.start(containerId);
          break;
        case 'stop':
          await containersService.stop(containerId);
          break;
        case 'restart':
          await containersService.restart(containerId);
          break;
        case 'pause':
          await containersService.pause(containerId);
          break;
        case 'unpause':
          await containersService.unpause(containerId);
          break;
      }

      await loadData(false);
      Alert.alert('Sucesso', `Ação "${action}" executada com sucesso`);
    } catch (error) {
      console.error(`Error executing ${action}:`, error);
      Alert.alert('Erro', `Falha ao executar "${action}" no container`);
    } finally {
      setActionLoading(null);
    }
  };

  const confirmAction = (action: ContainerAction) => {
    const destructive = action === 'stop' || action === 'restart';

    if (!destructive) {
      void runAction(action);
      return;
    }

    const message =
      action === 'restart'
        ? `Reiniciar ${primaryName}?`
        : `Parar ${primaryName}?`;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(message)) {
        void runAction(action);
      }
      return;
    }

    Alert.alert(
      action === 'restart' ? 'Reiniciar container' : 'Parar container',
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: action === 'restart' ? 'Reiniciar' : 'Parar',
          style: 'destructive',
          onPress: () => void runAction(action),
        },
      ]
    );
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
        <Text style={styles.loadingText}>Container não encontrado.</Text>
        <TouchableOpacity style={styles.backButtonStandalone} onPress={() => router.back()}>
          <Text style={styles.backButtonStandaloneText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={18} color={Colors.onSurface} />
        </TouchableOpacity>

        <View style={styles.headerBody}>
          <Text style={styles.eyebrow}>CONTAINER_INSPECT</Text>
          <Text style={styles.title}>{primaryName}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: getStatusTone(details.state) }]} />
            <Text style={styles.statusText}>{details.status}</Text>
            <Text style={styles.statusMeta}>ID {details.id.slice(0, 12)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.metricGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>STATE</Text>
            <Text style={styles.metricValue}>{details.state.toUpperCase()}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>AGE</Text>
            <Text style={styles.metricValue}>{formatAge(details.created)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>CPU</Text>
            <Text style={styles.metricValue}>{stats ? formatPercent(stats.cpuPercent) : '--'}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>MEM</Text>
            <Text style={styles.metricValue}>
              {stats ? formatPercent(stats.memoryPercent) : '--'}
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {quickActions.map((item) => (
            <TouchableOpacity
              key={item.action}
              style={[
                styles.actionButton,
                item.tone === 'danger' && styles.actionButtonDanger,
                item.tone === 'success' && styles.actionButtonSuccess,
              ]}
              onPress={() => confirmAction(item.action)}
              disabled={actionLoading !== null}
            >
              {actionLoading === item.action ? (
                <ActivityIndicator size="small" color={Colors.onSurface} />
              ) : (
                <>
                  {item.action === 'start' && <Play size={14} color={Colors.onSurface} />}
                  {item.action === 'stop' && <Square size={14} color={Colors.onSurface} />}
                  {item.action === 'restart' && <RotateCw size={14} color={Colors.onSurface} />}
                  {item.action === 'pause' && <Pause size={14} color={Colors.onSurface} />}
                  {item.action === 'unpause' && <Play size={14} color={Colors.onSurface} />}
                  <Text style={styles.actionButtonText}>{item.label}</Text>
                </>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Section title="Runtime">
        <KeyValue label="Imagem" value={details.image} multiline />
        <KeyValue label="Image ID" value={details.imageId.slice(0, 24)} />
        <KeyValue label="Comando" value={details.command || 'N/A'} multiline />
        <KeyValue label="Working Dir" value={details.config.workingDir || '/'} />
        <KeyValue label="Usuário" value={details.config.user || 'default'} />
        <KeyValue
          label="Restart Policy"
          value={details.hostConfig.restartPolicy?.Name || 'no'}
        />
      </Section>

      <Section title="Resource Stats">
        {stats ? (
          <>
            <KeyValue label="CPU" value={formatPercent(stats.cpuPercent)} />
            <KeyValue
              label="Memória"
              value={`${formatBytes(stats.memoryUsage)} / ${formatBytes(stats.memoryLimit)}`}
            />
            <KeyValue label="Rede RX" value={formatBytes(stats.netRx)} />
            <KeyValue label="Rede TX" value={formatBytes(stats.netTx)} />
            <KeyValue label="Disco Read" value={formatBytes(stats.blockRead)} />
            <KeyValue label="Disco Write" value={formatBytes(stats.blockWrite)} />
          </>
        ) : (
          <Text style={styles.emptySectionText}>
            {statsUnavailable
              ? 'Stats indisponíveis para o estado atual do container.'
              : 'Sem estatísticas carregadas.'}
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
          <Text style={styles.emptySectionText}>Nenhuma porta publicada.</Text>
        )}
      </Section>

      <Section title="Mounts">
        {details.mounts.length > 0 ? (
          details.mounts.map((mount) => (
            <View key={`${mount.destination}-${mount.source}`} style={styles.stackBlock}>
              <Text style={styles.stackTitle}>{mount.destination}</Text>
              <Text style={styles.stackValue}>{mount.source || 'anonymous volume'}</Text>
              <Text style={styles.stackMeta}>
                {mount.type} • {mount.rw ? 'rw' : 'ro'} • {mount.mode || 'default'}
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
          Object.entries(details.networkSettings.networks).map(([name, network]) => (
            <View key={name} style={styles.stackBlock}>
              <Text style={styles.stackTitle}>{name}</Text>
              <Text style={styles.stackValue}>IP {network.ipAddress || 'N/A'}</Text>
              <Text style={styles.stackMeta}>
                Gateway {network.gateway || 'N/A'} • MAC {network.macAddress || 'N/A'}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptySectionText}>Nenhuma rede conectada.</Text>
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
          <Text style={styles.emptySectionText}>Sem variáveis expostas.</Text>
        )}
      </Section>

      <Section title="Labels">
        {Object.keys(details.labels).length > 0 ? (
          Object.entries(details.labels).map(([key, value]) => (
            <KeyValue key={key} label={key} value={value} multiline />
          ))
        ) : (
          <Text style={styles.emptySectionText}>Nenhuma label configurada.</Text>
        )}
      </Section>
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
    paddingTop: 48,
    paddingBottom: 32,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.onSurface,
    fontSize: 14,
    textAlign: 'center',
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
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBody: {
    flex: 1,
    gap: 6,
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
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusText: {
    color: Colors.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  statusMeta: {
    color: Colors.outline,
    fontSize: 12,
    fontFamily: monoFont,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    gap: 16,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    minWidth: '47%',
    flexGrow: 1,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  metricLabel: {
    color: Colors.outline,
    fontSize: 11,
    fontFamily: monoFont,
    letterSpacing: 1.2,
  },
  metricValue: {
    color: Colors.onSurface,
    fontSize: 18,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primaryContainer,
    minWidth: 104,
    justifyContent: 'center',
  },
  actionButtonDanger: {
    backgroundColor: '#7f1d1d',
  },
  actionButtonSuccess: {
    backgroundColor: '#166534',
  },
  actionButtonText: {
    color: Colors.onSurface,
    fontWeight: '700',
    fontSize: 13,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: Colors.outline,
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
    color: Colors.outline,
    fontSize: 11,
    fontFamily: monoFont,
    letterSpacing: 1.1,
  },
  infoValue: {
    color: Colors.onSurface,
    fontSize: 14,
    fontWeight: '500',
  },
  infoValueMultiline: {
    lineHeight: 20,
  },
  emptySectionText: {
    color: Colors.secondary,
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
    fontWeight: '700',
  },
  stackValue: {
    color: Colors.secondary,
    fontSize: 13,
    fontFamily: monoFont,
  },
  stackMeta: {
    color: Colors.outline,
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
});
