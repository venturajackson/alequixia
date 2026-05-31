import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Agent } from "./runtime/agent.js";
import { createEventBus } from "./runtime/events.js";
import { JsonStore } from "./runtime/json-store.js";
import { Memory } from "./runtime/memory.js";
import { SecretStore } from "./runtime/secret-store.js";
import { Scheduler } from "./runtime/scheduler.js";
import { createProvider } from "./runtime/providers.js";
import { createCoreSkills } from "./skills/core.js";
import { createLocalActionSkills } from "./skills/local-actions.js";
import { createShellSkill } from "./skills/shell.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
await loadDotEnv(join(root, ".env"));
const env = process.env;
const port = Number(env.PORT || 4000);
const workspaceId = env.WORKSPACE_ID || "default";
const workspaceRoot = join(root, "workspaces", workspaceId);
const publicRoot = join(root, "web");

const events = createEventBus();
const rulesStore = new JsonStore(join(root, "config", "rules.json"));
const soul = await readFile(join(root, "config", "soul.md"), "utf8");
const rules = await rulesStore.read();
const memory = new Memory(workspaceRoot);
const secrets = new SecretStore(join(workspaceRoot, "secrets.enc"), env.SECRET_STORE_PASSPHRASE || "");
const provider = createProvider(env);

const agent = new Agent({
  soul,
  rules,
  rulesStore,
  memory,
  secrets,
  provider,
  events,
  workspaceId
});

agent.registerSkills(createCoreSkills(agent));
agent.registerSkills(createLocalActionSkills({ events, workspaceRoot }));
agent.registerSkills([createShellSkill({ rules, workspaceRoot, allowShell: env.ALLOW_SHELL === "true" })]);

const scheduler = new Scheduler({ events, rules, agent });
scheduler.start();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/status") {
      return json(res, 200, agent.status());
    }

    if (req.method === "GET" && url.pathname === "/api/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive"
      });
      const unsubscribe = events.subscribe((event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });
      req.on("close", unsubscribe);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      const body = await readJson(req);
      const response = await agent.chat(String(body.message || ""), {
        channel: "dashboard",
        user: body.user || "local"
      });
      return json(res, 200, response);
    }

    if (req.method === "POST" && url.pathname === "/api/rules") {
      const body = await readJson(req);
      const response = await agent.runSkill("behavior.adjust", body);
      return json(res, 200, response);
    }

    if (req.method === "GET") {
      const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      const safeFile = file.replaceAll("..", "");
      const content = await readFile(join(publicRoot, safeFile));
      return sendStatic(res, safeFile, content);
    }

    json(res, 404, { error: "not_found" });
  } catch (error) {
    json(res, 500, { error: "internal_error", message: error.message });
  }
});

server.listen(port, () => {
  events.publish({ type: "system.started", port, workspaceId });
  console.log(`Alequixia dashboard: http://localhost:${port}`);
});

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

function sendStatic(res, file, content) {
  const type = file.endsWith(".css") ? "text/css" : file.endsWith(".js") ? "text/javascript" : "text/html";
  res.writeHead(200, { "content-type": `${type}; charset=utf-8` });
  res.end(content);
}

async function loadDotEnv(file) {
  try {
    const content = await readFile(file, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
