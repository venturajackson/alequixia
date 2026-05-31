const statusEl = document.querySelector("#status");
const eventsEl = document.querySelector("#events");
const messagesEl = document.querySelector("#messages");
const form = document.querySelector("#form");
const input = document.querySelector("#input");
const providerBadge = document.querySelector("#providerBadge");
const quickActions = document.querySelectorAll("[data-prompt]");
const apiAvailable = location.hostname === "localhost" || location.hostname === "127.0.0.1";

refreshStatus();
if (apiAvailable) connectEvents();
append(
  "assistant",
  apiAvailable
    ? "Estou pronta. Peça uma tarefa, pergunta ou acao local."
    : "Painel publico da Alequixia. Para usar a IA e acoes locais, rode npm run start."
);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await sendMessage(input.value.trim());
  input.value = "";
});

for (const button of quickActions) {
  button.addEventListener("click", async () => {
    await sendMessage(button.dataset.prompt || "");
  });
}

async function sendMessage(message) {
  if (!message) return;
  append("user", message);
  if (!apiAvailable) {
    append("assistant", "No GitHub Pages o backend Node nao fica ativo. Clone o repositorio, rode npm run start e acesse http://localhost:4000.");
    return;
  }
  const waiting = append("assistant", "Processando...");
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message })
  });
  const data = await response.json();
  waiting.textContent = data.answer || JSON.stringify(data, null, 2);
  renderActions(data.actions || []);
  refreshStatus();
}

async function refreshStatus() {
  const data = apiAvailable
    ? await fetch("/api/status").then((response) => response.json())
    : {
        workspaceId: "github-pages",
        provider: "site-estatico",
        skills: ["memoria", "skills", "dashboard", "ollama"],
        dynamicRules: ["Publicacao estatica do projeto Alequixia."]
      };
  providerBadge.textContent = data.provider;
  statusEl.innerHTML = "";
  const rows = [
    ["Workspace", data.workspaceId],
    ["Skills", String(data.skills.length)],
    ["Regras", String(data.dynamicRules.length)]
  ];
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    statusEl.append(row);
  }
}

function connectEvents() {
  const source = new EventSource("/api/events");
  source.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const line = document.createElement("div");
    line.textContent = `${data.at} ${data.type}`;
    eventsEl.prepend(line);
  };
}

function append(role, text) {
  const node = document.createElement("div");
  node.className = `message ${role}`;
  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = role === "user" ? "Voce" : "Alequixia";
  const body = document.createElement("div");
  body.textContent = text;
  node.append(meta, body);
  messagesEl.append(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return body;
}

function renderActions(actions) {
  if (!actions.length) return;
  const summary = actions.map((action) => action.type).join("  |  ");
  const node = document.createElement("div");
  node.className = "action-trace";
  node.textContent = `Acao executada: ${summary}`;
  messagesEl.append(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
