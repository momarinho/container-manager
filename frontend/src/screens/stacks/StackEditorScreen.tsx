import React, { useState, useEffect } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Play, FileCode, Wand2, Check } from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { queryClient } from '../../config/queryClient';
import { stacksService } from '../../services/stacks.service';

const monoFont = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const SAMPLE_COMPOSE = `version: '3.8'

services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
    restart: always
    environment:
      - NGINX_PORT=80

  cache:
    image: redis:alpine
    ports:
      - "6379:6379"
    restart: always
`;

export default function StackEditorScreen() {
  const router = useRouter();
  const { name: paramName } = useLocalSearchParams<{ name?: string }>();

  const [name, setName] = useState(paramName || '');
  const [composeYaml, setComposeYaml] = useState('');
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    if (paramName) {
      setName(paramName);
      setLoading(true);
      stacksService
        .getStackCompose(paramName)
        .then((content) => {
          if (content) setComposeYaml(content);
        })
        .catch((err) => {
          Alert.alert('Aviso', 'Não foi possível carregar o arquivo compose original: ' + err.message);
        })
        .finally(() => setLoading(false));
    }
  }, [paramName]);

  const handleInsertSample = () => {
    if (composeYaml.trim() && composeYaml !== SAMPLE_COMPOSE) {
      Alert.alert(
        'Substituir conteúdo',
        'Deseja substituir o conteúdo atual pelo template de exemplo?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Substituir',
            onPress: () => {
              if (!name) setName('sample-stack');
              setComposeYaml(SAMPLE_COMPOSE);
            },
          },
        ]
      );
    } else {
      if (!name) setName('sample-stack');
      setComposeYaml(SAMPLE_COMPOSE);
    }
  };

  const handleDeploy = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert('Erro', 'Informe o nome da stack');
      return;
    }

    if (!composeYaml.trim()) {
      Alert.alert('Erro', 'Informe o conteúdo do arquivo docker-compose.yml');
      return;
    }

    setDeploying(true);
    try {
      await stacksService.deployStack({
        name: cleanName,
        composeYaml,
      });

      void queryClient.invalidateQueries({ queryKey: ['stacks'] });
      void queryClient.invalidateQueries({ queryKey: ['containers'] });

      Alert.alert('Sucesso', `Stack '${cleanName}' implantada com sucesso!`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Falha ao implantar stack';
      Alert.alert('Erro no Deploy', msg);
    } finally {
      setDeploying(false);
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
          <Text style={styles.title}>
            {paramName ? `Editar Stack: ${paramName}` : 'Nova Stack Compose'}
          </Text>
          <Text style={styles.subtitle}>Suba múltiplos containers com docker-compose.yml</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Carregando configuração...</Text>
        </View>
      ) : (
        <View style={styles.formCard}>
          {/* Nome da Stack */}
          <Text style={styles.label}>Nome da Stack</Text>
          <TextInput
            style={[styles.input, paramName ? styles.inputDisabled : null]}
            value={name}
            onChangeText={setName}
            placeholder="ex: minha-aplicacao"
            placeholderTextColor={Colors.textMuted}
            editable={!paramName}
            autoCapitalize="none"
          />

          {/* Cabeçalho do Editor YAML */}
          <View style={styles.editorHeader}>
            <View style={styles.editorTitleRow}>
              <FileCode size={16} color={Colors.primary} />
              <Text style={styles.label}>docker-compose.yml</Text>
            </View>
            <TouchableOpacity style={styles.sampleButton} onPress={handleInsertSample}>
              <Wand2 size={14} color={Colors.secondary} />
              <Text style={styles.sampleButtonText}>Usar Exemplo</Text>
            </TouchableOpacity>
          </View>

          {/* Área de Texto do YAML */}
          <TextInput
            style={styles.yamlArea}
            value={composeYaml}
            onChangeText={setComposeYaml}
            placeholder={`services:\n  app:\n    image: node:alpine\n    ports:\n      - "3000:3000"`}
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={18}
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />

          {/* Botão de Deploy */}
          <TouchableOpacity
            style={[styles.deployBtn, deploying && styles.deployBtnDisabled]}
            onPress={handleDeploy}
            disabled={deploying}
          >
            {deploying ? (
              <>
                <ActivityIndicator size="small" color={Colors.onPrimary} />
                <Text style={styles.deployBtnText}>Implantando Containers...</Text>
              </>
            ) : (
              <>
                {paramName ? (
                  <Check size={18} color={Colors.onPrimary} />
                ) : (
                  <Play size={18} color={Colors.onPrimary} />
                )}
                <Text style={styles.deployBtnText}>
                  {paramName ? 'Atualizar e Reiniciar Stack' : 'Implantar Stack (up -d)'}
                </Text>
              </>
            )}
          </TouchableOpacity>
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
  loadingBox: {
    padding: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: Colors.textMuted,
    fontSize: 14,
  },
  formCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: {
    color: Colors.onSurface,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surfaceVariant,
    color: Colors.onSurface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 14,
    marginBottom: 16,
  },
  inputDisabled: {
    opacity: 0.7,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  editorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sampleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.surfaceVariant,
  },
  sampleButtonText: {
    color: Colors.secondary,
    fontSize: 12,
    fontWeight: '500',
  },
  yamlArea: {
    backgroundColor: '#0d1117',
    color: '#e6edf3',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 13,
    fontFamily: monoFont,
    minHeight: 280,
    marginBottom: 20,
    lineHeight: 19,
  },
  deployBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  deployBtnDisabled: {
    opacity: 0.6,
  },
  deployBtnText: {
    color: Colors.onPrimary,
    fontWeight: 'bold',
    fontSize: 14,
  },
});
