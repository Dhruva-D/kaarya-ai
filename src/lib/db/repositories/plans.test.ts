import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { approvalClaimPredicate } from "./plans";

describe("atomic approval predicate", () => {
  it("requires ownership, exact version and hash, pending status and future expiry", () => {
    const dialect = new PgDialect();
    const query = dialect.sqlToQuery(approvalClaimPredicate(
      "11111111-1111-4111-8111-111111111111",
      "owner-A",
      { planVersion: 2, canonicalHash: "a".repeat(64), confirmation: true, clientRequestId: "22222222-2222-4222-8222-222222222222" },
      new Date("2026-11-09T10:00:00Z"),
    )!);
    expect(query.sql).toContain('"action_plans"."user_id"');
    expect(query.sql).toContain('"action_plans"."version"');
    expect(query.sql).toContain('"action_plans"."canonical_hash"');
    expect(query.sql).toContain('"action_plans"."status"');
    expect(query.sql).toContain('"action_plans"."expires_at"');
    expect(query.params).toContain("owner-A");
    expect(query.params).toContain(2);
    expect(query.params).toContain("a".repeat(64));
    expect(query.params).toContain("awaiting_approval");
  });
});
