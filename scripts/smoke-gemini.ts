import { proposeAction } from "../src/lib/integrations/gemini/planner";

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error("Set GEMINI_API_KEY in .env.local first");
  const result = await proposeAction(
    { text: "Schedule a synthetic project meeting tomorrow at 5 PM for 30 minutes", timezone: "Asia/Kolkata", nowIso: new Date().toISOString() },
    { apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL },
  );
  console.log(JSON.stringify(result));
}

void main().catch((error: unknown) => {
  console.error("Gemini smoke test failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
