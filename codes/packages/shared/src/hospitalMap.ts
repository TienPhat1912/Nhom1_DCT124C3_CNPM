import { localizedCopy, localizeText } from "./localizedText.ts";
import type { Department, Destination, Locale } from "./types";
import {
  mapDepartments,
  configuredMapDepartments,
  floorLabel,
  departmentNodeId,
} from "./hospitalDepartments.ts";

export type MapNode = {
  id: string;
  x: number;
  y: number;
  floor: string;
  name?: string;
  fallback?: boolean;
  nameVi: string;
  nameEn: string;
  kind: "room" | "department" | "gate" | "checkpoint" | "elevator";
  building?: string;
  room?: string;
  departmentId?: string;
  marker?: string;
  closed?: boolean;
};
export type MapEdge = {
  from: string;
  to: string;
  weight: number;
  kind: "walk" | "elevator";
  closed?: boolean;
  oneWay?: boolean;
};
export type MapGraph = { nodes: MapNode[]; edges: MapEdge[] };
export type MapRoute = { nodes: MapNode[]; edges: MapEdge[]; weight: number };
// Department buildings/floors come from the supplied directory. Coordinates,
// entrances and walkways are still SAMPLE data. No metre/time estimates.
const point = (
  id: string,
  x: number,
  y: number,
  vi: string,
  en: string,
  building?: string,
  floor = "0",
  kind: MapNode["kind"] = "checkpoint",
): MapNode => ({ id, x, y, nameVi: vi, nameEn: en, building, floor, kind });
const room = (
  code: string,
  building: string,
  floor: string,
  x: number,
  y: number,
  vi: string,
  en: string,
): MapNode => ({
  ...point(`room-${code}`, x, y, vi, en, building, floor, "room"),
  room: code,
});
export const mapBuildings = [
  { id: "A", x: 340, y: 420 },
  { id: "B", x: 345, y: 215 },
  { id: "C", x: 480, y: 360 },
  { id: "D", x: 390, y: 130 },
  { id: "E", x: 160, y: 240 },
  { id: "F", x: 350, y: 48 },
  { id: "G", x: 130, y: 480 },
];
const nodes: MapNode[] = [
  point("gate-1", 310, 600, "Cổng 1", "Gate 1", undefined, "0", "gate"),
  point("gate-2", 550, 600, "Cổng 2", "Gate 2", undefined, "0", "gate"),
  point("gate-3", 70, 365, "Cổng 3", "Gate 3", undefined, "0", "gate"),
  point("lobby-a", 310, 550, "Sảnh A", "A lobby", "A"),
  point("south-a", 310, 515, "Hành lang nam A", "South A corridor", "A"),
  point("north-a", 310, 340, "Giao lối A – B", "A–B junction"),
  point("west-a", 232, 340, "Lối đi phía tây A", "West A walkway"),
  point("west-entry", 92, 340, "Lối vào phía tây", "West entrance"),
  point("west-g", 92, 400, "Lối rẽ khu G", "G junction"),
  point("west-mid", 232, 400, "Giao lối phía tây", "West junction"),
  point("south-west", 232, 515, "Lối đi tây nam A", "Southwest A walkway"),
  point("lobby-c", 435, 550, "Sảnh C", "C lobby", "C"),
  point("east-a", 435, 340, "Giao lối B – C", "B–C junction"),
  point("east-c", 550, 550, "Lối vào phía đông C", "East C entrance"),
  point("north-c", 550, 207, "Lối đi phía bắc C", "North C walkway"),
  point("north-east", 435, 207, "Lối rẽ vào B", "B entrance junction"),
  point("upper-east", 435, 190, "Lối đi đông bắc B", "Northeast B walkway"),
  point("north-b", 310, 190, "Lối đi phía bắc B", "North B walkway"),
  point("lobby-d", 232, 190, "Sảnh D", "D lobby", "D"),
  point("lobby-e", 102, 274, "Sảnh E", "E lobby", "E"),
  point("west-e", 232, 274, "Lối đi phía đông E", "East E walkway"),
  point("lobby-f", 232, 83, "Sảnh F", "F lobby", "F"),
  point("lobby-g", 128, 400, "Sảnh G", "G lobby", "G"),
  room("A101", "A", "1", 345, 470, "Phòng khám tổng quát", "Consultation room"),
  room("R01", "A", "1", 270, 550, "Quầy tiếp nhận", "Reception desk"),
  room("P01", "A", "1", 400, 530, "Quầy nhà thuốc", "Pharmacy counter"),
  room("C01", "C", "1", 480, 515, "Quầy thu ngân", "Settlement desk"),
  room("B201", "B", "2", 342, 260, "Phòng lấy mẫu", "Sample collection"),
  room("B202", "B", "2", 400, 260, "Phòng chẩn đoán hình ảnh", "Imaging room"),
  room("D301", "D", "3", 405, 170, "Phòng khoa khác", "Other clinic"),
];
const pairs = [
  ["gate-1", "lobby-a"],
  ["lobby-a", "south-a"],
  ["south-a", "north-a"],
  ["north-a", "west-a"],
  ["west-a", "west-entry"],
  ["west-entry", "gate-3"],
  ["west-entry", "west-g"],
  ["west-g", "west-mid"],
  ["west-mid", "south-west"],
  ["west-mid", "west-a"],
  ["west-g", "lobby-g"],
  ["south-west", "south-a"],
  ["lobby-a", "lobby-c"],
  ["lobby-c", "east-a"],
  ["east-a", "north-a"],
  ["lobby-c", "east-c"],
  ["east-c", "gate-2"],
  ["east-c", "north-c"],
  ["north-c", "north-east"],
  ["north-east", "east-a"],
  ["north-east", "upper-east"],
  ["upper-east", "north-b"],
  ["north-b", "north-a"],
  ["north-b", "lobby-d"],
  ["lobby-d", "west-e"],
  ["west-e", "west-a"],
  ["west-e", "lobby-e"],
  ["lobby-d", "lobby-f"],
];
const buildingLayout: Record<
  string,
  {
    lift: [number, number];
    hall: [number, number];
    entrance: string;
    slots: [number, number][];
  }
