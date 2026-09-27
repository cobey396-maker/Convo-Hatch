// End-to-end check of the embedded widget in a real browser (Playwright + Chromium).
// Prerequisites (see docs/widget.md → "Browser test"):
//   1. `npm run widget -- seed`, then `npm run build && npm start` in apps/chatbot (app on :3001)
//   2. `npm run demo:site` (fictional contractor site on :4000)
//   3. Playwright available: `npm i -D playwright` or set PLAYWRIGHT_MODULE to its path.
// Screenshots go to E2E_SCREENSHOTS (default ./.e2e-screenshots).

import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const APP = process.env.WIDGET_BASE_URL || "http://localhost:3001";
const SITE = process.env.DEMO_SITE_URL || "http://localhost:4000";
// Same demo server, different origin: not in the demo client's allowedOrigins.
const UNAPPROVED_SITE = process.env.UNAPPROVED_SITE_URL || "http://127.0.0.1:4000";
const SHOTS = process.env.E2E_SCREENSHOTS || ".e2e-screenshots";
// When the app runs with WIDGET_EMAIL_PROVIDER=outbox and WIDGET_DEMO_NOTIFY_TO set, the test also
// checks that the demo notification email was produced (skipped when E2E_OUTBOX_DIR is "off").
const OUTBOX = process.env.E2E_OUTBOX_DIR || path.join(".data", "outbox");
const { chromium, devices } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const results = [];

async function step(name, run) {
  try {
    await run();
    results.push(`PASS ${name}`);
  } catch (error) {
    for (const context of browser.contexts()) {
      for (const [index, page] of context.pages().entries()) {
        await page.screenshot({ path: `${SHOTS}/failure-${name.split(":")[0]}-${index}.png` }).catch(() => {});
      }
    }
    results.push(`FAIL ${name}: ${error.message.split("\n")[0]}`);
  }
}

function launcherOf(page) {
  return page.locator("[data-convohatch-widget] button.launcher");
}

