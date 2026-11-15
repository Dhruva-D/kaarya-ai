import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { proposalSchema, providerProposalSchema, type Proposal } from "../../agent/proposal";

export class CodexProposalError extends Error {
  constructor(public readonly reason: "model_unavailable" | "cli_unavailable" | "timeout" | "invalid_response") {
    super(`Codex proposal ${reason}`);
  }
}

type PlannerInput = {
  text: string; timezone: string; nowIso: string; languageCode?: string;
  recentTurns?: Array<{ role: "user" | "assistant"; content: string }>;
  pendingAction?: unknown;
};

/** Local CLI only. The child receives no app secrets and cannot write to the app workspace. */
export async function proposeWithCodex(input: PlannerInput): Promise<{ proposal: Proposal; model: string }> {
  if (process.env.CODEX_CLI_ENABLED === "false" || (process.env.NODE_ENV === "production" && process.env.CODEX_CLI_ENABLED !== "true")) {
    throw new CodexProposalError("cli_unavailable");
  }
  const directory = await mkdtemp(join(tmpdir(), "kaarya-codex-"));
  try {
    const schemaPath = join(directory, "proposal.schema.json");
    await writeFile(schemaPath, JSON.stringify(providerProposalSchema));
    const prompt = [
      "You are Kaarya's JSON proposal parser. Return only one JSON object matching the provided schema. Do not call tools or inspect files. Never claim an external action has executed.",
      "Propose at most two actions in user order using only calendar.create_event, tasks.create_task, or gmail.send. Ask a concise question when required details are missing. Never invent recipients, people, or dates.",
      "Calendar needs user-specified title, start, end, duration, guest decision and Meet decision. Use absolute ISO times with offset. Tasks have a due date only, no timed reminder. Gmail needs the exact user-supplied recipient, subject and body. Reply in the requested language.",
      `Request data: ${JSON.stringify({ nowIso: input.nowIso, timezone: input.timezone, languageCode: input.languageCode ?? "en-IN", recentTurns: input.recentTurns ?? [], pendingAction: input.pendingAction ?? null, text: input.text })}`,
    ].join("\n");
    const output = await runCodex(directory, schemaPath, prompt);
    let decoded: unknown;
    try { decoded = JSON.parse(output); } catch { throw new CodexProposalError("invalid_response"); }
    const result = proposalSchema.safeParse(decoded);
    if (!result.success) throw new CodexProposalError("invalid_response");
    return { proposal: result.data, model: "codex:gpt-5.6-luna" };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function runCodex(directory: string, schemaPath: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const command = process.env.CODEX_CLI_PATH || (process.platform === "win32" ? "codex.exe" : "codex");
    const child = spawn(/* turbopackIgnore: true */ command, [
      "exec", "-m", "gpt-5.6-luna", "-c", "model_reasoning_effort=medium", "-c", "service_tier=fast",
      "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "--ignore-user-config",
      "--output-schema", schemaPath, "--json", "-",
    ], {
      cwd: directory, windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
      env: { NODE_ENV: process.env.NODE_ENV ?? "development", ...Object.fromEntries(["PATH", "Path", "PATHEXT", "SystemRoot", "WINDIR", "USERPROFILE", "HOME", "APPDATA", "LOCALAPPDATA", "CODEX_HOME", "TMP", "TEMP"]
        .map((key) => [key, process.env[key]]).filter((entry): entry is [string, string] => Boolean(entry[1]))) },
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (value: string | CodexProposalError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (value instanceof CodexProposalError) reject(value);
      else resolve(value);
    };
    const timer = setTimeout(() => { child.kill(); finish(new CodexProposalError("timeout")); }, 20_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; if (stdout.length > 100_000) { child.kill(); finish(new CodexProposalError("invalid_response")); } });
    child.stderr.on("data", (chunk: string) => { stderr = (stderr + chunk).slice(-6_000); });
    child.on("error", () => finish(new CodexProposalError("cli_unavailable")));
    child.stdin.on("error", () => finish(new CodexProposalError("cli_unavailable")));
    child.on("close", (code) => {
      if (code !== 0) {
        finish(new CodexProposalError(/model_not_found|not supported when using Codex|unknown model/i.test(stderr + stdout) ? "model_unavailable" : "cli_unavailable"));
        return;
      }
      let message: string | undefined;
      for (const line of stdout.split(/\r?\n/u)) {
        try {
          const event = JSON.parse(line) as { type?: string; item?: { type?: string; text?: string } };
          if (event.type === "item.completed" && event.item?.type === "agent_message") message = event.item.text;
        } catch { /* CLI event stream may include blank lines. */ }
      }
      finish(message || new CodexProposalError("invalid_response"));
    });
    child.stdin.end(prompt);
  });
}
