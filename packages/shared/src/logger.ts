export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

/**
 * Keys that must never reach a log sink verbatim. Kickbase session cookies and
 * raw API payloads have leaked in the upstream project's logging — this list
 * is the guard against repeating that (see docs/upstream-analysis.md, finding #4).
 */
const REDACTED_KEYS = new Set(["cookie", "kb_cookie", "authorization", "token", "password"]);

function redact(fields: LogFields | undefined): LogFields | undefined {
  if (!fields) return fields;
  const redacted: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    redacted[key] = REDACTED_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : value;
  }
  return redacted;
}

export interface CreateLoggerOptions {
  minLevel?: LogLevel;
  sink?: (line: string) => void;
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const minLevel = options.minLevel ?? "info";
  const sink =
    options.sink ??
    ((line: string) => {
      console.log(line);
    });

  function write(level: LogLevel, message: string, fields?: LogFields): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...redact(fields),
    };
    sink(JSON.stringify(entry));
  }

  return {
    debug: (message, fields) => {
      write("debug", message, fields);
    },
    info: (message, fields) => {
      write("info", message, fields);
    },
    warn: (message, fields) => {
      write("warn", message, fields);
    },
    error: (message, fields) => {
      write("error", message, fields);
    },
  };
}
