# 工程架构说明

## 当前目标

先搭建一个可运行、可扩展的聊天 bot 骨架。重点不是一次性做完整 Agent，而是给后续能力演进留下清晰边界：

- UI 层：负责输入、展示消息、基础状态。
- API 层：负责校验请求、组织上下文、调用模型 provider。
- Provider 层：隔离具体模型厂商，当前面向火山引擎。
- Shared 层：沉淀前后端共同使用的数据结构。

## 请求链路

```text
React Chat UI
  -> POST /api/chat
  -> chat route
  -> model provider
  -> Volcengine Ark Responses API
  -> normalized assistant message
```

## Provider 设计

`src/server/providers/model-provider.ts` 定义统一接口：

- 输入：标准化聊天消息、可选温度、可选最大 token。
- 输出：标准化 assistant 文本。

这样后续接入 OpenAI、DeepSeek、本地模型或多模型路由时，不需要改前端和 route 的主体逻辑。

## 环境变量

真实密钥只放在 `.env.local`，不要提交到仓库。

```text
ARK_API_KEY
ARK_BASE_URL
ARK_MODEL
API_TIMEOUT_MS
```

## 后续演进路线

1. Streaming：用 SSE 或 Fetch stream 返回增量 token。
2. Memory：先做本地 SQLite，再考虑向量库。
3. Tools：为搜索、文件读写、代码执行等能力定义工具协议。
4. Eval：围绕真实前端 Agent JD 做任务集和评分规则。
