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
import { Network, Trash2, Plus, ArrowLeft, RefreshCw, Cpu } from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { networksService } from '../../services/networks.service';
import type { DockerNetwork } from '../../types/network.types';

const monoFont = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function NetworksScreen() {
  const router = useRouter();
  const [networks, setNetworks] = useState<DockerNetwork[]>([]);
  const [networkName, setNetworkName] = useState('');
  const [driver, setDriver] = useState('bridge');
  const [subnet, setSubnet] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pruning, setPruning] = useState(false);

  useEffect(() => {
    void loadNetworks();
  }, []);

  const loadNetworks = async () => {
    try {
      setLoading(true);
      const data = await networksService.list();
      setNetworks(data);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao carregar redes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNetwork = async () => {
    if (!networkName.trim()) {
      Alert.alert('Erro', 'Informe o nome da rede');
      return;
    }

    setSubmitting(true);
    try {
      await networksService.create({
        name: networkName.trim(),
        driver: driver.trim() || 'bridge',
        subnet: subnet.trim() || undefined,
      });
      Alert.alert('Sucesso', 'Rede criada com sucesso');
      setNetworkName('');
      setSubnet('');
      await loadNetworks();
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao criar rede');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveNetwork = (id: string, name: string) => {
    Alert.alert('Remover Rede', `Tem certeza que deseja remover a rede "${name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await networksService.remove(id);
            Alert.alert('Sucesso', `Rede ${name} removida`);
            await loadNetworks();
          } catch (error: any) {
            Alert.alert('Erro', error.message || 'Erro ao remover rede');
          }
        },
      },
    ]);
  };

  const handlePruneNetworks = () => {
    Alert.alert(
      'Limpar Redes Não Utilizadas (Prune)',
      'Esta ação removerá todas as redes customizadas sem containers conectados. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar Redes',
          style: 'destructive',
          onPress: async () => {
            setPruning(true);
            try {
              const report = await networksService.prune();
              const count = report.networksDeleted.length;
              Alert.alert('Prune Concluído', `${count} rede(s) excluída(s).`);
              await loadNetworks();
            } catch (error: any) {
              Alert.alert('Erro', error.message || 'Erro ao limpar redes');
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
          <Network size={24} color={Colors.primary} />
          <Text style={styles.title}>Redes Docker</Text>
        </View>
        <TouchableOpacity
          style={[styles.pruneButton, pruning && styles.disabledButton]}
          onPress={handlePruneNetworks}
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

      {/* Formulário de Criação de Rede */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Criar Nova Rede</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nome da Rede</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: app_custom_net"
            placeholderTextColor={Colors.textPlaceholder}
            value={networkName}
            onChangeText={setNetworkName}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Driver (Padrão: bridge)</Text>
          <TextInput
            style={styles.input}
            placeholder="bridge (overlay, macvlan)"
            placeholderTextColor={Colors.textPlaceholder}
            value={driver}
            onChangeText={setDriver}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Subnet Opcional (CIDR)</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: 172.28.0.0/16"
            placeholderTextColor={Colors.textPlaceholder}
            value={subnet}
            onChangeText={setSubnet}
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, submitting && styles.disabledButton]}
          onPress={handleCreateNetwork}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.surface} />
          ) : (
            <>
              <Plus size={18} color={Colors.surface} />
              <Text style={styles.buttonText}>Criar Rede</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Lista de Redes */}
      <View style={styles.card}>
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Redes Existentes</Text>
          <Text style={styles.counterText}>{networks.length} redes</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 20 }} />
        ) : networks.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma rede encontrada no Docker.</Text>
        ) : (
          networks.map((net) => (
            <View key={net.fullId} style={styles.networkRow}>
              <View style={styles.networkInfo}>
                <View style={styles.networkTitleRow}>
                  <Text style={styles.networkName}>{net.name}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{net.driver}</Text>
                  </View>
                  <Text style={styles.networkId}>{net.id}</Text>
                </View>
                {Boolean(net.subnet) && (
                  <Text style={styles.subnetText}>Subnet: {net.subnet}</Text>
                )}
                <View style={styles.containersInfoRow}>
                  <Cpu size={12} color={Colors.secondary} style={{ marginRight: 4 }} />
                  <Text style={styles.containersCountText}>
                    {net.containerCount} container(s) conectado(s)
                    {net.containers.length > 0 &&
                      `: ${net.containers.map((c) => c.name).join(', ')}`}
                  </Text>
                </View>
              </View>
              {!['bridge', 'host', 'null'].includes(net.driver) && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleRemoveNetwork(net.fullId, net.name)}
                >
                  <Trash2 size={18} color={Colors.error} />
                </TouchableOpacity>
              )}
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
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceHigh,
  },
  networkInfo: {
    flex: 1,
    paddingRight: 8,
  },
  networkTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  networkName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.onSurface,
    fontFamily: monoFont,
  },
  networkId: {
    fontSize: 11,
    color: Colors.outline,
    fontFamily: monoFont,
  },
  subnetText: {
    fontSize: 12,
    color: Colors.secondary,
    fontFamily: monoFont,
    marginBottom: 2,
  },
  containersInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  containersCountText: {
    fontSize: 11,
    color: Colors.secondary,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#3b82f6',
  },
  deleteButton: {
    padding: 8,
  },
});
