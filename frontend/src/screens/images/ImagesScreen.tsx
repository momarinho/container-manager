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
import { useRouter } from 'expo-router';
import {
  Disc,
  Search,
  Download,
  Trash2,
  ArrowLeft,
  RefreshCw,
  Star,
  CheckCircle,
} from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { queryClient } from '../../config/queryClient';
import { useImagesQuery, useHubSearchQuery } from '../../hooks/queries';
import { imagesService } from '../../services/images.service';

const monoFont = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function ImagesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'local' | 'hub'>('local');

  // Aba Local
  const { data: localImages = [], isLoading: loadingLocal, refetch: refetchLocal } = useImagesQuery();
  const [quickPullName, setQuickPullName] = useState('');
  const [pulling, setPulling] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Aba Hub
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const { data: hubResults = [], isLoading: loadingHub } = useHubSearchQuery(submittedQuery);
  const [pullingHubImage, setPullingHubImage] = useState<string | null>(null);

  const handlePullImage = async (imageName: string) => {
    const target = imageName.trim();
    if (!target) {
      Alert.alert('Erro', 'Informe o nome da imagem a ser baixada');
      return;
    }

    setPulling(true);
    setPullingHubImage(target);
    try {
      await imagesService.pullImage({ image: target });
      Alert.alert('Sucesso', `Imagem '${target}' baixada com sucesso!`);
      setQuickPullName('');
      void queryClient.invalidateQueries({ queryKey: ['images'] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Falha ao baixar imagem';
      Alert.alert('Erro ao Baixar', msg);
    } finally {
      setPulling(false);
      setPullingHubImage(null);
    }
  };

  const handleDeleteImage = (imageId: string, tag: string) => {
    Alert.alert(
      'Remover Imagem',
      `Deseja realmente excluir a imagem '${tag}'?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(imageId);
            try {
              await imagesService.removeImage(imageId, false);
              void queryClient.invalidateQueries({ queryKey: ['images'] });
            } catch (error: unknown) {
              const msg = error instanceof Error ? error.message : 'Erro ao remover imagem';
              Alert.alert('Erro', msg);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim().length >= 2) {
      setSubmittedQuery(searchQuery.trim());
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
          <Text style={styles.title}>Hub de Imagens</Text>
          <Text style={styles.subtitle}>Gerencie imagens locais e busque no Docker Hub</Text>
        </View>
      </View>

      {/* Segmented Control */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'local' && styles.tabBtnActive]}
          onPress={() => setActiveTab('local')}
        >
          <Disc size={16} color={activeTab === 'local' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabBtnText, activeTab === 'local' && styles.tabBtnTextActive]}>
            Locais ({localImages.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'hub' && styles.tabBtnActive]}
          onPress={() => setActiveTab('hub')}
        >
          <Search size={16} color={activeTab === 'hub' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabBtnText, activeTab === 'hub' && styles.tabBtnTextActive]}>
            Docker Hub Search
          </Text>
        </TouchableOpacity>
      </View>

      {/* ABA 1: IMAGENS LOCAIS */}
      {activeTab === 'local' && (
        <View>
          {/* Card de Pull Rápido */}
          <View style={styles.pullCard}>
            <Text style={styles.cardTitle}>Baixar Nova Imagem</Text>
            <View style={styles.pullRow}>
              <TextInput
                style={styles.pullInput}
                value={quickPullName}
                onChangeText={setQuickPullName}
                placeholder="ex: alpine:latest, postgres:16"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.pullButton, pulling && styles.pullButtonDisabled]}
                onPress={() => handlePullImage(quickPullName)}
                disabled={pulling}
              >
                {pulling ? (
                  <ActivityIndicator size="small" color={Colors.onPrimary} />
                ) : (
                  <>
                    <Download size={16} color={Colors.onPrimary} />
                    <Text style={styles.pullButtonText}>Pull</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Lista de Imagens Locais */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Imagens no Host</Text>
            <TouchableOpacity onPress={() => refetchLocal()}>
              <RefreshCw size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {loadingLocal ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : localImages.length === 0 ? (
            <View style={styles.emptyCard}>
              <Disc size={36} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Nenhuma imagem encontrada no daemon local.</Text>
            </View>
          ) : (
            localImages.map((img) => {
              const isDeleting = deletingId === img.id;
              return (
                <View key={img.id} style={styles.imageCard}>
                  <View style={styles.imageCardLeft}>
                    <Text style={styles.imageTag}>{img.primaryTag}</Text>
                    <Text style={styles.imageMeta}>
                      ID: {img.id} • Tamanho: {formatBytes(img.size)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteImage(img.id, img.primaryTag)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <ActivityIndicator size="small" color={Colors.error} />
                    ) : (
                      <Trash2 size={16} color={Colors.error} />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* ABA 2: DOCKER HUB SEARCH */}
      {activeTab === 'hub' && (
        <View>
          {/* Barra de Busca */}
          <View style={styles.searchBarRow}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              placeholder="Buscar repositório (ex: redis, node, python)..."
              placeholderTextColor={Colors.textMuted}
              returnKeyType="search"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearchSubmit}>
              <Search size={16} color={Colors.onPrimary} />
            </TouchableOpacity>
          </View>

          {loadingHub ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Buscando no Docker Hub...</Text>
            </View>
          ) : submittedQuery && hubResults.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Nenhuma imagem encontrada para &quot;{submittedQuery}&quot;.</Text>
            </View>
          ) : (
            hubResults.map((item) => {
              const isDownloading = pullingHubImage === item.name;
              return (
                <View key={item.name} style={styles.hubCard}>
                  <View style={styles.hubCardTop}>
                    <View style={styles.hubTitleRow}>
                      <Text style={styles.hubName}>{item.name}</Text>
                      {item.isOfficial && (
                        <View style={styles.officialBadge}>
                          <CheckCircle size={12} color={Colors.success} />
                          <Text style={styles.officialText}>Oficial</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.starsRow}>
                      <Star size={12} color={Colors.warning} />
                      <Text style={styles.starsText}>{item.starCount}</Text>
                    </View>
                  </View>

                  {item.description ? (
                    <Text style={styles.hubDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.hubPullBtn, isDownloading && styles.hubPullBtnDisabled]}
                    onPress={() => handlePullImage(item.name)}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <ActivityIndicator size="small" color={Colors.onPrimary} />
                    ) : (
                      <>
                        <Download size={14} color={Colors.onPrimary} />
                        <Text style={styles.hubPullBtnText}>Baixar Imagem</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      )}
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
    marginBottom: 16,
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: Colors.surfaceVariant,
  },
  tabBtnText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  tabBtnTextActive: {
    color: Colors.onSurface,
    fontWeight: '700',
  },
  pullCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  cardTitle: {
    color: Colors.onSurface,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  pullRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pullInput: {
    flex: 1,
    backgroundColor: Colors.surfaceVariant,
    color: Colors.onSurface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 13,
    fontFamily: monoFont,
  },
  pullButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  pullButtonDisabled: {
    opacity: 0.6,
  },
  pullButtonText: {
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  loadingBox: {
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
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 8,
  },
  imageCard: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imageCardLeft: {
    flex: 1,
    marginRight: 12,
  },
  imageTag: {
    color: Colors.onSurface,
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: monoFont,
    marginBottom: 4,
  },
  imageMeta: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  deleteBtn: {
    padding: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 6,
  },
  searchBarRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    color: Colors.onSurface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  hubCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  hubCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  hubTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  hubName: {
    color: Colors.onSurface,
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: monoFont,
  },
  officialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  officialText: {
    color: Colors.success,
    fontSize: 11,
    fontWeight: '700',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starsText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  hubDesc: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  hubPullBtn: {
    backgroundColor: Colors.surfaceVariant,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
  },
  hubPullBtnDisabled: {
    opacity: 0.6,
  },
  hubPullBtnText: {
    color: Colors.onSurface,
    fontWeight: '600',
    fontSize: 12,
  },
});
