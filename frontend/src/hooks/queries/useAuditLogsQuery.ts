import { useQuery } from "@tanstack/react-query";
import { auditService, type AuditQueryFilter } from "../../services/audit.service";
import type { AuditLogEntry } from "../../types/audit.types";

export const AUDIT_LOGS_QUERY_KEY = (filter?: AuditQueryFilter) =>
  ["auditLogs", filter?.action, filter?.resourceType, filter?.limit, filter?.offset] as const;

export function useAuditLogsQuery(filter?: AuditQueryFilter) {
  return useQuery<AuditLogEntry[]>({
    queryKey: AUDIT_LOGS_QUERY_KEY(filter),
    queryFn: () => auditService.listAuditLogs(filter),
    refetchInterval: 5000,
  });
}
