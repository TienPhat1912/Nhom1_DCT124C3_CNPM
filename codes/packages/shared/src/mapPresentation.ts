import type { Locale } from "./types";
import type { MapGraph, MapNode, MapRoute, MapSpace } from "./mapModel.ts";
import { floorLabel } from "./hospitalDepartments.ts";
import { positionCopy } from "./positionCopy.ts";

export const mapUiCopy = {
  vi: {
    campus: "Khuôn viên",
    shownBuilding: "Tòa đang xem",
    plan: "Mặt bằng tầng",
    building: "Tòa",
    demo: "Mặt bằng demo tự thiết kế; không phải bản khảo sát bệnh viện thực tế. Trọng số tuyến không phải mét hoặc thời gian đi bộ.",
    entranceOnly:
      "Chỉ có sảnh demo. Chưa có dữ liệu tầng của các khoa tại tòa này; không thể chỉ đường đến các khoa đó.",
    coverage: "Kiểm kê vị trí",
    mapped: "Đã ánh xạ",
    unmapped: "Chưa ánh xạ",
    inactive: "Đang đóng",
    incomplete: "Thiếu tòa/tầng",
    door: "Cửa",
    lobby: "Sảnh",
    exit: "Lối ra",
    entrance: "Lối vào",
    corridor: "Hành lang",
    campusPath: "Lối nối khuôn viên",
    lift: "Thang máy",
    stairs: "Cầu thang",
    room: "Phòng / khoa",
    view: "Xem chặng",
    noSegment: "Tuyến đi không qua mặt bằng đang xem.",
    start: "Bắt đầu tại {place}. Đi thẳng đến {next}.",
    straight: "Đi thẳng đến {next}.",
    left: "Rẽ trái, đi thẳng đến {next}.",
    right: "Rẽ phải, đi thẳng đến {next}.",
    uturn: "Quay lại, đi đến {next}.",
    stairStep: "Đi cầu thang tòa {building} từ {from} đến {to}.",
    enter: "Vào tòa {building}, {floor}.",
    leave: "Ra khỏi tòa {building}, đi vào khuôn viên.",
    transfer: "Đi qua lối nối đến tòa {building}, {floor}.",
  },
  en: {
    campus: "Campus",
    shownBuilding: "Displayed building",
    plan: "Floor plan",
    building: "Building",
    demo: "Self-designed demo floor plans, not a surveyed hospital map. Route costs are not metres or walking times.",
    entranceOnly:
      "Demo lobby only. Department floors in this building are unconfirmed; routes to those departments are unavailable.",
    coverage: "Location inventory",
    mapped: "Mapped",
    unmapped: "Not mapped",
    inactive: "Closed",
    incomplete: "Building/floor unconfirmed",
    door: "Door",
    lobby: "Lobby",
    exit: "Exit",
    entrance: "Entrance",
    corridor: "Corridor",
    campusPath: "Campus walkway",
    lift: "Lift",
    stairs: "Stairs",
    room: "Room / department",
    view: "Show leg",
    noSegment: "Your route does not pass through this plan.",
    start: "Start at {place}. Continue straight to {next}.",
    straight: "Continue straight to {next}.",
    left: "Turn left, then continue to {next}.",
    right: "Turn right, then continue to {next}.",
    uturn: "Turn back and continue to {next}.",
    stairStep: "Take the stairs in building {building} from {from} to {to}.",
    enter: "Enter building {building}, {floor}.",
    leave: "Leave building {building} for the campus walkway.",
    transfer: "Use the connector to building {building}, {floor}.",
  },
  zh: {
    campus: "院区",
    shownBuilding: "查看楼栋",
    plan: "楼层平面图",
    building: "楼栋",
    demo: "自行设计的演示平面图，并非医院实测地图。路线权重不代表米数或步行时间。",
    entranceOnly: "仅有演示大厅。该楼栋科室楼层尚未确认，暂不能为其规划路线。",
    coverage: "位置清单",
    mapped: "已标注",
    unmapped: "未标注",
    inactive: "已关闭",
    incomplete: "楼栋或楼层未确认",
    door: "门",
    lobby: "大厅",
    exit: "出口",
    entrance: "入口",
    corridor: "走廊",
    campusPath: "院区通道",
    lift: "电梯",
    stairs: "楼梯",
    room: "房间 / 科室",
    view: "查看路段",
    noSegment: "路线不经过此平面图。",
    start: "从{place}出发，直行至{next}。",
    straight: "直行至{next}。",
    left: "左转后前往{next}。",
    right: "右转后前往{next}。",
    uturn: "返回并前往{next}。",
    stairStep: "在{building}楼走楼梯，从{from}至{to}。",
    enter: "进入{building}楼，{floor}。",
    leave: "离开{building}楼，进入院区通道。",
    transfer: "通过连接通道前往{building}楼，{floor}。",
  },
  ko: {
    campus: "병원 구역",
    shownBuilding: "표시할 건물",
    plan: "층별 평면도",
    building: "건물",
    demo: "직접 설계한 시연용 평면도이며 실제 병원 측량 지도가 아닙니다. 경로 가중치는 거리나 보행 시간이 아닙니다.",
    entranceOnly:
      "시연용 로비만 있습니다. 진료과 층 정보가 확인되지 않아 해당 진료과 경로를 안내할 수 없습니다.",
    coverage: "위치 목록",
    mapped: "지도에 표시됨",
    unmapped: "미등록 위치",
    inactive: "폐쇄됨",
    incomplete: "건물 또는 층 미확인",
    door: "문",
    lobby: "로비",
    exit: "출구",
    entrance: "입구",
    corridor: "복도",
    campusPath: "구역 연결로",
    lift: "엘리베이터",
    stairs: "계단",
    room: "방 / 진료과",
    view: "구간 보기",
    noSegment: "이 평면도를 지나는 경로가 없습니다.",
    start: "{place}에서 출발하여 {next}까지 직진하세요.",
    straight: "{next}까지 직진하세요.",
    left: "왼쪽으로 돌아 {next}까지 이동하세요.",
    right: "오른쪽으로 돌아 {next}까지 이동하세요.",
    uturn: "돌아가서 {next}까지 이동하세요.",
    stairStep: "{building} 건물에서 계단으로 {from}에서 {to}까지 이동하세요.",
    enter: "{building} 건물, {floor}에 들어가세요.",
    leave: "{building} 건물에서 나와 연결로로 이동하세요.",
    transfer: "연결로를 통해 {building} 건물, {floor}로 이동하세요.",
  },
  ja: {
    campus: "敷地",
    shownBuilding: "表示する建物",
    plan: "階別平面図",
    building: "棟",
    demo: "独自設計のデモ平面図で、実測した病院地図ではありません。経路の重みは距離や徒歩時間ではありません。",
    entranceOnly:
      "デモ用ロビーのみです。診療科の階が未確認のため、その診療科への経路は表示できません。",
    coverage: "位置一覧",
    mapped: "地図に登録済み",
    unmapped: "未登録",
    inactive: "閉鎖中",
    incomplete: "建物または階が未確認",
    door: "扉",
    lobby: "ロビー",
    exit: "出口",
    entrance: "入口",
    corridor: "廊下",
    campusPath: "敷地内通路",
    lift: "エレベーター",
    stairs: "階段",
    room: "部屋 / 診療科",
    view: "区間を表示",
    noSegment: "この平面図を通る経路はありません。",
    start: "{place}から出発し、{next}まで直進してください。",
    straight: "{next}まで直進してください。",
    left: "左折して{next}まで進んでください。",
    right: "右折して{next}まで進んでください。",
    uturn: "引き返して{next}まで進んでください。",
    stairStep: "{building}棟の階段で{from}から{to}へ移動してください。",
    enter: "{building}棟、{floor}に入ってください。",
    leave: "{building}棟を出て敷地内通路へ進んでください。",
    transfer: "連絡通路で{building}棟、{floor}へ進んでください。",
  },
  ru: {
    campus: "Территория",
    shownBuilding: "Отображаемый корпус",
    plan: "План этажа",
    building: "Корпус",
    demo: "Демонстрационные планы собственной разработки, не обмерная карта больницы. Вес маршрута не означает метры или время ходьбы.",
    entranceOnly:
      "Только демонстрационный вестибюль. Этажи отделений не подтверждены; маршруты к ним недоступны.",
    coverage: "Список местоположений",
    mapped: "Нанесено на карту",
    unmapped: "Нет на карте",
    inactive: "Закрыто",
    incomplete: "Корпус или этаж не подтверждён",
    door: "Дверь",
    lobby: "Вестибюль",
    exit: "Выход",
    entrance: "Вход",
    corridor: "Коридор",
    campusPath: "Дорожка на территории",
    lift: "Лифт",
    stairs: "Лестница",
    room: "Помещение / отделение",
    view: "Показать участок",
    noSegment: "Маршрут не проходит через этот план.",
    start: "Начните у {place}. Следуйте прямо до {next}.",
    straight: "Следуйте прямо до {next}.",
    left: "Поверните налево и следуйте до {next}.",
    right: "Поверните направо и следуйте до {next}.",
    uturn: "Развернитесь и следуйте до {next}.",
    stairStep:
      "Поднимитесь или спуститесь по лестнице корпуса {building} с {from} на {to}.",
    enter: "Войдите в корпус {building}, {floor}.",
    leave: "Выйдите из корпуса {building} на территорию.",
    transfer: "Пройдите по переходу в корпус {building}, {floor}.",
  },
} as const;

