export class BaseXiApiError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "BaseXiApiError";
  }
}

export class BaseXiNetworkError extends BaseXiApiError {
  constructor(endpoint: string, cause: unknown) {
    super(`Network error calling BaseXI at ${endpoint}: ${String(cause)}`, endpoint);
    this.name = "BaseXiNetworkError";
    this.cause = cause;
  }
}

export class BaseXiParseError extends BaseXiApiError {
  constructor(endpoint: string, cause: unknown) {
    super(`Failed to parse BaseXI response at ${endpoint}: ${String(cause)}`, endpoint);
    this.name = "BaseXiParseError";
    this.cause = cause;
  }
}
