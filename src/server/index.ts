import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig } from "./config.js";
import { VolcengineProvider } from "./providers/volcengine-provider.js";
import { createChatRouter } from "./routes/chat.js";

const config = getConfig();
const app = express();
const provider = new VolcengineProvider(config.ark);

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "chat-daiyhasi-bot" });
});

app.use("/api/chat", createChatRouter(provider));

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(currentDir, "../client");

app.use(express.static(clientDist));
app.get("*", (_request, response) => {
  response.sendFile(path.join(clientDist, "index.html"));
});

app.listen(config.port, () => {
  console.log(`Chat bot API listening on http://127.0.0.1:${config.port}`);
});
