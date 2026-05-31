export function createCoreSkills(agent) {
  return [
    {
      name: "memory.remember",
      description: "Salva uma memoria curta no workspace atual.",
      run: async ({ text }) => {
        if (!text?.trim()) return { answer: "Informe o texto da memoria.", actions: [] };
        await agent.memory.remember(text);
        return { answer: "Memoria salva.", actions: [{ type: "memory.remember" }] };
      }
    },
    {
      name: "memory.search",
      description: "Pesquisa fatos e historico do workspace atual.",
      run: async ({ text }) => {
        const results = await agent.memory.search(text || "", 10);
        return { answer: results.map((item) => `${item.source}: ${item.text}`).join("\n") || "Nada encontrado.", actions: [] };
      }
    },
    {
      name: "memory.forget",
      description: "Remove memorias que contem um trecho.",
      run: async ({ text }) => {
        if (!text?.trim()) return { answer: "Informe o trecho a esquecer.", actions: [] };
        const removed = await agent.memory.forget(text);
        return { answer: `${removed} memoria(s) removida(s).`, actions: [{ type: "memory.forget", removed }] };
      }
    },
    {
      name: "behavior.adjust",
      description: "Atualiza regras dinamicas de comportamento.",
      run: async ({ addRule, removeRule, dynamicRules }) => {
        const current = [...(agent.rules.dynamicRules || [])];
        let next = Array.isArray(dynamicRules) ? dynamicRules : current;
        if (addRule) next = [...next, String(addRule)];
        if (removeRule) next = next.filter((rule) => rule !== removeRule);
        agent.rules.dynamicRules = [...new Set(next)].filter(Boolean);
        await agent.rulesStore.write(agent.rules);
        return { answer: "Regras dinamicas atualizadas.", dynamicRules: agent.rules.dynamicRules, actions: [{ type: "behavior.adjust" }] };
      }
    },
    {
      name: "secrets.set",
      description: "Armazena um segredo criptografado.",
      run: async ({ name, value }) => {
        if (!name || !value) return { answer: "Informe name e value.", actions: [] };
        await agent.secrets.set(name, value);
        return { answer: `Segredo ${name} armazenado.`, actions: [{ type: "secrets.set", name }] };
      }
    }
  ];
}
