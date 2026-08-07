export class KickbaseApiError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "KickbaseApiError";
  }
}

/** Thrown for 401/403 responses — almost always an expired or invalid KB_TOKEN. */
export class KickbaseAuthError extends KickbaseApiError {
  constructor(endpoint: string, status: number) {
    super(
      `Kickbase authentication failed (status ${status}) at ${endpoint}. ` +
        "Your KB_TOKEN has likely expired (tokens are short-lived, ~1 hour). " +
        "Kickbase has no web version — capture a fresh Bearer token from the " +
        "mobile app's network traffic and update your environment.",
      endpoint,
      status,
    );
    this.name = "KickbaseAuthError";
  }
}

/** Thrown when a request could not be completed after all retries. */
export class KickbaseNetworkError extends KickbaseApiError {
  constructor(endpoint: string, cause: unknown) {
    super(`Network error calling Kickbase API at ${endpoint}: ${String(cause)}`, endpoint);
    this.name = "KickbaseNetworkError";
    this.cause = cause;
  }
}

/** Thrown when the response body could not be parsed as the expected JSON shape. */
export class KickbaseParseError extends KickbaseApiError {
  constructor(endpoint: string, cause: unknown) {
    super(`Failed to parse Kickbase API response at ${endpoint}: ${String(cause)}`, endpoint);
    this.name = "KickbaseParseError";
    this.cause = cause;
  }
}
