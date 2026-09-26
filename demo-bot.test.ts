import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SAMPLE_ZIPS,
  choicesFor,
  handleAction,
  handleText,
  initialState,
  type Action,
  type BotReply,
  type BotState,
  type RequestSummary,
} from "../lib/demo-bot.ts";

function run(actions: Action[]) {
  let state: BotState = initialState();
  const replies: BotReply[] = [];
  for (const action of actions) {
    const available = choicesFor(state).map((choice) => JSON.stringify(choice.action));
    assert.ok(available.includes(JSON.stringify(action)), `Action ${JSON.stringify(action)} not offered at step ${state.step}`);
    const turn = handleAction(state, action);
    state = turn.state;
    replies.push(...turn.replies);
  }
  return { state, replies };
}

function summaryOf(replies: BotReply[]): RequestSummary {
  const found = replies.find((reply): reply is { summary: RequestSummary } => "summary" in reply);
  assert.ok(found, "expected a summary");
  return found.summary;
}

function allText(replies: BotReply[]): string {
  return replies.map((reply) => ("text" in reply ? reply.text : "")).join(" ");
}

test("AC repair flow collects ZIP, issue, callback time, and sample contact", () => {
  const { state, replies } = run([
    { type: "intent", intent: "repair" },
    { type: "zip", zip: SAMPLE_ZIPS.inside, inArea: true },
    { type: "detail", kind: "issue", value: "Blowing warm air" },
    { type: "callback", value: "Afternoon (noon–4pm)" },
    { type: "contact" },
  ]);
  assert.equal(state.step, "done");
  const summary = summaryOf(replies);
  assert.equal(summary.service, "AC repair");
  assert.equal(summary.zip, SAMPLE_ZIPS.inside);
  assert.equal(summary.details, "Blowing warm air");
  assert.equal(summary.callback, "Afternoon (noon–4pm)");
  assert.match(summary.contact, /Jordan Sample/);
  assert.match(allText(replies), /nothing was submitted or booked/);
});

test("maintenance flow asks for the system type", () => {
  const { replies } = run([
    { type: "intent", intent: "maintenance" },
    { type: "zip", zip: SAMPLE_ZIPS.inside, inArea: true },
    { type: "detail", kind: "system", value: "Heat pump" },
    { type: "callback", value: "Any time" },
    { type: "contact" },
  ]);
  const summary = summaryOf(replies);
  assert.equal(summary.service, "Maintenance visit");
  assert.equal(summary.details, "System: Heat pump");
});

test("service area check handles an out-of-area ZIP with a handoff, not a guess", () => {
  const { state, replies } = run([
    { type: "intent", intent: "area" },
    { type: "zip", zip: SAMPLE_ZIPS.outside, inArea: false },
    { type: "confirmOutOfArea" },
    { type: "callback", value: "Morning (8am–noon)" },
    { type: "contact" },
  ]);
  assert.equal(state.step, "done");
  const summary = summaryOf(replies);
  assert.equal(summary.service, "Service area check");
  assert.match(summary.areaNote, /office to confirm/);
});

test("in-area check offers services and continues into a request", () => {
  const { state } = run([
    { type: "intent", intent: "area" },
    { type: "zip", zip: SAMPLE_ZIPS.inside, inArea: true },
    { type: "service", service: "Heating repair" },
  ]);
  assert.equal(state.step, "issue");
  assert.ok(choicesFor(state).some((choice) => choice.label === "Not producing heat"));
});

test("restart returns to the main menu", () => {
  const { state } = run([
    { type: "intent", intent: "human" },
    { type: "zip", zip: SAMPLE_ZIPS.inside, inArea: true },
    { type: "callback", value: "Any time" },
    { type: "contact" },
    { type: "restart" },
  ]);
  assert.deepEqual(state, initialState());
});

test("free text: guardrails for prices, repairs, and availability", () => {
  const state = initialState();
  assert.match(allText(handleText(state, "How much does a new AC cost?").replies), /can’t give prices/);
  assert.match(allText(handleText(state, "How do I fix my thermostat myself?").replies), /can’t walk you through repairs/);
  assert.match(allText(handleText(state, "Can someone come out today?").replies), /can’t promise/);
});

test("free text: safety message for gas smells", () => {
  assert.match(allText(handleText(initialState(), "I smell gas near the furnace").replies), /911/);
  // A gas furnace alone is not an emergency.
  assert.equal(handleText(initialState(), "my gas furnace is not heating").state.step, "zip");
});

test("free text: personal details are redacted and not echoed", () => {
  const phone = handleText(initialState(), "call me at 555-867-5309");
  assert.equal(phone.redactUserText, true);
  const email = handleText(initialState(), "me@example.com");
  assert.equal(email.redactUserText, true);
  const zip = handleText({ step: "zip", draft: {} }, "90210");
  assert.equal(zip.redactUserText, true);
  assert.equal(zip.state.step, "zip");
});

test("free text: starts flows for known intents and admits unknowns", () => {
  assert.equal(handleText(initialState(), "I need an AC repair.").state.step, "zip");
  assert.equal(handleText(initialState(), "Can I request a maintenance visit?").state.draft.service, "Maintenance visit");
  assert.equal(handleText(initialState(), "Do you service my area?").state.step, "zip");
  const unknown = handleText(initialState(), "Do you sell pool tables?");
  assert.match(allText(unknown.replies), /rather not guess/);
});

test("no reply anywhere in the script mentions a dollar price", () => {
  const flows: Action[][] = [
    [{ type: "intent", intent: "hours" }],
    [{ type: "intent", intent: "repair" }, { type: "zip", zip: SAMPLE_ZIPS.inside, inArea: true }],
  ];
  for (const flow of flows) {
    assert.doesNotMatch(allText(run(flow).replies), /\$\d/);
  }
});
