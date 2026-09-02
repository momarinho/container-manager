export interface AuditLogEntry {
  id: string;
  userId: string;
  username: string;
  action: string;
  resourceType: string;
  resourceId: string;
  clientIp: string;
  details: string;
  status: "SUCCESS" | "FAILED" | string;
  timestamp: string;
}

export interface AuditLogsResponse {
  success: boolean;
  data: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}
