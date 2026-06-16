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
import { Users, Trash2, Check, ArrowLeft } from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { usersService } from '../../services/users.service';
import { User } from '../../types/user.types';

const monoFont = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function UsersScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await usersService.list();
      setUsers(data);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!username || !password) {
      Alert.alert('Erro', 'Preencha o nome do usuário e a senha');
      return;
    }

    setSubmitting(true);
    try {
      await usersService.create(username.trim(), password);
      Alert.alert('Sucesso', 'Usuário criado com sucesso');
      setUsername('');
      setPassword('');
      await loadUsers();
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao criar usuário');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = (user: User) => {
    if (user.username === 'alice') {
      Alert.alert('Ação Proibida', 'Não é permitido excluir o usuário administrador padrão "alice".');
      return;
    }

    Alert.alert(
      'Excluir Usuário',
      `Tem certeza que deseja excluir o usuário "${user.username}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await usersService.delete(user.username);
              Alert.alert('Sucesso', 'Usuário excluído');
              await loadUsers();
            } catch (error: any) {
              Alert.alert('Erro', error.message || 'Erro ao excluir usuário');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.primary} />
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleRow}>
          <Text style={styles.headerEyebrow}>USER_REGISTRY</Text>
          <View style={styles.headerLine} />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleRow}>
              <View style={styles.heroIconBox}>
                <Users size={22} color={Colors.primary} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>Usuários</Text>
                <Text style={styles.heroSubtitle}>
                  Gerencie as contas de acesso dinâmicas ao painel do Container Manager.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>TOTAL_USERS</Text>
              <Text style={styles.metricValue}>
                {loading ? '--' : String(users.length).padStart(2, '0')}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>CREATE_USER</Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>USERNAME</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Ex: mateus"
                placeholderTextColor="rgba(65, 71, 82, 0.8)"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Senha de acesso"
                placeholderTextColor="rgba(65, 71, 82, 0.8)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
              onPress={handleCreateUser}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.background} />
              ) : (
                <>
                  <Check size={16} color={Colors.background} />
                  <Text style={styles.primaryButtonText}>Adicionar Usuário</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>REGISTERED_USERS</Text>
          <Text style={styles.sectionHint}>{users.length} ativos</Text>
        </View>

        <View style={styles.listContainer}>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
          ) : users.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nenhum usuário cadastrado</Text>
            </View>
          ) : (
            users.map((user) => {
              const isAlice = user.username === 'alice';

              return (
                <View key={user.id} style={styles.userCard}>
                  <View style={[styles.userAccent, isAlice && styles.userAccentAdmin]} />

                  <View style={styles.userBody}>
                    <View style={styles.userMain}>
                      <View style={styles.userIconBox}>
                        <Users size={20} color={isAlice ? Colors.primary : Colors.secondary} />
                      </View>

                      <View style={styles.userInfo}>
                        <View style={styles.userTitleRow}>
                          <Text style={styles.usernameText}>{user.username}</Text>
                          {isAlice ? (
                            <View style={styles.adminBadge}>
                              <View style={styles.adminBadgeDot} />
                              <Text style={styles.adminBadgeText}>ADMIN</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.userMeta}>
                          ID: {user.id.slice(0, 8).toUpperCase()}...
                        </Text>
                        <Text style={styles.userDate}>
                          Criado em: {new Date(user.createdAt).toLocaleString('pt-BR')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.userActions}>
                      {!isAlice ? (
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleDeleteUser(user)}
                        >
                          <Trash2 size={16} color={Colors.error} />
                        </TouchableOpacity>
                      ) : null}
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  backText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
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
  userCard: {
    backgroundColor: Colors.surfaceLow,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  userAccent: {
    width: 4,
    backgroundColor: Colors.outline,
  },
  userAccentAdmin: {
    backgroundColor: Colors.primaryContainer,
  },
  userBody: {
    flex: 1,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  userMain: {
    flexDirection: 'row',
    flex: 1,
    gap: 16,
  },
  userIconBox: {
    width: 44,
    height: 44,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: 'rgba(65, 71, 82, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  usernameText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(88, 166, 255, 0.12)',
  },
  adminBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: Colors.primary,
  },
  userMeta: {
    fontSize: 11,
    color: Colors.textSubtle,
    fontFamily: monoFont,
  },
  userDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  userActions: {
    flexDirection: 'row',
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
