import test from "node:test";
import assert from "node:assert/strict";
import * as map from "../../packages/shared/src/hospitalMap.ts";
import * as departments from "../../packages/shared/src/hospitalDepartments.ts";
import * as localized from "../../packages/shared/src/localizedText.ts";
import * as locales from "../../packages/shared/src/locales.ts";
import { nativeHarness, find, all, deferred, tick } from "./native-harness.mjs";
const shared = {
  ...map,
  ...departments,
  ...localized,
  ...locales,
  translator: () => (x) => x,
};
const destination = (room) => ({
  id: room,
  ...map.mappedJourneyRooms.find((r) => r.room === room),
});
function fixture() {
  const runtime = { locale: "en", config: { departments: [], locations: [] } },
    speech = { stop() {}, play() {} },
    texts = [];
  const h = nativeHarness("HospitalMap.tsx", {
    "@hospital/shared": shared,
    "./runtime": { useNative: () => runtime },
    "./FloorPlan": { FloorPlan: "FloorPlan" },
    "./useRouteSpeech": {
      useRouteSpeech: (text) => {
        texts.push(text);
        return speech;
      },
    },
    "react-native": {
      View: "View",
      Pressable: "Pressable",
      StyleSheet: { create: (x) => x },
    },
  });
  return {
    ...h,
    runtime,
    texts,
    renderPlan: (room = "B201", extra = {}) =>
      h.render("MapPanel", { destination: destination(room), ...extra }),
  };
}
function choose(tree, label) {
  const node = find(
    tree,
    (n) => n.type === "Choice" && n.props.label === label,
  );
  assert.ok(node, label);
  node.props.onPress();
}
function press(tree, label) {
  const node = find(
    tree,
    (n) => n.type === "Btn" && n.props.children === label,
  );
  assert.ok(node, label);
  assert.ok(!node.props.disabled, label);
  node.props.onPress();
}

test("native map same-floor/cross-floor/cross-building routes use shared legs and retain manual origin while browsing", () => {
  for (const [from, target] of [
    ["room-B202", "B201"],
    ["department-B-imaging-0", "B201"],
    ["room-A101", "B201"],
  ]) {
    const h = fixture();
    let tree = h.renderPlan(target);
    find(tree, (n) => n.type === "FloorPlan").props.onChoose(from);
    tree = h.renderPlan(target);
    press(tree, "Find route");
    tree = h.renderPlan(target);
    const plan = find(tree, (n) => n.type === "FloorPlan");
    const expected = map.shortestPath(map.hospitalMap, from, `room-${target}`);
    assert.equal(plan.props.route.id, expected.id);
    assert.equal(plan.props.target, `room-${target}`);
    assert.ok(h.texts.at(-1).includes(target));
    choose(tree, "Displayed building: Building C");
    tree = h.renderPlan(target);
    find(
      tree,
      (n) =>
        n.type === "Pressable" &&
        n.props.accessibilityLabel === "Displayed floor 7",
    ).props.onPress();
    tree = h.renderPlan(target);
    const browsed = find(tree, (n) => n.type === "FloorPlan");
    assert.equal(browsed.props.spaceId, "floor:C:7");
    assert.equal(browsed.props.from, from);
    assert.equal(browsed.props.route.id, expected.id);
    h.unmount();
  }
});

