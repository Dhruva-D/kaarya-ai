import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import { encodeGmailRaw, sendGmailMessage } from "./gmail";

const action = { tool: "gmail.send" as const, args: { to: "test@example.com", subject: "ನಮಸ್ಕಾರ", body: "Synthetic hello.\nThis is a test." } };
const auth = {} as Parameters<typeof sendGmailMessage>[1];

describe("Gmail send adapter", () => {
  it("encodes exact recipient, UTF-8 subject and body in MIME", () => {
    const mime = Buffer.from(encodeGmailRaw(action), "base64url").toString("utf8");
    expect(mime).toContain("To: test@example.com\r\n");
    expect(mime).toContain("Subject: =?UTF-8?B?");
    expect(mime).toContain("Content-Type: text/plain; charset=UTF-8");
    expect(mime).not.toContain("Synthetic hello.");
    expect(Buffer.from(mime.split("\r\n\r\n")[1].replaceAll("\r\n", ""), "base64").toString("utf8")).toBe(action.args.body);
  });
  it("sends only once and requires a real Gmail ID", async () => {
    const send = vi.fn(async (params) => {
      expect(params.userId).toBe("me");
      return { data: { id: "gmail-id" } };
    });
    expect(await sendGmailMessage(action, auth, send)).toEqual({ providerObjectId: "gmail-id" });
    expect(send).toHaveBeenCalledOnce();
    await expect(sendGmailMessage(action, auth, async () => ({ data: {} }))).rejects.toMatchObject({ outcome: "unknown" });
  });
  it("does not claim success after a provider timeout", async () => {
    await expect(sendGmailMessage(action, auth, async () => { throw new Error("timeout"); })).rejects.toMatchObject({ outcome: "unknown" });
  });
});
