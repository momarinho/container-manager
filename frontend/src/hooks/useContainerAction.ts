import { useCallback, useState } from "react";
import { containersService } from "../services/containers.service";
import type { ActionFeedback } from "../components/ActionFeedbackBanner";

export type ContainerActionType =
  | "start"
  | "stop"
  | "restart"
  | "pause"
  | "unpause";

interface RunContainerActionOptions {
  action: ContainerActionType;
  containerId: string;
  onCompleted?: () => Promise<void> | void;
}

function getLoadingMessage(action: ContainerActionType): string {
  switch (action) {
    case "start":
      return "Iniciando container...";
    case "stop":
      return "Parando container...";
    case "restart":
      return "Reiniciando container...";
    case "pause":
      return "Pausando container...";
    case "unpause":
      return "Retomando container...";
  }
}

function getSuccessMessage(action: ContainerActionType): string {
  switch (action) {
    case "start":
      return "Container iniciado com sucesso.";
    case "stop":
      return "Container parado com sucesso.";
    case "restart":
      return "Container reiniciado com sucesso.";
    case "pause":
      return "Container pausado com sucesso.";
    case "unpause":
      return "Container retomado com sucesso.";
  }
}

function getErrorMessage(action: ContainerActionType): string {
  switch (action) {
    case "start":
      return "Falha ao iniciar o container.";
    case "stop":
      return "Falha ao parar o container.";
    case "restart":
      return "Falha ao reiniciar o container.";
    case "pause":
      return "Falha ao pausar o container.";
    case "unpause":
      return "Falha ao retomar o container.";
  }
}

async function executeAction(
  action: ContainerActionType,
  containerId: string,
): Promise<void> {
  switch (action) {
    case "start":
      await containersService.start(containerId);
      return;
    case "stop":
      await containersService.stop(containerId);
      return;
    case "restart":
      await containersService.restart(containerId);
      return;
    case "pause":
      await containersService.pause(containerId);
      return;
    case "unpause":
      await containersService.unpause(containerId);
      return;
  }
}

export function useContainerAction() {
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [pendingAction, setPendingAction] = useState<ContainerActionType | null>(
    null,
  );
  const [pendingContainerId, setPendingContainerId] = useState<string | null>(
    null,
  );

  const clearFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  const runAction = useCallback(
    async ({
      action,
      containerId,
      onCompleted,
    }: RunContainerActionOptions): Promise<boolean> => {
      try {
        setPendingAction(action);
        setPendingContainerId(containerId);
        setFeedback({
          tone: "loading",
          message: getLoadingMessage(action),
        });

        await executeAction(action, containerId);

        if (onCompleted) {
          try {
            await onCompleted();
          } catch (refreshError) {
            console.error("Container action completed but sync failed:", refreshError);
            setFeedback({
              tone: "error",
              message:
                "A ação foi concluída, mas a interface não conseguiu sincronizar os dados.",
            });
            return false;
          }
        }

        setFeedback({
          tone: "success",
          message: getSuccessMessage(action),
        });
        return true;
      } catch (error) {
        console.error(`Failed to execute "${action}" for container ${containerId}:`, error);
        setFeedback({
          tone: "error",
          message: getErrorMessage(action),
        });
        return false;
      } finally {
        setPendingAction(null);
        setPendingContainerId(null);
      }
    },
    [],
  );

  return {
    clearFeedback,
    feedback,
    pendingAction,
    pendingContainerId,
    runAction,
  };
}
