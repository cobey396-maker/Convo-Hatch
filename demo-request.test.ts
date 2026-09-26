import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDemoRequest, validateDemoRequest } from "../lib/demo-request.ts";
import { getDeliveryProvider } from "../lib/delivery.ts";

const valid = {
  name: "Alex Rivera",
  business: "Example Heating",
  email: "alex@example.com",
  website: "",
  trade: "HVAC",
  message: "We get a lot of after-hours questions.",
};

test("accepts a complete request with no website", () => {
  assert.deepEqual(validateDemoRequest(normalizeDemoRequest(valid)), {});
});

test("requires name, business, email, trade, and message", () => {
  const errors = validateDemoRequest(normalizeDemoRequest({}));
  assert.deepEqual(Object.keys(errors).sort(), ["business", "email", "message", "name", "trade"]);
});

test("rejects malformed email, website, trade, and short messages", () => {
  const errors = validateDemoRequest(
    normalizeDemoRequest({ ...valid, email: "alex@", website: "not a site", trade: "Pools", message: "hi" }),
  );
  assert.ok(errors.email);
  assert.ok(errors.website);
  assert.ok(errors.trade);
  assert.ok(errors.message);
});

test("accepts websites with or without a protocol", () => {
  for (const website of ["example.com", "https://www.example.com/contact", "http://sub.example.co.uk"]) {
    assert.deepEqual(validateDemoRequest(normalizeDemoRequest({ ...valid, website })), {}, website);
  }
});

test("normalizes non-string input safely", () => {
  const input = normalizeDemoRequest({ name: 42, email: ["x"], message: "  padded  " });
  assert.equal(input.name, "");
  assert.equal(input.email, "");
  assert.equal(input.message, "padded");
});

test("delivery is unavailable until configured", () => {
  const keys = [
    "RESEND_API_KEY",
    "DEMO_REQUEST_TO_EMAIL",
    "DEMO_REQUEST_FROM_EMAIL",
    "DEMO_REQUEST_WEBHOOK_URL",
  ];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    assert.equal(getDeliveryProvider(), null);

    process.env.DEMO_REQUEST_WEBHOOK_URL = "http://insecure.example.com";
    assert.equal(getDeliveryProvider(), null, "non-https webhooks are ignored");

    process.env.DEMO_REQUEST_WEBHOOK_URL = "https://hooks.example.com/demo";
    assert.equal(getDeliveryProvider(), "webhook");

    process.env.RESEND_API_KEY = "test";
    process.env.DEMO_REQUEST_TO_EMAIL = "to@example.com";
    assert.equal(getDeliveryProvider(), "webhook", "Resend needs all three values");
    process.env.DEMO_REQUEST_FROM_EMAIL = "from@example.com";
    assert.equal(getDeliveryProvider(), "resend");
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