export const mapSpaceTitle = (
  space: Pick<MapSpace, "kind" | "building" | "floor">,
  locale: Locale,
) =>
  space.kind === "campus"
    ? mapUiCopy[locale].campus
    : `${mapUiCopy[locale].building} ${space.building} · ${floorLabel(space.floor, locale)}`;

export function mapScene(
  graph: MapGraph,
  spaceId: string,
  route: MapRoute | null,
) {
  const space = graph.spaces?.find((s) => s.id === spaceId);
  const nodes = graph.nodes.filter((n) => n.spaceId === spaceId && !n.closed);
  const ids = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter(
    (e) => e.kind === "walk" && !e.closed && ids.has(e.from) && ids.has(e.to),
  );
  const routeIds = new Set(route?.edges);
  return {
    space,
    nodes,
    edges,
    routeEdges: edges.filter((e) => routeIds.has(e)),
  };
}

export function infrastructureLabel(n: MapNode, locale: Locale): string | null {
  if (n.id.startsWith("position-origin:")) return positionCopy[locale].origin;
  const c = mapUiCopy[locale];
  const suffix = n.building
    ? ` · ${c.building} ${n.building} · ${floorLabel(n.floor, locale)}`
    : "";
  const kind = n.kind;
  if (
    kind === "room" ||
    kind === "department" ||
    kind === "gate" ||
    n.fallback ||
    n.name
  )
    return null;
  const label =
    kind === "elevator"
      ? c.lift
      : kind === "stairs"
        ? c.stairs
        : kind === "door"
          ? c.door
          : kind === "exit"
            ? c.exit
            : kind === "entrance"
              ? c.entrance
              : kind === "lobby"
                ? c.lobby
                : n.spaceId === "campus"
                  ? c.campusPath
                  : c.corridor;
  return `${label}${n.marker ? " " + n.marker : ""}${suffix}`;
}
