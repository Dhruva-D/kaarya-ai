import { describe, expect, it } from "vitest";
import { recipientWasSupplied, validateMailProposal } from "./mail-plan";

const action = { tool: "gmail.send" as const, args: { to: "test@example.com", subject: "Synthetic update", body: "Hello" } };

describe("Gmail recipient evidence", () => {
  it("requires the exact email address in the user's words", () => {
    expect(recipientWasSupplied(action, ["Send to test@example.com"])).toBe(true);
    expect(() => validateMailProposal(action, ["Send to Alice"])).toThrow(/Recipient/);
    expect(() => validateMailProposal(action, ["Email TEST@example.com"])).not.toThrow();
  });
});
