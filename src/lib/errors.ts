// Typed application errors — backend-standards.md §5.1
// Route handlers catch AppError subclasses and map them to HTTP responses.

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super('FORBIDDEN', message, 403)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 422)
  }
}

export class ConflictError extends AppError {
  constructor(message: string, data?: Record<string, unknown>) {
    super('CONFLICT', message, 409, data)
  }
}

export class GoneError extends AppError {
  constructor(message: string) {
    super('GONE', message, 410)
  }
}
