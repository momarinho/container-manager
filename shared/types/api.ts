export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccess<T, M = Record<string, never>> {
  success: true;
  data: T;
  meta?: M;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorPayload;
}

export type ApiResponse<T, M = Record<string, never>> = ApiSuccess<T, M> | ApiFailure;
