import { expect, test } from "@playwright/test";

test("anonymous visitors are sent to Google sign-in", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
});

test("anonymous requests cannot approve a Calendar plan", async ({ request }) => {
  const response = await request.post("/api/plans/00000000-0000-4000-8000-000000000001/approve", {
    headers: { origin: "http://localhost:3000" },
    data: {
      planVersion: 1,
      canonicalHash: "a".repeat(64),
      confirmation: true,
      clientRequestId: "00000000-0000-4000-8000-000000000002",
    },
  });
  expect(response.status()).toBe(401);
  expect((await response.json()).code).toBe("UNAUTHENTICATED");
});

test("a foreign origin is rejected before Calendar access", async ({ request }) => {
  const response = await request.post("/api/plans/00000000-0000-4000-8000-000000000001/approve", {
    headers: { origin: "https://unrelated.example" },
    data: {},
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).code).toBe("BAD_ORIGIN");
});

test("sign-in stays usable at a 390px mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflows).toBe(false);
});
