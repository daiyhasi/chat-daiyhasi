import type { ModelSettings } from "../../shared/chat.js";
import type { ModelProvider } from "./model-provider.js";
import { VolcengineProvider } from "./volcengine-provider.js";

export function createModelProvider(settings: ModelSettings): ModelProvider {
  if (settings.provider === "volcengine-ark-responses") {
    return new VolcengineProvider({
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      timeoutMs: settings.timeoutMs,
      defaultMaxOutputTokens: settings.defaultMaxOutputTokens
    });
  }

  throw new Error(`Unsupported model provider: ${settings.provider}`);
}
