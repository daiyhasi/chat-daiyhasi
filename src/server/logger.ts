import fs from "node:fs";
import path from "node:path";

const logDir = path.resolve(process.cwd(), "logs");
const logFile = path.join(logDir, "server.log");

export function logInfo(event: string, details: Record<string, unknown> = {}): void {
  writeLog("info", event, details);
}

export function logError(event: string, details: Record<string, unknown> = {}): void {
  writeLog("error", event, details);
}

export function toLogError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { error };
  }

  return {
    errorName: error.name,
    errorMessage: error.message,
    errorStack: error.stack
  };
}

function writeLog(level: "info" | "error", event: string, details: Record<string, unknown>): void {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    event,
    ...details
  });

  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(logFile, `${line}\n`, "utf8");

  if (level === "error") {
    console.error(line);
    return;
  }

  console.info(line);
}
