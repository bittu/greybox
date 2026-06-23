export class PilotError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'PilotError';
    if (Error.captureStackTrace) Error.captureStackTrace(this, PilotError);
  }
}

export class CodeEvaluationError extends PilotError {
  constructor(
    message: string,
    public readonly code: string,
    cause?: Error,
  ) {
    super(message, cause);
    this.name = 'CodeEvaluationError';
  }
}

/** Thrown by brain.check() when an assertion fails */
export class AssertionError extends PilotError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'AssertionError';
  }
}

/** Thrown when the LLM cannot find the target element in the tree */
export class ElementNotFoundError extends PilotError {
  constructor(
    public readonly instruction: string,
    reason?: string,
  ) {
    super(`Element not found for: "${instruction}"${reason ? ` — ${reason}` : ''}`);
    this.name = 'ElementNotFoundError';
  }
}
