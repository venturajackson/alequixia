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

function redact(value) {
  const text = JSON.stringify(value);
  return JSON.parse(text.replace(/(api[_-]?key|token|password|passphrase|secret)":"[^"]+"/gi, '$1":"[redacted]"'));
}
