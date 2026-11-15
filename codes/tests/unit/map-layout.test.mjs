import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  hospitalMap,
  configuredHospitalMap,
  mapBuildings,
  mappedJourneyRooms,
  mapInventory,
  mapScene,
  mapUiCopy,
  mapSpaceTitle,
  mapLabel,
  floorSpaceId,
  routeInstructions,
  routeLanguage,
  shortestPath,
  validateHospitalMap,
  buildingFloors,
  destinationNode,
} from "../../packages/shared/src/hospitalMap.ts";
import {
  mapDepartments,
  configuredMapDepartments,
  departmentNodeId,
} from "../../packages/shared/src/hospitalDepartments.ts";

test("new configured departments and rooms stay visible in inventory without inferred coordinates", () => {
  const custom = {
    id: "new-admin-department",
    code: "NEW",
    nameVi: "New department",
    nameEn: "New department",
    active: true,
  };
  const departments = configuredMapDepartments([custom]);
  const entry = departments.find((d) => d.id === custom.id);
  assert.ok(entry);
  assert.equal(entry.building, null);
  assert.deepEqual(entry.floors, []);
  const graph = configuredHospitalMap([custom]);
  assert.equal(
    graph.nodes.some((n) => n.departmentId === custom.id),
    false,
  );
  const report = mapInventory(
    graph,
    [
      {
        id: "H801",
        nameVi: "New room",
        building: "H",
        floor: "8",
        room: "801",
        active: true,
      },
    ],
    [custom],
  );
  assert.equal(
    report.departments.find((d) => d.id === custom.id).status,
    "incomplete",
  );
  assert.equal(report.locations[0].status, "unmapped");
});

