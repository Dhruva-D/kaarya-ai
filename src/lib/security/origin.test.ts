import { describe, expect, it } from "vitest";
import { isSameOriginPost } from "./origin";

describe("state-changing route origin", () => {
  it("allows only matching browser origins", () => {
    expect(isSameOriginPost(new Request("https://kaarya.test/api/chat", { headers: { origin: "https://kaarya.test" } }))).toBe(true);
    expect(isSameOriginPost(new Request("https://kaarya.test/api/chat", { headers: { origin: "https://evil.test" } }))).toBe(false);
    expect(isSameOriginPost(new Request("https://kaarya.test/api/chat"))).toBe(false);
  });
});
