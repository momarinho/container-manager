import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Layers,
  Play,
  Square,
  Trash2,
  Plus,
  ArrowLeft,
  RefreshCw,
  FileCode,
  Terminal,
  X,
} from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { queryClient } from '../../config/queryClient';
import { useStacksQuery } from '../../hooks/queries';
import { stacksService } from '../../services/stacks.service';
import type { StackInfo } from '../../types/stack.types';

const monoFont = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function StackListScreen() {
  const router = useRouter();
  const { data: stacks = [], isLoading: loading, refetch } = useStacksQuery();

  const [activeActionStack, setActiveActionStack] = useState<string | null>(null);
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [selectedStackLogs, setSelectedStackLogs] = useState<{ name: string; logs: string } | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const handleUpStack = async (name: string) => {
    setActiveActionStack(name);
    try {
      await stacksService.upStack(name);
      void queryClient.invalidateQueries({ queryKey: ['stacks'] });
      void queryClient.invalidateQueries({ queryKey: ['containers'] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao iniciar stack';
      Alert.alert('Erro', msg);
    } finally {
      setActiveActionStack(null);
    }
  };

  const handleDownStack = async (name: string) => {
    setActiveActionStack(name);
    try {
      await stacksService.downStack(name);
      void queryClient.invalidateQueries({ queryKey: ['stacks'] });
      void queryClient.invalidateQueries({ queryKey: ['containers'] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao parar stack';
      Alert.alert('Erro', msg);
    } finally {
      setActiveActionStack(null);
    }
  };

  const handleDeleteStack = (name: string) => {
    Alert.alert(
      'Remover Stack',
      `Deseja realmente derrubar e remover a stack '${name}'?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setActiveActionStack(name);
            try {
              await stacksService.deleteStack(name);
              void queryClient.invalidateQueries({ queryKey: ['stacks'] });
              void queryClient.invalidateQueries({ queryKey: ['containers'] });
            } catch (error: unknown) {
              const msg = error instanceof Error ? error.message : 'Erro ao remover stack';
              Alert.alert('Erro', msg);
            } finally {
              setActiveActionStack(null);
            }
          },
        },
      ]
    );
  };

  const handleViewLogs = async (name: string) => {
    setSelectedStackLogs({ name, logs: '' });
    setLogsModalVisible(true);
    setLoadingLogs(true);
    try {
      const logs = await stacksService.getStackLogs(name, 150);
      setSelectedStackLogs({ name, logs: logs || 'Nenhum log gerado pela stack até o momento.' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao carregar logs';
      setSelectedStackLogs({ name, logs: `Erro ao buscar logs: ${msg}` });
    } finally {
      setLoadingLogs(false);
    }
  };

  const getStatusBadge = (status: StackInfo['status']) => {
    switch (status) {
      case 'running':
        return { label: 'Executando', bg: 'rgba(74, 222, 128, 0.15)', color: Colors.success };
      case 'partially_running':
        return { label: 'Parcial', bg: 'rgba(251, 191, 36, 0.15)', color: Colors.warning };
      case 'stopped':
      default:
        return { label: 'Parado', bg: 'rgba(148, 163, 184, 0.15)', color: Colors.textMuted };
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
          <Text style={styles.title}>Stacks (Docker Compose)</Text>
          <Text style={styles.subtitle}>Gerencie stacks multi-container</Text>
        </View>
        <TouchableOpacity
          style={styles.newButton}
          onPress={() => router.push('/stack-editor' as any)}
        >
          <Plus size={16} color={Colors.onPrimary} />
          <Text style={styles.newButtonText}>Nova</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de Stacks */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Layers size={18} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Stacks ({stacks.length})</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => refetch()}
          disabled={loading}
        >
          <RefreshCw size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {loading && stacks.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Carregando stacks...</Text>
        </View>
      ) : stacks.length === 0 ? (
        <View style={styles.emptyCard}>
          <Layers size={40} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Nenhuma stack encontrada</Text>
          <Text style={styles.emptySubtitle}>
            Crie uma nova stack colando um arquivo docker-compose.yml.
          </Text>
          <TouchableOpacity
            style={[styles.actionBtn, styles.primaryBtn, { marginTop: 14 }]}
            onPress={() => router.push('/stack-editor' as any)}
          >
            <Plus size={16} color={Colors.onPrimary} />
            <Text style={styles.primaryBtnText}>Criar Stack</Text>
          </TouchableOpacity>
        </View>
      ) : (
        stacks.map((stack) => {
          const badge = getStatusBadge(stack.status);
          const isBusy = activeActionStack === stack.name;

          return (
            <View key={stack.name} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.nameRow}>
                  <Text style={styles.stackName}>{stack.name}</Text>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>
              </View>

              {/* Informações dos serviços */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Serviços ({stack.servicesCount}):</Text>
                <View style={styles.chipsWrap}>
                  {stack.services.map((svc) => (
                    <View key={svc} style={styles.chip}>
                      <Text style={styles.chipText}>{svc}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Informações dos containers */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Containers ativos: </Text>
                <Text style={styles.infoValue}>
                  {stack.containers.filter((c) => c.state === 'running').length} / {stack.containersCount}
                </Text>
              </View>

              {/* Ações */}
              <View style={styles.actionsRow}>
                {stack.status === 'running' ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.stopBtn]}
                    onPress={() => handleDownStack(stack.name)}
                    disabled={isBusy}
                  >
                    {isBusy ? (
                      <ActivityIndicator size="small" color={Colors.error} />
                    ) : (
                      <>
                        <Square size={14} color={Colors.error} />
                        <Text style={styles.stopBtnText}>Parar</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.startBtn]}
                    onPress={() => handleUpStack(stack.name)}
                    disabled={isBusy}
                  >
                    {isBusy ? (
                      <ActivityIndicator size="small" color={Colors.success} />
                    ) : (
                      <>
                        <Play size={14} color={Colors.success} />
                        <Text style={styles.startBtnText}>Iniciar</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionBtn, styles.secondaryBtn]}
                  onPress={() => handleViewLogs(stack.name)}
                >
                  <Terminal size={14} color={Colors.onSurface} />
                  <Text style={styles.secondaryBtnText}>Logs</Text>
                </TouchableOpacity>

                {stack.hasComposeFile && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.secondaryBtn]}
                    onPress={() => router.push(`/stack-editor?name=${encodeURIComponent(stack.name)}` as any)}
                  >
                    <FileCode size={14} color={Colors.onSurface} />
                    <Text style={styles.secondaryBtnText}>YAML</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={() => handleDeleteStack(stack.name)}
                  disabled={isBusy}
                >
                  <Trash2 size={14} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* Modal de Logs Agrupados */}
      <Modal
        visible={logsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLogsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Terminal size={18} color={Colors.primary} />
                <Text style={styles.modalTitle}>Logs da Stack: {selectedStackLogs?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setLogsModalVisible(false)}>
                <X size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {loadingLogs ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Carregando logs da stack...</Text>
              </View>
            ) : (
              <ScrollView style={styles.logBox} contentContainerStyle={styles.logContent}>
                <Text style={styles.logText}>{selectedStackLogs?.logs}</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  newButtonText: {
    color: Colors.onPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  refreshButton: {
    padding: 6,
  },
  loadingContainer: {
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
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTop: {
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stackName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.onSurface,
    fontFamily: monoFont,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  infoRow: {
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 13,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: Colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipText: {
    color: Colors.secondary,
    fontSize: 12,
    fontFamily: monoFont,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    gap: 6,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
  },
  primaryBtnText: {
    color: Colors.onPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  startBtn: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
  },
  startBtnText: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  stopBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  stopBtnText: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryBtn: {
    backgroundColor: Colors.surfaceVariant,
  },
  secondaryBtnText: {
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: '500',
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 10,
    marginLeft: 'auto',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  modalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  logBox: {
    backgroundColor: '#0d1117',
    padding: 14,
  },
  logContent: {
    paddingBottom: 20,
  },
  logText: {
    color: '#38bdf8',
    fontSize: 12,
    fontFamily: monoFont,
    lineHeight: 18,
  },
});
