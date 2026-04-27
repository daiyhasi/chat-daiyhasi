export type ChatRole = "system" | "user" | "assistant";

export type ChatContentPart =
  | {
      type: "input_text";
      text: string;
    }
  | {
      type: "input_image";
      imageUrl: string;
    };

export interface ChatMessage {
  id?: string;
  role: ChatRole;
  content: string | ChatContentPart[];
}

export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  message: ChatMessage;
  provider: string;
}

export interface ApiErrorResponse {
  error: {
    message: string;
    code?: string;
  };
}
