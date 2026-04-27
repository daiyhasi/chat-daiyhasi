import { Router } from "express";
import type { ChatContentPart, ChatRequest, ChatResponse } from "../../shared/chat.js";
import type { ModelProvider } from "../providers/model-provider.js";

export function createChatRouter(provider: ModelProvider): Router {
  const router = Router();

  router.post("/", async (request, response) => {
    const body = request.body as Partial<ChatRequest>;
    const validationError = validateChatRequest(body);

    if (validationError) {
      response.status(400).json({
        error: {
          message: validationError,
          code: "BAD_CHAT_REQUEST"
        }
      });
      return;
    }

    try {
      const result = await provider.generateChat({
        messages: body.messages!,
        temperature: body.temperature,
        maxTokens: body.maxTokens
      });

      const payload: ChatResponse = {
        message: {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.content
        },
        provider: result.provider
      };

      response.json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown chat error.";
      response.status(500).json({
        error: {
          message,
          code: "CHAT_COMPLETION_FAILED"
        }
      });
    }
  });

  return router;
}

function validateChatRequest(body: Partial<ChatRequest>): string | null {
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return "messages must be a non-empty array.";
  }

  for (const message of body.messages) {
    if (!message || !["system", "user", "assistant"].includes(message.role)) {
      return "each message must include a valid role.";
    }

    if (!isValidContent(message.content)) {
      return "each message must include non-empty content.";
    }
  }

  return null;
}

function isValidContent(content: unknown): content is string | ChatContentPart[] {
  if (typeof content === "string") {
    return content.trim().length > 0;
  }

  if (!Array.isArray(content) || content.length === 0) {
    return false;
  }

  return content.every((part) => {
    if (!part || typeof part !== "object" || !("type" in part)) {
      return false;
    }

    if (part.type === "input_text") {
      return "text" in part && typeof part.text === "string" && part.text.trim().length > 0;
    }

    if (part.type === "input_image") {
      return "imageUrl" in part && typeof part.imageUrl === "string" && part.imageUrl.trim().length > 0;
    }

    return false;
  });
}