> = {
  A: {
    lift: [295, 500],
    hall: [310, 515],
    entrance: "south-a",
    slots: [
      [260, 390],
      [345, 390],
      [260, 450],
      [345, 450],
      [260, 490],
    ],
  },
  B: {
    lift: [297, 318],
    hall: [310, 260],
    entrance: "north-a",
    slots: [
      [260, 220],
      [400, 220],
      [260, 285],
      [400, 285],
    ],
  },
  C: {
    lift: [457, 490],
    hall: [435, 470],
    entrance: "lobby-c",
    slots: [
      [485, 270],
      [485, 365],
      [485, 455],
    ],
  },
  D: {
    lift: [268, 98],
    hall: [268, 145],
    entrance: "lobby-d",
    slots: [
      [320, 110],
      [395, 110],
      [320, 170],
    ],
  },
  G: {
    lift: [125, 560],
    hall: [125, 500],
    entrance: "lobby-g",
    slots: [[140, 450]],
  },
};
const liftEdges: MapEdge[] = [];
for (const [building, layout] of Object.entries(buildingLayout)) {
  const floors = [
    ...new Set([
      "0",
      ...mapDepartments
        .filter((d) => d.building === building)
        .flatMap((d) => d.floors),
      ...nodes
        .filter((n) => n.building === building && n.kind === "room")
        .map((n) => n.floor),
    ]),
  ].sort((a, b) => Number(a) - Number(b));
  for (const floor of floors) {
    const liftId = `lift-${building.toLowerCase()}-${floor}`;
    const hallId = `hall-${building.toLowerCase()}-${floor}`;
    nodes.push(
      point(
        liftId,
        ...layout.lift,
        `Thang máy ${building} · ${floorLabel(floor, "vi")}`,
        `Lift ${building} · ${floorLabel(floor, "en")}`,
        building,
        floor,
        "elevator",
      ),
    );
    nodes.push(
      point(
        hallId,
        ...layout.hall,
        `Hành lang ${building} · ${floorLabel(floor, "vi")}`,
        `Corridor ${building} · ${floorLabel(floor, "en")}`,
        building,
        floor,
      ),
    );
    pairs.push([liftId, hallId]);
    if (floor === "0") pairs.push([layout.entrance, liftId]);
    for (const n of nodes.filter(
      (n) => n.building === building && n.floor === floor && n.kind === "room",
    ))
      pairs.push([hallId, n.id]);
    const departments = mapDepartments.filter(
      (d) => d.building === building && d.floors.includes(floor),
    );
    departments.forEach((d, index) => {
      const [x, y] = layout.slots[index];
      const id = departmentNodeId(d.id, floor);
      nodes.push({
        ...point(id, x, y, d.nameVi, d.nameEn, building, floor, "department"),
        departmentId: d.id,
        marker: d.marker,
      });
      pairs.push([hallId, id]);
    });
  }
  // Direct lift travel between served levels: no fictitious walking between floors.
  for (let i = 0; i < floors.length; i++)
    for (let j = i + 1; j < floors.length; j++)
      liftEdges.push({
        from: `lift-${building.toLowerCase()}-${floors[i]}`,
        to: `lift-${building.toLowerCase()}-${floors[j]}`,
        kind: "elevator",
        weight: 90 * Math.abs(Number(floors[i]) - Number(floors[j])),
      });
}
export const hospitalMap: MapGraph = {
  nodes,
  edges: [
    ...pairs.map(([from, to]): MapEdge => {
      const a = nodes.find((n) => n.id === from)!,
        b = nodes.find((n) => n.id === to)!;
      return {
        from,
        to,
        kind: "walk",
        weight: Math.hypot(a.x - b.x, a.y - b.y),
      };
    }),
    ...liftEdges,
  ],
};
export const mapFloors = [...new Set(nodes.map((n) => n.floor))].sort(
  (a, b) => Number(a) - Number(b),
);
export function configuredHospitalMap(
  departments: Department[],
  authoritative = false,
): MapGraph {
  const directory = configuredMapDepartments(departments, authoritative);
  return {
    ...hospitalMap,
    nodes: hospitalMap.nodes.map((n) => {
      if (!n.departmentId) return n;
      const d = directory.find((d) => d.id === n.departmentId);
      return d
        ? {
            ...n,
            name: d.name,
            fallback: d.fallback,
            nameVi: d.nameVi,
            nameEn: d.nameEn,
            closed: n.closed || d.active === false,
          }
        : n;
    }),
  };
}
export const buildingFloors = (building: string, graph = hospitalMap) =>
  [
    ...new Set(
      graph.nodes
        .filter((n) => n.building === building && !n.closed)
        .map((n) => n.floor),
    ),
  ].sort((a, b) => Number(a) - Number(b));
