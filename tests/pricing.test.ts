import { test } from "node:test";
import assert from "node:assert/strict";
import { footer, nav, pricing } from "../content/site.ts";
import { buildFactSheet } from "../lib/site-assistant/knowledge.ts";

test("publishes only Core and Custom Integrations", () => {
  assert.deepEqual(pricing.plans.map((plan) => plan.name), ["Core", "Custom Integrations"]);
  const [core, custom] = pricing.plans;
  assert.equal(core.priceLabel, "$199 per month");
  assert.equal(core.setup, "$500 one-time setup fee");
  assert.equal(custom.priceLabel, "Custom quote");
});

test("pricing CTAs start a demo or inquiry, never checkout", () => {
  for (const plan of pricing.plans) assert.equal(plan.cta.href, "/#request-demo", plan.name);
});

test("pricing copy makes no discount, trial, popularity, or guarantee claims", () => {
  const copy = JSON.stringify(pricing).toLowerCase();
  for (const phrase of ["founding", "discount", "free trial", "most popular", "guarantee", "unlimited usage", "refund"]) {
    assert.ok(!copy.includes(phrase), phrase);
  }
});

test("Pricing is in the main and footer navigation", () => {
  assert.ok(nav.links.some((link) => link.href === "/pricing"));
  assert.ok(footer.sections.some((link) => link.href === "/pricing"));
});

test("the site assistant knows the published pricing", () => {
  const facts = buildFactSheet();
  assert.match(facts, /Core: \$199 per month, plus a \$500 one-time setup fee/);
  assert.match(facts, /Custom Integrations: Custom quote/);
  assert.doesNotMatch(facts, /lists no .*prices/);
});
