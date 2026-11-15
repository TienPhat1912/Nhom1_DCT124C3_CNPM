import data from "../data/hospital-layout.json" with { type: "json" };
import { mapDepartments, departmentNodeId } from "./hospitalDepartments.ts";
import {
  floorSpaceId,
  type MapGraph,
  type MapNode,
  type MapEdge,
  type MapRect,
  type MapWall,
  type MapSpace,
} from "./mapModel.ts";

export const mapBuildings = data.buildings;
export const mappedJourneyRooms = data.rooms;
export const mapLayoutVersion = data.version;

/** A door is an actual gap in the same wall segments drawn by both clients. */
function walls(rect: MapRect, opening: "top" | "bottom", x: number): MapWall[] {
  const { x: left, y: top, width, height } = rect,
    right = left + width,
    bottom = top + height;
  const y = opening === "top" ? top : bottom;
  return [
    { x1: left, y1: top, x2: left, y2: bottom },
    { x1: right, y1: top, x2: right, y2: bottom },
    {
      x1: left,
      y1: opening === "top" ? bottom : top,
      x2: right,
      y2: opening === "top" ? bottom : top,
    },
    { x1: left, y1: y, x2: x - 14, y2: y },
    { x1: x + 14, y1: y, x2: right, y2: y },
  ];
}