export const startNodes = (area: string, floor: string, graph = hospitalMap) =>
  graph.nodes.filter(
    (n) =>
      !n.closed &&
      (area === "outside"
        ? !n.building
        : n.building === area && n.floor === floor),
  );
export const mapLabel = (n: MapNode, locale: Locale) => {
  if (n.kind === "elevator" || n.id.startsWith("hall-")) {
    const source =
      n.kind === "elevator" ? "Thang máy {building}" : "Hành lang {building}";
    return `${localizeText(source, locale).replace("{building}", n.building ?? "")} · ${floorLabel(n.floor, locale)}`;
  }
  return `${n.room ? n.room + " · " : ""}${locale === "vi" ? n.nameVi : (n.name ?? localizeText(n.nameVi, locale))}`;
};
const normalized = (s: string) => s.trim().toUpperCase();
// Keep the entire spoken route in Vietnamese when a custom label is unavailable.
export function routeLanguage(route: MapRoute | null, locale: Locale): Locale {
  if (locale === "vi" || !route) return locale;
  return route.nodes.some(
    (n) =>
      n.kind !== "elevator" &&
      !n.id.startsWith("hall-") &&
      (n.fallback || (!n.name && localizeText(n.nameVi, locale) === n.nameVi)),
  )
    ? "vi"
    : locale;
}
export function destinationNode(destination: Destination, graph = hospitalMap) {
  return graph.nodes.find(
    (n) =>
      !n.closed &&
      n.kind === "room" &&
      normalized(n.room ?? "") === normalized(destination.room) &&
      normalized(n.building ?? "") === normalized(destination.building) &&
      normalized(n.floor) === normalized(destination.floor),
  );
}

