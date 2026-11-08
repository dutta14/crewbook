export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  readonly id: string;

  /** The message carries the id only; never put a person's name in an error. */
  constructor(id: string) {
    super(`Member not found: ${id}`);
    this.name = 'NotFoundError';
    this.id = id;
  }
}
