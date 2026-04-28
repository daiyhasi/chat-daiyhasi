import { Router } from "express";
import type { ModelSettingsResponse, UpdateModelSettingsRequest } from "../../shared/chat.js";
import { SettingsRepository } from "../repositories/settings-repository.js";

export function createSettingsRouter(repository: SettingsRepository): Router {
  const router = Router();

  router.get("/model", (_request, response) => {
    const payload: ModelSettingsResponse = {
      settings: repository.getPublicModelSettings()
    };

    response.json(payload);
  });

  router.put("/model", (request, response) => {
    const body = request.body as Partial<UpdateModelSettingsRequest>;
    const updateRequest = parseModelSettings(body);

    if (typeof updateRequest === "string") {
      response.status(400).json({
        error: {
          message: updateRequest,
          code: "BAD_MODEL_SETTINGS"
        }
      });
      return;
    }

    const payload: ModelSettingsResponse = {
      settings: repository.updateModelSettings(updateRequest)
    };

    response.json(payload);
  });

  return router;
}

function parseModelSettings(body: Partial<UpdateModelSettingsRequest>): UpdateModelSettingsRequest | string {
  if (body.provider !== "volcengine-ark-responses") {
    return "provider must be volcengine-ark-responses.";
  }

  if (typeof body.baseUrl !== "string" || !body.baseUrl.trim().startsWith("http")) {
    return "baseUrl must be a valid http URL.";
  }

  if (typeof body.model !== "string" || body.model.trim().length === 0) {
    return "model is required.";
  }

  if (!Number.isFinite(body.defaultMaxOutputTokens) || body.defaultMaxOutputTokens! <= 0) {
    return "defaultMaxOutputTokens must be greater than 0.";
  }

  if (!Number.isFinite(body.timeoutMs) || body.timeoutMs! <= 0) {
    return "timeoutMs must be greater than 0.";
  }

  const defaultMaxOutputTokens = body.defaultMaxOutputTokens;
  const timeoutMs = body.timeoutMs;

  if (typeof defaultMaxOutputTokens !== "number" || typeof timeoutMs !== "number") {
    return "numeric settings are required.";
  }

  return {
    provider: body.provider,
    apiKey: body.apiKey,
    baseUrl: body.baseUrl,
    model: body.model,
    defaultMaxOutputTokens,
    timeoutMs
  };
}
