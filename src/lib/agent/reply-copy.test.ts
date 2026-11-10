import { describe, expect, it } from "vitest";
import { replyCopy } from "./reply-copy";

describe("safe localized reply copy", () => {
  it("never asserts an external action completed", () => {
    expect(replyCopy("review", "kn-IN")).toContain("ಪರಿಶೀಲಿಸಿ");
    expect(replyCopy("review", "en-IN")).toContain("before I create it");
    expect(replyCopy("unsupported", "hi-IN")).toContain("कैलेंडर");
  });
});
