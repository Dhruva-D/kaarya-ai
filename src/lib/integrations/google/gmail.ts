import { Buffer } from "node:buffer";
import { google } from "googleapis";
import type { MailAction } from "../../agent/plan";

type GmailAuth = InstanceType<typeof google.auth.OAuth2>;
type SendParams = { userId: "me"; requestBody: { raw: string } };
type SendResult = { data: { id?: string | null; threadId?: string | null } };
type MessageSend = (params: SendParams) => Promise<SendResult>;

export class GmailWriteError extends Error {
  constructor(public readonly outcome: "failed" | "unknown", message: string) { super(message); }
}

function encodedSubject(subject: string): string {
  const chunks: Buffer[] = [];
  let current: Buffer[] = [];
  let bytes = 0;
  for (const char of subject) {
    const codepoint = Buffer.from(char, "utf8");
    if (bytes + codepoint.length > 42 && current.length) { chunks.push(Buffer.concat(current)); current = []; bytes = 0; }
    current.push(codepoint);
    bytes += codepoint.length;
  }
  if (current.length) chunks.push(Buffer.concat(current));
  return chunks.map((chunk) => `=?UTF-8?B?${chunk.toString("base64")}?=`).join("\r\n ");
}

/** ASCII MIME envelope with UTF-8 subject/body; no caller-controlled header folding. */
export function encodeGmailRaw(action: MailAction): string {
  const { to, subject, body } = action.args;
  if (/[\r\n]/u.test(to + subject)) throw new Error("Invalid email header");
  const base64Body = Buffer.from(body, "utf8").toString("base64").match(/.{1,76}/gu)?.join("\r\n") ?? "";
  const mime = [
    `To: ${to}`,
    `Subject: ${encodedSubject(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Body,
  ].join("\r\n");
  return Buffer.from(mime, "utf8").toString("base64url");
}

export async function sendGmailMessage(action: MailAction, auth: GmailAuth, sendOverride?: MessageSend): Promise<{ providerObjectId: string }> {
  const send = sendOverride ?? (async (params: SendParams) => {
    const response = await google.gmail({ version: "v1", auth }).users.messages.send(params, { timeout: 30_000 });
    return { data: response.data };
  });
  let result: SendResult;
  try {
    result = await send({ userId: "me", requestBody: { raw: encodeGmailRaw(action) } });
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status && status >= 400 && status < 500 && status !== 409 && status !== 429) {
      throw new GmailWriteError("failed", `Gmail rejected the message (HTTP ${status})`);
    }
    throw new GmailWriteError("unknown", "Gmail may have sent the message; confirmation was lost");
  }
  if (!result.data.id) throw new GmailWriteError("unknown", "Gmail did not return a message ID");
  return { providerObjectId: result.data.id };
}
