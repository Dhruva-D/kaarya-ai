import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

const valid = {
  AUTH_SECRET: "test-secret",
  AUTH_GOOGLE_ID: "test-id",
  AUTH_GOOGLE_SECRET: "test-oauth-secret",
  DATABASE_URL: "postgresql://test:test@localhost:5432/kaarya",
  TOKEN_ENCRYPTION_KEY: "test-key",
  GNANI_API_KEY: "test-gnani-key",
  GEMINI_API_KEY: "test-gemini-key",
};

describe("server environment", () => {
  it("accepts complete configuration with documented defaults", () => {
    expect(parseServerEnv(valid).GEMINI_MODEL).toBe("gemini-3.5-flash-lite");
  });

  it("reports invalid field names without exposing values", () => {
    expect(() => parseServerEnv({ ...valid, GNANI_API_KEY: "" })).toThrow(/GNANI_API_KEY/);
    expect(() => parseServerEnv({ ...valid, GNANI_API_KEY: "" })).not.toThrow(/test-gemini-key/);
  });
});
