import type { ChatMessage } from "../../shared/chat.js";
import type { GenerateChatOptions, GenerateChatResult, ModelProvider } from "./model-provider.js";

interface VolcengineProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
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
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config: VolcengineProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.model = config.model;
    this.timeoutMs = config.timeoutMs;
  }

  async generateChat(options: GenerateChatOptions): Promise<GenerateChatResult> {
    this.assertReady();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          input: this.toArkInput(options.messages),
          temperature: options.temperature ?? 0.7,
          max_output_tokens: options.maxTokens ?? 1000
        }),
        signal: controller.signal
      });

      const data = (await response.json()) as ArkResponsesResponse;

      if (!response.ok) {
        const detail = data.error?.message ?? response.statusText;
        throw new Error(`Volcengine Ark Responses request failed: ${detail}`);
      }

      const content = this.readResponseText(data);

      if (!content) {
        throw new Error("Volcengine Ark Responses API returned an empty assistant message.");
      }

      return {
        content,
        provider: "volcengine-ark-responses"
      };
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