export function shortestPath(
  graph: MapGraph,
  from: string,
  to: string,
): MapRoute | null {
  const available = new Map(
    graph.nodes.filter((n) => !n.closed).map((n) => [n.id, n]),
  );
  if (!available.has(from) || !available.has(to)) return null;
  const adjacent = new Map<string, { next: string; edge: MapEdge }[]>();
  for (const edge of graph.edges) {
    if (
      edge.closed ||
      !Number.isFinite(edge.weight) ||
      edge.weight <= 0 ||
      !available.has(edge.from) ||
      !available.has(edge.to)
    )
      continue;
    adjacent.set(edge.from, [
      ...(adjacent.get(edge.from) ?? []),
      { next: edge.to, edge },
    ]);
    if (!edge.oneWay)
      adjacent.set(edge.to, [
        ...(adjacent.get(edge.to) ?? []),
        { next: edge.from, edge },
      ]);
  }
  const distance = new Map<string, number>([[from, 0]]);
  const previous = new Map<string, { id: string; edge: MapEdge }>();
  const unvisited = new Set(available.keys());
  while (unvisited.size) {
    let current: string | undefined;
    let best = Infinity;
    for (const id of unvisited) {
      const cost = distance.get(id) ?? Infinity;
      if (cost < best) {
        best = cost;
        current = id;
      }
    }
    if (current === undefined) break;
    if (current === to) {
      const path = [available.get(to)!],
        edges: MapEdge[] = [];
      let cursor = to;
      while (cursor !== from) {
        const entry = previous.get(cursor)!;
        edges.unshift(entry.edge);
        path.unshift(available.get(entry.id)!);
        cursor = entry.id;
      }
      return { nodes: path, edges, weight: best };
    }
    unvisited.delete(current);
    for (const { next, edge } of adjacent.get(current) ?? []) {
      if (
        unvisited.has(next) &&
        best + edge.weight < (distance.get(next) ?? Infinity)
      ) {
        distance.set(next, best + edge.weight);
        previous.set(next, { id: current, edge });
      }
    }
  }
  return null;
}
export function routeInstructions(
  route: MapRoute,
  locale: Locale,
  ticket = true,
): string[] {
  const format = (source: string, values: Record<string, string> = {}) =>
    localizeText(source, locale).replace(
      /\{(\w+)\}/g,
      (_, key: string) => values[key] ?? "",
    );
  if (route.nodes.length === 1)
    return [
      format(
        ticket ? "Bạn đã ở đúng phòng trên phiếu." : "Bạn đã đến điểm đã chọn.",
      ),
    ];
  return route.nodes.map((n, i) => {
    const place = mapLabel(n, locale);
    if (!i) return format("Bắt đầu tại {place}.", { place });
    const previous = route.nodes[i - 1];
    const values = {
      place,
      building: n.building ?? previous.building ?? "",
      from: floorLabel(previous.floor, locale).toLowerCase(),
      to: floorLabel(n.floor, locale).toLowerCase(),
      floor: floorLabel(n.floor, locale).toLowerCase(),
    };
    let text =
      route.edges[i - 1].kind === "elevator"
        ? format("Đi thang máy tòa {building} từ {from} đến {to}.", values)
        : n.building !== previous.building
          ? n.building
            ? format("Đi đến {place}, vào tòa {building}, {floor}.", values)
            : format("Ra khỏi tòa {building}, đi đến {place}.", values)
          : format("Đi theo lối nối đến {place}.", values);
    if (i === route.nodes.length - 1)
      text +=
        " " +
        format(
          ticket ? "Đây là điểm đến trên phiếu." : "Đây là khoa/phòng đã chọn.",
        );
    return text;
  });
}

