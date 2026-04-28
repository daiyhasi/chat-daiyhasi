import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig } from "./config.js";
import { ChatRepository } from "./repositories/chat-repository.js";
import { SettingsRepository } from "./repositories/settings-repository.js";
import { createChatRouter } from "./routes/chat.js";
import { createSettingsRouter } from "./routes/settings.js";
import { createSessionsRouter } from "./routes/sessions.js";

const config = getConfig();
const app = express();
const repository = new ChatRepository();
const settingsRepository = new SettingsRepository(config);

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "chat-daiyhasi-bot" });
});

app.use("/api/chat", createChatRouter(settingsRepository));
app.use("/api/settings", createSettingsRouter(settingsRepository));
app.use("/api/sessions", createSessionsRouter(repository, settingsRepository));

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(currentDir, "../client");

app.use(express.static(clientDist));
app.get("*", (_request, response) => {
  response.sendFile(path.join(clientDist, "index.html"));
});

app.listen(config.port, () => {
  console.log(`Chat bot API listening on http://127.0.0.1:${config.port}`);
});
