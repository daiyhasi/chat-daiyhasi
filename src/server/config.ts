import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

export interface AppConfig {
  port: number;
  corsOrigin: string;
  ark: {
    apiKey: string;
    baseUrl: string;
    model: string;
    timeoutMs: number;
    defaultMaxOutputTokens: number;
  };
}

export function getConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 8787),
    corsOrigin: process.env.CORS_ORIGIN ?? "http://127.0.0.1:5173",
    ark: {
      apiKey: process.env.ARK_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN ?? "",
      baseUrl:
        process.env.ARK_BASE_URL ??
        process.env.ANTHROPIC_BASE_URL ??
        "https://ark.cn-beijing.volces.com/api/v3",
      model: process.env.ARK_MODEL ?? process.env.ANTHROPIC_MODEL ?? "doubao-seed-2-0-lite-260215",
      timeoutMs: Number(process.env.API_TIMEOUT_MS ?? 3000000),
      defaultMaxOutputTokens: Number(process.env.ARK_DEFAULT_MAX_OUTPUT_TOKENS ?? 4096)
    }
  };
}