test("all declared floors, departments, Journey rooms and unresolved catalog locations are inventoried", () => {
  assert.equal(hospitalMap.spaces.length, 26);
  assert.equal(hospitalMap.spaces.filter((s) => s.kind === "floor").length, 25);
  assert.deepEqual(
    mapBuildings.map((b) => b.id),
    ["A", "B", "C", "D", "E", "F", "G"],
  );
  for (const b of mapBuildings)
    assert.deepEqual(buildingFloors(b.id), b.floors);
  for (const d of mapDepartments) {
    for (const floor of d.floors) {
      const n = hospitalMap.nodes.find(
        (n) => n.id === departmentNodeId(d.id, floor),
      );
      assert.ok(n, d.id + floor);
      assert.equal(n.spaceId, floorSpaceId(d.building, floor));
    }
    if (!d.building || !d.floors.length)
      assert.equal(
        hospitalMap.nodes.filter((n) => n.departmentId === d.id).length,
        0,
      );
  }
  for (const r of mappedJourneyRooms) assert.equal(destinationNode(r).id, r.id);
  const roster = JSON.parse(
    readFileSync(
      new URL(
        "../../packages/shared/data/hospital-roster.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(roster.clinics.length, 81);
  const inventory = mapInventory(
    hospitalMap,
    roster.clinics.map((c) => ({
      ...c,
      nameVi: c.name,
      building: c.building ?? "?",
      floor: c.floor ?? "?",
      room: c.room ?? "?",
    })),
  );
  assert.equal(
    inventory.departments.filter((x) => x.status === "incomplete").length,
    9,
  );
  assert.ok(inventory.locations.every((x) => x.status === "incomplete"));
  assert.equal(
    mapInventory(hospitalMap, [
      { id: "unknown", nameVi: "new", building: "A", floor: "1", room: "66" },
    ]).locations[0].status,
    "unmapped",
  );
});

test("the exact rendered wall/door/corridor geometry validates every graph edge", () => {
  assert.deepEqual(validateHospitalMap(hospitalMap), []);
  for (const space of hospitalMap.spaces.filter((s) => s.kind === "floor")) {
    assert.ok(space.outline && space.walls.length && space.corridors.length);
    for (const room of space.rooms) {
      const exits = hospitalMap.edges.filter(
        (e) => e.from === room.nodeId || e.to === room.nodeId,
      );
      assert.equal(exits.length, 1, "Rooms cannot be transit shortcuts");
      assert.ok(exits.every((e) => [e.from, e.to].includes(room.doorId)));
    }
    assert.deepEqual(
      new Set(
        space.cores.map(
          (c) => hospitalMap.nodes.find((n) => n.id === c.nodeId).kind,
        ),
      ),
      new Set(["elevator", "stairs"]),
    );
  }
  const space = hospitalMap.spaces.find((s) => s.id === "floor:A:1"),
    [a, b] = space.rooms;
  const shortcut = {
    ...hospitalMap,
    edges: [
      ...hospitalMap.edges,
      {
        id: "bad-wall-shortcut",
        from: a.nodeId,
        to: b.nodeId,
        kind: "walk",
        zone: "corridor",
        weight: 1,
      },
    ],
  };
  assert.ok(validateHospitalMap(shortcut).some((s) => /wall|walkable/.test(s)));
});

test("same-floor, cross-floor and cross-building routes use doors, declared transitions and single arrival", () => {
  for (const [from, to] of [
    ["room-B201", "room-B202"],
    ["room-A101", "department-A-outpatients-0"],
    ["room-A101", "room-B201"],
    ["gate-2", "department-C-hall-7"],
    ["room-C01", "department-G-meeting--1"],
  ]) {
    const r = shortestPath(hospitalMap, from, to);
    assert.ok(r);
    assert.equal(r.legs.filter((l) => l.action === "arrive").length, 1);
    assert.equal(new Set(r.legs.map((l) => l.id)).size, r.legs.length);
    assert.equal(r.legs.flatMap((l) => l.edges).length, r.edges.length);
    assert.ok(r.nodes.some((n) => n.kind === "door"));
    for (const l of r.legs) {
      if (!l.transition)
        assert.equal(new Set(l.nodes.map((n) => n.spaceId)).size, 1);
      else {
        assert.equal(l.edges.length, 1);
        assert.ok(l.edges[0].transition);
      }
    }
    for (const e of r.edges.filter((e) => e.kind !== "walk")) {
      assert.equal(
        e.transition.fromSpace,
        hospitalMap.nodes.find((n) => n.id === e.from).spaceId,
      );
      assert.equal(
        e.transition.toSpace,
        hospitalMap.nodes.find((n) => n.id === e.to).spaceId,
      );
    }
    assert.equal(shortestPath(hospitalMap, from, to).id, r.id);
  }
  const same = shortestPath(hospitalMap, "room-B201", "room-B202");
  assert.ok(same.edges.every((e) => e.kind === "walk"));
  const cross = shortestPath(hospitalMap, "room-A101", "room-B201");
  assert.equal(cross.edges.filter((e) => e.kind === "connector").length, 2);
  assert.ok(cross.nodes.some((n) => n.spaceId === "campus"));
});

test("closed lifts fall back to stairs; closed doors/links and one-way connectors do not invent paths", () => {
  const noLifts = {
    ...hospitalMap,
    edges: hospitalMap.edges.map((e) => ({
      ...e,
      closed: e.kind === "elevator",
    })),
  };
  const r = shortestPath(noLifts, "gate-1", "room-B201");
  assert.ok(r.edges.some((e) => e.kind === "stairs"));
  assert.ok(
    routeInstructions(r, "en").some((s) => s.includes("stairs in building B")),
  );
  const door = hospitalMap.spaces
    .flatMap((s) => s.rooms)
    .find((r) => r.nodeId === "room-B201").doorId;
  const sealed = {
    ...hospitalMap,
    nodes: hospitalMap.nodes.map((n) => ({ ...n, closed: n.id === door })),
  };
  assert.equal(shortestPath(sealed, "gate-1", "room-B201"), null);
  const oneWay = {
    ...hospitalMap,
    edges: hospitalMap.edges.map((e) =>
      e.kind === "connector" && e.to === "exit-b" ? { ...e, oneWay: true } : e,
    ),
  };
  assert.ok(shortestPath(oneWay, "gate-1", "room-B201"));
  assert.equal(shortestPath(oneWay, "room-B201", "gate-1"), null);
  const isolated = {
    ...hospitalMap,
    edges: hospitalMap.edges.filter(
      (e) => e.from !== "entry-b" && e.to !== "entry-b",
    ),
  };
  assert.equal(shortestPath(isolated, "gate-1", "room-B201"), null);
});

test("straight hallway checkpoints merge; turn prompts precede the turn and do not use cross-frame angles", () => {
  const r = shortestPath(hospitalMap, "gate-1", "room-B201");
  const start = r.legs[0];
  assert.equal(start.action, "start");
  assert.ok(start.nodes.length > 3, "Collinear campus nodes form one leg");
  assert.equal(r.legs[1].action, "left");
  assert.equal(r.legs[1].nodes[0].id, start.nodes.at(-1).id);
  const lift = r.legs.findIndex((l) => l.action === "elevator");
  assert.equal(r.legs[lift + 1].action, "straight");
  assert.ok(r.legs.length < r.nodes.length);
  const mirror = shortestPath(hospitalMap, "room-B201", "gate-1");
  assert.ok(mirror.legs.some((l) => l.action === "right"));
  assert.ok(mirror.legs.some((l) => l.action === "exit"));
});

test("floor/campus scenes only render edges in one coordinate frame and preserve route orientation", () => {
  const r = shortestPath(hospitalMap, "room-A101", "room-B201");
  for (const s of hospitalMap.spaces) {
    const scene = mapScene(hospitalMap, s.id, r),
      ids = new Set(scene.nodes.map((n) => n.id));
    assert.ok(
      scene.edges.every(
        (e) => ids.has(e.from) && ids.has(e.to) && e.kind === "walk",
      ),
    );
    assert.ok(scene.routeEdges.every((e) => r.edges.includes(e)));
    assert.equal(
      scene.nodes.some((n) => n.spaceId !== s.id),
      false,
    );
  }
  assert.equal(mapScene(hospitalMap, "floor:E:1", r).space, undefined);
  const allClosed = {
    ...hospitalMap,
    nodes: hospitalMap.nodes.map((n) => ({
      ...n,
      closed: n.building === "C" && n.floor === "7",
    })),
  };
  assert.ok(
    buildingFloors("C", allClosed).includes("7"),
    "Closing nodes does not erase a declared floor",
  );
});

test("all six languages cover new controls and turn/transfer/stair instructions with unchanged IDs", () => {
  const r = shortestPath(hospitalMap, "gate-1", "room-B201");
  for (const locale of ["vi", "en", "zh", "ko", "ja", "ru"]) {
    assert.deepEqual(Object.keys(mapUiCopy[locale]), Object.keys(mapUiCopy.vi));
    assert.ok(
      Object.values(mapUiCopy[locale]).every(
        (s) => typeof s === "string" && s.trim(),
      ),
    );
    assert.ok(
      mapSpaceTitle(
        hospitalMap.spaces.find((s) => s.id === "floor:B:2"),
        locale,
      ).includes("B"),
    );
    const text = routeInstructions(r, locale).join(" ");
    assert.ok(text.includes("B201"));
    assert.doesNotMatch(text, /\{\w+\}/);
    assert.equal(routeLanguage(r, locale), locale);
    if (locale !== "vi") assert.doesNotMatch(text, /Rẽ|Đi thẳng|Vào tòa/);
    for (const n of r.nodes) assert.ok(mapLabel(n, locale));
  }
});
