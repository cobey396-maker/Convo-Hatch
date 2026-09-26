import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt } from "../lib/ai.ts";
import { toPublicView } from "../lib/config.ts";
import { sendMessage, startConversation } from "../lib/conversations.ts";
import { checkServiceArea, submitLead } from "../lib/leads.ts";
import { idempotencyKey, setup, validLead, type Fixture } from "./widget-fixtures.ts";

let f: Fixture;
before(async () => {
  f = await setup();
});
after(async () => {
  await f.db.close();
});

async function conversationFor(publicId: string, visitor = "visitor-iso"): Promise<string> {
  const result = await startConversation(f.deps(), { publicId, visitor });
  assert.ok(result.ok);
  return result.conversationId;
}

test("a conversation started for one client can't be continued through another", async () => {
  const alphaConversation = await conversationFor("alpha-heating");
  const crossed = await sendMessage(f.deps(), {
    publicId: "bravo-cooling",
    conversationId: alphaConversation,
    message: "What are your hours?",
    visitor: "visitor-iso",
  });
  assert.equal(crossed.ok, false);
  assert.equal(!crossed.ok && crossed.status, 404);

  const own = await sendMessage(f.deps(), {
    publicId: "alpha-heating",
    conversationId: alphaConversation,
    message: "What are your hours?",
    visitor: "visitor-iso",
  });
  assert.ok(own.ok);
});

test("a lead can't be filed against another client's conversation", async () => {
  const alphaConversation = await conversationFor("alpha-heating");
  const result = await submitLead(f.deps(), {
    publicId: "bravo-cooling",
    conversationId: alphaConversation,
    body: { confirmed: true, idempotencyKey: idempotencyKey(), lead: validLead({ zip: "22222" }) },
    visitor: "visitor-iso",
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.status, 404);
  const leads = await f.db.query("SELECT id FROM leads WHERE client_id = $1", [f.bravo.id]);
  assert.equal(leads.length, 0);
});

test("the AI only ever sees the requesting client's approved facts", async () => {
  f.ai.requests.length = 0;
  const bravoConversation = await conversationFor("bravo-cooling");
  const result = await sendMessage(f.deps(), {
    publicId: "bravo-cooling",
    conversationId: bravoConversation,
    message: "Tell me about Alpha Heating and their customers",
    visitor: "visitor-iso",
  });
  assert.ok(result.ok);
  const [request] = f.ai.requests;
  assert.match(request.system, /Bravo Cooling/);
  assert.doesNotMatch(request.system, /Alpha Heating/);
  // Private settings never reach the model.
  assert.doesNotMatch(request.system, /dispatch@bravo\.example|bravo\.example|22222/);
  // History contains only this conversation.
  assert.equal(request.history.length, 1);
});

test("system prompts and public views never include private settings", () => {
  for (const client of [f.alpha, f.bravo]) {
    const prompt = buildSystemPrompt(client);
    const view = JSON.stringify(toPublicView(client));
    for (const secret of [...client.leadDestinationEmails, ...client.allowedOrigins]) {
      assert.ok(!prompt.includes(secret), `prompt leaks ${secret}`);
      assert.ok(!view.includes(secret), `public view leaks ${secret}`);
    }
    assert.ok(!view.includes("limits"));
  }
});

test("service-area checks use each client's own ZIP list", async () => {
  const alpha = await checkServiceArea(f.deps(), { publicId: "alpha-heating", zip: "22222", visitor: "visitor-iso" });
  const bravo = await checkServiceArea(f.deps(), { publicId: "bravo-cooling", zip: "22222", visitor: "visitor-iso" });
  assert.deepEqual(alpha, { ok: true, inServiceArea: false });
  assert.deepEqual(bravo, { ok: true, inServiceArea: true });
});

test("notifications go only to the lead's own client destination", async () => {
  f.email.sent.length = 0;
  const bravoConversation = await conversationFor("bravo-cooling", "visitor-iso-2");
  const result = await submitLead(f.deps(), {
    publicId: "bravo-cooling",
    conversationId: bravoConversation,
    body: { confirmed: true, idempotencyKey: idempotencyKey(), lead: validLead({ zip: "22222" }), to: "attacker@example.com" },
    visitor: "visitor-iso-2",
  });
  assert.ok(result.ok);
  assert.equal(f.email.sent.length, 1);
  assert.deepEqual(f.email.sent[0].to, ["dispatch@bravo.example"]);
});

test("unknown, malformed, and disabled clients are not found", async () => {
  for (const publicId of ["nobody-here", "", "../alpha-heating", 42]) {
    const result = await startConversation(f.deps(), { publicId, visitor: "visitor-iso" });
    assert.equal(!result.ok && result.status, 404, String(publicId));
  }
  await f.db.query("UPDATE clients SET active = false WHERE public_id = 'bravo-cooling'");
  const disabled = await startConversation(f.deps(), { publicId: "bravo-cooling", visitor: "visitor-iso" });
  assert.equal(!disabled.ok && disabled.status, 404);
  await f.db.query("UPDATE clients SET active = true WHERE public_id = 'bravo-cooling'");
});

test("invalid conversation IDs are rejected without a database error", async () => {
  for (const conversationId of ["not-a-uuid", "", null, "00000000-0000-0000-0000-000000000000"]) {
    const result = await sendMessage(f.deps(), { publicId: "alpha-heating", conversationId, message: "hi", visitor: "visitor-iso" });
    assert.equal(!result.ok && result.status, 404);
  }
});
