import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  ConfigProvider,
  Empty,
  Flex,
  Form,
  Input,
  Layout,
  List,
  InputNumber,
  Modal,
  Select,
  Spin,
  theme,
  Typography
} from "antd";
import {
  LeftOutlined,
  DeleteOutlined,
  SettingOutlined,
  MessageOutlined,
  PlusOutlined,
  RightOutlined,
  SendOutlined
} from "@ant-design/icons";
import type {
  ApiErrorResponse,
  ChatContentPart,
  ChatMessage,
  ChatSession,
  CreateSessionMessageResponse,
  CreateSessionResponse,
  ListMessagesResponse,
  ListSessionsResponse,
  ModelSettingsResponse,
  PublicModelSettings,
  UpdateModelSettingsRequest
} from "../shared/chat";

const { Sider, Content } = Layout;
const { Text, Title } = Typography;
const { TextArea } = Input;

export function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [modelSettings, setModelSettings] = useState<PublicModelSettings | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const [settingsForm] = Form.useForm<UpdateModelSettingsRequest>();

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    scrollMessagesToBottom();
  }, [activeSessionId, messages.length, isLoading]);

  async function bootstrap() {
    setIsBooting(true);
    setError("");

    try {
      const loadedSessions = await fetchSessions();
      const loadedSettings = await fetchModelSettings();
      setModelSettings(loadedSettings);
      if (loadedSessions.length > 0) {
        setSessions(loadedSessions);
        setActiveSessionId(loadedSessions[0].id);
        setMessages(await fetchMessages(loadedSessions[0].id));
        return;
      }

      const session = await createSession();
      setSessions([session]);
      setActiveSessionId(session.id);
      setMessages([]);
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    } finally {
      setIsBooting(false);
    }
  }

  async function handleCreateSession() {
    if (isLoading) {
      return;
    }

    setError("");

    if (activeSessionId && messages.length === 0) {
      setInput("");
      scrollMessagesToBottom();
      return;
    }

    const existingEmptySession = sessions.find((session) => session.title === "新会话");
    if (existingEmptySession) {
      await handleSelectSession(existingEmptySession.id);
      return;
    }

    try {
      const session = await createSession();
      setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
      setActiveSessionId(session.id);
      setMessages([]);
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    }
  }

  async function handleSelectSession(sessionId: string) {
    if (sessionId === activeSessionId || isLoading) {
      return;
    }

    setError("");
    setActiveSessionId(sessionId);

    try {
      setMessages(await fetchMessages(sessionId));
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    }
  }

  async function handleDeleteSession(sessionId: string) {
    if (isLoading) {
      return;
    }

    setError("");

    try {
      await deleteSession(sessionId);
      const remainingSessions = sessions.filter((session) => session.id !== sessionId);

      if (remainingSessions.length === 0) {
        const session = await createSession();
        setSessions([session]);
        setActiveSessionId(session.id);
        setMessages([]);
        return;
      }

      setSessions(remainingSessions);

      if (sessionId !== activeSessionId) {
        return;
      }

      const nextSession = remainingSessions[0];
      setActiveSessionId(nextSession.id);
      setMessages(await fetchMessages(nextSession.id));
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    }
  }

  async function handleOpenSettings() {
    setError("");
    setIsSettingsOpen(true);

    try {
      const settings = await fetchModelSettings();
      setModelSettings(settings);
      settingsForm.setFieldsValue({
        provider: settings.provider,
        apiKey: "",
        baseUrl: settings.baseUrl,
        model: settings.model,
        defaultMaxOutputTokens: settings.defaultMaxOutputTokens,
        timeoutMs: settings.timeoutMs
      });
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    }
  }

  async function handleSaveSettings(values: UpdateModelSettingsRequest) {
    setIsSettingsSaving(true);
    setError("");

    try {
      const settings = await updateModelSettings(values);
      setModelSettings(settings);
      setIsSettingsOpen(false);
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    } finally {
      setIsSettingsSaving(false);
    }
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content || isLoading || !activeSessionId) {
      return;
    }

    const optimisticUserMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content
    };

    setMessages((current) => [...current, optimisticUserMessage]);
    setInput("");
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`/api/sessions/${activeSessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          temperature: 0.7
        })
      });

      const payload = (await response.json()) as CreateSessionMessageResponse | ApiErrorResponse;
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error.message : "请求失败");
      }

      setMessages((current) => [
        ...current.filter((message) => message.id !== optimisticUserMessage.id),
        payload.userMessage,
        payload.assistantMessage
      ]);
      mergeSession(payload.session);
    } catch (requestError) {
      setMessages((current) => current.filter((message) => message.id !== optimisticUserMessage.id));
      setInput(content);
      setError(toErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    void sendMessage();
  }

  function mergeSession(session: ChatSession) {
    setSessions((current) =>
      [session, ...current.filter((item) => item.id !== session.id)].sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      )
    );
  }

  function scrollMessagesToBottom() {
    requestAnimationFrame(() => {
      const messageList = messageListRef.current;
      if (!messageList) {
        return;
      }

      messageList.scrollTop = messageList.scrollHeight;
    });
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          borderRadius: 8,
          colorPrimary: "#0f766e",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }
      }}
    >
      <Layout className="app-shell">
        <Sider
          breakpoint="md"
          className="sidebar"
          collapsed={isSidebarCollapsed}
          collapsedWidth={64}
          collapsible
          onCollapse={setIsSidebarCollapsed}
          theme="dark"
          trigger={null}
          width={320}
        >
          <Flex className="sidebar-inner" vertical>
            <Button
              aria-label={isSidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
              aria-expanded={!isSidebarCollapsed}
              className="sidebar-toggle"
              icon={isSidebarCollapsed ? <RightOutlined /> : <LeftOutlined />}
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              shape="default"
              type="text"
            />

            {!isSidebarCollapsed ? (
              <>
                <Flex className="sidebar-header" gap={16} vertical>
                  <div>
                    <Title className="app-title" level={3}>
                      Chat Daiyhasi Bot
                    </Title>
                    <Text className="app-subtitle">
                      围绕前端转型 AI Agent 开发，沉淀项目、能力和面试表达。
                    </Text>
                  </div>

                  <Button
                    block
                    disabled={isLoading}
                    icon={<PlusOutlined />}
                    onClick={handleCreateSession}
                    size="large"
                    type="primary"
                  >
                    新建会话
                  </Button>
                </Flex>

                <List
                  className="session-list"
                  dataSource={sessions}
                  locale={{ emptyText: <Empty description="暂无会话" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                  renderItem={(session) => (
                    <List.Item className="session-list-item">
                      <Button
                        block
                        className={`session-item ${session.id === activeSessionId ? "active" : ""}`}
                        icon={<MessageOutlined />}
                        onClick={() => void handleSelectSession(session.id)}
                        type="text"
                      >
                        <span className="session-text">
                          <span className="session-title">{session.title || "新会话"}</span>
                          <time>{formatDateTime(session.updatedAt)}</time>
                        </span>
                      </Button>
                      <Button
                        aria-label="删除会话"
                        className="delete-session-button"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteSession(session.id);
                        }}
                        type="text"
                      />
                    </List.Item>
                  )}
                />

                <Flex className="sidebar-footer" gap={10} vertical>
                  <Button
                    block
                    className="settings-button"
                    icon={<SettingOutlined />}
                    onClick={() => void handleOpenSettings()}
                    type="text"
                  >
                    模型设置
                  </Button>
                  <Flex align="center" className="status" gap={10}>
                    <span aria-hidden="true" className="status-dot" />
                    <Text>{modelSettings?.model ?? "未配置模型"}</Text>
                  </Flex>
                </Flex>
              </>
            ) : null}
          </Flex>
        </Sider>

        <Content className="chat-panel">
          <Flex align="center" className="chat-title" justify="space-between">
            <div>
              <Title level={4}>{activeSession?.title ?? "新会话"}</Title>
              <Text type="secondary">{isBooting ? "正在加载历史记录..." : "最近 10 轮对话会作为模型上下文"}</Text>
            </div>
            {isBooting ? <Spin size="small" /> : null}
          </Flex>

          <div className="message-list" ref={messageListRef}>
            {!isBooting && messages.length === 0 ? (
              <Empty
                className="empty-chat"
                description="新会话已准备好，可以开始聊你的 AI Agent 转型计划。"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : null}

            {messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id ?? renderMessageContent(message.content)}>
                <Text className="message-role">{message.role === "user" ? "你" : "助手"}</Text>
                <p>{renderMessageContent(message.content)}</p>
              </article>
            ))}
            {isLoading ? (
              <article className="message assistant">
                <Text className="message-role">助手</Text>
                <Spin size="small" /> <Text>思考中...</Text>
              </article>
            ) : null}
          </div>

          {error ? <Alert className="error-banner" message={error} showIcon type="error" /> : null}

          <form className="composer" onSubmit={handleSubmit}>
            <TextArea
              aria-label="输入消息"
              autoSize={{ minRows: 2, maxRows: 6 }}
              disabled={isBooting || !activeSessionId}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="输入一个问题，比如：帮我把前端 JD 拆成 AI Agent 学习路线"
              value={input}
            />
            <Button
              disabled={isBooting || isLoading || input.trim().length === 0}
              htmlType="submit"
              icon={<SendOutlined />}
              size="large"
              type="primary"
            >
              发送
            </Button>
          </form>
        </Content>
      </Layout>

      <Modal
        confirmLoading={isSettingsSaving}
        okText="保存配置"
        onCancel={() => setIsSettingsOpen(false)}
        onOk={() => settingsForm.submit()}
        open={isSettingsOpen}
        title="模型接入设置"
        width={640}
      >
        <Form
          form={settingsForm}
          layout="vertical"
          onFinish={(values) => void handleSaveSettings(values)}
          requiredMark={false}
        >
          <Form.Item label="模型提供方" name="provider" rules={[{ required: true, message: "请选择模型提供方" }]}>
            <Select
              options={[
                {
                  label: "火山引擎 Ark Responses API",
                  value: "volcengine-ark-responses"
                }
              ]}
            />
          </Form.Item>

          <Form.Item
            extra={modelSettings?.hasApiKey ? "已保存 API Key。留空表示继续使用当前密钥。" : "本地保存，不会返回给前端展示。"}
            label="API Key"
            name="apiKey"
          >
            <Input.Password autoComplete="off" placeholder="输入新的 API Key，留空则不修改" />
          </Form.Item>

          <Form.Item
            label="Base URL"
            name="baseUrl"
            rules={[{ required: true, message: "请输入 Base URL" }]}
          >
            <Input placeholder="https://ark.cn-beijing.volces.com/api/v3" />
          </Form.Item>

          <Form.Item label="模型 ID" name="model" rules={[{ required: true, message: "请输入模型 ID" }]}>
            <Input placeholder="doubao-seed-2-0-lite-260215" />
          </Form.Item>

          <Flex gap={16}>
            <Form.Item
              className="settings-number-field"
              label="默认输出 Tokens"
              name="defaultMaxOutputTokens"
              rules={[{ required: true, message: "请输入默认输出 tokens" }]}
            >
              <InputNumber min={1} step={256} />
            </Form.Item>

            <Form.Item
              className="settings-number-field"
              label="超时时间 ms"
              name="timeoutMs"
              rules={[{ required: true, message: "请输入超时时间" }]}
            >
              <InputNumber min={1000} step={1000} />
            </Form.Item>
          </Flex>
        </Form>
      </Modal>
    </ConfigProvider>
  );
}

async function fetchSessions(): Promise<ChatSession[]> {
  const response = await fetch("/api/sessions");
  const payload = (await response.json()) as ListSessionsResponse | ApiErrorResponse;
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error.message : "加载会话失败");
  }

  return payload.sessions;
}

async function createSession(): Promise<ChatSession> {
  const response = await fetch("/api/sessions", { method: "POST" });
  const payload = (await response.json()) as CreateSessionResponse | ApiErrorResponse;
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error.message : "创建会话失败");
  }

  return payload.session;
}

async function fetchMessages(sessionId: string): Promise<ChatMessage[]> {
  const response = await fetch(`/api/sessions/${sessionId}/messages`);
  const payload = (await response.json()) as ListMessagesResponse | ApiErrorResponse;
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error.message : "加载消息失败");
  }

  return payload.messages;
}

async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
  if (!response.ok) {
    const payload = (await response.json()) as ApiErrorResponse;
    throw new Error(payload.error.message || "删除会话失败");
  }
}

async function fetchModelSettings(): Promise<PublicModelSettings> {
  const response = await fetch("/api/settings/model");
  const payload = (await response.json()) as ModelSettingsResponse | ApiErrorResponse;
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error.message : "加载模型配置失败");
  }

  return payload.settings;
}

async function updateModelSettings(values: UpdateModelSettingsRequest): Promise<PublicModelSettings> {
  const response = await fetch("/api/settings/model", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values)
  });
  const payload = (await response.json()) as ModelSettingsResponse | ApiErrorResponse;
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error.message : "保存模型配置失败");
  }

  return payload.settings;
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

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "未知错误";
}
