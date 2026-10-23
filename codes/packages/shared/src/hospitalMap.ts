import type { Destination, Locale } from "./types";

export type MapNode = {
  id: string;
  x: number;
  y: number;
  floor: string;
  nameVi: string;
  nameEn: string;
  kind: "room" | "gate" | "checkpoint" | "elevator";
  building?: string;
  room?: string;
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

// SAMPLE: room positions, floors and paths need on-site verification.
// Coordinates project onto the supplied campus image (604 x 666).
// Weight is in relative model units, NOT metres or travel time.
const point = (
  id: string,
  x: number,
  y: number,
  vi: string,
  en: string,
  building?: string,
  floor = "1",
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
  point("gate-1", 310, 600, "Cổng 1", "Gate 1", undefined, "1", "gate"),
  point("gate-2", 550, 600, "Cổng 2", "Gate 2", undefined, "1", "gate"),
  point("gate-3", 70, 365, "Cổng 3", "Gate 3", undefined, "1", "gate"),
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
  point("d-lift-hall", 268, 190, "Lối đến thang máy D", "D lift corridor", "D"),
  point("lobby-e", 102, 274, "Sảnh E", "E lobby", "E"),
  point("west-e", 232, 274, "Lối đi phía đông E", "East E walkway"),
  point("lobby-f", 232, 83, "Sảnh F", "F lobby", "F"),
  point("lobby-g", 128, 400, "Sảnh G", "G lobby", "G"),
  point(
    "lift-b-1",
    297,
    318,
    "Thang máy B · tầng 1",
    "Lift B · floor 1",
    "B",
    "1",
    "elevator",
  ),
  point(
    "lift-b-2",
    297,
    318,
    "Thang máy B · tầng 2",
    "Lift B · floor 2",
    "B",
    "2",
    "elevator",
  ),
  point(
    "hall-b-2",
    310,
    260,
    "Hành lang B · tầng 2",
    "B corridor · floor 2",
    "B",
    "2",
  ),
  point(
    "lift-d-1",
    268,
    98,
    "Thang máy D · tầng 1",
    "Lift D · floor 1",
    "D",
    "1",
    "elevator",
  ),
  point(
    "lift-d-3",
    268,
    98,
    "Thang máy D · tầng 3",
    "Lift D · floor 3",
    "D",
    "3",
    "elevator",
  ),
  point(
    "hall-d-3",
    268,
    145,
    "Hành lang D · tầng 3",
    "D corridor · floor 3",
    "D",
    "3",
  ),
  room("A101", "A", "1", 345, 470, "Phòng khám tổng quát", "Consultation room"),
  room("R01", "A", "1", 270, 550, "Quầy tiếp nhận", "Reception desk"),
  room("P01", "A", "1", 445, 605, "Quầy nhà thuốc", "Pharmacy counter"),
  room("C01", "C", "1", 480, 470, "Quầy thu ngân", "Settlement desk"),
  room("B201", "B", "2", 342, 260, "Phòng lấy mẫu", "Sample collection"),
  room("B202", "B", "2", 400, 260, "Phòng chẩn đoán hình ảnh", "Imaging room"),
  room("D301", "D", "3", 342, 145, "Phòng khoa khác", "Other clinic"),
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
  ["lobby-d", "d-lift-hall"],
  ["d-lift-hall", "lift-d-1"],
  ["north-a", "lift-b-1"],
  ["lift-b-2", "hall-b-2"],
  ["hall-b-2", "room-B201"],
  ["hall-b-2", "room-B202"],
  ["lift-d-3", "hall-d-3"],
  ["hall-d-3", "room-D301"],
  ["south-a", "room-A101"],
  ["lobby-a", "room-R01"],
  ["lobby-c", "room-P01"],
  ["lobby-c", "room-C01"],
];
export const hospitalMap: MapGraph = {
  nodes,
  edges: [
    ...pairs.map(([from, to]): MapEdge => {
      const a = nodes.find((n) => n.id === from)!;
      const b = nodes.find((n) => n.id === to)!;
      return {
        from,
        to,
        kind: "walk",
        weight: Math.hypot(a.x - b.x, a.y - b.y),
      };
    }),
    { from: "lift-b-1", to: "lift-b-2", kind: "elevator", weight: 90 },
    { from: "lift-d-1", to: "lift-d-3", kind: "elevator", weight: 180 },
  ],
};
export const mapFloors = ["1", "2", "3"];
export const buildingFloors = (building: string) =>
  [
    ...new Set(
      nodes
        .filter((n) => n.building === building && !n.closed)
        .map((n) => n.floor),
    ),
  ].sort();
export const startNodes = (area: string, floor: string) =>
  nodes.filter(
    (n) =>
      !n.closed &&
      (area === "outside"
        ? !n.building
        : n.building === area && n.floor === floor),
  );
export const mapLabel = (n: MapNode, locale: Locale) =>
  `${n.room ? n.room + " · " : ""}${locale === "vi" ? n.nameVi : n.nameEn}`;
const normalized = (s: string) => s.trim().toUpperCase();
export function destinationNode(destination: Destination, graph = hospitalMap) {
  // Use the ticket snapshot, not the current location's ID or inferred room prefix.
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
export function routeInstructions(route: MapRoute, locale: Locale): string[] {
  const vi = locale === "vi";
  if (route.nodes.length === 1)
    return [
      vi
        ? "Bạn đã ở đúng phòng trên phiếu."
        : "You are at the room on your ticket.",
    ];
  return route.nodes.map((n, i) => {
    const label = mapLabel(n, locale);
    if (!i) return vi ? `Bắt đầu tại ${label}.` : `Start at ${label}.`;
    const previous = route.nodes[i - 1];
    let text: string;
    if (route.edges[i - 1].kind === "elevator") {
      text = vi
        ? `Đi thang máy tòa ${n.building} từ tầng ${previous.floor} đến tầng ${n.floor}.`
        : `Take the lift in building ${n.building} from floor ${previous.floor} to floor ${n.floor}.`;
    } else if (n.building !== previous.building) {
      text = n.building
        ? vi
          ? `Đi đến ${label}, vào tòa ${n.building}, tầng ${n.floor}.`
          : `Go to ${label}, enter building ${n.building}, floor ${n.floor}.`
        : vi
          ? `Ra khỏi tòa ${previous.building}, đi đến ${label}.`
          : `Leave building ${previous.building} and go to ${label}.`;
    } else {
      text = vi
        ? `Đi theo lối nối đến ${label}.`
        : `Follow the connecting path to ${label}.`;
    }
    if (i === route.nodes.length - 1)
      text += vi
        ? " Đây là điểm đến trên phiếu."
        : " This is your ticket destination.";
    return text;
  });
}
export const mapCopy = {
  vi: {
    title: "Bản đồ bệnh viện",
    sample: "Bản đồ mẫu",
    warning:
      "Vị trí phòng, tầng và lối đi là dữ liệu minh họa. Cần đối chiếu thực tế trước khi dùng để dẫn đường.",
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
    target: "Phòng cần đến",
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
    sample: "Sample map",
    warning:
      "Room positions, floors and paths are illustrative. Verify them on site before using this map for navigation.",
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
    target: "Destination room",
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
