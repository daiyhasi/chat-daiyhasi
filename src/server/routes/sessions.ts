import { Router } from "express";
import type {
  ChatContentPart,
  ChatMessage,
  CreateSessionMessageRequest,
  CreateSessionMessageResponse,
  CreateSessionResponse,
  ListMessagesResponse,
  ListSessionsResponse
} from "../../shared/chat.js";
import { logError, logInfo, toLogError } from "../logger.js";
import { createModelProvider } from "../providers/provider-factory.js";
import { ChatRepository } from "../repositories/chat-repository.js";
import { SettingsRepository } from "../repositories/settings-repository.js";
import { systemPrompt } from "../system-prompt.js";

const CONTEXT_MESSAGE_LIMIT = 20;

export function createSessionsRouter(repository: ChatRepository, settingsRepository: SettingsRepository): Router {
  const router = Router();

  router.get("/", (_request, response) => {
    const payload: ListSessionsResponse = {
      sessions: repository.listSessions()
    };

    response.json(payload);
  });

  router.post("/", (_request, response) => {
    const emptySession = repository.getLatestEmptySession();
    const payload: CreateSessionResponse = {
      session: emptySession ?? repository.createSession()
    };

    response.status(emptySession ? 200 : 201).json(payload);
  });

  router.get("/:sessionId/messages", (request, response) => {
    const session = repository.getSession(request.params.sessionId);
    if (!session) {
      response.status(404).json({ error: { message: "Session not found.", code: "SESSION_NOT_FOUND" } });
      return;
    }

    const payload: ListMessagesResponse = {
      messages: repository.listMessages(session.id)
    };

    response.json(payload);
  });

  router.delete("/:sessionId", (request, response) => {
    const deleted = repository.deleteSession(request.params.sessionId);
    if (!deleted) {
      response.status(404).json({ error: { message: "Session not found.", code: "SESSION_NOT_FOUND" } });
      return;
    }

    response.status(204).send();
  });

  router.post("/:sessionId/messages", async (request, response) => {
    const session = repository.getSession(request.params.sessionId);
    if (!session) {
      response.status(404).json({ error: { message: "Session not found.", code: "SESSION_NOT_FOUND" } });
      return;
    }

    const body = request.body as Partial<CreateSessionMessageRequest>;
    if (!isValidContent(body.content)) {
      response.status(400).json({
        error: {
          message: "content must be non-empty text or content parts.",
          code: "BAD_MESSAGE_REQUEST"
        }
      });
      return;
    }

    try {
      const recentMessages = [
        ...repository.listRecentMessages(session.id, CONTEXT_MESSAGE_LIMIT - 1),
        {
          role: "user",
          content: body.content
        } satisfies ChatMessage
      ];

      logInfo("sessions.message.create", {
        sessionId: session.id,
        recentMessageCount: recentMessages.length,
        contentKind: typeof body.content === "string" ? "text" : "parts"
      });

      const provider = createModelProvider(settingsRepository.getModelSettings());
      const result = await provider.generateChat({
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          ...recentMessages
        ],
        temperature: body.temperature,
        maxTokens: body.maxTokens
      });

      const { userMessage, assistantMessage } = repository.addMessagePair(session.id, body.content, result.content);
      const titledSession = repository.updateTitleIfEmpty(session.id, createTitle(body.content));
      const payload: CreateSessionMessageResponse = {
        userMessage,
        assistantMessage,
        session: repository.getSession(session.id) ?? titledSession,
        provider: result.provider
      };

      response.json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown chat error.";
      logError("sessions.message.failed", {
        sessionId: session.id,
        ...toLogError(error)
      });
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

function isValidContent(content: unknown): content is ChatMessage["content"] {
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

function createTitle(content: ChatMessage["content"]): string {
  const text = extractText(content).replace(/\s+/g, " ").trim();
  return text.length > 24 ? `${text.slice(0, 24)}...` : text || "新会话";
}

function extractText(content: ChatMessage["content"]): string {
  if (typeof content === "string") {
    return content;
  }

  return content
    .filter((part): part is Extract<ChatContentPart, { type: "input_text" }> => part.type === "input_text")
    .map((part) => part.text)
    .join("\n");
}