const basemapCopy = {
  vi: {
    title: "Bản đồ bệnh viện",
    unconfirmed:
      "Cần xác nhận vị trí: ảnh chưa ghi đủ khu hoặc tầng. Chưa thể tìm đường tới khoa này.",
    chooseTargetFloor: "Chọn tầng cần đến của khoa trước khi tìm đường.",
    departmentDestination: "Khoa/phòng đã chọn",
    departmentArrived: "Bạn đã đến điểm đã chọn.",
    floorDepartments: "Các khoa tại tầng đang xem",
    sample: "Bản đồ mẫu",
    warning:
      "Khu và tầng của các khoa theo ảnh bạn cung cấp; tọa độ điểm vào khoa, phòng mẫu và lối đi là minh họa. Cần đối chiếu thực tế trước khi dùng để dẫn đường.",
    hint: "Trong tòa nhà: chọn tòa → lầu → checkpoint gần nhất. Ngoài tòa nhà: chọn checkpoint gần bạn trên bản đồ.",
    area: "1. Vị trí của bạn",
    outside: "Ngoài tòa nhà",
    building: "Tòa",
    chooseArea: "Chọn tòa nhà hoặc ngoài trời",
    floor: "Tầng",
    level: "2. Lầu đang đứng",
    chooseFloor: "Chọn lầu",
    start: "Checkpoint gần nhất",
    chooseStart: "Chọn checkpoint / phòng",
    find: "Tìm đường",
    destination: "Đích trên phiếu",
    current: "Bạn đang ở đây",
    target: "Điểm cần đến",
    fixed: "Checkpoint cố định",
    route: "Đường đi ngắn nhất",
    steps: "Hướng dẫn từng chặng",
    select: "Chọn vị trí hiện tại, sau đó bấm Tìm đường.",
    unmapped:
      "Phòng trên phiếu chưa khớp khu, tầng và mã phòng trên bản đồ. Vui lòng liên hệ quầy tiếp nhận.",
    unreachable:
      "Chưa có lối đi kết nối tới phòng này. Vui lòng yêu cầu nhân viên hỗ trợ.",
    arrived: "Bạn đã ở đúng phòng trên phiếu.",
    reset: "Chọn lại vị trí",
    shown: "Tầng đang xem",
    noSegment: "Tuyến đi không qua tầng đang xem.",
    zoomIn: "Phóng to",
    zoomOut: "Thu nhỏ",
    fit: "Vừa khung",
    selected: "Vị trí do bạn chọn; hãy cập nhật khi di chuyển.",
    listen: "Nghe chỉ đường",
    stop: "Dừng đọc",
    audioError:
      "Không phát được âm thanh. Bạn vẫn có thể đọc hướng dẫn bên dưới.",
    narrationIntro: "Hướng dẫn trên bản đồ mẫu. ",
    update: "Tôi đang ở đây",
  },
  en: {
    title: "Hospital map",
    unconfirmed:
      "Needs confirmation: the source does not specify the building or floor. A route is not available yet.",
    chooseTargetFloor:
      "Choose the department destination floor before finding a route.",
    departmentDestination: "Selected department",
    departmentArrived: "You have reached your selected destination.",
    floorDepartments: "Departments on the displayed floor",
    sample: "Sample map",
    warning:
      "Department buildings and floors follow the supplied directory; entry points, sample rooms and paths are illustrative. Verify them on site before using this map for navigation.",
    hint: "Inside: choose building → floor → nearest checkpoint. Outside: select a nearby checkpoint on the map.",
    area: "1. Your location",
    outside: "Outside buildings",
    building: "Building",
    chooseArea: "Choose a building or outside",
    floor: "Floor",
    level: "2. Your floor",
    chooseFloor: "Choose a floor",
    start: "Nearest checkpoint",
    chooseStart: "Choose a checkpoint / room",
    find: "Find route",
    destination: "Ticket destination",
    current: "You are here",
    target: "Destination",
    fixed: "Fixed checkpoint",
    route: "Shortest route",
    steps: "Step-by-step directions",
    select: "Choose your current location, then select Find route.",
    unmapped:
      "The ticket's building, floor and room do not match a mapped location. Please contact reception.",
    unreachable:
      "No connected route to this room. Please ask a staff member for help.",
    arrived: "You are at the room on your ticket.",
    reset: "Choose again",
    shown: "Displayed floor",
    noSegment: "Your route does not pass through this floor.",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    fit: "Fit map",
    selected: "You selected this position; update it as you move.",
    listen: "Listen to directions",
    stop: "Stop playback",
    audioError:
      "Audio is unavailable. You can still read the directions below.",
    narrationIntro: "Directions on the sample map. ",
    update: "I am here",
  },
} as const;

export const mapCopy = {
  ...basemapCopy,
  zh: localizedCopy(basemapCopy.vi, "zh"),
  ko: localizedCopy(basemapCopy.vi, "ko"),
  ja: localizedCopy(basemapCopy.vi, "ja"),
  ru: localizedCopy(basemapCopy.vi, "ru"),
};
