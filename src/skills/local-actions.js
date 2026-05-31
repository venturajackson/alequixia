import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cpus, freemem, hostname, platform, release, totalmem } from "node:os";

const execFileAsync = promisify(execFile);

const APP_ALIASES = new Map([
  ["bloco de notas", "notepad.exe"],
  ["notepad", "notepad.exe"],
  ["calculadora", "calc.exe"],
  ["calculator", "calc.exe"],
  ["explorer", "explorer.exe"],
  ["arquivos", "explorer.exe"],
  ["gerenciador de arquivos", "explorer.exe"],
  ["paint", "mspaint.exe"],
  ["wordpad", "wordpad.exe"],
  ["powershell", "powershell.exe"],
  ["terminal", "wt.exe"],
  ["vscode", "code"],
  ["vs code", "code"],
  ["visual studio code", "code"],
  ["chrome", "chrome.exe"],
  ["google chrome", "chrome.exe"],
  ["edge", "msedge.exe"],
  ["microsoft edge", "msedge.exe"],
  ["firefox", "firefox.exe"]
]);

export function createLocalActionSkills({ events, workspaceRoot }) {
  return [
    {
      name: "open.url",
      description: "Abre uma URL http/https no navegador padrao.",
      run: async ({ text, target }) => {
        const url = normalizeUrl(target || text);
        await startProcess(url, [], workspaceRoot);
        events.publish({ type: "local.opened_url", url });
        return {
          answer: `Abri no navegador: ${url}`,
          actions: [{ type: "open.url", url }]
        };
      }
    },
    {
      name: "open.app",
      description: "Abre aplicativos locais conhecidos por alias seguro.",
      run: async ({ text, app }) => {
        const requested = normalizeName(app || text);
        const executable = APP_ALIASES.get(requested);
        if (!executable) {
          return {
            answer: `Nao encontrei esse aplicativo na lista segura: ${app || text}. Apps permitidos: ${[...APP_ALIASES.keys()].sort().join(", ")}.`,
            actions: [{ type: "open.app.denied", requested }]
          };
        }
        await startProcess(executable, [], workspaceRoot);
        events.publish({ type: "local.opened_app", app: requested });
        return {
          answer: `Abri o aplicativo: ${requested}`,
          actions: [{ type: "open.app", app: requested }]
        };
      }
    },
    {
      name: "system.info",
      description: "Mostra informacoes basicas do sistema local.",
      run: async () => {
        const totalGb = (totalmem() / 1024 ** 3).toFixed(1);
        const freeGb = (freemem() / 1024 ** 3).toFixed(1);
        const cpu = cpus()[0]?.model || "CPU nao identificada";
        return {
          answer: [
            `Host: ${hostname()}`,
            `Sistema: ${platform()} ${release()}`,
            `CPU: ${cpu}`,
            `Memoria livre: ${freeGb} GB de ${totalGb} GB`
          ].join("\n"),
          actions: [{ type: "system.info" }]
        };
      }
    }
  ];
}

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("Informe uma URL.");
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Somente URLs http/https sao permitidas.");
  return url.toString();
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function startProcess(target, args, cwd) {
  await execFileAsync("powershell.exe", ["-NoProfile", "-Command", "Start-Process", "-FilePath", target, ...args], {
    cwd,
    timeout: 15000,
    windowsHide: true
  });
}
