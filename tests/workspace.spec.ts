import { test, expect } from "@playwright/test";

test("one-click sample, chat, sources, clear and document removal", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Chat with your documents" })).toBeVisible();
  await page.getByRole("button", { name: "Load sample FAQ" }).click();
  await page.getByRole("button", { name: "3 documents ready" }).click();
  await expect(page.locator(".document")).toHaveCount(3);
  await page.getByRole("button", { name: "What is the return policy?" }).click();
  await expect(page.locator(".message.assistant")).toContainText("30 days");
  await page.locator(".sources button").first().click();
  await expect(
    page.locator('.sources [data-slot="collapsible-content"][data-state="open"]'),
  ).toContainText("original packaging");
  await page.getByRole("button", { name: "Clear chat" }).click();
  await expect(page.locator(".message")).toHaveCount(0);
  await page.getByRole("button", { name: "Remove Returns & refunds" }).click();
  await expect(page.locator(".document")).toHaveCount(2);
});

test("paste and upload work without credentials", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Local preview" })).toBeVisible();
  await page.getByRole("button", { name: "Paste text" }).click();
  await page.getByLabel("Title").fill("Museum hours");
  await page
    .getByLabel("Document text")
    .fill("The museum opens at 10 AM on weekends and closes at 6 PM.");
  await page.getByRole("button", { name: "Add document", exact: true }).click();
  await page.getByRole("textbox", { name: "Ask a question" }).fill("When does the museum open?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.locator(".message.assistant")).toContainText("10 AM");
  await page.getByLabel("Upload a document").setInputFiles({
    name: "parking.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Parking is free for all museum visitors on Sundays."),
  });
  await page.getByRole("button", { name: "2 documents ready" }).click();
  await expect(page.locator(".document")).toHaveCount(2);
});

test("greetings, missing information and validation", async ({ request }) => {
  const greeting = await request.post("/api/chat", { data: { question: "hi", documents: [] } });
  expect(greeting.status()).toBe(200);
  expect((await greeting.json()).answer).toContain("Hi!");
  const invalid = await request.post("/api/chat", { data: { question: "" } });
  expect(invalid.status()).toBe(400);
  const unknown = await request.post("/api/chat", { data: { question: "refund", documents: [] } });
  expect(await unknown.json()).toMatchObject({ sources: [], mode: "demo" });
  const custom = await request.post("/api/chat", {
    data: {
      question: "museum",
      documents: [
        { id: "museum", title: "Museum", content: "The museum opens at 10 AM every Sunday." },
      ],
    },
  });
  expect((await custom.json()).answer).toContain("10 AM");
});

test("failed messages can be retried without duplicate user bubbles", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Local preview" })).toBeVisible();
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Please retry." }),
    }),
  );
  await page.getByRole("textbox", { name: "Ask a question" }).fill("hi");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Please retry" })).toBeVisible();
  await expect(page.locator(".message.user")).toHaveCount(0);
  await page.unroute("**/api/chat");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.locator(".message.assistant")).toContainText("Hi!");
  await expect(page.locator(".message.user")).toHaveCount(1);
});

test("mobile layout stays within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByRole("button", { name: "Load sample FAQ" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Ask a question" })).toBeVisible();
});

test("fallback and latency details are visible and chat averages reset", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Local preview" })).toBeVisible();
  await page.getByRole("textbox", { name: "Ask a question" }).fill("quantum astrophysics");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.locator(".message.assistant")).toContainText("No answer found");
  await expect(page.getByLabel("Average response time")).toContainText("1 reply this chat");
  await page.getByRole("button", { name: /0 generation tokens.*Details/ }).click();
  await expect(page.locator(".message.assistant")).toContainText("not a bill");
  await expect(page.locator(".sources")).toHaveCount(0);
  await page.getByRole("button", { name: "Clear chat" }).click();
  await expect(page.getByLabel("Average response time")).toHaveCount(0);
});

test("provider usage and low-score evidence display without claiming confidence", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Local preview" })).toBeVisible();
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        answer: "I couldn’t find a supported answer.",
        sources: [],
        mode: "live",
        meta: {
          status: "no_answer",
          reason: "insufficient_evidence",
          retrieval: { score: 0.65, threshold: 0.5 },
          serverMs: 12,
          generationCalled: true,
          tokens: { input: 230, output: 45, total: 300 },
        },
      }),
    }),
  );
  await page.getByRole("textbox", { name: "Ask a question" }).fill("What is the warranty?");
  await page.getByRole("button", { name: "Send question" }).click();
  await page.getByRole("button", { name: /230 in \/ 45 out tokens/ }).click();
  await expect(page.locator(".message.assistant")).toContainText("300 total tokens");
  await expect(page.locator(".message.assistant")).toContainText("0.650");
  await expect(page.locator(".message.assistant")).toContainText("not a probability");
});

test("health reports local preview without provider requests", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true, mode: "demo" });
});
