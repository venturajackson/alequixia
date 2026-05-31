const statusEl = document.querySelector("#status");
const eventsEl = document.querySelector("#events");
const messagesEl = document.querySelector("#messages");
const form = document.querySelector("#form");
const input = document.querySelector("#input");
const providerBadge = document.querySelector("#providerBadge");
const apiAvailable = location.hostname === "localhost" || location.hostname === "127.0.0.1";

refreshStatus();
if (apiAvailable) connectEvents();
append(
  "assistant",
  apiAvailable
    ? "Estou pronta. Pode me pedir uma tarefa ou usar comandos como /memory.remember."
    : "Este e o painel publico da Alequixia. Para conversar com a IA, rode o projeto localmente com npm run start."
);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
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
  refreshStatus();
});

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
    ["Provider", data.provider],
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
