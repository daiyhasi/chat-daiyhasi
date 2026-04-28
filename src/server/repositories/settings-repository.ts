import type { ModelSettings, PublicModelSettings, UpdateModelSettingsRequest } from "../../shared/chat.js";
import type { AppConfig } from "../config.js";
import { db } from "../db.js";

const MODEL_SETTINGS_KEY = "model_settings";

interface SettingsRow {
  value_json: string;
}

export class SettingsRepository {
  constructor(private readonly config: AppConfig) {}

  getModelSettings(): ModelSettings {
    const row = db.prepare("SELECT value_json FROM app_settings WHERE key = ?").get(MODEL_SETTINGS_KEY) as
      | SettingsRow
      | undefined;

    if (!row) {
      return this.getDefaultModelSettings();
    }

    return {
      ...this.getDefaultModelSettings(),
      ...(JSON.parse(row.value_json) as Partial<ModelSettings>)
    };
  }

  getPublicModelSettings(): PublicModelSettings {
    const settings = this.getModelSettings();
    return {
      provider: settings.provider,
      baseUrl: settings.baseUrl,
      model: settings.model,
      defaultMaxOutputTokens: settings.defaultMaxOutputTokens,
      timeoutMs: settings.timeoutMs,
      hasApiKey: settings.apiKey.trim().length > 0
    };
  }

  updateModelSettings(request: UpdateModelSettingsRequest): PublicModelSettings {
    const current = this.getModelSettings();
    const settings: ModelSettings = {
      provider: request.provider,
      apiKey: request.apiKey?.trim() ? request.apiKey.trim() : current.apiKey,
      baseUrl: request.baseUrl.trim(),
      model: request.model.trim(),
      defaultMaxOutputTokens: request.defaultMaxOutputTokens,
      timeoutMs: request.timeoutMs
    };

    db.prepare(
      `
        INSERT INTO app_settings (key, value_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value_json = excluded.value_json,
          updated_at = excluded.updated_at
      `
    ).run(MODEL_SETTINGS_KEY, JSON.stringify(settings), new Date().toISOString());

    return this.getPublicModelSettings();
  }

  private getDefaultModelSettings(): ModelSettings {
    return {
      provider: "volcengine-ark-responses",
      apiKey: this.config.ark.apiKey,
      baseUrl: this.config.ark.baseUrl,
      model: this.config.ark.model,
      defaultMaxOutputTokens: this.config.ark.defaultMaxOutputTokens,
      timeoutMs: this.config.ark.timeoutMs
    };
  }
}
