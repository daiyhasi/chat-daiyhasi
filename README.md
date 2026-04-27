# Chat Daiyhasi Bot

一个面向 AI Agent 转型练习的聊天 bot 工程骨架。当前先完成前后端基础架构，后续可以逐步接入火山引擎模型、会话记忆、工具调用和业务场景评估。

## 技术栈

- React + Vite：聊天界面
- Express：后端 API
- TypeScript：前后端共享类型
- SQLite：本地保存会话和消息历史
- Provider 抽象：先接火山引擎，后续可替换或并联其他模型

## 快速开始

```bash
npm install
cp .env.example .env.local
```

把你的火山引擎 API key 写入 `.env.local`：

```bash
ARK_API_KEY=你的本地密钥
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_MODEL=doubao-seed-2-0-lite-260215
```

启动后端：

```bash
npm run dev:server
```

启动前端：

```bash
npm run dev
```

前端默认地址是 `http://127.0.0.1:5173`，后端默认地址是 `http://127.0.0.1:8787`。

## 目录结构

```text
src/
  client/        # React 聊天界面
  server/        # Express API 与模型接入
  shared/        # 前后端共享类型
data/            # 本地 SQLite 数据库，已忽略提交
docs/
  architecture.md
```

## 下一步建议

1. 明确火山引擎模型 ID 和调用参数。
2. 增加流式响应，让聊天体验更接近真实产品。
3. 增加会话搜索、重命名、删除和摘要记忆。
4. 用真实 JD 场景沉淀 Agent 能力清单和评测用例。
