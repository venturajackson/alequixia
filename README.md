# Alequixia

Fundacao inicial para um assistente pessoal modular estilo Jarvis.

## O que ja existe

- `config/soul.md`: personalidade e limites do assistente.
- Regras dinamicas em `config/rules.json`, atualizaveis sem reiniciar.
- Memoria em duas camadas por workspace: `MEMORY.md` e `history.jsonl`.
- Store de segredos criptografado com `chacha20-poly1305`.
- Blocklist de comandos perigosos.
- Provider plugavel: `mock`, `openrouter` ou `ollama`.
- Skills iniciais: memoria, comportamento, segredos e shell protegido.
- Dashboard web local com chat, status e eventos em tempo real via SSE.
- Scheduler com heartbeat periodico.

## Rodar

```powershell
Copy-Item .env.example .env
npm run start
```

Abra `http://localhost:4000`.

Sem `.env`, o projeto roda em modo `mock`, sem chamar APIs externas.

## Site publico

O GitHub Pages publica a pasta `web/` como site estatico. O chat com IA
funciona localmente, porque depende do servidor Node em `/api/chat`.

## Comandos no chat

```text
/memory.remember O usuario prefere respostas objetivas.
/memory.search respostas objetivas
/memory.forget respostas objetivas
/open.url https://example.com
/open.app calculadora
/system.info
```

Tambem ha roteamento em linguagem natural para acoes locais:

```text
abra o site github.com
abrir calculadora
abrir navegador
status do sistema
```

## Ativar modelo

OpenRouter:

```powershell
$env:AI_PROVIDER="openrouter"
$env:OPENROUTER_API_KEY="sua-chave"
$env:OPENROUTER_MODEL="openai/gpt-4.1-mini"
npm run start
```

Ollama:

```powershell
$env:AI_PROVIDER="ollama"
$env:OLLAMA_MODEL="llama3.1"
npm run start
```

## Proxima ordem recomendada

1. Canal principal: Telegram ou WhatsApp.
2. Memoria hibrida real: BM25 + embeddings.
3. Browser automation com Playwright.
4. Jobs agendados persistentes.
5. Marketplace de skills.
6. Voz: STT + ElevenLabs ou stack local.
