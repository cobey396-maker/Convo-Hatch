import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatHours, normalizeOrigin, textColorFor, validateClientConfig } from "../lib/config.ts";
import { installationSnippet, PLACEHOLDER_BASE_URL } from "../lib/snippet.ts";

const demo = JSON.parse(readFileSync("db/clients/demo-cedar-hollow.json", "utf8"));

test("the fictional demo client config is valid and marked as a demo", () => {
  const result = validateClientConfig(demo);
  assert.ok(result.ok, result.ok ? "" : result.errors.join("; "));
  assert.equal(result.config.isDemo, true);
  assert.deepEqual(result.config.leadDestinationEmails, []);
  assert.match(result.config.businessName, /demo/i);
  assert.match(result.config.profile.branding.greeting, /fictional/);
});

test("the example template is structurally valid", () => {
  const result = validateClientConfig(JSON.parse(readFileSync("db/clients/example-client.json", "utf8")));
  assert.ok(result.ok, result.ok ? "" : result.errors.join("; "));
});

test("demo clients can't list contractor destinations", () => {
  const result = validateClientConfig({ ...demo, leadDestinationEmails: ["owner@real-contractor.example"] });
  assert.ok(!result.ok);
  assert.match(result.errors.join("\n"), /must be empty for demo clients/);
});

test("real clients need a lead destination and at least one allowed origin", () => {
  const result = validateClientConfig({ ...demo, isDemo: false, leadDestinationEmails: [], allowedOrigins: [] });
  assert.ok(!result.ok);
  assert.ok(result.errors.some((error) => error.startsWith("leadDestinationEmails")));
  assert.ok(result.errors.some((error) => error.startsWith("allowedOrigins")));
});

test("configs are validated field by field", () => {
  const result = validateClientConfig({
    ...demo,
    publicId: "Bad ID!",
    serviceZipCodes: ["1234", "abcde"],
    profile: { ...demo.profile, timeZone: "Nowhere/Land", branding: { ...demo.profile.branding, primaryColor: "red" } },
    limits: { dailyAiReplies: -1 },
  });
  assert.ok(!result.ok);
  const joined = result.errors.join("\n");
  for (const field of ["publicId", "serviceZipCodes[0]", "serviceZipCodes[1]", "profile.timeZone", "primaryColor", "limits.dailyAiReplies"]) {
    assert.match(joined, new RegExp(field.replace(/[[\]]/g, "\\$&")), field);
  }
});

test("allowed origins must be exact https origins (http only for localhost)", () => {
  assert.equal(normalizeOrigin("https://www.Example.com/"), "https://www.example.com");
  assert.equal(normalizeOrigin("http://localhost:4000"), "http://localhost:4000");
  assert.equal(normalizeOrigin("http://www.example.com"), null);
  assert.equal(normalizeOrigin("https://*.example.com"), null);
  assert.equal(normalizeOrigin("https://example.com/contact"), null);
  assert.equal(normalizeOrigin("https://user:pass@example.com"), null);
  assert.equal(normalizeOrigin("*"), null);
});

test("the installation snippet names the client and never invents a production host", () => {
  const saved = process.env.WIDGET_PUBLIC_BASE_URL;
  delete process.env.WIDGET_PUBLIC_BASE_URL;
  assert.equal(
    installationSnippet("demo-cedar-hollow"),
    `<script src="${PLACEHOLDER_BASE_URL}/widget.js" data-client-id="demo-cedar-hollow" async></script>`,
  );
  process.env.WIDGET_PUBLIC_BASE_URL = "https://chat.example.net/";
  assert.match(installationSnippet("demo-cedar-hollow"), /src="https:\/\/chat\.example\.net\/widget\.js"/);
  if (saved === undefined) delete process.env.WIDGET_PUBLIC_BASE_URL;
  else process.env.WIDGET_PUBLIC_BASE_URL = saved;
});

test("brand text color keeps contrast readable", () => {
  assert.equal(textColorFor("#1f5f5b"), "#ffffff");
  assert.equal(textColorFor("#ffd54f"), "#111827");
});

test("hours are listed for every day, with closed days marked", () => {
  const result = validateClientConfig(demo);
  assert.ok(result.ok);
  const lines = formatHours(result.config.profile);
  assert.equal(lines.length, 7);
  assert.equal(lines[0], "Monday: 7:30 AM – 6:00 PM");
  assert.equal(lines[6], "Sunday: Closed");
});
