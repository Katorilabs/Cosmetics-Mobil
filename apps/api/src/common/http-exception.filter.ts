import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

type ErrorPayload = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

type ErrorRequest = {
  url: string;
  headers: Record<string, string | string[] | undefined>;
};

type ErrorResponse = {
  setHeader(name: string, value: string): void;
  status(status: number): { json(body: unknown): void };
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    status: number;
    details?: unknown;
    path: string;
    timestamp: string;
    requestId: string;
  };
};

export function buildApiError(
  exception: unknown,
  path: string,
  requestId: string = randomUUID(),
  timestamp: string = new Date().toISOString(),
): { status: number; body: ApiErrorBody } {
  const status = exception instanceof HttpException
    ? exception.getStatus()
    : HttpStatus.INTERNAL_SERVER_ERROR;
  const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
  const payload: ErrorPayload = typeof raw === 'object' && raw !== null ? raw : { message: raw };
  const validationMessages = Array.isArray(payload.message)
    ? payload.message.filter((message): message is string => typeof message === 'string')
    : undefined;
  const explicitMessage = typeof payload.message === 'string' ? payload.message : undefined;
  const message = status === HttpStatus.INTERNAL_SERVER_ERROR
    ? 'An unexpected error occurred'
    : validationMessages
      ? 'Request validation failed'
      : explicitMessage ?? 'Request failed';
  const code = typeof payload.code === 'string'
    ? payload.code
    : validationMessages
      ? 'VALIDATION_FAILED'
      : `HTTP_${status}`;
  const details = payload.details ?? (validationMessages ? { violations: validationMessages } : undefined);

  return {
    status,
    body: {
      error: {
        code,
        message,
        status,
        ...(details === undefined ? {} : { details }),
        path,
        timestamp,
        requestId,
      },
    },
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<ErrorRequest>();
    const response = http.getResponse<ErrorResponse>();
    const suppliedRequestId = request.headers['x-request-id'];
    const candidate = Array.isArray(suppliedRequestId) ? suppliedRequestId[0] : suppliedRequestId;
    const requestId = typeof candidate === 'string' && /^[A-Za-z0-9._-]{1,100}$/.test(candidate)
      ? candidate
      : randomUUID();
    const apiError = buildApiError(exception, request.url, requestId);

    if (apiError.status >= 500) {
      this.logger.error('Unhandled request error', exception instanceof Error ? exception.stack : undefined);
    }

    response.setHeader('x-request-id', requestId);
    response.status(apiError.status).json(apiError.body);
  }
}
