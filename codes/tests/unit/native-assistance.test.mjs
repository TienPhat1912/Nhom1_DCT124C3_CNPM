import { test } from "node:test";
import assert from "node:assert/strict";
import { nativeHarness, all, find } from "./native-harness.mjs";
test("native help submits explicit source and context, keeps input on error, then tracks status", async () => {
  const sent = [],
    resource = { data: [], loading: false, error: null, refresh() {} };
  let succeed = false;
  const h = nativeHarness("Records.tsx", {
    "@hospital/shared": { dateText: (x) => x },
    "./runtime": {
      useNative: () => ({ locale: "ja", t: (x) => x, config: {}, api: {} }),
      useLoad: () => resource,
      useAction: () => ({
        busy: false,
        run: async (path, body) => {
          sent.push({ path, body });
          return succeed ? { id: "help" } : null;
        },
      }),
    },
  });
  let tree = h.render("Help", { visitId: null });
  find(
    tree,
    (n) => n.type === "Input" && n.props.label === "helpDescription",
  ).props.onChangeText("  原文\n");
  find(
    tree,
    (n) => n.type === "Choice" && n.props.label === "ja",
  ).props.onPress();
  tree = h.render("Help", { visitId: null });
  await find(tree, (n) => n.type === "Btn").props.onPress();
  assert.equal(sent[0].body.visitId, null);
  assert.equal(sent[0].body.sourceLanguage, "ja");
  assert.equal(sent[0].body.description, "  原文\n");
  tree = h.render("Help", { visitId: "visit", stepId: "step" });
  assert.equal(find(tree, (n) => n.type === "Input").props.value, "  原文\n");
  succeed = true;
  await find(tree, (n) => n.type === "Btn").props.onPress();
  assert.equal(sent[1].body.visitId, "visit");
  assert.equal(sent[1].body.stepId, "step");
  resource.data = [
    {
      id: "help",
      category: "Language",
      status: "Acknowledged",
      description: "  原文\n",
      resolution: "Reception helped",
      createdAt: "now",
    },
  ];
  tree = h.render("Help", { visitId: "visit", stepId: "step" });
  assert.equal(find(tree, (n) => n.type === "Input").props.value, "");
  assert.equal(
    find(tree, (n) => n.type === "Badge").props.value,
    "Acknowledged",
  );
  assert.match(
    JSON.stringify(all(tree, (n) => n.type === "Txt")),
    /Reception helped/,
  );
});