test("native target change invalidates the old route; unknown rooms/floors never receive invented coordinates", () => {
  const h = fixture();
  let tree = h.renderPlan("A101");
  find(tree, (n) => n.type === "FloorPlan").props.onChoose("gate-1");
  tree = h.renderPlan("A101");
  press(tree, "Find route");
  h.renderPlan("A101");
  const first = h.texts.at(-1);
  tree = h.renderPlan("B201");
  const plan = find(tree, (n) => n.type === "FloorPlan");
  assert.equal(plan.props.route.nodes.at(-1).id, "room-B201");
  assert.notEqual(h.texts.at(-1), first);
  tree = h.render("MapPanel", {
    destination: { ...destination("B201"), room: "B999" },
  });
  assert.equal(find(tree, (n) => n.type === "FloorPlan").props.route, null);
  assert.equal(
    find(tree, (n) => n.type === "Btn" && n.props.children === "Find route")
      .props.disabled,
    true,
  );
  assert.equal(h.texts.at(-1), "");
  tree = h.renderPlan("B201", {
    department: departments.mapDepartments.find((d) => d.id === "E-premium"),
  });
  assert.equal(find(tree, (n) => n.type === "FloorPlan").props.route, null);
  choose(tree, "Displayed building: Building E");
  tree = h.renderPlan("B201", {
    department: departments.mapDepartments.find((d) => d.id === "E-premium"),
  });
  assert.ok(JSON.stringify(tree).includes(map.mapUiCopy.en.entranceOnly));
  h.unmount();
});

test("native SVG exposes only the selected frame and route directions, with accessible room/entrance labels", () => {
  const svg = Object.fromEntries(
    ["Circle", "Defs", "G", "Line", "Marker", "Path", "Rect", "Text"].map(
      (k) => [k, k],
    ),
  );
  const selected = [];
  const h = nativeHarness("FloorPlan.tsx", {
    "@hospital/shared": shared,
    "react-native": {
      ScrollView: "ScrollView",
      useWindowDimensions: () => ({ width: 400 }),
    },
    "react-native-svg": { __esModule: true, default: "Svg", ...svg },
  });
  const props = {
    graph: map.hospitalMap,
    spaceId: "floor:B:2",
    route: map.shortestPath(map.hospitalMap, "room-A101", "room-B201"),
    from: "room-A101",
    target: "room-B201",
    locale: "en",
    zoom: 1,
    onChoose: (id) => selected.push(id),
    onBuilding() {},
  };
  let tree = h.render("FloorPlan", props);
  assert.equal(
    find(tree, (n) => n.type === "Svg").props.viewBox,
    "0 0 720 500",
  );
  assert.equal(
    find(tree, (n) => n.props.accessibilityLabel?.includes("A101")),
    undefined,
  );
  const room = find(
    tree,
    (n) => n.type === "G" && n.props.accessibilityLabel?.startsWith("B201"),
  );
  assert.ok(room);
  room.props.onPress();
  assert.deepEqual(selected, ["room-B201"]);
  const blue = all(
    tree,
    (n) => n.type === "Line" && n.props.stroke === "#1261df",
  );
  assert.ok(blue.length > 0);
  assert.ok(blue.every((n) => n.props.markerEnd));
  tree = h.render("FloorPlan", { ...props, spaceId: "campus" });
  assert.ok(find(tree, (n) => n.props.accessibilityLabel === "Gate 1"));
  assert.equal(
    find(tree, (n) => n.props.accessibilityLabel?.startsWith("B201")),
    undefined,
  );
  h.unmount();
});

test("native route voice discards pending voices and old callbacks when destination changes or map closes", async () => {
  const gate = deferred(),
    spoken = [];
  let voices = () => gate.promise;
  const h = nativeHarness("useRouteSpeech.ts", {
    "@hospital/shared": shared,
    "expo-speech": {
      stop: async () => {},
      getAvailableVoicesAsync: () => voices(),
      speak: (text, options) => spoken.push({ text, options }),
    },
  });
  const old = h.render("useRouteSpeech", "A101", "en", "audioError");
  const pending = old.play();
  await tick();
  const current = h.render("useRouteSpeech", "B201", "en", "audioError");
  gate.resolve([{ language: "en-US", identifier: "en" }]);
  await pending;
  assert.equal(spoken.length, 0);
  voices = async () => [{ language: "en-US", identifier: "en" }];
  await current.play();
  assert.equal(spoken[0].text, "B201");
  h.unmount();
  spoken[0].options.onError();
});
