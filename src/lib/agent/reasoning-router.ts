import { proposeWithCodex, CodexProposalError } from "../integrations/codex/planner";
import { GeminiProposalError, proposeAction } from "../integrations/gemini/planner";

type Input = Parameters<typeof proposeAction>[0];
type Selection = "codex-gpt-6-luna" | "gemini-3.5-flash-lite" | "gemini-3.6-flash";
let modelUnavailableUntil = 0;

export class ReasoningFallbackError extends Error {
  constructor(public readonly codexReason: string, public readonly geminiReason: string) {
    super("Both reasoning providers are unavailable");
  }
}

export async function proposeWithFallback(input: Input, options: { selected: Selection }) {
  if (options.selected !== "codex-gpt-6-luna") {
    return { ...await proposeAction(input, { apiKey: process.env.GEMINI_API_KEY ?? "", model: options.selected }), fallbackReason: undefined };
  }
  let fallbackReason: string;
  if (Date.now() < modelUnavailableUntil) fallbackReason = "GPT-6 Luna is not enabled for this ChatGPT account";
  else {
    try { return { ...await proposeWithCodex(input), fallbackReason: undefined }; }
    catch (error) {
      if (!(error instanceof CodexProposalError)) throw error;
      if (error.reason === "model_unavailable") modelUnavailableUntil = Date.now() + 60 * 60_000;
      fallbackReason = error.reason === "model_unavailable" ? "GPT-6 Luna is not enabled for this ChatGPT account" : error.reason.replaceAll("_", " ");
    }
  }
  let fallback: Awaited<ReturnType<typeof proposeAction>>;
  try {
    fallback = await proposeAction(input, { apiKey: process.env.GEMINI_API_KEY ?? "", model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite" });
  } catch (error) {
    if (error instanceof GeminiProposalError) throw new ReasoningFallbackError(fallbackReason, error.reason);
    throw error;
  }
  return { ...fallback, fallbackReason };
}
