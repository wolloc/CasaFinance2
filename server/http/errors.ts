import type { ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { log } from '../observability/logger.js';

export const getErrorMessage = (error: unknown, fallback = 'Erro interno no servidor'): string =>
  error instanceof Error ? error.message : fallback;

export const globalErrorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const requestId = request.header('x-request-id') ?? randomUUID();
  const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
    ? error.status
    : 500;
  log('error', 'http_request_failed', { requestId, method: request.method, path: request.path, status, errorType: error instanceof Error ? error.name : 'UnknownError' });
  response.status(status).json({ success: false, error: status >= 500 ? 'Erro interno no servidor' : getErrorMessage(error), request_id: requestId });
};
