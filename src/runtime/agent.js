export class Agent {
  constructor({ soul, rules, rulesStore, memory, secrets, provider, events, workspaceId }) {
    this.soul = soul;
    this.rules = rules;
    this.rulesStore = rulesStore;
    this.memory = memory;
    this.secrets = secrets;
    this.provider = provider;
    this.events = events;
    this.workspaceId = workspaceId;
    this.skills = new Map();
  }

  registerSkills(skills) {
    for (const skill of skills) {
      this.skills.set(skill.name, skill);
    }
  }

  status() {
    return {
      workspaceId: this.workspaceId,
      provider: this.provider.name,
      skills: [...this.skills.keys()].sort(),
      dynamicRules: this.rules.dynamicRules,
      memory: this.memory.status()
    };
  }

  async chat(message, context = {}) {
    if (!message.trim()) return { answer: "Envie uma mensagem para eu processar.", actions: [] };

    this.events.publish({ type: "chat.received", message, context });
    await this.memory.appendHistory({ role: "user", content: message, context });

    const direct = await this.tryDirectSkill(message, context);
    if (direct) return direct;

    const routed = await this.tryNaturalSkill(message, context);
    if (routed) return routed;

    const memories = (await this.memory.search(message, 8))
      .filter((item) => !(item.source === "history" && item.text.startsWith("assistant:")))
      .slice(0, 5);
    const prompt = this.buildPrompt(message, memories);
    const answer = await this.provider.complete(prompt);

    await this.memory.appendHistory({ role: "assistant", content: answer, context });
    this.events.publish({ type: "chat.answered", answer });
    return { answer, actions: [], memories };
  }

  async tryDirectSkill(message, context) {
    const trimmed = message.trim();
    const match = trimmed.match(/^\/([a-z0-9_.-]+)\s*(.*)$/i);
    if (!match) return null;
    const [, name, rawArgs] = match;
    const result = await this.runSkill(name, { text: rawArgs, context });
    await this.memory.appendHistory({ role: "assistant", content: result.answer || JSON.stringify(result), context });
    return result;
  }

  async tryNaturalSkill(message, context) {
    const intent = routeIntent(message);
    if (!intent) return null;
    const result = await this.runSkill(intent.name, { ...intent.args, context });
    await this.memory.appendHistory({ role: "assistant", content: result.answer || JSON.stringify(result), context });
    return result;
  }

  async runSkill(name, args = {}) {
    const skill = this.skills.get(name);
    if (!skill) return { answer: `Skill nao encontrada: ${name}`, actions: [] };
    this.events.publish({ type: "skill.started", skill: name, args: redact(args) });
    const result = await skill.run(args);
    this.events.publish({ type: "skill.finished", skill: name, result: redact(result) });
    return result;
  }

  buildPrompt(message, memories) {
    const rules = this.rules.dynamicRules.map((rule) => `- ${rule}`).join("\n");
    const memoryText = memories.map((item) => `- ${item.text}`).join("\n") || "- Nenhuma memoria relevante.";
    return [
      this.soul,
      "\n## Regras dinamicas\n",
      rules,
      "\n## Memorias relevantes\n",
      memoryText,
      "\n## Pedido do usuario\n",
      message
    ].join("\n");
  }
}

function routeIntent(message) {
  const text = normalize(message);
  const raw = String(message).trim();

  const urlMatch = raw.match(/https?:\/\/[^\s]+/i);
  if (urlMatch && /\b(abrir|abre|abra|acessar|acesse|navegar|entre)\b/.test(text)) {
    return { name: "open.url", args: { target: urlMatch[0] } };
  }

  const siteMatch = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/\b(?:abrir|abre|abra|acessar|acesse|navegar|entre)\s+(?:o\s+site\s+|a\s+pagina\s+|no\s+)?([a-z0-9.-]+\.[a-z]{2,})(?:\s|$)/);
  if (siteMatch) {
    return { name: "open.url", args: { target: siteMatch[1] } };
  }

  if (/\b(abrir|abre|abra)\s+(navegador|browser|internet)\b/.test(text)) {
    return { name: "open.url", args: { target: "https://www.google.com" } };
  }

  const appMatch = text.match(/\b(?:abrir|abre|abra|iniciar|execute|executar)\s+(?:o\s+|a\s+)?([a-z0-9 ._-]+)$/);
  if (appMatch) {
    return { name: "open.app", args: { app: appMatch[1].trim() } };
  }

  if (/\b(status|diagnostico|diagnostico do sistema|informacoes do sistema)\b/.test(text)) {
    return { name: "system.info", args: {} };
  }

  return null;
}

function normalize(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function redact(value) {
  const text = JSON.stringify(value);
  return JSON.parse(text.replace(/(api[_-]?key|token|password|passphrase|secret)":"[^"]+"/gi, '$1":"[redacted]"'));
}
