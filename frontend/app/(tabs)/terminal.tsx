import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Alert,
  type LayoutChangeEvent,
} from "react-native";
import {
  History,
  Send,
  Terminal as TerminalIcon,
  X,
  Check,
} from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { useTerminal } from "../../src/hooks/useTerminal";
import { terminalService } from "../../src/services/terminal.service";

const monoFont = Platform.OS === "ios" ? "Menlo" : "monospace";

type ContainerOption = {
  id: string;
  name: string;
  image: string;
};

type TerminalSize = {
  cols: number;
  rows: number;
};

export default function TerminalScreen() {
  const [selectedContainer, setSelectedContainer] =
    useState<ContainerOption | null>(null);
  const [showContainerSelector, setShowContainerSelector] = useState(false);
  const [containers, setContainers] = useState<ContainerOption[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [output, setOutput] = useState<string>("");
  const [input, setInput] = useState("");
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldAutoStart, setShouldAutoStart] = useState(false);
  const [terminalSize, setTerminalSize] = useState<TerminalSize>({
    cols: 80,
    rows: 24,
  });

  const scrollViewRef = useRef<ScrollView>(null);

  // Hook de terminal
  const {
    isConnected,
    isReady,
    isReconnecting,
    sessionId,
    startSession,
    sendInput,
    resize,
    closeSession,
  } = useTerminal(
    selectedContainer?.id || null,
    (data: string) => {
      setOutput((prev) => prev + data);
    },
    (newSessionId: string) => {
      setIsSessionActive(true);
      setShouldAutoStart(false);
      setError(null);
      console.log("Session started:", newSessionId);
    },
    () => {
      setIsSessionActive(false);
      setShouldAutoStart(false);
    },
    (errorMessage: string) => {
      setError(errorMessage);
      setIsSessionActive(false);
      setShouldAutoStart(
        errorMessage === "Connection lost. Attempting to reconnect...",
      );
    },
  );

  // Carregar containers disponíveis
  const loadContainers = async () => {
    setLoadingContainers(true);
    try {
      const data = await terminalService.getAvailableContainers();
      setContainers(data);
    } catch (err) {
      console.error("Error loading containers:", err);
      Alert.alert("Erro", "Não foi possível carregar os containers");
    } finally {
      setLoadingContainers(false);
    }
  };

  // Auto-scroll quando há nova saída
  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: false });
    }
  }, [output]);

  // Iniciar sessão automaticamente quando o socket estiver pronto
  useEffect(() => {
    if (
      shouldAutoStart &&
      isConnected &&
      isReady &&
      selectedContainer &&
      !sessionId &&
      !isSessionActive
    ) {
      startSession("/bin/sh", terminalSize.cols, terminalSize.rows);
    }
  }, [
    isConnected,
    isReady,
    isSessionActive,
    selectedContainer,
    sessionId,
    shouldAutoStart,
    startSession,
    terminalSize.cols,
    terminalSize.rows,
  ]);

  useEffect(() => {
    if (sessionId && isSessionActive) {
      resize(terminalSize.cols, terminalSize.rows);
    }
  }, [isSessionActive, resize, sessionId, terminalSize.cols, terminalSize.rows]);

  const handleSelectContainer = (container: ContainerOption) => {
    setSelectedContainer(container);
    setShowContainerSelector(false);
    setOutput("");
    setIsSessionActive(false);
    setError(null);
    setShouldAutoStart(true);
  };

  const handleSend = () => {
    if (input.trim() && isSessionActive) {
      sendInput(input + "\r");
      setInput("");
    }
  };

  const handleDisconnect = () => {
    closeSession();
    setSelectedContainer(null);
    setOutput("");
    setIsSessionActive(false);
    setError(null);
    setShouldAutoStart(false);
  };

  const handleReconnectSession = () => {
    setError(null);
    setIsSessionActive(false);
    setShouldAutoStart(true);
  };

  const handleTerminalLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const nextCols = Math.max(24, Math.floor((width - 24) / 8));
    const nextRows = Math.max(8, Math.floor((height - 24) / 18));

    setTerminalSize((current) => {
      if (current.cols === nextCols && current.rows === nextRows) {
        return current;
      }

      return { cols: nextCols, rows: nextRows };
    });
  };

  // Se não selecionou container, mostra seletor
  if (!selectedContainer) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TerminalIcon color={Colors.primary} size={24} />
          <Text style={styles.headerTitle}>Terminal</Text>
        </View>

        <View style={styles.emptyState}>
          <TerminalIcon color={Colors.outline} size={48} />
          <Text style={styles.emptyTitle}>Nenhum container selecionado</Text>
          <Text style={styles.emptyDescription}>
            Selecione um container para abrir o terminal interativo
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              loadContainers();
              setShowContainerSelector(true);
            }}
          >
            <Text style={styles.primaryButtonText}>Selecionar Container</Text>
          </TouchableOpacity>
        </View>

        <Modal
          visible={showContainerSelector}
          animationType="slide"
          onRequestClose={() => setShowContainerSelector(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Container</Text>
              <TouchableOpacity onPress={() => setShowContainerSelector(false)}>
                <X color={Colors.onSurface} size={24} />
              </TouchableOpacity>
            </View>

            {loadingContainers ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Carregando containers...</Text>
              </View>
            ) : containers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  Nenhum container em execução
                </Text>
              </View>
            ) : (
              <FlatList
                data={containers}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalContainerItem}
                    onPress={() => handleSelectContainer(item)}
                  >
                    <View style={styles.modalContainerItemLeft}>
                      <View style={styles.modalContainerDot} />
                      <View style={styles.modalContainerInfo}>
                        <Text style={styles.modalContainerName}>{item.name}</Text>
                        <Text style={styles.modalContainerImage}>{item.image}</Text>
                      </View>
                    </View>
                    <Check color={Colors.primary} size={20} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </Modal>
      </View>
    );
  }

  // Terminal conectado
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: isSessionActive
                  ? Colors.tertiary
                  : Colors.outline,
              },
            ]}
          />
          <Text style={styles.statusText}>
            {isReconnecting
              ? "RECONNECTING..."
              : isSessionActive
                ? "CONNECTED"
                : isConnected
                  ? "READY"
                  : "CONNECTING..."}
          </Text>
          <Text style={styles.selectedContainerName}>{selectedContainer.name}</Text>
        </View>
        <TouchableOpacity
          style={styles.disconnectButton}
          onPress={handleDisconnect}
        >
          <X color={Colors.error} size={20} />
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!isSessionActive ? (
        <View style={styles.sessionActions}>
          <TouchableOpacity
            style={styles.reconnectButton}
            onPress={handleReconnectSession}
          >
            <Text style={styles.reconnectButtonText}>
              {isReconnecting ? "Reconectando..." : "Abrir sessão"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.terminalContainer} onLayout={handleTerminalLayout}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.terminalScroll}
          contentContainerStyle={styles.terminalContent}
        >
          <Text style={styles.terminalOutput}>{output}</Text>
          {isSessionActive && <View style={styles.cursor} />}
        </ScrollView>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inputArea}
      >
        <TouchableOpacity
          style={styles.historyBtn}
          onPress={() => {
            // TODO: Implementar histórico de comandos
          }}
        >
          <History color={Colors.secondary} size={20} />
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder={
              isSessionActive ? "Digite um comando..." : "Aguardando conexão..."
            }
            placeholderTextColor="rgba(65, 71, 82, 0.4)"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            autoCapitalize="none"
            autoCorrect={false}
            editable={isSessionActive}
          />
        </View>

        <TouchableOpacity
          style={[styles.sendBtn, !isSessionActive && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!isSessionActive}
        >
          <Send color={Colors.background} size={20} />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingTop: 48,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.onSurface,
    marginLeft: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 2,
    color: Colors.secondary,
  },
  selectedContainerName: {
    fontSize: 12,
    color: Colors.outline,
    marginLeft: 8,
  },
  disconnectButton: {
    padding: 8,
  },
  errorBanner: {
    backgroundColor: "rgba(255, 180, 171, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 180, 171, 0.2)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
  },
  sessionActions: {
    marginBottom: 12,
    alignItems: "flex-start",
  },
  reconnectButton: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  reconnectButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  terminalContainer: {
    flex: 1,
    backgroundColor: "#000",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(65, 71, 82, 0.1)",
    marginBottom: 16,
    overflow: "hidden",
  },
  terminalScroll: {
    flex: 1,
  },
  terminalContent: {
    padding: 16,
  },
  terminalOutput: {
    color: "#c9f1d5",
    fontFamily: monoFont,
    fontSize: 14,
    lineHeight: 20,
  },
  cursor: {
    width: 8,
    height: 20,
    backgroundColor: Colors.primary,
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 24,
  },
  historyBtn: {
    padding: 12,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 12,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: "#000",
    borderRadius: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: Colors.onSurface,
    fontFamily: monoFont,
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: Colors.primaryContainer,
    padding: 14,
    borderRadius: 12,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.onSurface,
  },
  emptyDescription: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  primaryButton: {
    backgroundColor: Colors.primaryContainer,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 48,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.onSurface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: "center",
  },
  modalContainerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceHigh,
  },
  modalContainerItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalContainerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.tertiary,
  },
  modalContainerInfo: {
    gap: 4,
  },
  modalContainerName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.onSurface,
  },
  modalContainerImage: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});
