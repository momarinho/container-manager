import { useQuery } from '@tanstack/react-query';
import { containersService } from '../../services/containers.service';
import type { Container } from '../../types/container.types';

export interface ContainerQueryParams {
  all?: boolean;
  status?: string;
  name?: string;
}

export function useContainersQuery(params?: ContainerQueryParams) {
  return useQuery<Container[]>({
    queryKey: ['containers', params],
    queryFn: () => containersService.list(params),
  });
}