// ---------- Desktop, keyboard only ----------
await step("desktop: keyboard-only chat and callback request", async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()));
  page.on("response", (response) => response.status() >= 400 && consoleErrors.push(`${response.status()} ${response.url()}`));
  await page.goto(SITE);

  const launcher = launcherOf(page);
  await launcher.waitFor({ state: "visible", timeout: 20_000 });
  assert.equal(await launcher.getAttribute("aria-label"), "Open chat with Cedar Hollow Heating & Air (demo)");
  await page.screenshot({ path: `${SHOTS}/desktop-1-closed.png` });

  // Reach the launcher with Tab.
  let focused = false;
  for (let index = 0; index < 30 && !focused; index += 1) {
    await page.keyboard.press("Tab");
    focused = await page.evaluate(() => {
      const host = document.querySelector("[data-convohatch-widget]");
      return host?.shadowRoot?.activeElement?.classList.contains("launcher") ?? false;
    });
  }
  assert.ok(focused, "launcher is reachable with Tab");
  await page.keyboard.press("Enter");
  assert.equal(await launcher.getAttribute("aria-expanded"), "true");

  const frame = page.frameLocator("[data-convohatch-widget] iframe");
  const input = frame.getByLabel("Type your question");
  await assert.doesNotReject(input.waitFor({ state: "visible" }));
  await page.waitForTimeout(200);
  assert.ok(await input.evaluate((element) => document.activeElement === element), "focus moves into the chat input");

  await frame.getByText("AI assistant", { exact: true }).waitFor();
  await frame.getByText(/ConvoHatch demo of a fictional business/).waitFor();
  await frame.getByRole("button", { name: /Start over/ }).waitFor();
  await frame.getByText(/Live AI is unavailable/).waitFor();

  await page.keyboard.type("Do you serve 54321?");
  await page.keyboard.press("Enter");
  await frame.getByText("Yes, ZIP 54321 is in Cedar Hollow Heating & Air (demo)’s service area.", { exact: false }).waitFor();
  await page.keyboard.type("What about 98765");
  await page.keyboard.press("Enter");
  await frame.getByText("ZIP 98765 isn’t on", { exact: false }).waitFor();
  await page.keyboard.type("How do I reset my furnace?");
  await page.keyboard.press("Enter");
  await frame.getByText("I can’t give repair or troubleshooting instructions", { exact: false }).waitFor();
  await page.keyboard.type("Do you offer free estimates?");
  await page.keyboard.press("Enter");
  await frame.getByText("Estimates for replacing a heating or cooling system are free.", { exact: false }).waitFor();
  await page.screenshot({ path: `${SHOTS}/desktop-2-chat.png` });

  // Open the callback form with the keyboard.
  const callbackButton = frame.getByRole("button", { name: "Request a callback" }).last();
  await callbackButton.focus();
  await page.keyboard.press("Enter");
  await frame.getByRole("heading", { name: "Request a callback" }).waitFor();

  // Submitting empty shows errors and moves focus to the first problem.
  await frame.getByRole("button", { name: "Review request" }).focus();
  await page.keyboard.press("Enter");
  await frame.getByText("Enter your name.").waitFor();
  assert.ok(await frame.getByLabel("Name").evaluate((element) => document.activeElement === element), "focus on first error");

  await page.keyboard.type("Jordan Sample");
  await frame.getByLabel("Phone").focus();
  await page.keyboard.type("555-010-0142");
  // The ZIP field is prefilled from the last ZIP typed in the chat (98765); replace it.
  const zipField = frame.getByLabel("ZIP code where you need service");
  assert.equal(await zipField.inputValue(), "98765");
  await zipField.focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("54321");
  await frame.getByLabel("Service needed").selectOption("Furnace repair");
  await frame.getByLabel("Details (optional)").focus();
  await page.keyboard.type("No heat upstairs.");
  // The day list is in the business's time zone; pick the first specific date.
  const daySelect = frame.getByLabel("Preferred callback day");
  assert.equal(await daySelect.locator("option").first().textContent(), "First available day");
  // Closed days (Sunday) are listed but can't be chosen.
  assert.ok((await daySelect.locator("option[disabled]").allTextContents()).every((label) => label.includes("(office closed)")));
  const firstOpenDay = await daySelect.locator("option:not([disabled])").nth(1).getAttribute("value");
  await daySelect.selectOption(firstOpenDay);
  await frame.getByLabel("Preferred callback time").selectOption("Morning (8 AM – 12 PM)");
  await frame.getByRole("button", { name: "Review request" }).focus();
  await page.keyboard.press("Enter");

  await frame.getByRole("heading", { name: "Review your request" }).waitFor();
  await frame.getByText("It is not a confirmed appointment", { exact: false }).waitFor();
  await frame.getByText(/Morning \(8 AM – 12 PM\) \(Central (Daylight|Standard) Time\)/).waitFor();
  await frame.getByText("(555) 010-0142").or(frame.getByText("555-010-0142")).first().waitFor();
  await page.screenshot({ path: `${SHOTS}/desktop-3-review.png` });

  await frame.getByRole("button", { name: "Send request" }).focus();
  await page.keyboard.press("Enter");
  await frame.getByRole("heading", { name: "Request received" }).waitFor();
  const reference = await frame.getByText(/CH-[A-Z2-9]{8}/).first().textContent();
  assert.match(reference, /CH-[A-Z2-9]{8}/);
  await frame.getByText("not sent to any contractor", { exact: false }).waitFor();
  if (OUTBOX !== "off") {
    const code = reference.match(/CH-[A-Z2-9]{8}/)[0];
    const files = (await readdir(OUTBOX).catch(() => [])).filter((file) => file.endsWith(".eml"));
    const emails = await Promise.all(files.map((file) => readFile(path.join(OUTBOX, file), "utf8")));
    const email = emails.find((text) => text.includes(code));
    assert.ok(email, `notification email for ${code} in ${OUTBOX}`);
    assert.match(email, /^To: demo-inbox@convohatch\.example$/m);
    assert.match(email, /^Subject: \[DEMO\] Callback request: Furnace repair, ZIP 54321/m);
    assert.match(email, /not a confirmed appointment/);
  }
  await page.screenshot({ path: `${SHOTS}/desktop-4-received.png` });

  // Escape closes the panel and returns focus to the launcher.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  assert.equal(await launcher.getAttribute("aria-expanded"), "false");
  const launcherFocused = await page.evaluate(
    () => document.querySelector("[data-convohatch-widget]")?.shadowRoot?.activeElement?.classList.contains("launcher") ?? false,
  );
  assert.ok(launcherFocused, "focus returns to the launcher");

  const relevantErrors = consoleErrors.filter((text) => !/favicon/.test(text));
  assert.deepEqual(relevantErrors, [], `console errors: ${relevantErrors.join(" | ")}`);
  await context.close();
});

