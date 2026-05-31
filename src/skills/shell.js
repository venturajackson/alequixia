import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function createShellSkill({ rules, workspaceRoot, allowShell }) {
  return {
    name: "shell.run",
    description: "Executa comando PowerShell com blocklist. Desligado por padrao.",
    run: async ({ text }) => {
      if (!allowShell) {
        return { answer: "Shell desativado. Defina ALLOW_SHELL=true somente quando quiser permitir comandos locais.", actions: [] };
      }
      const command = String(text || "").trim();
      if (!command) return { answer: "Informe um comando.", actions: [] };
      const blocked = (rules.commandBlocklist || []).find((item) => command.toLowerCase().includes(item.toLowerCase()));
      if (blocked) return { answer: `Comando bloqueado pela regra: ${blocked}`, actions: [{ type: "shell.blocked", blocked }] };

      const { stdout, stderr } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], {
        cwd: workspaceRoot,
        timeout: 30000,
        maxBuffer: 1024 * 1024
      });
      return {
        answer: [stdout.trim(), stderr.trim()].filter(Boolean).join("\n") || "Comando executado sem saida.",
        actions: [{ type: "shell.run" }]
      };
    }
  };
}
