import React from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Search as SearchIcon, Terminal, Activity, LogOut, Settings } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';

const mockContainers = [
  { id: '4f92bc8102ae', name: 'nginx-proxy', status: 'running', cpu: '15%', memory: '256MB', uptime: '14d 2h', image: 'nginx:latest' },
  { id: 'a921d74301fc', name: 'redis', status: 'stopped', cpu: '0%', memory: '0MB', uptime: '0h', image: 'redis:alpine' },
  { id: '12c8e44199bd', name: 'postgres', status: 'running', cpu: '2%', memory: '45MB', uptime: '142h', image: 'postgres:latest' },
];

export default function DashboardScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>🐳 Container Manager</Text>
          <Text style={styles.subtitle}>SYSTEM_STATUS: OPTIMIZED // ACTIVE_NODES: 03</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleLogout}>
            <LogOut size={20} color={Colors.outline} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Settings size={20} color={Colors.outline} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <SearchIcon size={16} color={Colors.outline} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search containers..."
            placeholderTextColor={Colors.outline}
          />
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>CPU LOAD</Text>
            <View style={styles.statValueContainer}>
              <Text style={[styles.statValue, { color: Colors.primary }]}>17.4</Text>
              <Text style={styles.statUnit}>%</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>MEMORY</Text>
            <View style={styles.statValueContainer}>
              <Text style={[styles.statValue, { color: Colors.primary }]}>301</Text>
              <Text style={styles.statUnit}>MB</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>NETWORK IN</Text>
            <View style={styles.statValueContainer}>
              <Text style={[styles.statValue, { color: Colors.tertiary }]}>2.4</Text>
              <Text style={styles.statUnit}>GB/s</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>UPTIME</Text>
            <View style={styles.statValueContainer}>
              <Text style={[styles.statValue, { color: Colors.onSurface }]}>142</Text>
              <Text style={styles.statUnit}>HRS</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACTIVE RUNTIME INSTANCES</Text>

        {mockContainers.map((container) => (
          <TouchableOpacity 
            key={container.id} 
            style={[
              styles.card,
              container.status === 'running' ? styles.cardRunning : styles.cardStopped
            ]}
            onPress={() => router.push('/modal' as any)}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.statusDot, container.status === 'running' ? styles.statusRunning : styles.statusStopped]} />
              <View>
                <Text style={styles.cardTitle}>{container.name}</Text>
                <Text style={styles.cardId}>ID: {container.id}</Text>
              </View>
            </View>

            <View style={styles.cardMetrics}>
              <View style={styles.metricColumn}>
                <Text style={styles.metricLabel}>CPU UTILIZATION</Text>
                <View style={styles.metricRow}>
                  <Text style={styles.metricValue}>{container.cpu}</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: parseInt(container.cpu) || 0 }]} />
                  </View>
                </View>
              </View>
              <View style={styles.metricColumn}>
                <Text style={styles.metricLabel}>MEMORY USAGE</Text>
                <Text style={styles.metricValueWhite}>{container.memory}</Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionButton}>
                  <Terminal size={20} color={Colors.outline} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Activity size={20} color={Colors.outline} />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* FAB - Using absolute positioning within ScrollView content might be tricky if it's long, but simple for now */}
      <TouchableOpacity style={styles.fab}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
    paddingTop: 48,
    paddingBottom: 100, // Space for FAB
  },
  header: {
    marginBottom: 32,
  },
  titleContainer: {
    marginBottom: 24,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  headerButton: {
    padding: 8,
    backgroundColor: Colors.surfaceLow,
    borderRadius: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.secondary,
    opacity: 0.8,
  },
  searchContainer: {
    position: 'relative',
    marginBottom: 32,
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    top: 16,
    zIndex: 1,
  },
  searchInput: {
    backgroundColor: Colors.surfaceLow,
    color: Colors.onSurface,
    paddingVertical: 14,
    paddingLeft: 48,
    paddingRight: 16,
    borderRadius: 4,
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(65, 71, 82, 0.2)', // outline/20
    justifyContent: 'space-between',
    minHeight: 100,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.outline,
    letterSpacing: 1,
    marginBottom: 16,
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statUnit: {
    fontSize: 12,
    color: Colors.outline,
    marginBottom: 2,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: Colors.outline,
    marginBottom: 16,
  },
  card: {
    backgroundColor: Colors.surfaceLow,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 2,
  },
  cardRunning: {
    borderLeftColor: Colors.tertiary,
  },
  cardStopped: {
    borderLeftColor: Colors.error,
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 16,
  },
  statusRunning: {
    backgroundColor: Colors.tertiary,
  },
  statusStopped: {
    backgroundColor: Colors.error,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  cardId: {
    fontSize: 10,
    color: Colors.outline,
    marginTop: 4,
  },
  cardMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricColumn: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.outline,
    letterSpacing: 1,
    marginBottom: 4,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricValue: {
    fontSize: 14,
    color: Colors.primary,
  },
  metricValueWhite: {
    fontSize: 14,
    color: Colors.onSurface,
  },
  progressTrack: {
    height: 4,
    flex: 1,
    maxWidth: 100,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: {
    fontSize: 32,
    color: Colors.background,
    fontWeight: 'bold',
  },
});