// ---------- Mobile ----------
await step("mobile: launcher clears the sticky call bar; panel is full screen and closable", async () => {
  const context = await browser.newContext({ ...devices["iPhone 13"], defaultBrowserType: undefined });
  const page = await context.newPage();
  await page.goto(SITE);
  const launcher = launcherOf(page);
  await launcher.waitFor({ state: "visible", timeout: 20_000 });
  const launcherBox = await launcher.boundingBox();
  const barBox = await page.locator(".call-bar").boundingBox();
  assert.ok(launcherBox.y + launcherBox.height <= barBox.y, "launcher sits above the call bar");
  assert.ok(launcherBox.width >= 44 && launcherBox.height >= 44, "touch target is at least 44px");
  await page.screenshot({ path: `${SHOTS}/mobile-1-closed.png` });

  await launcher.tap();
  const panel = page.locator("[data-convohatch-widget] .panel");
  const viewport = page.viewportSize();
  const panelBox = await panel.boundingBox();
  assert.equal(Math.round(panelBox.width), viewport.width);
  assert.equal(Math.round(panelBox.height), viewport.height);
  const frame = page.frameLocator("[data-convohatch-widget] iframe");
  await frame.getByText("Hi! I’m the AI assistant", { exact: false }).waitFor();
  await frame.getByRole("button", { name: "What services do you offer?" }).tap();
  await frame.getByText("approved list of services", { exact: false }).waitFor();
  // Long messages wrap instead of widening the panel.
  const input = frame.getByLabel("Type your question");
  await input.tap();
  await input.fill(`Do you fix ${"supercalifragilisticheatpump".repeat(6)} systems and what are your hours?`);
  await input.press("Enter");
  await frame.getByText("Monday–Friday: 7:30 AM – 6:00 PM", { exact: false }).waitFor();
  const scrollWidth = await frame.locator("body").evaluate((body) => body.scrollWidth);
  assert.ok(scrollWidth <= viewport.width, `no horizontal scroll (${scrollWidth}px)`);
  await page.screenshot({ path: `${SHOTS}/mobile-2-open.png` });

  await frame.getByRole("button", { name: "Close chat" }).tap();
  await page.waitForTimeout(100);
  assert.equal(await launcher.getAttribute("aria-expanded"), "false");
  assert.ok(await launcher.isVisible());
  await context.close();
});

