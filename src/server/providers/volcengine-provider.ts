import type { ChatMessage } from "../../shared/chat.js";
import { logError, logInfo, toLogError } from "../logger.js";
import type { GenerateChatOptions, GenerateChatResult, ModelProvider } from "./model-provider.js";

interface VolcengineProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  defaultMaxOutputTokens: number;
}

interface ArkInputTextPart {
  type: "input_text";
  text: string;
}

interface ArkInputImagePart {
  type: "input_image";
  image_url: string;
}

interface ArkInputMessage {
  role: "user" | "assistant";
  content: Array<ArkInputTextPart | ArkInputImagePart>;
}

interface ArkOutputTextPart {
  type?: string;
  text?: string;
}

interface ArkOutputMessage {
  type?: string;
  role?: string;
  content?: ArkOutputTextPart[];
}

interface ArkResponsesResponse {
  output_text?: string;
  output?: ArkOutputMessage[];
  error?: {
    message?: string;
    code?: string;
  };
}

export class VolcengineProvider implements ModelProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly responsesUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly defaultMaxOutputTokens: number;

  constructor(config: VolcengineProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.responsesUrl = `${this.baseUrl}/responses`;
    this.model = config.model;
    this.timeoutMs = config.timeoutMs;
    this.defaultMaxOutputTokens = config.defaultMaxOutputTokens;
  }

  async generateChat(options: GenerateChatOptions): Promise<GenerateChatResult> {
    this.assertReady();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const startedAt = Date.now();
    const requestBody = {
      model: this.model,
      input: this.toArkInput(options.messages),
      temperature: options.temperature ?? 0.7,
      max_output_tokens: options.maxTokens ?? this.defaultMaxOutputTokens
    };

    logInfo("ark.responses.request", {
      url: this.responsesUrl,
      model: this.model,
      messageCount: options.messages.length,
      inputCount: requestBody.input.length,
      inputSummary: summarizeInput(requestBody.input),
      temperature: requestBody.temperature,
      maxOutputTokens: requestBody.max_output_tokens
    });

    try {
      const response = await fetch(this.responsesUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      const data = (await response.json()) as ArkResponsesResponse;
      const elapsedMs = Date.now() - startedAt;

      logInfo("ark.responses.response", {
        status: response.status,
        ok: response.ok,
        elapsedMs,
        hasOutputText: Boolean(data.output_text),
        outputCount: data.output?.length ?? 0,
        responsePreview: truncate(JSON.stringify(data), 2000)
      });

      if (!response.ok) {
        const detail = data.error?.message ?? response.statusText;
        throw new Error(`Volcengine Ark Responses request failed: ${detail}`);
      }

      const content = this.readResponseText(data);

      if (!content) {
        logError("ark.responses.empty_message", {
          status: response.status,
          elapsedMs,
          likelyCause: getEmptyMessageHint(data),
          responseBody: truncate(JSON.stringify(data), 4000)
        });
        throw new Error(
          `Volcengine Ark Responses API returned an empty assistant message. ${getEmptyMessageHint(data)}`
        );
      }

      return {
        content,
        provider: "volcengine-ark-responses"
      };
    } catch (error) {
      logError("ark.responses.failed", {
        url: this.responsesUrl,
        model: this.model,
        elapsedMs: Date.now() - startedAt,
        ...toLogError(error)
      });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private assertReady(): void {
    if (!this.apiKey) {
      throw new Error("Missing ARK_API_KEY in environment.");
    }

    if (!this.model) {
      throw new Error("Missing ARK_MODEL in environment.");
    }
  }

  private toArkInput(messages: ChatMessage[]): ArkInputMessage[] {
    const systemPrompt = this.toSystemPrompt(messages);
    const chatMessages = messages.filter((message) => message.role !== "system");

    return chatMessages.map((message, index) => {
      const shouldPrependSystem = index === 0 && message.role === "user" && systemPrompt;
      const content = shouldPrependSystem
        ? this.prependTextPart(message.content, systemPrompt)
        : message.content;

      return {
        role: message.role as "user" | "assistant",
        content: this.toArkContentParts(content)
      };
    });
  }

  private toSystemPrompt(messages: ChatMessage[]): string | undefined {
    const systemPrompts = messages
      .filter((message) => message.role === "system")
      .map((message) => this.extractText(message.content).trim())
      .filter(Boolean);

    return systemPrompts.length > 0 ? systemPrompts.join("\n\n") : undefined;
  }

  private toArkContentParts(content: ChatMessage["content"]): Array<ArkInputTextPart | ArkInputImagePart> {
    if (typeof content === "string") {
      return [{ type: "input_text", text: content }];
    }

    return content.map((part) => {
      if (part.type === "input_image") {
        return {
          type: "input_image",
          image_url: part.imageUrl
        };
      }

      return {
        type: "input_text",
        text: part.text
      };
    });
  }

  private prependTextPart(content: ChatMessage["content"], text: string): ChatMessage["content"] {
    if (typeof content === "string") {
      return `${text}\n\n${content}`;
    }

    return [{ type: "input_text", text }, ...content];
  }

  private extractText(content: ChatMessage["content"]): string {
    if (typeof content === "string") {
      return content;
    }

    return content
      .filter((part) => part.type === "input_text")
      .map((part) => part.text)
      .join("\n");
  }

  private readResponseText(data: ArkResponsesResponse): string {
    const directText = data.output_text?.trim();
    if (directText) {
      return directText;
    }

    return (
      data.output
        ?.flatMap((message) => message.content ?? [])
        .filter((block) => block.type === "output_text" && block.text)
        .map((block) => block.text)
        .join("\n")
        .trim() ?? ""
    );
  }
}

function getEmptyMessageHint(data: ArkResponsesResponse): string {
  const responseStatus = "status" in data ? data.status : undefined;
  const incompleteDetails = "incomplete_details" in data ? data.incomplete_details : undefined;

  if (responseStatus === "incomplete" && JSON.stringify(incompleteDetails).includes("length")) {
    return "The response was incomplete because max_output_tokens was exhausted before final text was produced.";
  }

  return "No output_text or output_text content block was found in the provider response.";
}

function summarizeInput(input: ArkInputMessage[]): Array<Record<string, unknown>> {
  return input.map((message) => ({
    role: message.role,
    parts: message.content.map((part) => {
      if (part.type === "input_image") {
        return {
          type: part.type,
          imageUrl: part.image_url
        };
      }

      return {
        type: part.type,
        textLength: part.text.length,
        textPreview: truncate(part.text, 120)
      };
    })
  }));
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
