import { useQuery } from '@tanstack/react-query';
import { systemService } from '../../services/system.service';
import type { SystemStats } from '../../types/system.types';

export function useSystemStatsQuery() {
  return useQuery<SystemStats>({
    queryKey: ['systemStats'],
    queryFn: () => systemService.getStats(),
  });
}
