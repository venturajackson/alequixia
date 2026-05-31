export function createProvider(env) {
  const selected = env.AI_PROVIDER || "auto";
  if (selected === "auto") return new AutoProvider(env);
  if (selected === "openrouter") return new OpenRouterProvider(env);
  if (selected === "ollama") return new OllamaProvider(env);
  return new MockProvider();
}

class AutoProvider {
  name = "auto";

  constructor(env) {
    this.openrouter = new OpenRouterProvider(env);
    this.ollama = new OllamaProvider(env);
    this.mock = new MockProvider();
  }

  async complete(prompt) {
    if (this.openrouter.isConfigured()) return this.openrouter.complete(prompt);
    if (await this.ollama.isAvailable()) return this.ollama.complete(prompt);
    return [
      "Ainda nao encontrei um modelo real conectado nesta maquina.",
      "",
      "Opcoes para ativar agora:",
      "1. OpenRouter: coloque OPENROUTER_API_KEY no arquivo .env e reinicie.",
      "2. Ollama: instale/abra o Ollama, rode um modelo local e reinicie.",
      "",
      this.mock.preview(prompt)
    ].join("\n");
  }
}

class MockProvider {
  name = "mock";

  async complete(prompt) {
    return this.preview(prompt);
  }

  preview(prompt) {
    const request = prompt.split("## Pedido do usuario").at(-1).trim();
    return [
      "Modo sem modelo conectado.",
      `Recebi: ${request}`,
      "As skills locais continuam funcionando, mas respostas inteligentes precisam de OpenRouter ou Ollama."
    ].join("\n");
  }
}

class OpenRouterProvider {
  name = "openrouter";

  constructor(env) {
    this.apiKey = env.OPENROUTER_API_KEY;
    this.model = env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async complete(prompt) {
    if (!this.apiKey) return "OPENROUTER_API_KEY nao configurada.";
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (!response.ok) return `OpenRouter falhou: ${response.status} ${await response.text()}`;
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Sem resposta do modelo.";
  }
}

class OllamaProvider {
  name = "ollama";

  constructor(env) {
    this.url = env.OLLAMA_URL || "http://localhost:11434";
    this.model = env.OLLAMA_MODEL || "llama3.1";
  }

  async isAvailable() {
    try {
      const response = await fetch(`${this.url}/api/tags`, { signal: AbortSignal.timeout(1200) });
      return response.ok;
    } catch {
      return false;
    }
  }

  async complete(prompt) {
    const response = await fetch(`${this.url}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, prompt, stream: false })
    });
    if (!response.ok) return `Ollama falhou: ${response.status} ${await response.text()}`;
    const data = await response.json();
    return data.response || "Sem resposta do modelo local.";
  }
}
