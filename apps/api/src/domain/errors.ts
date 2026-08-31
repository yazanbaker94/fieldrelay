export class DomainError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function notFound(entity: string, id: string): DomainError {
  return new DomainError(`${entity} ${id} was not found`, 404, "NOT_FOUND", { entity, id });
}

export function invalidState(message: string, details?: Record<string, unknown>): DomainError {
  return new DomainError(message, 409, "INVALID_STATE", details);
}

export function validationError(message: string, details?: Record<string, unknown>): DomainError {
  return new DomainError(message, 400, "VALIDATION_ERROR", details);
}
