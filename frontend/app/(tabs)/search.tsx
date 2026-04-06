import React from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { Search as SearchIcon, Server, Layers, ExternalLink, Terminal } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';

export default function SearchScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>COMMAND_QUERY</Text>
          <View style={styles.headerLine} />
        </View>
        <View style={styles.searchWrapper}>
          <SearchIcon style={styles.searchIcon} color={Colors.outline} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search containers, logs, images"
            placeholderTextColor="rgba(65, 71, 82, 0.5)" // outline/50
            defaultValue="Search containers, logs, images"
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.resultsContainer}>
          {/* Result 1: Container */}
          <TouchableOpacity style={styles.resultCard}>
            <View style={[styles.cardAccent, { backgroundColor: Colors.tertiary }]} />
            <View style={styles.cardContent}>
              <View style={styles.iconBox}>
                <Server color={Colors.tertiary} size={24} />
              </View>
              <View style={styles.infoCol}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>nginx-proxy</Text>
                  <View style={[styles.statusBadge, { backgroundColor: 'rgba(103, 223, 112, 0.1)' }]}>
                    <View style={[styles.statusDot, { backgroundColor: Colors.tertiary }]} />
                    <Text style={[styles.statusText, { color: Colors.tertiary }]}>RUNNING</Text>
                  </View>
                </View>
                <Text style={styles.subtitle}>ID: 4f8d29c3a1b0 • Uptime: 14d 2h</Text>
              </View>
            </View>
            <ExternalLink color={Colors.primary} size={20} />
          </TouchableOpacity>

          {/* Result 2: Logs */}
          <TouchableOpacity style={styles.resultCard}>
            <View style={styles.logHeader}>
              <View style={styles.logIconRow}>
                <View style={styles.iconBox}>
                  <Terminal color={Colors.error} size={24} />
                </View>
                <View>
                  <Text style={styles.title}>
                    redis logs <Text style={{ color: Colors.error }}>{'"'}error{'"'}</Text>
                  </Text>
                  <Text style={styles.subtitle}>3 matches found in standard output</Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(255, 180, 171, 0.1)' }]}>
                <Text style={[styles.statusText, { color: Colors.error }]}>CRITICAL</Text>
              </View>
            </View>
            <View style={styles.logBlock}>
              <Text style={styles.logLine}>
                <Text style={styles.logTime}>14:02:11 </Text>
                <Text style={styles.logError}>[ERROR] </Text>
                <Text style={styles.logText}>Failed to write to AOF file...</Text>
              </Text>
              <Text style={styles.logLine}>
                <Text style={styles.logTime}>14:02:15 </Text>
                <Text style={styles.logError}>[ERROR] </Text>
                <Text style={styles.logTextWhite}>Background saving error</Text>
              </Text>
            </View>
          </TouchableOpacity>

          {/* Result 3: Image */}
          <TouchableOpacity style={styles.resultCard}>
            <View style={styles.cardContent}>
              <View style={styles.iconBox}>
                <Layers color={Colors.primary} size={24} />
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.title}>postgres:latest</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>IMAGE</Text>
                  <View style={styles.metaDot} />
                  <Text style={styles.metaValue}>SHA256:d48e23f...</Text>
                  <View style={styles.metaDot} />
                  <Text style={styles.metaValue}>412MB</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.pullBtn}>
              <Text style={styles.pullBtnText}>PULL</Text>
            </TouchableOpacity>
          </TouchableOpacity>
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
  header: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: Colors.primary,
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(65, 71, 82, 0.2)', // outline/20
  },
  searchWrapper: {
    position: 'relative',
    backgroundColor: Colors.surfaceLow,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  searchIcon: {
    position: 'absolute',
    left: 20,
    top: 20,
    zIndex: 1,
  },
  searchInput: {
    paddingVertical: 20,
    paddingLeft: 56,
    paddingRight: 24,
    fontSize: 16,
    color: Colors.onSurface,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  resultsContainer: {
    gap: 16,
  },
  resultCard: {
    backgroundColor: Colors.surfaceLow,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4,
    height: '100%',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    flex: 1,
  },
  iconBox: {
    width: 48,
    height: 48,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(65, 71, 82, 0.1)',
  },
  infoCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.outline,
    fontFamily: 'monospace',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  logIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  logBlock: {
    backgroundColor: Colors.background,
    padding: 12,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255, 180, 171, 0.5)',
  },
  logLine: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  logTime: {
    color: Colors.outline,
    opacity: 0.7,
  },
  logError: {
    color: Colors.error,
  },
  logText: {
    color: Colors.outline,
    opacity: 0.7,
  },
  logTextWhite: {
    color: Colors.onSurface,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.outline,
    letterSpacing: 1,
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.outline,
  },
  metaValue: {
    fontSize: 10,
    color: Colors.outline,
    fontFamily: 'monospace',
  },
  pullBtn: {
    backgroundColor: Colors.surfaceHigh,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(65, 71, 82, 0.2)',
  },
  pullBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primary,
  },
});
