import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { join } from "node:path";

export class Memory {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.factsFile = join(workspaceRoot, "MEMORY.md");
    this.historyFile = join(workspaceRoot, "history.jsonl");
  }

  status() {
    return {
      factsFile: this.factsFile,
      historyFile: this.historyFile
    };
  }

  async remember(text) {
    await mkdir(this.workspaceRoot, { recursive: true });
    await appendFile(this.factsFile, `- ${text.trim()}\n`, "utf8");
  }

  async forget(query) {
    const facts = await this.readFacts();
    const kept = facts.filter((line) => !line.toLowerCase().includes(query.toLowerCase()));
    await mkdir(this.workspaceRoot, { recursive: true });
    await writeFile(this.factsFile, kept.join("\n") + (kept.length ? "\n" : ""), "utf8");
    return facts.length - kept.length;
  }

  async appendHistory(entry) {
    await mkdir(this.workspaceRoot, { recursive: true });
    await appendFile(this.historyFile, `${JSON.stringify({ ...entry, at: new Date().toISOString() })}\n`, "utf8");
  }

  async search(query, limit = 5) {
    const facts = await this.readFacts();
    const history = await this.readHistory();
    const items = [
      ...facts.map((text) => ({ source: "fact", text })),
      ...history.map((entry) => ({ source: "history", text: `${entry.role}: ${entry.content}` }))
    ];
    return items
      .map((item) => ({ ...item, score: score(query, item.text) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async readFacts() {
    try {
      return (await readFile(this.factsFile, "utf8")).split(/\r?\n/).filter(Boolean);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async readHistory() {
    try {
      return (await readFile(this.historyFile, "utf8"))
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }
}

function score(query, text) {
  const q = tokens(query);
  const t = new Set(tokens(text));
  return q.reduce((sum, token) => sum + (t.has(token) ? 1 : 0), 0);
}

function tokens(text) {
  return String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9_]+/g) || [];
}
