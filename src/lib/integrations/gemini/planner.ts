import { GoogleGenAI } from "@google/genai";
import { proposalSchema, providerProposalSchema, type Proposal } from "../../agent/proposal";

type InteractionResult = { status: string; output_text?: string; model?: string };
type CreateInteraction = (params: {
  model: string;
  input: string;
  system_instruction: string;
  response_format: { type: "text"; mime_type: "application/json"; schema: typeof providerProposalSchema };
  store: false;
}) => Promise<InteractionResult>;

export async function proposeCalendarAction(
  input: { text: string; timezone: string; nowIso: string },
  options: { apiKey: string; model?: string; createInteraction?: CreateInteraction },
): Promise<{ proposal: Proposal; model: string }> {
  if (!options.apiKey.trim()) throw new Error("Gemini API key is missing");
  if (!input.text.trim() || input.text.length > 2_000) throw new Error("Message must be 1–2000 characters");
  if (Number.isNaN(Date.parse(input.nowIso))) throw new Error("Invalid reference time");
  try {
    new Intl.DateTimeFormat("en", { timeZone: input.timezone });
  } catch {
    throw new Error("Invalid user timezone");
  }

  const model = options.model ?? "gemini-3.6-flash";
  const client = options.createInteraction ? undefined : new GoogleGenAI({ apiKey: options.apiKey });
  const create = options.createInteraction ?? ((params) => client!.interactions.create(params));
  const result = await create({
    model,
    input: `Current time: ${input.nowIso}\nUser timezone: ${input.timezone}\nUser request: ${input.text}`,
    system_instruction: [
      "You are Kaarya's proposal parser. Return only the JSON object matching the schema.",
      "You may propose one Calendar event, ask a precise follow-up question, or say the request is unsupported.",
      "Never claim an action has executed. No tools are available to you.",
      "Do not invent people, email addresses, dates, or private facts. Ask when an essential detail is ambiguous.",
      "For an event, use an absolute ISO start and end with offset in the user's timezone.",
    ].join(" "),
    response_format: { type: "text", mime_type: "application/json", schema: providerProposalSchema },
    store: false,
  });
  if (result.status !== "completed" || !result.output_text) {
    throw new Error("Gemini did not complete a structured proposal");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.output_text);
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }
  const proposal = proposalSchema.safeParse(parsed);
  if (!proposal.success) throw new Error("Gemini proposal did not satisfy the action contract");
  return { proposal: proposal.data, model: result.model ?? model };
}
