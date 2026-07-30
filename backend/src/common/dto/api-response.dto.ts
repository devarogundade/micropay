export class ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
  search?: string;
  filters?: Record<string, unknown>;
  requestId?: string;
  network?: string;
}

export class ApiErrorBody {
  code!: string;
  message!: string;
  details?: unknown;
}

export class ApiResponseDto<T = unknown> {
  success!: boolean;
  data?: T;
  meta?: ApiMeta;
  error?: ApiErrorBody;
}

export function ok<T>(
  data: T,
  meta?: ApiMeta,
): ApiResponseDto<T> {
  return { success: true, data, meta };
}

export function fail(
  code: string,
  message: string,
  details?: unknown,
): ApiResponseDto<never> {
  return {
    success: false,
    error: { code, message, details },
  };
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  extra?: Omit<ApiMeta, 'page' | 'limit' | 'total' | 'totalPages'>,
): ApiResponseDto<T[]> {
  return ok(data, {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / Math.max(limit, 1))),
    ...extra,
  });
}
