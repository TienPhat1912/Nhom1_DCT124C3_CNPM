import test from "node:test";
import assert from "node:assert/strict";
import { all, find, loadNative, nativeHarness } from "./native-harness.mjs";
const { patientResultLabels } = loadNative("../../../packages/shared/src/patientResults.ts");
const item = { id: "diagnosis", code: "D01", nameVi: "Chẩn đoán gốc Việt" };
const original = { language: "vi", diagnosis: "Kết quả Việt", explanation: "Giải thích Việt", instructions: "Hướng dẫn Việt" };
const published = {
  visitId: "visit", examStatus: "Completed", bookingUrl: "https://example.test/legacy-booking",
  summary: { id: "record", revision: 1, language: "en", fallback: false, diagnosis: "Translated diagnosis", explanation: "Translated explanation", instructions: "Translated care", authorName: "Confirmed doctor", publishedAt: "2026-11-14T00:00:00Z", contentKey: "translation-1", original },
  clinicalRecord: { author: { name: "Confirmed doctor" }, confirmedAt: "2026-11-14T00:00:00Z", symptoms: [], signs: [], diagnoses: [item] },
  followUps: [{ id: "followup", visitId: "visit", departmentId: "department", recommendedAt: "2026-11-15T00:00:00Z", text: "Translated follow-up", language: "en", fallback: false, original: { language: "vi", text: "Khuyến nghị Việt" } }],
};
function fixture() {
  const runtime = { session: { sessionId: "owner" }, locale: "en", t: x => x, config: { departments: [] } };
  const resource = { data: null, loading: false, error: null, refresh() {} }, paths = [], contexts = [], played = [];
  const speech = { loading: false, playing: false, error: "", stop: async () => {}, play: async (...args) => played.push(args) };
  const h = nativeHarness("Records.tsx", { "@hospital/shared": { patientResultLabels, dateText: x => x, displayName: x => x.nameVi }, "./runtime": {
    useNative: () => runtime, useLoad: path => { paths.push(path); return resource; }, useNarration: context => { contexts.push(context); return speech; },
  } });
  return { ...h, runtime, resource, paths, contexts, played };
}
const strings = tree => JSON.stringify(all(tree, n => n.type === "Txt").map(n => n.props.children));
const buttons = tree => all(tree, n => n.type === "Btn");

test("native results hide unpublished content; confirmed results appear while Visit remains Active", () => {
  const h = fixture(); h.resource.data = { summary: null, clinicalRecord: null, followUps: [], bookingUrl: null };
  let tree = h.render("Results", { id: "visit" });
  assert.match(strings(tree), /noPublished/); assert.equal(buttons(tree).length, 0);
  h.resource.data = published; tree = h.render("Results", { id: "visit" });
  assert.match(strings(tree), /D01/); assert.match(strings(tree), /Chẩn đoán gốc Việt/);
  assert.match(strings(tree), /Confirmed doctor/); assert.match(strings(tree), /Translated diagnosis/);
  assert.match(strings(tree), /Khuyến nghị Việt/); assert.match(strings(tree), /machineTranslation/);
  assert.ok(!buttons(tree).some(n => /bookFollowUp|linkAccount|booking/i.test(String(n.props.children))));
});

test("native language switch keeps original snapshots and sends narration for the displayed source/contentKey", async () => {
  const h = fixture(); h.resource.data = published;
  let tree = h.render("Results", { id: "visit" });
  await buttons(tree).find(n => n.props.children === "listen").props.onPress();
  assert.equal(h.played[0][0], "/api/visits/visit/narration");
  assert.equal(h.played[0][1].contentKey, "translation-1"); assert.equal(h.played[0][1].language, "en");
  h.runtime.locale = "vi"; h.resource.data = { ...published, summary: { ...published.summary, ...original, contentKey: "source-1", fallback: false } };
  tree = h.render("Results", { id: "visit" });
  assert.ok(h.paths.at(-1).endsWith("language=vi")); assert.match(h.contexts.at(-1), /source-1/);
  assert.match(strings(tree), /Kết quả Việt/); assert.match(strings(tree), /D01/);
  find(tree, n => n.type === "Btn" && n.props.children === "original").props.onPress();
  assert.match(strings(h.render("Results", { id: "visit" })), /Hướng dẫn Việt/);
});

test("native fallback is labeled and authorization errors immediately hide a previous snapshot", () => {
  const h = fixture(); h.resource.data = { ...published, summary: { ...published.summary, ...original, fallback: true } };
  let tree = h.render("Results", { id: "visit" }); assert.match(strings(tree), /fallback/);
  h.resource.error = new Error("grant expired"); tree = h.render("Results", { id: "visit" });
  assert.doesNotMatch(strings(tree), /D01|Kết quả Việt|Khuyến nghị Việt/); assert.equal(buttons(tree).length, 0);
  assert.ok(!h.contexts.at(-1).includes("translation-1"));
});

test("native legacy history renders published summary without requiring structured V2 snapshots", () => {
  const h = fixture(); h.resource.data = { ...published, clinicalRecord: null };
  const tree = h.render("Results", { id: "legacy" });
  assert.match(strings(tree), /Translated diagnosis/); assert.doesNotMatch(strings(tree), /D01/);
  assert.ok(h.paths.at(-1).startsWith("/api/visits/legacy/content"));
});
