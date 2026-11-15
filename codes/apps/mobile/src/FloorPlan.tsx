import { ScrollView, useWindowDimensions } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Marker,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import {
  mapBuildings,
  mapLabel,
  mapScene,
  mapSpaceTitle,
  mapUiCopy,
  type Locale,
  type MapGraph,
  type MapNode,
  type MapRoute,
  type MapWall,
} from "@hospital/shared";

export function FloorPlan({
  graph,
  spaceId,
  route,
  from,
  target,
  locale,
  zoom,
  onChoose,
  onBuilding,
}: {
  graph: MapGraph;
  spaceId: string;
  route: MapRoute | null;
  from: string;
  target?: string;
  locale: Locale;
  zoom: number;
  onChoose: (id: string) => void;
  onBuilding: (id: string) => void;
}) {
  const { width } = useWindowDimensions();
  const scene = mapScene(graph, spaceId, route),
    c = mapUiCopy[locale];
  if (!scene.space) return null;
  const space = scene.space,
    byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const active = new Set(scene.routeEdges),
    canvasWidth = Math.max(300, width - 56) * zoom;
  const arrowId = `map-arrow-${spaceId.replace(/[^\w-]/g, "-")}`;
  const wall = (w: MapWall, i: number) => (
    <Line key={i} {...w} stroke="#486878" strokeWidth={2.5} />
  );
  const pointLabel = (n: MapNode) =>
    n.room ??
    (n.departmentId
      ? `${n.building}.${n.marker}`
      : n.kind === "elevator"
        ? "↕"
        : n.kind === "stairs"
          ? "⇧"
          : n.kind === "exit" || n.kind === "entrance"
            ? "↔"
            : (n.marker ?? ""));
  return (
    <ScrollView
      horizontal
      style={{ flexGrow: 0 }}
      accessibilityLabel={mapSpaceTitle(space, locale)}
    >
      <Svg
        width={canvasWidth}
        height={(canvasWidth * space.height) / space.width}
        viewBox={`0 0 ${space.width} ${space.height}`}
        accessibilityLabel={mapSpaceTitle(space, locale)}
      >
        <Defs>
          <Marker
            id={arrowId}
            markerUnits="userSpaceOnUse"
            markerWidth={12}
            markerHeight={12}
            refX={10}
            refY={6}
            orient="auto"
          >
            <Path d="M0,0 L12,6 L0,12 Z" fill="#1261df" />
          </Marker>
        </Defs>
        <Rect
          width={space.width}
          height={space.height}
          fill={space.kind === "campus" ? "#edf5ed" : "#e8eeeb"}
        />
        {space.outline && <Rect {...space.outline} fill="white" />}
        {space.corridors.map((r, i) => (
          <Rect key={i} {...r} fill="#d8ece5" />
        ))}
        {space.rooms.map((r) => {
          const n = byId.get(r.nodeId)!;
          const short = mapLabel(n, locale).replace(
            n.room ? `${n.room} · ` : "",
            "",
          );
          return (
            <G key={r.nodeId}>
              <Rect
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                fill={
                  n.closed
                    ? "#e4e4e4"
                    : n.id === target
                      ? "#fff1d9"
                      : n.id === from
                        ? "#d7f2e7"
                        : "#f4f7fb"
                }
              />
              {r.walls.map(wall)}
              <SvgText
                x={r.x + r.width / 2}
                y={
                  byId.get(r.doorId)!.y === r.y ? r.y + r.height - 30 : r.y + 22
                }
                textAnchor="middle"
                fontSize={14}
                fontWeight="bold"
                fill="#203d35"
              >
                {pointLabel(n)}
              </SvgText>
              <SvgText
                x={r.x + r.width / 2}
                y={
                  byId.get(r.doorId)!.y === r.y ? r.y + r.height - 9 : r.y + 43
                }
                textAnchor="middle"
                fontSize={10}
                fill="#435f57"
              >
                {Array.from(short).slice(0, 16).join("")}
                {short.length > 16 ? "…" : ""}
              </SvgText>
            </G>
          );
        })}
        {space.cores.map((r) => {
          const n = byId.get(r.nodeId)!;
          return (
            <G key={r.nodeId}>
              <Rect
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                fill="#e6e9f2"
              />
              {r.walls.map(wall)}
              <SvgText
                x={n.x}
                y={r.y + r.height - 10}
                textAnchor="middle"
                fontSize={10}
                fill="#435f57"
              >
                {n.kind === "stairs" ? c.stairs : c.lift}
              </SvgText>
            </G>
          );
        })}
        {space.walls.map(wall)}
        {space.kind === "campus" &&
          mapBuildings.map((b) => (
            <G
              key={b.id}
              accessibilityRole="button"
              accessibilityLabel={`${c.building} ${b.id}`}
              onPress={() => onBuilding(b.id)}
            >
              <Rect
                x={b.x}
                y={b.y}
                width={b.width}
                height={b.height}
                rx={8}
                fill="white"
                stroke="#486878"
              />
              <SvgText
                x={b.x + b.width / 2}
                y={b.y + 33}
                textAnchor="middle"
                fontSize={22}
                fontWeight="bold"
                fill="#16392e"
              >
                {b.id}
              </SvgText>
              <SvgText
                x={b.x + b.width / 2}
                y={b.y + 55}
                textAnchor="middle"
                fontSize={10}
                fill="#435f57"
              >
                {b.entranceOnly ? "?" : b.floors.join(" · ")}
              </SvgText>
            </G>
          ))}
        {scene.edges.map((edge) => {
          const a = byId.get(edge.from)!,
            b = byId.get(edge.to)!,
            onRoute = active.has(edge),
            index = route?.edges.indexOf(edge) ?? -1;
          const start = onRoute && index >= 0 ? route!.nodes[index] : a,
            end = onRoute && index >= 0 ? route!.nodes[index + 1] : b;
          return (
            <G key={edge.id}>
              {onRoute && (
                <Line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="white"
                  strokeWidth={9}
                />
              )}
              <Line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={onRoute ? "#1261df" : "#6a8395"}
                strokeWidth={onRoute ? 4.5 : 2}
                strokeDasharray={onRoute ? undefined : "4 5"}
                markerEnd={onRoute ? `url(#${arrowId})` : undefined}
              />
            </G>
          );
        })}
        {scene.nodes
          .filter((n) => n.kind !== "door")
          .map((n) => {
            const start = n.id === from,
              end = n.id === target;
            return (
              <G
                key={n.id}
                onPress={() => onChoose(n.id)}
                accessibilityRole="button"
                accessibilityLabel={mapLabel(n, locale)}
                accessibilityState={{ selected: start }}
              >
                <Circle cx={n.x} cy={n.y} r={18} fill="transparent" />
                {(start || end) && (
                  <Circle cx={n.x} cy={n.y} r={15} fill="white" />
                )}
                <Circle
                  cx={n.x}
                  cy={n.y}
                  r={
                    start ||
                    end ||
                    ["elevator", "stairs", "exit", "entrance", "gate"].includes(
                      n.kind,
                    )
                      ? 9
                      : 4
                  }
                  fill={start ? "#0a6357" : end ? "#c15b08" : "white"}
                  stroke="#486878"
                  strokeWidth={2}
                />
                {(start ||
                  end ||
                  ["elevator", "stairs", "exit", "entrance", "gate"].includes(
                    n.kind,
                  )) && (
                  <SvgText
                    x={n.x}
                    y={n.y + 4}
                    textAnchor="middle"
                    fontSize={10}
                    fill={start || end ? "white" : "#203d35"}
                  >
                    {start ? "●" : end ? "★" : pointLabel(n)}
                  </SvgText>
                )}
                {n.kind === "checkpoint" && n.marker && (
                  <SvgText
                    x={n.x + 12}
                    y={n.y + (space.kind === "campus" ? -16 : 18)}
                    fontSize={10}
                    fill="#435f57"
                  >
                    {n.marker}
                  </SvgText>
                )}
                {(n.kind === "gate" || n.kind === "entrance") && (
                  <SvgText
                    x={n.x}
                    y={n.y - 20}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#203d35"
                  >
                    {mapLabel(n, locale)}
                  </SvgText>
                )}
              </G>
            );
          })}
      </Svg>
    </ScrollView>
  );
}
