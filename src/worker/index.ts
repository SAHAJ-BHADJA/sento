// Standalone background worker. Run with `npm run worker`.
// Deploy as a long-running process (Railway/Render worker, a container, etc.).
export {};

// Load .env when running outside Next (best-effort; Next loads it itself).
try {
  (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.(".env");
} catch {
  // no .env file — rely on the ambient environment
}

const { env } = await import("../lib/env");
const { logger } = await import("../lib/log");
const { runCycle } = await import("../lib/engine");

const log = logger("worker");
let running = false;
let stopped = false;

async function tick(): Promise<void> {
  if (running) {
    log.warn("previous cycle still running; skipping tick");
    return;
  }
  running = true;
  const started = Date.now();
  try {
    await runCycle();
    log.info("cycle complete", { ms: Date.now() - started });
  } catch (err) {
    log.error("cycle crashed", { error: err instanceof Error ? err.message : String(err) });
  } finally {
    running = false;
  }
}

async function main(): Promise<void> {
  log.info("worker starting", {
    pollIntervalSeconds: env.pollIntervalSeconds,
    matchThreshold: env.matchThreshold,
    requireApproval: env.requireApproval,
  });
  await tick();
  const interval = setInterval(() => {
    if (!stopped) void tick();
  }, env.pollIntervalSeconds * 1000);

  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      log.info("shutting down", { sig });
      stopped = true;
      clearInterval(interval);
      setTimeout(() => process.exit(0), 500);
    });
  }
}

void main();
