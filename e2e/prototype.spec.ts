import { test, expect } from "@playwright/test";

test("scripted prototype completes all six flows without Google or application writes", async ({ page }) => {
  const writeRequests: string[] = [];
  page.on("request", (request) => { if (request.method() === "POST") writeRequests.push(request.url()); });
  await page.goto("/prototype");
  await expect(page.getByText("Client prototype", { exact: true })).toBeVisible();
  for (const title of ["Meeting & invitation", "Google Task", "Email", "Meeting + task", "Job application", "Electricity complaint"]) {
    await page.getByRole("navigation").getByRole("button", { name: title, exact: true }).click();
    await page.getByRole("button", { name: "Send this line", exact: true }).click();
    await page.getByRole("button", { name: "Send this line", exact: true }).click();
    await page.getByRole("button", { name: "Simulate action", exact: true }).click();
    await expect(page.getByText("Prototype flow complete", { exact: true })).toBeVisible();
    await expect(page.getByText(/PROTOTYPE-.*-001/)).toBeVisible();
  }
  expect(writeRequests).toEqual([]);
});

test("prototype remains usable at mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/prototype");
  await expect(page.getByRole("heading", { name: "Meeting & invitation" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
