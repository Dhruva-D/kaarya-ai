import { readFile } from "node:fs/promises";
import { transcribeWav } from "../src/lib/integrations/gnani/stt";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npm run smoke:gnani -- <short-spoken.wav>");
  if (!process.env.GNANI_API_KEY) throw new Error("Set GNANI_API_KEY in .env.local first");

  const result = await transcribeWav(await readFile(file), {
    apiKey: process.env.GNANI_API_KEY,
    endpoint: process.env.GNANI_STT_URL,
  });
  console.log(JSON.stringify({ provider: "gnani", ...result }));
}

void main().catch((error: unknown) => {
  console.error("Gnani smoke test failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