// ---------- Demo journeys: safety, privacy, prefill, cancel, sample details, start over ----------
await step("demo: safety reply, HTML as text, prefill from chat, cancel, sample details, start over", async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(SITE);
  const launcher = launcherOf(page);
  await launcher.waitFor({ state: "visible", timeout: 20_000 });
  await launcher.click();
  const frame = page.frameLocator("[data-convohatch-widget] iframe");
  const input = frame.getByLabel("Type your question");
  await input.waitFor();

  async function say(text) {
    await input.fill(text);
    await input.press("Enter");
  }

  await say("I smell gas by the furnace");
  await frame.getByText("If you smell gas, leave the building now.", { exact: false }).waitFor();
  await frame.getByText("This chat can’t send emergency help", { exact: false }).waitFor();

  await say('<img src=x onerror="window.__xss=1"> <b>bold</b> do you clean ducts?');
  await frame.getByText('<img src=x onerror="window.__xss=1"> <b>bold</b> do you clean ducts?').waitFor();
  await frame.getByText("doesn’t offer ductwork", { exact: false }).waitFor();
  assert.equal(await frame.locator("img[src=x]").count(), 0, "HTML is shown as text");

  // Contact details typed in chat are not kept server-side, but prefill the form in this browser.
  await say("My name is Jordan Sample, call 555-010-0142, zip 54322");
  await frame.getByText("contact details aren’t kept in the chat", { exact: false }).waitFor();
  await frame.getByRole("button", { name: "Request a callback" }).last().click();
  assert.equal(await frame.getByLabel("Name").inputValue(), "Jordan Sample");
  assert.equal(await frame.getByLabel("Phone").inputValue(), "555-010-0142");
  assert.equal(await frame.getByLabel("ZIP code where you need service").inputValue(), "54322");
  await page.screenshot({ path: `${SHOTS}/demo-1-prefill.png` });

  // Review, then cancel: nothing is sent.
  await frame.getByLabel("Service needed").selectOption("AC repair");
  await frame.getByLabel("Preferred callback time").selectOption("Any time during office hours");
  await frame.getByRole("button", { name: "Review request" }).click();
  await frame.getByRole("heading", { name: "Review your request" }).waitFor();
  await frame.getByRole("button", { name: "Cancel" }).click();
  await frame.getByText("Callback request cancelled. Nothing was sent.").waitFor();

  // Sample-details button fills fictional values; a hazard in the details shows the safety alert on review.
  await frame.getByRole("button", { name: "Request a callback" }).last().click();
  await frame.getByRole("button", { name: "Fill in fictional sample details" }).click();
  assert.equal(await frame.getByLabel("Phone").inputValue(), "(555) 010-0142");
  await frame.getByLabel("Service needed").selectOption("Furnace repair");
  await frame.getByLabel("Details (optional)").fill("Furnace smells like something burning.");
  await frame.getByLabel("Preferred callback time").selectOption("Afternoon (12 – 5 PM)");
  await frame.getByRole("button", { name: "Review request" }).click();
  await frame.getByText("Sending this request does not send emergency help.", { exact: false }).waitFor();
  await page.screenshot({ path: `${SHOTS}/demo-2-review-safety.png` });
  await frame.getByRole("button", { name: "Cancel" }).click();

  // Start over clears the conversation and the typed details.
  await frame.getByRole("button", { name: /Start over/ }).click();
  await frame.getByText("Hi! I’m the AI assistant", { exact: false }).waitFor();
  assert.equal(await frame.getByText("I smell gas by the furnace").count(), 0);
  await frame.getByRole("button", { name: "Request a callback" }).last().click();
  assert.equal(await frame.getByLabel("Name").inputValue(), "");
  await context.close();
});

// ---------- Unapproved website ----------
// The same demo page, reached through an origin that isn't in the demo client's allowedOrigins.
await step("unapproved website: the browser refuses to frame the widget and no launcher appears", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const blocked = [];
  page.on("console", (message) => /frame-ancestors|Refused to frame/i.test(message.text()) && blocked.push(message.text()));
  await page.goto(UNAPPROVED_SITE);
  // The loader and the iframe request both happen; only the browser's framing check stops it.
  await page.waitForFunction(() => document.querySelector("[data-convohatch-widget]") !== null);
  await page.waitForTimeout(4000);
  assert.equal(await launcherOf(page).isVisible(), false);
  assert.ok(blocked.length > 0, "browser reported the frame-ancestors block");
  await context.close();
});

// ---------- Unknown client ----------
await step("unknown client ID: no launcher", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(SITE);
  await launcherOf(page).waitFor({ state: "visible", timeout: 20_000 });
  await page.evaluate((app) => {
    const script = document.createElement("script");
    script.src = `${app}/widget.js?unknown`;
    script.dataset.clientId = "no-such-client";
    document.body.appendChild(script);
  }, APP);
  await page.waitForFunction(() => document.querySelector('[data-convohatch-widget="no-such-client"]') !== null);
  await page.waitForTimeout(4000);
  assert.equal(await page.locator('[data-convohatch-widget="no-such-client"] button.launcher').isVisible(), false);
  await context.close();
});

await browser.close();
console.log(results.join("\n"));
if (results.some((line) => line.startsWith("FAIL"))) process.exit(1);
