import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Box, Check, Layers3, PackageSearch } from "lucide-react-native";
import { Colors } from "../../../constants/Colors";
import ActionFeedbackBanner, {
  ActionFeedback,
} from "../../components/ActionFeedbackBanner";
import { containersService } from "../../services/containers.service";
import type {
  CreateContainerPort,
  CreateContainerRequest,
  CreateContainerVolume,
  ImageValidationResponse,
  PullStep,
} from "../../types/container.types";

const SUGGESTED_IMAGES = [
  "nginx:latest",
  "redis:7",
  "postgres:16",
  "node:20-alpine",
  "alpine:latest",
];

function parseLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseKeyValueLines(value: string): Record<string, string> {
  return parseLines(value).reduce<Record<string, string>>((result, line) => {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      return result;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1);
    if (!key) {
      return result;
    }

    result[key] = rawValue;
    return result;
  }, {});
}

function parsePorts(value: string): CreateContainerPort[] {
  return parseLines(value).flatMap((line) => {
    const [portPart, protocolPart] = line.split("/");
    const protocol = protocolPart === "udp" ? "udp" : "tcp";
    const segments = portPart.split(":").map((segment) => segment.trim());

    if (segments.length === 1) {
      const containerPort = Number(segments[0]);
      if (!Number.isFinite(containerPort) || containerPort <= 0) {
        return [];
      }

      return [{ containerPort, protocol }];
    }

    if (segments.length === 2) {
      const [hostPortRaw, containerPortRaw] = segments;
      const hostPort = Number(hostPortRaw);
      const containerPort = Number(containerPortRaw);
      if (
        !Number.isFinite(hostPort) ||
        !Number.isFinite(containerPort) ||
        hostPort <= 0 ||
        containerPort <= 0
      ) {
        return [];
      }

      return [{ hostPort, containerPort, protocol }];
    }

    if (segments.length === 3) {
      const [hostIp, hostPortRaw, containerPortRaw] = segments;
      const hostPort = Number(hostPortRaw);
      const containerPort = Number(containerPortRaw);
      if (
        !hostIp ||
        !Number.isFinite(hostPort) ||
        !Number.isFinite(containerPort) ||
        hostPort <= 0 ||
        containerPort <= 0
      ) {
        return [];
      }

      return [{ hostIp, hostPort, containerPort, protocol }];
    }

    return [];
  });
}

function parseVolumes(value: string): CreateContainerVolume[] {
  return parseLines(value).flatMap((line) => {
    const parts = line.split(":");
    if (parts.length < 2) {
      return [];
    }

    const source = parts[0]?.trim();
    const target = parts[1]?.trim();
    const mode = parts[2]?.trim().toLowerCase();

    if (!source || !target) {
      return [];
    }

    return [
      {
        source,
        target,
        readOnly: mode === "ro",
      },
    ];
  });
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholder={placeholder}
        placeholderTextColor={Colors.textPlaceholder}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        autoCapitalize="none"
      />
    </View>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.previewRow}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={styles.previewValue}>{value}</Text>
    </View>
  );
}

