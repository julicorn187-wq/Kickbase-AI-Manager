export class OpenLigaApiError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "OpenLigaApiError";
  }
}

export class OpenLigaNetworkError extends OpenLigaApiError {
  constructor(endpoint: string, cause: unknown) {
    super(`Network error calling OpenLigaDB at ${endpoint}: ${String(cause)}`, endpoint);
    this.name = "OpenLigaNetworkError";
    this.cause = cause;
  }
}

export class OpenLigaParseError extends OpenLigaApiError {
  constructor(endpoint: string, cause: unknown) {
    super(`Failed to parse OpenLigaDB response at ${endpoint}: ${String(cause)}`, endpoint);
    this.name = "OpenLigaParseError";
    this.cause = cause;
  }
}
