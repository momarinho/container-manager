import { useQuery } from '@tanstack/react-query';
import { volumesService } from '../../services/volumes.service';
import type { DockerVolume } from '../../types/volume.types';

export function useVolumesQuery() {
  return useQuery<DockerVolume[]>({
    queryKey: ['volumes'],
    queryFn: () => volumesService.list(),
  });
}