export default function CreateContainerScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [image, setImage] = useState("nginx:latest");
  const [commandInput, setCommandInput] = useState("");
  const [entrypointInput, setEntrypointInput] = useState("");
  const [envInput, setEnvInput] = useState("");
  const [portsInput, setPortsInput] = useState("8080:80/tcp");
  const [volumesInput, setVolumesInput] = useState("");
  const [labelsInput, setLabelsInput] = useState("");
  const [workingDir, setWorkingDir] = useState("");
  const [restartPolicy, setRestartPolicy] = useState<
    "no" | "always" | "unless-stopped" | "on-failure"
  >("unless-stopped");
  const [restartMaxRetries, setRestartMaxRetries] = useState("0");
  const [autoStart, setAutoStart] = useState(true);
  const [pullImage, setPullImage] = useState(true);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [imageValidation, setImageValidation] =
    useState<ImageValidationResponse | null>(null);
  const [isValidatingImage, setIsValidatingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdContainerId, setCreatedContainerId] = useState<string | null>(null);
  const [pullSteps, setPullSteps] = useState<PullStep[]>([]);

  const payload = useMemo<CreateContainerRequest>(
    () => ({
      name: name.trim() || undefined,
      image: image.trim(),
      command: parseLines(commandInput),
      entrypoint: parseLines(entrypointInput),
      env: parseKeyValueLines(envInput),
      ports: parsePorts(portsInput),
      volumes: parseVolumes(volumesInput),
      restartPolicy,
      restartMaxRetries: Number(restartMaxRetries) || 0,
      workingDir: workingDir.trim() || undefined,
      autoStart,
      pullImage,
      labels: parseKeyValueLines(labelsInput),
    }),
    [
      autoStart,
      commandInput,
      entrypointInput,
      envInput,
      image,
      labelsInput,
      name,
      portsInput,
      pullImage,
      restartMaxRetries,
      restartPolicy,
      volumesInput,
      workingDir,
    ],
  );

  const previewSummary = useMemo(
    () => ({
      commandCount: payload.command.length,
      envCount: Object.keys(payload.env).length,
      portCount: payload.ports.length,
      volumeCount: payload.volumes.length,
      labelCount: Object.keys(payload.labels).length,
    }),
    [payload],
  );

  const validateImage = async () => {
    if (!payload.image) {
      setFeedback({
        tone: "error",
        message: "Informe uma imagem antes de validar.",
      });
      return;
    }

    setIsValidatingImage(true);
    setFeedback({
      tone: "loading",
      message: "Validando disponibilidade da imagem...",
    });

    try {
      const result = await containersService.validateImage(payload.image);
      setImageValidation(result);

      if (!result.available) {
        setFeedback({
          tone: "error",
          message: "Imagem nao encontrada localmente nem no registry.",
        });
        return;
      }

      setFeedback({
        tone: "success",
        message:
          result.source === "local"
            ? "Imagem disponivel localmente."
            : "Imagem encontrada no registry e pronta para pull.",
      });
    } catch (error: any) {
      const message =
        error.response?.data?.error?.message ||
        error.message ||
        "Falha ao validar imagem.";
      setFeedback({ tone: "error", message });
      setImageValidation(null);
    } finally {
      setIsValidatingImage(false);
    }
  };

  const createContainer = async () => {
    if (!payload.image) {
      setFeedback({
        tone: "error",
        message: "Imagem do container e obrigatoria.",
      });
      return;
    }

    setIsSubmitting(true);
    setCreatedContainerId(null);
    setPullSteps([]);
    setFeedback({
      tone: "loading",
      message: "Validando imagem e preparando criacao...",
    });

    try {
      const validation = await containersService.validateImage(payload.image);
      setImageValidation(validation);

      if (!validation.available) {
        setFeedback({
          tone: "error",
          message: "A imagem informada nao esta disponivel.",
        });
        return;
      }

      setFeedback({
        tone: "loading",
        message: validation.requiresPull && payload.pullImage
          ? "Imagem localizada no registry. Fazendo pull e criando container..."
          : "Criando container...",
      });

      const response = await containersService.create(payload);
      setCreatedContainerId(response.container.id);
      setPullSteps(response.pullSteps);
      setFeedback({
        tone: "success",
        message: response.imagePulled
          ? "Container criado com pull da imagem concluido."
          : "Container criado com sucesso.",
      });
    } catch (error: any) {
      const message =
        error.response?.data?.error?.message ||
        error.response?.data?.error?.details?.message ||
        error.message ||
        "Falha ao criar container.";
      setFeedback({ tone: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={18} color={Colors.onSurface} />
        </TouchableOpacity>

        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>CONTAINER_FACTORY</Text>
          <Text style={styles.title}>Create Container</Text>
          <Text style={styles.subtitle}>
            Configure imagem, rede, volumes e runtime antes de enviar para o Docker.
          </Text>
        </View>
      </View>

      <ActionFeedbackBanner feedback={feedback} />

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <PackageSearch size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Image</Text>
        </View>

        <Field
          label="IMAGE"
          value={image}
          onChangeText={setImage}
          placeholder="nginx:latest"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {SUGGESTED_IMAGES.map((suggestedImage) => (
              <TouchableOpacity
                key={suggestedImage}
                style={[
                  styles.chip,
                  image === suggestedImage && styles.chipActive,
                ]}
                onPress={() => setImage(suggestedImage)}
              >
                <Text
                  style={[
                    styles.chipText,
                    image === suggestedImage && styles.chipTextActive,
                  ]}
                >
                  {suggestedImage}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => void validateImage()}
          disabled={isValidatingImage || isSubmitting}
        >
          {isValidatingImage ? (
            <ActivityIndicator size="small" color={Colors.onSurface} />
          ) : (
            <Check size={14} color={Colors.primary} />
          )}
          <Text style={styles.secondaryButtonText}>Validate image</Text>
        </TouchableOpacity>

        {imageValidation ? (
          <View style={styles.validationCard}>
            <KeyValue label="Source" value={imageValidation.source.toUpperCase()} />
            <KeyValue
              label="Pull"
              value={imageValidation.requiresPull ? "REQUIRED" : "NOT_REQUIRED"}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Box size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Runtime</Text>
        </View>

        <Field
          label="NAME"
          value={name}
          onChangeText={setName}
          placeholder="web-nginx"
        />
        <Field
          label="WORKING_DIR"
          value={workingDir}
          onChangeText={setWorkingDir}
          placeholder="/usr/src/app"
        />
        <Field
          label="COMMAND"
          value={commandInput}
          onChangeText={setCommandInput}
          placeholder={"npm\nrun\nstart"}
          multiline
        />
        <Field
          label="ENTRYPOINT"
          value={entrypointInput}
          onChangeText={setEntrypointInput}
          placeholder={"/docker-entrypoint.sh"}
          multiline
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Layers3 size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Bindings</Text>
        </View>

        <Field
          label="ENV"
          value={envInput}
          onChangeText={setEnvInput}
          placeholder={"NODE_ENV=production\nPORT=3000"}
          multiline
        />
        <Field
          label="PORTS"
          value={portsInput}
          onChangeText={setPortsInput}
          placeholder={"8080:80/tcp\n127.0.0.1:5432:5432/tcp"}
          multiline
        />
        <Field
          label="VOLUMES"
          value={volumesInput}
          onChangeText={setVolumesInput}
          placeholder={"/host/data:/var/lib/app\n/tmp/cache:/cache:ro"}
          multiline
        />
        <Field
          label="LABELS"
          value={labelsInput}
          onChangeText={setLabelsInput}
          placeholder={"com.example.role=frontend"}
          multiline
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Behavior</Text>

        <Field
          label="RESTART_POLICY"
          value={restartPolicy}
          onChangeText={(value) =>
            setRestartPolicy(
              value === "no" ||
                value === "always" ||
                value === "on-failure" ||
                value === "unless-stopped"
                ? value
                : "unless-stopped",
            )
          }
          placeholder="unless-stopped"
        />
        <Field
          label="RESTART_MAX_RETRIES"
          value={restartMaxRetries}
          onChangeText={setRestartMaxRetries}
          placeholder="0"
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>AUTO_START</Text>
          <Switch
            value={autoStart}
            onValueChange={setAutoStart}
            trackColor={{ false: Colors.outline, true: Colors.primaryContainer }}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>PULL_IMAGE_IF_MISSING</Text>
          <Switch
            value={pullImage}
            onValueChange={setPullImage}
            trackColor={{ false: Colors.outline, true: Colors.primaryContainer }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preview</Text>
        <View style={styles.previewCard}>
          <KeyValue label="Image" value={payload.image || "N/A"} />
          <KeyValue label="Name" value={payload.name || "auto-generated"} />
          <KeyValue label="Command args" value={String(previewSummary.commandCount)} />
          <KeyValue label="Env vars" value={String(previewSummary.envCount)} />
          <KeyValue label="Port bindings" value={String(previewSummary.portCount)} />
          <KeyValue label="Volumes" value={String(previewSummary.volumeCount)} />
          <KeyValue label="Labels" value={String(previewSummary.labelCount)} />
          <KeyValue label="Restart" value={payload.restartPolicy.toUpperCase()} />
          <KeyValue label="Auto start" value={payload.autoStart ? "YES" : "NO"} />
        </View>
      </View>

      {pullSteps.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pull Summary</Text>
          <View style={styles.previewCard}>
            {pullSteps.map((step, index) => (
              <Text key={`${step.status}-${index}`} style={styles.logLine}>
                {step.status}
                {step.detail ? ` • ${step.detail}` : ""}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.footerActions}>
        <TouchableOpacity
          style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
          onPress={() => void createContainer()}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={Colors.background} />
          ) : (
            <Text style={styles.primaryButtonText}>Create container</Text>
          )}
        </TouchableOpacity>

        {createdContainerId ? (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.replace(`/container/${createdContainerId}` as any)}
          >
            <Text style={styles.secondaryButtonText}>Open container</Text>
          </TouchableOpacity>
        ) : null}
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
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  title: {
    color: Colors.onSurface,
    fontSize: 26,
    fontWeight: "700",
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: Colors.outline,
    padding: 16,
    gap: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: "700",
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    color: Colors.textSubtle,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  input: {
    minHeight: 48,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outline,
    color: Colors.onSurface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  inputMultiline: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  chipRow: {
    flexDirection: "row",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  chipActive: {
    borderColor: Colors.primaryContainer,
    backgroundColor: Colors.surface,
  },
  chipText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: {
    color: Colors.primary,
  },
  validationCard: {
    gap: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outline,
    padding: 14,
  },
  previewCard: {
    gap: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outline,
    padding: 14,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  previewLabel: {
    color: Colors.textSubtle,
    fontSize: 12,
  },
  previewValue: {
    flex: 1,
    color: Colors.onSurface,
    fontSize: 12,
    textAlign: "right",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outline,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  switchLabel: {
    color: Colors.onSurface,
    fontSize: 13,
    fontWeight: "600",
  },
  footerActions: {
    gap: 12,
  },
  primaryButton: {
    minHeight: 52,
    backgroundColor: Colors.primaryContainer,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: 48,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.outline,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  logLine: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
