import type { ChatMessage, ChatSession } from "../../shared/chat.js";
import { db } from "../db.js";

interface SessionRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content_json: string;
  created_at: string;
}

export class ChatRepository {
  createSession(): ChatSession {
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: crypto.randomUUID(),
      title: "新会话",
      createdAt: now,
      updatedAt: now
    };

    db.prepare(
      `
        INSERT INTO sessions (id, title, created_at, updated_at)
        VALUES (@id, @title, @createdAt, @updatedAt)
      `
    ).run({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    });

    return session;
  }

  listSessions(): ChatSession[] {
    const rows = db
      .prepare("SELECT id, title, created_at, updated_at FROM sessions ORDER BY updated_at DESC")
      .all() as unknown as SessionRow[];

    return rows.map(toSession);
  }

  getLatestEmptySession(): ChatSession | null {
    const row = db
      .prepare(
        `
          SELECT sessions.id, sessions.title, sessions.created_at, sessions.updated_at
          FROM sessions
          LEFT JOIN messages ON messages.session_id = sessions.id
          GROUP BY sessions.id
          HAVING COUNT(messages.id) = 0
          ORDER BY sessions.updated_at DESC
          LIMIT 1
        `
      )
      .get() as SessionRow | undefined;

    return row ? toSession(row) : null;
  }

  countMessages(sessionId: string): number {
    const row = db.prepare("SELECT COUNT(*) AS count FROM messages WHERE session_id = ?").get(sessionId) as
      | { count: number }
      | undefined;

    return row?.count ?? 0;
  }

  deleteSession(sessionId: string): boolean {
    const result = db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    return result.changes > 0;
  }

  getSession(sessionId: string): ChatSession | null {
    const row = db
      .prepare("SELECT id, title, created_at, updated_at FROM sessions WHERE id = ?")
      .get(sessionId) as SessionRow | undefined;

    return row ? toSession(row) : null;
  }

  listMessages(sessionId: string): ChatMessage[] {
    const rows = db
      .prepare(
        `
          SELECT id, session_id, role, content_json, created_at
          FROM messages
          WHERE session_id = ?
          ORDER BY created_at ASC
        `
      )
      .all(sessionId) as unknown as MessageRow[];

    return rows.map(toMessage);
  }

  listRecentMessages(sessionId: string, limit: number): ChatMessage[] {
    const rows = db
      .prepare(
        `
          SELECT id, session_id, role, content_json, created_at
          FROM messages
          WHERE session_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        `
      )
      .all(sessionId, limit) as unknown as MessageRow[];

    return rows.reverse().map(toMessage);
  }

  addMessage(sessionId: string, role: "user" | "assistant", content: ChatMessage["content"]): ChatMessage {
    const now = new Date().toISOString();
    const messageId = crypto.randomUUID();
    const message: ChatMessage = {
      id: messageId,
      role,
      content
    };

    db.prepare(
      `
        INSERT INTO messages (id, session_id, role, content_json, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
    ).run(messageId, sessionId, role, JSON.stringify(content), now);

    this.touchSession(sessionId, now);

    return message;
  }

  addMessagePair(
    sessionId: string,
    userContent: ChatMessage["content"],
    assistantContent: ChatMessage["content"]
  ): { userMessage: ChatMessage; assistantMessage: ChatMessage } {
    const now = new Date().toISOString();
    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: userContent
    };
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: assistantContent
    };

    const insertMessage = db.prepare(
      `
        INSERT INTO messages (id, session_id, role, content_json, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
    );

    db.exec("BEGIN");
    try {
      insertMessage.run(userMessageId, sessionId, userMessage.role, JSON.stringify(userMessage.content), now);
      insertMessage.run(
        assistantMessageId,
        sessionId,
        assistantMessage.role,
        JSON.stringify(assistantMessage.content),
        now
      );
      this.touchSession(sessionId, now);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    return { userMessage, assistantMessage };
  }

  updateTitleIfEmpty(sessionId: string, title: string): ChatSession {
    const normalizedTitle = title.trim() || "新会话";
    db.prepare(
      `
        UPDATE sessions
        SET title = ?
        WHERE id = ? AND title = '新会话'
      `
    ).run(normalizedTitle, sessionId);

    return this.getSession(sessionId)!;
  }

  private touchSession(sessionId: string, updatedAt: string): void {
    db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(updatedAt, sessionId);
  }
}

function toSession(row: SessionRow): ChatSession {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: JSON.parse(row.content_json) as ChatMessage["content"]
  };
}
