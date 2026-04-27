import type { ChatMessage } from "../../shared/chat.js";

export interface GenerateChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateChatResult {
  content: string;
  provider: string;
}

export interface ModelProvider {
  generateChat(options: GenerateChatOptions): Promise<GenerateChatResult>;
}
