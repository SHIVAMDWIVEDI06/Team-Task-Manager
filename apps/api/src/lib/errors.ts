export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  badRequest: (message = 'Bad request', details?: unknown) => new HttpError(400, 'bad_request', message, details),
  validation: (details: unknown) => new HttpError(400, 'validation_error', 'Validation failed', details),
  unauthorized: (message = 'Authentication required') => new HttpError(401, 'unauthorized', message),
  forbidden: (message = 'You do not have permission to do that') => new HttpError(403, 'forbidden', message),
  notFound: (what = 'Resource') => new HttpError(404, 'not_found', `${what} not found`),
  conflict: (message: string) => new HttpError(409, 'conflict', message),
  tooLarge: (message = 'Payload too large') => new HttpError(413, 'payload_too_large', message),
  rateLimited: () => new HttpError(429, 'rate_limited', 'Too many requests — slow down'),
  internal: (message = 'Internal server error') => new HttpError(500, 'internal', message),
};
