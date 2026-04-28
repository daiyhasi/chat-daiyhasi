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

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionResponse {
  session: ChatSession;
}

export interface ListSessionsResponse {
  sessions: ChatSession[];
}

export interface ListMessagesResponse {
  messages: ChatMessage[];
}

export interface CreateSessionMessageRequest {
  content: ChatMessage["content"];
  temperature?: number;
  maxTokens?: number;
}

export interface CreateSessionMessageResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  session: ChatSession;
  provider: string;
}

export type ModelProviderType = "volcengine-ark-responses";

export interface ModelSettings {
  provider: ModelProviderType;
  apiKey: string;
  baseUrl: string;
  model: string;
  defaultMaxOutputTokens: number;
  timeoutMs: number;
}

export interface PublicModelSettings extends Omit<ModelSettings, "apiKey"> {
  hasApiKey: boolean;
}

export interface ModelSettingsResponse {
  settings: PublicModelSettings;
}

export interface UpdateModelSettingsRequest {
  provider: ModelProviderType;
  apiKey?: string;
  baseUrl: string;
  model: string;
  defaultMaxOutputTokens: number;
  timeoutMs: number;
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
