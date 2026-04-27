import { FormEvent, useMemo, useState } from "react";
import type { ApiErrorResponse, ChatContentPart, ChatMessage, ChatResponse } from "../shared/chat";

const systemPrompt: ChatMessage = {
  role: "system",
  content: "你是一个帮助前端工程师转型 AI Agent 开发的中文助手，回答要具体、务实、面向真实工作场景。"
};

const welcomeMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "你好，我是你的 AI Agent 转型聊天 bot。可以从 JD 分析、学习路线、项目拆解或代码实践开始聊。"
};

export function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const conversation = useMemo(
    () => [systemPrompt, ...messages.filter((message) => message.role !== "system")],
    [messages]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = input.trim();
    if (!content || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...conversation, userMessage],
          temperature: 0.7
        })
      });

      const payload = (await response.json()) as ChatResponse | ApiErrorResponse;
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error.message : "请求失败");
      }

      setMessages((current) => [...current, payload.message]);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "未知错误";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <h1>Chat Daiyhasi Bot</h1>
        <p>围绕前端转型 AI Agent 开发，沉淀项目、能力和面试表达。</p>
        <div className="status">
          <span aria-hidden="true" />
          火山引擎 Provider
        </div>
      </aside>

      <section className="chat-panel" aria-label="聊天窗口">
        <div className="message-list">
          {messages.map((message) => (
            <article className={`message ${message.role}`} key={message.id ?? renderMessageContent(message.content)}>
              <div className="message-role">{message.role === "user" ? "你" : "助手"}</div>
              <p>{renderMessageContent(message.content)}</p>
            </article>
          ))}
          {isLoading ? (
            <article className="message assistant">
              <div className="message-role">助手</div>
              <p>思考中...</p>
            </article>
          ) : null}
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            aria-label="输入消息"
            onChange={(event) => setInput(event.target.value)}
            placeholder="输入一个问题，比如：帮我把前端 JD 拆成 AI Agent 学习路线"
            rows={3}
            value={input}
          />
          <button disabled={isLoading || input.trim().length === 0} type="submit">
            发送
          </button>
        </form>
      </section>
    </main>
  );
}

function renderMessageContent(content: string | ChatContentPart[]): string {
  if (typeof content === "string") {
    return content;
  }

  return content
    .map((part) => {
      if (part.type === "input_image") {
        return `[图片] ${part.imageUrl}`;
      }

      return part.text;
    })
    .join("\n");
}
