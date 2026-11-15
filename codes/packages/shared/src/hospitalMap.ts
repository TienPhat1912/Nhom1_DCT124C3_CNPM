import { localizedCopy, localizeText } from "./localizedText.ts";
import type { Department, Destination, Locale, Location } from "./types";
import { configuredMapDepartments, floorLabel } from "./hospitalDepartments.ts";

import { hospitalMap } from "./hospitalLayout.ts";
import { infrastructureLabel, mapUiCopy } from "./mapPresentation.ts";
export { mapScene, mapSpaceTitle, mapUiCopy } from "./mapPresentation.ts";
import type { MapNode, MapGraph, MapRoute } from "./mapModel.ts";
export {
  hospitalMap,
  mapBuildings,
  mapLayoutVersion,
  mappedJourneyRooms,
} from "./hospitalLayout.ts";
export * from "./mapModel.ts";
export { shortestPath, routeLegs, validMapEdge } from "./mapRouting.ts";
export { validateHospitalMap } from "./mapValidation.ts";
export const mapFloors = [
  ...new Set(hospitalMap.nodes.map((n) => n.floor)),
].sort((a, b) => Number(a) - Number(b));
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
      graph.spaces
        ? graph.spaces
            .filter((s) => s.kind === "floor" && s.building === building)
            .map((s) => s.floor)
        : graph.nodes
            .filter((n) => n.building === building && !n.closed)
            .map((n) => n.floor),
    ),
  ].sort((a, b) => Number(a) - Number(b));
export const startNodes = (area: string, floor: string, graph = hospitalMap) =>
  graph.nodes.filter(
    (n) =>
      !n.closed &&
      n.kind !== "door" &&
      (area === "outside"
        ? !n.building
        : n.building === area && n.floor === floor),
  );
export const mapLabel = (n: MapNode, locale: Locale) =>
  infrastructureLabel(n, locale) ??
  `${n.room ? n.room + " · " : ""}${locale === "vi" ? n.nameVi : (n.name ?? localizeText(n.nameVi, locale))}`;
const normalized = (s: string) => s.trim().toUpperCase();
// Keep the entire spoken route in Vietnamese when a custom label is unavailable.
export function routeLanguage(route: MapRoute | null, locale: Locale): Locale {
  if (locale === "vi" || !route) return locale;
  return route.nodes.some(
    (n) =>
      n.fallback ||
      (infrastructureLabel(n, locale) === null &&
        !n.name &&
        localizeText(n.nameVi, locale) === n.nameVi),
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

export function routeInstructions(
  route: MapRoute,
  locale: Locale,
  ticket = true,
): string[] {
  const format = (text: string, values: Record<string, string> = {}) =>
    text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
  const c = mapUiCopy[locale];
  return route.legs.map((leg) => {
    const from = leg.nodes[0],
      to = leg.nodes.at(-1)!;
    const values = {
      place: mapLabel(from, locale),
      next: mapLabel(to, locale),
      building: (leg.action === "exit" ? from.building : to.building) ?? "",
      from: floorLabel(from.floor, locale).toLowerCase(),
      to: floorLabel(to.floor, locale).toLowerCase(),
      floor: floorLabel(to.floor, locale).toLowerCase(),
    };
    if (leg.action === "arrive") {
      const source =
        route.nodes.length === 1
          ? ticket
            ? "Bạn đã ở đúng phòng trên phiếu."
            : "Bạn đã đến điểm đã chọn."
          : ticket
            ? "Đây là điểm đến trên phiếu."
            : "Đây là khoa/phòng đã chọn.";
      return (
        localizeText(source, locale) +
        (route.nodes.length > 1 ? " " + mapLabel(to, locale) : "")
      );
    }
    if (leg.action === "elevator")
      return format(
        localizeText("Đi thang máy tòa {building} từ {from} đến {to}.", locale),
        values,
      );
    const text =
      leg.action === "stairs"
        ? c.stairStep
        : leg.action === "enter"
          ? c.enter
          : leg.action === "exit"
            ? c.leave
            : leg.action === "transfer"
              ? c.transfer
              : c[leg.action];
    return format(text, values);
  });
}

export type MapInventoryEntry = {
  id: string;
  name: string;
  building: string;
  floors: string[];
  room?: string;
  status: "mapped" | "unmapped" | "incomplete" | "inactive";
};
export function mapInventory(
  graph: MapGraph,
  locations: Location[] = [],
  configuredDepartments: Department[] = [],
) {
  const departments = configuredMapDepartments(configuredDepartments).map(
    (d) => {
      const nodes = graph.nodes.filter((n) => n.departmentId === d.id);
      return {
        id: d.id,
        name: d.name ?? d.nameVi,
        building: d.building ?? "?",
        floors: d.floors,
        status:
          !d.building || !d.floors.length
            ? "incomplete"
            : !nodes.length
              ? "unmapped"
              : nodes.every((n) => n.closed)
                ? "inactive"
                : "mapped",
      } as MapInventoryEntry;
    },
  );
  const configured = locations.map(
    (location) =>
      ({
        id: location.id,
        name: location.name ?? location.nameVi,
        building: location.building,
        floors: [location.floor],
        room: location.room,
        status:
          location.active === false
            ? "inactive"
            : !location.building ||
                !location.floor ||
                [location.building, location.floor, location.room].includes("?")
              ? "incomplete"
              : destinationNode(location, graph)
                ? "mapped"
                : "unmapped",
      }) as MapInventoryEntry,
  );
  return { departments, locations: configured };
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
