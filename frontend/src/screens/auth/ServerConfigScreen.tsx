import React, { useState } from 'react';
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
import { Server, Plus, Trash2, Check, Pencil } from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { ServerConfig } from '../../types/auth.types';
import { authService } from '../../services/auth.service';

const monoFont = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function ServerConfigScreen() {
  const { server: currentServer, setServer, servers, setServers, clearActiveServer } = useAuth();
  const [newServerUrl, setNewServerUrl] = useState('');
  const [newServerName, setNewServerName] = useState('');
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const activeServerLabel = currentServer?.name ?? 'NO_ACTIVE_NODE';

  const resetForm = () => {
    setNewServerUrl('');
    setNewServerName('');
    setEditingServerId(null);
  };

  const handleSaveServer = async () => {
    if (!newServerUrl || !newServerName) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    setTesting(true);

    try {
      const result = await authService.testConnection(newServerUrl);

      if (!result.success) {
        Alert.alert('Erro', result.message);
        return;
      }

      const normalizedUrl = newServerUrl.trim().replace(/\/$/, '');

      const nextServers = editingServerId
        ? servers.map((server) =>
            server.id === editingServerId
              ? { ...server, name: newServerName, url: normalizedUrl }
              : server
          )
        : [
            ...servers,
            {
              id: Date.now().toString(),
              name: newServerName,
              url: normalizedUrl,
              isDefault: servers.length === 0,
            },
          ];

      await setServers(nextServers);

      const savedServer =
        nextServers.find((server) => server.id === editingServerId) ??
        nextServers[nextServers.length - 1];

      const shouldSelectServer =
        (!editingServerId && savedServer) ||
        (editingServerId && currentServer?.id === editingServerId && savedServer);

      if (savedServer && shouldSelectServer) {
        await setServer(savedServer);
      }

      Alert.alert(
        'Sucesso',
        editingServerId ? 'Servidor atualizado com sucesso' : 'Servidor adicionado com sucesso'
      );
      resetForm();
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Não foi possível salvar o servidor');
    } finally {
      setTesting(false);
    }
  };

  const handleEditServer = (server: ServerConfig) => {
    setEditingServerId(server.id);
    setNewServerName(server.name);
    setNewServerUrl(server.url);
  };

  const handleRemoveServer = (server: ServerConfig) => {
    Alert.alert(
      'Remover servidor',
      `Deseja remover "${server.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            const nextServers = servers.filter((item) => item.id !== server.id);
            await setServers(nextServers);

            if (currentServer?.id === server.id) {
              if (nextServers.length > 0) {
                await setServer(nextServers[0]);
              } else {
                await clearActiveServer();
              }
            }
          },
        },
      ]
    );
  };

  const handleSelectServer = async (server: ServerConfig) => {
    await setServer(server);
    Alert.alert('Servidor atualizado', `Conectado a ${server.name}`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerEyebrow}>NODE_REGISTRY</Text>
          <View style={styles.headerLine} />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleRow}>
              <View style={styles.heroIconBox}>
                <Server size={22} color={Colors.primary} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>Servers</Text>
                <Text style={styles.heroSubtitle}>
                  Gerencie endpoints Docker no mesmo idioma visual do restante do app.
                </Text>
              </View>
            </View>

            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>{currentServer ? 'ACTIVE' : 'STANDBY'}</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>ACTIVE_NODE</Text>
              <Text style={styles.metricValue}>{activeServerLabel}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>TOTAL_ENDPOINTS</Text>
              <Text style={styles.metricValue}>{String(servers.length).padStart(2, '0')}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {editingServerId ? 'UPDATE_ENDPOINT' : 'REGISTER_ENDPOINT'}
          </Text>
          {editingServerId ? <Text style={styles.sectionHint}>EDIT_MODE</Text> : null}
        </View>

        <View style={styles.formCard}>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>DISPLAY_NAME</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Produção, staging, lab"
                placeholderTextColor="rgba(65, 71, 82, 0.8)"
                value={newServerName}
                onChangeText={setNewServerName}
              />
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>SERVER_URL</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="https://docker.example.com"
                placeholderTextColor="rgba(65, 71, 82, 0.8)"
                value={newServerUrl}
                onChangeText={setNewServerUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.primaryButton, testing && styles.primaryButtonDisabled]}
              onPress={handleSaveServer}
              disabled={testing}
            >
              {testing ? (
                <ActivityIndicator color={Colors.background} />
              ) : (
                <>
                  <Check size={16} color={Colors.background} />
                  <Text style={styles.primaryButtonText}>
                    {editingServerId ? 'Salvar alterações' : 'Testar e salvar'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={resetForm}>
              <Plus size={16} color={Colors.primary} />
              <Text style={styles.secondaryButtonText}>
                {editingServerId ? 'Limpar edição' : 'Novo'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>KNOWN_ENDPOINTS</Text>
          <Text style={styles.sectionHint}>{servers.length} registrados</Text>
        </View>

        <View style={styles.listContainer}>
          {servers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nenhum servidor configurado</Text>
              <Text style={styles.emptyText}>
                Adicione um endpoint acima para começar a alternar entre ambientes.
              </Text>
            </View>
          ) : (
            servers.map((server) => {
              const isActive = currentServer?.id === server.id;

              return (
                <View
                  key={server.id}
                  style={[styles.serverCard, isActive && styles.serverCardActive]}
                >
                  <View style={[styles.serverAccent, isActive && styles.serverAccentActive]} />

                  <View style={styles.serverBody}>
                    <View style={styles.serverMain}>
                      <View style={styles.serverIconBox}>
                        <Server size={20} color={isActive ? Colors.primary : Colors.secondary} />
                      </View>

                      <View style={styles.serverInfo}>
                        <View style={styles.serverTitleRow}>
                          <Text style={styles.serverName}>{server.name}</Text>
                          {isActive ? (
                            <View style={styles.activeBadge}>
                              <View style={styles.activeBadgeDot} />
                              <Text style={styles.activeBadgeText}>ACTIVE</Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={styles.serverUrl}>{server.url}</Text>
                        <Text style={styles.serverMeta}>
                          NODE_ID {server.id.slice(-6).toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.serverActions}>
                      {!isActive ? (
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleSelectServer(server)}
                        >
                          <Check size={16} color={Colors.tertiary} />
                        </TouchableOpacity>
                      ) : null}

                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleEditServer(server)}
                      >
                        <Pencil size={16} color={Colors.warning} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleRemoveServer(server)}
                      >
                        <Trash2 size={16} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
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
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 28,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: Colors.primary,
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(65, 71, 82, 0.2)',
  },
  heroCard: {
    backgroundColor: Colors.surfaceLow,
    padding: 20,
    gap: 18,
  },
  heroTopRow: {
    gap: 16,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  heroIconBox: {
    width: 52,
    height: 52,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: 'rgba(65, 71, 82, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textMuted,
  },
  liveBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(103, 223, 112, 0.08)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.tertiary,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: Colors.tertiary,
  },
  metricsRow: {
    gap: 12,
  },
  metricCard: {
    backgroundColor: Colors.background,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(65, 71, 82, 0.1)',
    gap: 6,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: Colors.textSubtle,
  },
  metricValue: {
    fontSize: 16,
    color: Colors.onSurface,
    fontFamily: monoFont,
  },
  section: {
    marginBottom: 28,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: Colors.primary,
  },
  sectionHint: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Colors.textSubtle,
  },
  formCard: {
    backgroundColor: Colors.surfaceLow,
    padding: 20,
    gap: 18,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: Colors.textMuted,
  },
  inputWrapper: {
    backgroundColor: Colors.background,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    paddingHorizontal: 16,
  },
  input: {
    height: 54,
    color: Colors.onSurface,
    fontSize: 15,
  },
  formActions: {
    gap: 12,
  },
  primaryButton: {
    minHeight: 50,
    backgroundColor: Colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 50,
    backgroundColor: Colors.surfaceHigh,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  listContainer: {
    gap: 12,
  },
  emptyCard: {
    backgroundColor: Colors.surfaceLow,
    padding: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textMuted,
  },
  serverCard: {
    backgroundColor: Colors.surfaceLow,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  serverCardActive: {
    backgroundColor: Colors.surfaceHigh,
  },
  serverAccent: {
    width: 4,
    backgroundColor: Colors.outline,
  },
  serverAccentActive: {
    backgroundColor: Colors.primaryContainer,
  },
  serverBody: {
    flex: 1,
    padding: 18,
    gap: 16,
  },
  serverMain: {
    flexDirection: 'row',
    gap: 16,
  },
  serverIconBox: {
    width: 44,
    height: 44,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: 'rgba(65, 71, 82, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serverInfo: {
    flex: 1,
    gap: 4,
  },
  serverTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  serverName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(88, 166, 255, 0.12)',
  },
  activeBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: Colors.primary,
  },
  serverUrl: {
    fontSize: 13,
    color: Colors.textMuted,
    fontFamily: monoFont,
  },
  serverMeta: {
    fontSize: 10,
    color: Colors.textSubtle,
    letterSpacing: 1.2,
    fontFamily: monoFont,
  },
  serverActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  actionButton: {
    width: 38,
    height: 38,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
