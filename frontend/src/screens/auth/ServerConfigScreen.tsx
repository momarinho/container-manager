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
} from 'react-native';
import { Server, Plus, Trash2, Check } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { ServerConfig } from '../../types/auth.types';
import { authService } from '../../services/auth.service';

export default function ServerConfigScreen() {
  const { server: currentServer, setServer } = useAuth();
  const [servers, setServers] = useState<ServerConfig[]>([currentServer].filter(Boolean) as ServerConfig[]);
  const [newServerUrl, setNewServerUrl] = useState('');
  const [newServerName, setNewServerName] = useState('');
  const [testing, setTesting] = useState(false);

  const handleTestConnection = async () => {
    if (!newServerUrl) {
      Alert.alert('Erro', 'Informe a URL do servidor');
      return;
    }

    setTesting(true);
    try {
      const result = await authService.testConnection(newServerUrl);
      if (result.success) {
        Alert.alert('Sucesso', result.message);
      } else {
        Alert.alert('Erro', result.message);
      }
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Não foi possível testar a conexão');
    } finally {
      setTesting(false);
    }
  };

  const handleAddServer = () => {
    if (!newServerUrl || !newServerName) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    const newServer: ServerConfig = {
      id: Date.now().toString(),
      name: newServerName,
      url: newServerUrl,
      isDefault: false,
    };

    setServers([...servers, newServer]);
    setNewServerUrl('');
    setNewServerName('');
  };

  const handleRemoveServer = (id: string) => {
    setServers(servers.filter(s => s.id !== id));
  };

  const handleSelectServer = async (server: ServerConfig) => {
    await setServer(server);
    Alert.alert('Servidor atualizado', `Conectado a ${server.name}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Server size={32} color="#6366f1" />
        <Text style={styles.title}>Configuração de Servidores</Text>
        <Text style={styles.subtitle}>Gerencie suas conexões Docker</Text>
      </View>

      {/* Adicionar Novo Servidor */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Adicionar Servidor</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nome (ex: Produção, Staging)"
            placeholderTextColor="#64748b"
            value={newServerName}
            onChangeText={setNewServerName}
          />
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="URL (ex: https://docker.example.com)"
            placeholderTextColor="#64748b"
            value={newServerUrl}
            onChangeText={setNewServerUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.testButton]}
            onPress={handleTestConnection}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator color="#6366f1" />
            ) : (
              <>
                <Check size={16} color="#6366f1" />
                <Text style={styles.testButtonText}>Testar</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.addButton]}
            onPress={handleAddServer}
          >
            <Plus size={16} color="#fff" />
            <Text style={styles.addButtonText}>Adicionar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista de Servidores */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Servidores Configurados</Text>

        {servers.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum servidor configurado</Text>
        ) : (
          servers.map((server) => (
            <View
              key={server.id}
              style={[
                styles.serverCard,
                currentServer?.id === server.id && styles.serverCardActive,
              ]}
            >
              <View style={styles.serverInfo}>
                <View style={styles.serverHeader}>
                  <Text style={styles.serverName}>{server.name}</Text>
                  {currentServer?.id === server.id && (
                    <Text style={styles.activeBadge}>Ativo</Text>
                  )}
                </View>
                <Text style={styles.serverUrl}>{server.url}</Text>
              </View>

              <View style={styles.serverActions}>
                {currentServer?.id !== server.id && (
                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => handleSelectServer(server)}
                  >
                    <Check size={16} color="#6366f1" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleRemoveServer(server.id)}
                >
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
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
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  input: {
    color: '#f8fafc',
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  testButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  testButtonText: {
    color: '#6366f1',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#6366f1',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 24,
  },
  serverCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#64748b',
  },
  serverCardActive: {
    borderLeftColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  serverInfo: {
    marginBottom: 12,
  },
  serverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  serverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  activeBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  serverUrl: {
    fontSize: 12,
    color: '#94a3b8',
  },
  serverActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  selectButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
