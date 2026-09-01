import { useQuery } from '@tanstack/react-query';
import { networksService } from '../../services/networks.service';
import type { DockerNetwork } from '../../types/network.types';

export function useNetworksQuery() {
  return useQuery<DockerNetwork[]>({
    queryKey: ['networks'],
    queryFn: () => networksService.list(),
  });
}