function buildLayout(): MapGraph {
  const nodes: MapNode[] = [],
    edges: MapEdge[] = [],
    spaces: MapSpace[] = [];
  const addNode = (
    id: string,
    x: number,
    y: number,
    space: MapSpace,
    kind: MapNode["kind"],
    nameVi: string,
    nameEn: string,
    extra: Partial<MapNode> = {},
  ) => {
    const node: MapNode = {
      id,
      x,
      y,
      spaceId: space.id,
      building: space.building,
      floor: space.floor,
      kind,
      nameVi,
      nameEn,
      ...extra,
    };
    nodes.push(node);
    return node;
  };
  const join = (
    from: string,
    to: string,
    kind: MapEdge["kind"] = "walk",
    zone: MapEdge["zone"] = "corridor",
    weight?: number,
  ) => {
    const a = nodes.find((n) => n.id === from)!,
      b = nodes.find((n) => n.id === to)!;
    if (!a || !b) throw new Error(`Unknown layout endpoint: ${from}/${to}`);
    edges.push({
      id: `${from}~${to}`,
      from,
      to,
      kind,
      zone,
      weight: weight ?? Math.hypot(a.x - b.x, a.y - b.y),
      ...(kind === "walk"
        ? {}
        : {
            transition: {
              fromSpace: a.spaceId!,
              toSpace: b.spaceId!,
              fromFloor: a.floor,
              toFloor: b.floor,
            },
          }),
    });
  };
  const campus: MapSpace = {
    id: "campus",
    kind: "campus",
    floor: "0",
    width: 604,
    height: 760,
    walls: [],
    corridors: [],
    rooms: [],
    cores: [],
  };
  spaces.push(campus);
  addNode("gate-1", 302, 724, campus, "gate", "Cổng 1", "Gate 1");
  addNode("gate-2", 564, 724, campus, "gate", "Cổng 2", "Gate 2");
  addNode("gate-3", 40, 360, campus, "gate", "Cổng 3", "Gate 3");
  const spine = [110, 270, 360, 430, 590, 680, 724];
  for (const [i, y] of spine.slice(0, -1).entries())
    addNode(
      `campus-${y}`,
      302,
      y,
      campus,
      "checkpoint",
      "Lối nối khuôn viên",
      "Campus walkway",
      { marker: `M${i + 1}` },
    );
  const spineId = (y: number) => (y === 724 ? "gate-1" : `campus-${y}`);
  for (let i = 1; i < spine.length; i++)
    join(spineId(spine[i - 1]), spineId(spine[i]), "walk", "campus");
  join("gate-3", "campus-360", "walk", "campus");
  join("gate-2", "gate-1", "walk", "campus");
  for (const building of mapBuildings) {
    const b = building.id,
      lower = b.toLowerCase(),
      entranceX = building.x < 302 ? building.x + building.width : building.x;
    const entranceY = building.y + building.height / 2;
    addNode(
      `entry-${lower}`,
      entranceX,
      entranceY,
      campus,
      "entrance",
      `Lối vào ${b}`,
      `${b} entrance`,
      { marker: b },
    );
    join(spineId(entranceY), `entry-${lower}`, "walk", "campus");
    for (const floor of building.floors) {
      const outline = { x: 15, y: 30, width: 690, height: 430 };
      const space: MapSpace = {
        id: floorSpaceId(b, floor),
        kind: "floor",
        building: b,
        floor,
        width: 720,
        height: 500,
        entranceOnly: building.entranceOnly,
        outline,
        walls:
          floor === "0"
            ? walls(outline, "bottom", 360)
            : [
                { x1: 15, y1: 30, x2: 705, y2: 30 },
                { x1: 705, y1: 30, x2: 705, y2: 460 },
                { x1: 705, y1: 460, x2: 15, y2: 460 },
                { x1: 15, y1: 460, x2: 15, y2: 30 },
              ],
        corridors: [
          { x: 36, y: 210, width: 648, height: 60 },
          { x: 346, y: 240, width: 28, height: floor === "0" ? 220 : 200 },
        ],
        rooms: [],
        cores: [],
      };
      spaces.push(space);
      const hallId = `hall-${lower}-${floor}`;
      for (const [i, x] of [50, 150, 290, 360, 430, 570, 670].entries())
        addNode(
          x === 360 ? hallId : `hall-${lower}-${floor}-${x}`,
          x,
          240,
          space,
          "checkpoint",
          "Hành lang",
          "Corridor",
          { marker: `H${i + 1}` },
        );
      const hall = (x: number) =>
        x === 360 ? hallId : `hall-${lower}-${floor}-${x}`;
      const xs = [50, 150, 290, 360, 430, 570, 670];
      for (let i = 1; i < xs.length; i++) join(hall(xs[i - 1]), hall(xs[i]));
      const lobbyId =
        floor === "0" ? `lobby-${lower}` : `landing-${lower}-${floor}`;
      addNode(lobbyId, 360, 440, space, "lobby", `Sảnh ${b}`, `${b} lobby`);
      join(hallId, lobbyId);
      if (floor === "0") {
        addNode(
          `exit-${lower}`,
          360,
          460,
          space,
          "exit",
          `Lối ra ${b}`,
          `${b} exit`,
        );
        join(lobbyId, `exit-${lower}`);
        join(`entry-${lower}`, `exit-${lower}`, "connector", undefined, 20);
      }
      for (const [kind, x, id] of [
        ["elevator", 50, `lift-${lower}-${floor}`],
        ["stairs", 670, `stairs-${lower}-${floor}`],
      ] as const) {
        const rect = { x: x - 30, y: 300, width: 60, height: 80 },
          doorId = `door-${id}`;
        addNode(
          id,
          x,
          340,
          space,
          kind,
          kind === "elevator" ? "Thang máy" : "Cầu thang",
          kind === "elevator" ? "Lift" : "Stairs",
        );
        addNode(doorId, x, 300, space, "door", "Cửa", "Door");
        space.cores.push({ ...rect, nodeId: id, walls: walls(rect, "top", x) });
        space.corridors.push({ x: x - 14, y: 270, width: 28, height: 30 });
        join(hall(x), doorId);
        join(doorId, id, "walk", "room-access");
      }
      const entries: Array<
        Partial<MapNode> & Pick<MapNode, "id" | "kind" | "nameVi" | "nameEn">
      > = [
        ...data.rooms
          .filter((r) => r.building === b && r.floor === floor)
          .map((r) => ({ ...r, kind: "room" as const })),
        ...mapDepartments
          .filter((d) => d.building === b && d.floors.includes(floor))
          .map((d) => ({
            id: departmentNodeId(d.id, floor),
            kind: "department" as const,
            departmentId: d.id,
            marker: d.marker,
            nameVi: d.nameVi,
            nameEn: d.nameEn,
          })),
      ].sort((a, b) => a.id.localeCompare(b.id));
      if (entries.length > 8)
        throw new Error(`Explicit floor plan slots required for ${space.id}`);
      entries.forEach((entry, index) => {
        const x = [150, 290, 430, 570][index % 4],
          upper = index < 4;
        const rect = {
          x: x - 55,
          y: upper ? 60 : 300,
          width: 110,
          height: 120,
        };
        const doorId = `door-${entry.id}`,
          doorY = upper ? 180 : 300;
        addNode(
          entry.id,
          x,
          upper ? 120 : 360,
          space,
          entry.kind,
          entry.nameVi,
          entry.nameEn,
          entry,
        );
        addNode(doorId, x, doorY, space, "door", "Cửa", "Door");
        space.rooms.push({
          ...rect,
          nodeId: entry.id,
          doorId,
          walls: walls(rect, upper ? "bottom" : "top", x),
        });
        space.corridors.push({
          x: x - 14,
          y: upper ? 180 : 270,
          width: 28,
          height: 30,
        });
        join(entry.id, doorId, "walk", "room-access");
        join(doorId, hall(x));
      });
    }
    for (let i = 0; i < building.floors.length; i++)
      for (let j = i + 1; j < building.floors.length; j++) {
        const a = building.floors[i],
          c = building.floors[j];
        join(
          `lift-${lower}-${a}`,
          `lift-${lower}-${c}`,
          "elevator",
          undefined,
          35 + 10 * Math.abs(Number(a) - Number(c)),
        );
        if (j === i + 1)
          join(
            `stairs-${lower}-${a}`,
            `stairs-${lower}-${c}`,
            "stairs",
            undefined,
            90 * Math.abs(Number(a) - Number(c)),
          );
      }
  }
  // Campus path geometry is generated from these exact graph edges.
  for (const e of edges.filter(
    (e) => e.kind === "walk" && e.zone === "campus",
  )) {
    const a = nodes.find((n) => n.id === e.from)!,
      b = nodes.find((n) => n.id === e.to)!;
    campus.corridors.push({
      x: Math.min(a.x, b.x) - 10,
      y: Math.min(a.y, b.y) - 10,
      width: Math.abs(a.x - b.x) + 20,
      height: Math.abs(a.y - b.y) + 20,
    });
  }
  return { nodes, edges, spaces, version: data.version };
}
export const hospitalMap = buildLayout();
