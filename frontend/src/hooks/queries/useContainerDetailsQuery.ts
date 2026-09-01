import { useQuery } from '@tanstack/react-query';
import { containersService } from '../../services/containers.service';
import type { ContainerDetails } from '../../types/container.types';

export function useContainerDetailsQuery(id: string) {
  return useQuery<ContainerDetails>({
    queryKey: ['container', id],
    queryFn: () => containersService.get(id),
    enabled: Boolean(id),
  });
}
