import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { HardDrive, Trash2, Plus, ArrowLeft, RefreshCw, Layers } from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { volumesService } from '../../services/volumes.service';
import type { DockerVolume } from '../../types/volume.types';

const monoFont = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function VolumesScreen() {
  const router = useRouter();
  const [volumes, setVolumes] = useState<DockerVolume[]>([]);
  const [volumeName, setVolumeName] = useState('');
  const [driver, setDriver] = useState('local');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pruning, setPruning] = useState(false);

  useEffect(() => {
    void loadVolumes();
  }, []);

  const loadVolumes = async () => {
    try {
      setLoading(true);
      const data = await volumesService.list();
      setVolumes(data);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao carregar volumes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVolume = async () => {
    if (!volumeName.trim()) {
      Alert.alert('Erro', 'Informe o nome do volume');
      return;
    }

    setSubmitting(true);
    try {
      await volumesService.create({
        name: volumeName.trim(),
        driver: driver.trim() || 'local',
      });
      Alert.alert('Sucesso', 'Volume criado com sucesso');
      setVolumeName('');
      await loadVolumes();
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao criar volume');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveVolume = (name: string) => {
    Alert.alert('Remover Volume', `Tem certeza que deseja remover o volume "${name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await volumesService.remove(name);
            Alert.alert('Sucesso', `Volume ${name} removido`);
            await loadVolumes();
          } catch (error: any) {
            Alert.alert('Erro', error.message || 'Erro ao remover volume');
          }
        },
      },
    ]);
  };

  const handlePruneVolumes = () => {
    Alert.alert(
      'Limpar Volumes Órfãos (Prune)',
      'Esta ação removerá todos os volumes que não estão associados a nenhum container. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar Volumes',
          style: 'destructive',
          onPress: async () => {
            setPruning(true);
            try {
              const report = await volumesService.prune();
              const count = report.volumesDeleted.length;
              const mb = (report.spaceReclaimed / (1024 * 1024)).toFixed(2);
              Alert.alert('Prune Concluído', `${count} volume(s) excluído(s). Espaço liberado: ${mb} MB`);
              await loadVolumes();
            } catch (error: any) {
              Alert.alert('Erro', error.message || 'Erro ao limpar volumes');
            } finally {
              setPruning(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <HardDrive size={24} color={Colors.primary} />
          <Text style={styles.title}>Volumes Docker</Text>
        </View>
        <TouchableOpacity
          style={[styles.pruneButton, pruning && styles.disabledButton]}
          onPress={handlePruneVolumes}
          disabled={pruning}
        >
          {pruning ? (
            <ActivityIndicator size="small" color={Colors.error} />
          ) : (
            <RefreshCw size={16} color={Colors.error} />
          )}
          <Text style={styles.pruneButtonText}>Prune</Text>
        </TouchableOpacity>
      </View>

      {/* Formulário de Criação de Volume */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Criar Novo Volume</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nome do Volume</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: app_data_vol"
            placeholderTextColor={Colors.textPlaceholder}
            value={volumeName}
            onChangeText={setVolumeName}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Driver (Padrão: local)</Text>
          <TextInput
            style={styles.input}
            placeholder="local"
            placeholderTextColor={Colors.textPlaceholder}
            value={driver}
            onChangeText={setDriver}
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, submitting && styles.disabledButton]}
          onPress={handleCreateVolume}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.surface} />
          ) : (
            <>
              <Plus size={18} color={Colors.surface} />
              <Text style={styles.buttonText}>Criar Volume</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Lista de Volumes */}
      <View style={styles.card}>
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Volumes Existentes</Text>
          <Text style={styles.counterText}>{volumes.length} volumes</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 20 }} />
        ) : volumes.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum volume encontrado no Docker.</Text>
        ) : (
          volumes.map((vol) => (
            <View key={vol.name} style={styles.volumeRow}>
              <View style={styles.volumeInfo}>
                <View style={styles.volumeTitleRow}>
                  <Text style={styles.volumeName}>{vol.name}</Text>
                  <View style={[styles.badge, vol.inUse ? styles.badgeInUse : styles.badgeUnused]}>
                    <Text style={[styles.badgeText, vol.inUse ? styles.badgeTextInUse : styles.badgeTextUnused]}>
                      {vol.inUse ? 'Em uso' : 'Não utilizado'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.driverText}>Driver: {vol.driver}</Text>
                <Text style={styles.mountpointText} numberOfLines={1} ellipsizeMode="middle">
                  {vol.mountpoint}
                </Text>
                {vol.usedBy.length > 0 && (
                  <View style={styles.usedByContainer}>
                    <Layers size={12} color={Colors.secondary} style={{ marginRight: 4 }} />
                    <Text style={styles.usedByText}>
                      Containers: {vol.usedBy.map((c) => c.name).join(', ')}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleRemoveVolume(vol.name)}
              >
                <Trash2 size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))
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
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  pruneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  pruneButtonText: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceHigh,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.onSurface,
    marginBottom: 16,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  counterText: {
    fontSize: 13,
    color: Colors.secondary,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: Colors.secondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 8,
    padding: 12,
    color: Colors.onSurface,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceHigh,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  buttonText: {
    color: Colors.surface,
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  emptyText: {
    color: Colors.secondary,
    textAlign: 'center',
    marginVertical: 16,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceHigh,
  },
  volumeInfo: {
    flex: 1,
    paddingRight: 8,
  },
  volumeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  volumeName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.onSurface,
    fontFamily: monoFont,
  },
  driverText: {
    fontSize: 12,
    color: Colors.secondary,
  },
  mountpointText: {
    fontSize: 11,
    color: Colors.outline,
    fontFamily: monoFont,
    marginTop: 2,
  },
  usedByContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  usedByText: {
    fontSize: 11,
    color: Colors.secondary,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeInUse: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  badgeUnused: {
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  badgeTextInUse: {
    color: '#22c55e',
  },
  badgeTextUnused: {
    color: Colors.secondary,
  },
  deleteButton: {
    padding: 8,
  },
});
