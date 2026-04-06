import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  Alert,
  RefreshControl,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';
import { Search as SearchIcon, LogOut, Settings, Play, Square, RotateCw } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { systemService } from '../../src/services/system.service';
import { containersService } from '../../src/services/containers.service';
import { useWebSocket } from '../../src/hooks/useWebSocket';
import type { SystemStats } from '../../src/types/system.types';
import type { Container } from '../../src/types/container.types';

export default function DashboardScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  
  // Estados
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // WebSocket para estatísticas em tempo real
  const { isConnected } = useWebSocket<SystemStats>(
    '/stats',
    (data) => {
      if (autoRefresh) {
        setStats(data);
      }
    },
    autoRefresh
  );

  // Carrega dados iniciais
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, containersData] = await Promise.all([
        systemService.getStats(),
        containersService.list({ all: true })
      ]);
      setStats(statsData);
      setContainers(containersData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Erro', 'Falha ao carregar dados do sistema');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const confirmAndLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const handleLogout = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Deseja realmente sair?')) {
        void confirmAndLogout();
      }
      return;
    }

    Alert.alert(
      'Logout',
      'Deseja realmente sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', onPress: () => void confirmAndLogout(), style: 'destructive' }
      ]
    );
  };

  const handleContainerAction = async (id: string, action: 'start' | 'stop' | 'restart') => {
    try {
      switch (action) {
        case 'start':
          await containersService.start(id);
          break;
        case 'stop':
          await containersService.stop(id);
          break;
        case 'restart':
          await containersService.restart(id);
          break;
      }
      // Recarrega lista após ação
      await loadData();
      Alert.alert('Sucesso', `Container ${action}ed com sucesso`);
    } catch (error) {
      console.error(`Error ${action}ing container:`, error);
      Alert.alert('Erro', `Falha ao ${action} container`);
    }
  };

  const getStatusColor = (value: number): string => {
    if (value >= 90) return Colors.error || '#ef4444';
    if (value >= 70) return Colors.warning || '#f59e0b';
    return Colors.success || '#10b981';
  };

  const getContainerStatusColor = (state: string): string => {
    if (state === 'running') return Colors.success || '#10b981';
    if (state === 'paused') return Colors.warning || '#f59e0b';
    return Colors.outline;
  };

  // Filtra containers pela busca
  const filteredContainers = containers.filter(c => 
    c.names.some(name => name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    c.image.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Carregando...</Text>
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
          <Text style={styles.title}>🐳 Container Manager</Text>
          <Text style={styles.subtitle}>
            {stats ? `SYSTEM_STATUS: OPTIMIZED // ACTIVE_NODES: ${stats.containers.running.toString().padStart(2, '0')}` : 'Loading...'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleLogout}>
            <LogOut size={20} color={Colors.outline} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Settings size={20} color={Colors.outline} />
          </TouchableOpacity>
        </View>

        {/* Busca */}
        <View style={styles.searchContainer}>
          <SearchIcon size={16} color={Colors.outline} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search containers..."
            placeholderTextColor={Colors.outline}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Stats do Sistema */}
        {stats && (
          <>
            <View style={styles.autoRefreshContainer}>
              <Text style={styles.autoRefreshLabel}>Atualização automática</Text>
              <Switch
                value={autoRefresh}
                onValueChange={setAutoRefresh}
                trackColor={{ false: '#374151', true: Colors.primary }}
                thumbColor="#fff"
              />
              {isConnected && autoRefresh && (
                <View style={styles.connectedDot} />
              )}
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>CPU LOAD</Text>
                <View style={styles.statValueContainer}>
                  <Text style={[styles.statValue, { color: getStatusColor(stats.cpu) }]}>
                    {stats.cpu.toFixed(1)}
                  </Text>
                  <Text style={styles.statUnit}>%</Text>
                </View>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>MEMORY</Text>
                <View style={styles.statValueContainer}>
                  <Text style={[styles.statValue, { color: getStatusColor(stats.memory) }]}>
                    {stats.memory.toFixed(0)}
                  </Text>
                  <Text style={styles.statUnit}>%</Text>
                </View>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>DISK</Text>
                <View style={styles.statValueContainer}>
                  <Text style={[styles.statValue, { color: getStatusColor(stats.disk) }]}>
                    {stats.disk.toFixed(0)}
                  </Text>
                  <Text style={styles.statUnit}>%</Text>
                </View>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>UPTIME</Text>
                <View style={styles.statValueContainer}>
                  <Text style={[styles.statValue, { color: Colors.onSurface }]}>
                    {Math.floor(stats.uptime / 3600)}
                  </Text>
                  <Text style={styles.statUnit}>HRS</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Lista de Containers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACTIVE RUNTIME INSTANCES</Text>

        {filteredContainers.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum container encontrado</Text>
        ) : (
          filteredContainers.map((container) => (
            <TouchableOpacity 
              key={container.id} 
              style={[
                styles.card,
                container.state === 'running' ? styles.cardRunning : styles.cardStopped
              ]}
              activeOpacity={1}
            >
              <View style={styles.cardHeader}>
                <View style={[
                  styles.statusDot, 
                  { backgroundColor: getContainerStatusColor(container.state) }
                ]} />
                <View>
                  <Text style={styles.cardTitle}>
                    {container.names[0]?.replace(/^\//, '') || 'Unnamed'}
                  </Text>
                  <Text style={styles.cardId}>ID: {container.id.substring(0, 12)}</Text>
                </View>
              </View>

              <View style={styles.cardMetrics}>
                <Text style={styles.cardMetric}>Image: {container.image}</Text>
                <Text style={styles.cardMetric}>Status: {container.status}</Text>
              </View>

              <View style={styles.cardActions}>
                {container.state === 'running' ? (
                  <>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleContainerAction(container.id, 'restart');
                      }}
                    >
                      <RotateCw size={16} color={Colors.primary} />
                      <Text style={styles.actionButtonText}>Restart</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleContainerAction(container.id, 'stop');
                      }}
                    >
                      <Square size={16} color={Colors.error || '#ef4444'} />
                      <Text style={styles.actionButtonText}>Stop</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleContainerAction(container.id, 'start');
                    }}
                  >
                    <Play size={16} color={Colors.success || '#10b981'} />
                    <Text style={styles.actionButtonText}>Start</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
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
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: Colors.outline,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  headerActions: {
    position: 'absolute',
    top: 48,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  autoRefreshContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  autoRefreshLabel: {
    fontSize: 12,
    color: Colors.outline,
    flex: 1,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success || '#10b981',
  },
  statsGrid: {
    flexDirection: 'row',
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
    color: Colors.outline,
    fontFamily: 'monospace',
    letterSpacing: 1,
    marginBottom: 8,
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  statUnit: {
    fontSize: 10,
    color: Colors.outline,
    marginLeft: 2,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 11,
    color: Colors.outline,
    fontFamily: 'monospace',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.outline,
    fontSize: 14,
    marginTop: 24,
  },
  card: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 3,
  },
  cardRunning: {
    borderLeftColor: Colors.success || '#10b981',
  },
  cardStopped: {
    borderLeftColor: Colors.outline,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.onSurface,
    marginBottom: 2,
  },
  cardId: {
    fontSize: 11,
    color: Colors.outline,
    fontFamily: 'monospace',
  },
  cardMetrics: {
    gap: 4,
    marginBottom: 12,
  },
  cardMetric: {
    fontSize: 12,
    color: Colors.outline,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: Colors.surface,
  },
  actionButtonText: {
    fontSize: 12,
    color: Colors.onSurface,
    fontWeight: '500',
  },
});
