// Tiny structured logger. Keeps evidence/observation style: every line is a
// JSON object so worker output is greppable.

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, scope: string, message: string, data?: unknown) {
  const line = {
    t: new Date().toISOString(),
    level,
    scope,
    message,
    ...(data !== undefined ? { data } : {}),
  };
  const text = JSON.stringify(line);
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

export function logger(scope: string) {
  return {
    debug: (m: string, d?: unknown) => emit("debug", scope, m, d),
    info: (m: string, d?: unknown) => emit("info", scope, m, d),
    warn: (m: string, d?: unknown) => emit("warn", scope, m, d),
    error: (m: string, d?: unknown) => emit("error", scope, m, d),
  };
}
