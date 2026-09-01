import { useMutation, useQueryClient } from '@tanstack/react-query';
import { containersService } from '../../services/containers.service';
import type { Container } from '../../types/container.types';

export type ContainerActionType = 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'delete';

interface ActionPayload {
  id: string;
  action: ContainerActionType;
  force?: boolean;
}

export function useContainerActionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, action, force }: ActionPayload) => {
      switch (action) {
        case 'start':
          return containersService.start(id);
        case 'stop':
          return containersService.stop(id);
        case 'restart':
          return containersService.restart(id);
        case 'pause':
          return containersService.pause(id);
        case 'unpause':
          return containersService.unpause(id);
        case 'delete':
          return containersService.remove(id, force);
      }
    },
    onMutate: async ({ id, action }) => {
      await queryClient.cancelQueries({ queryKey: ['containers'] });
      await queryClient.cancelQueries({ queryKey: ['container', id] });

      const previousContainers = queryClient.getQueryData<Container[]>(['containers']);

      if (previousContainers) {
        let nextState = 'running';
        if (action === 'stop') {
          nextState = 'exited';
        } else if (action === 'pause') {
          nextState = 'paused';
        } else if (action === 'unpause') {
          nextState = 'running';
        }

        if (action === 'delete') {
          queryClient.setQueryData<Container[]>(
            ['containers'],
            previousContainers.filter((c) => c.id !== id)
          );
        } else {
          queryClient.setQueryData<Container[]>(
            ['containers'],
            previousContainers.map((c) =>
              c.id === id ? { ...c, state: nextState, status: `${nextState} (optimistic)` } : c
            )
          );
        }
      }

      return { previousContainers };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousContainers) {
        queryClient.setQueryData(['containers'], context.previousContainers);
      }
    },
    onSettled: (_data, _error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['containers'] });
      void queryClient.invalidateQueries({ queryKey: ['container', id] });
      void queryClient.invalidateQueries({ queryKey: ['systemStats'] });
    },
  });
}
