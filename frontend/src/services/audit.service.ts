import type { AuditLogEntry, AuditLogsResponse } from "../types/audit.types";
import { apiClient } from "./apiClient";

export interface AuditQueryFilter {
  limit?: number;
  offset?: number;
  action?: string;
  resourceType?: string;
}

export const auditService = {
  async listAuditLogs(filter?: AuditQueryFilter): Promise<AuditLogEntry[]> {
    const response = await apiClient.get<AuditLogsResponse>("/audit-logs", {
      params: filter,
    });
    return response.data.data;
  },
};

export default auditService;
