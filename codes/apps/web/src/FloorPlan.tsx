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
  position,
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
  position?: { x: number; y: number; spaceId: string };
}) {
  const scene = mapScene(graph, spaceId, route),
    c = mapUiCopy[locale];
  if (!scene.space) return null;
  const space = scene.space,
    byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const active = new Set(scene.routeEdges),
    routeNodes = new Set(route?.nodes.map((n) => n.id));
  const arrowId = `map-arrow-${spaceId.replace(/[^\w-]/g, "-")}`;
  const wall = (w: MapWall, i: number) => (
    <line key={i} {...w} className="floor-wall" />
  );
  const keyboard = (event: React.KeyboardEvent, fn: () => void) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      fn();
    }
  };
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
    <svg
      className="map-canvas"
      style={{ width: `${zoom * 100}%` }}
      viewBox={`0 0 ${space.width} ${space.height}`}
      role="group"
      aria-label={mapSpaceTitle(space, locale)}
      data-testid="map-plan"
      data-space={space.id}
    >
      <title>
        {mapSpaceTitle(space, locale)} · {c.plan}
      </title>
      <defs>
        <marker
          id={arrowId}
          markerUnits="userSpaceOnUse"
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L12,6 L0,12 Z" fill="#1261df" />
        </marker>
      </defs>
      <rect
        width={space.width}
        height={space.height}
        fill={space.kind === "campus" ? "#edf5ed" : "#e8eeeb"}
      />
      {space.outline && <rect {...space.outline} fill="#fff" />}
      {space.corridors.map((r, i) => (
        <rect key={i} {...r} fill="#d8ece5" />
      ))}
      {space.rooms.map((r) => {
        const n = byId.get(r.nodeId)!;
        const short = mapLabel(n, locale).replace(
          n.room ? `${n.room} · ` : "",
          "",
        );
        return (
          <g key={r.nodeId} data-testid="map-room" data-node={r.nodeId}>
            <title>{mapLabel(n, locale)}</title>
            <rect
              {...{ x: r.x, y: r.y, width: r.width, height: r.height }}
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
            <text
              x={r.x + r.width / 2}
              y={byId.get(r.doorId)!.y === r.y ? r.y + r.height - 30 : r.y + 22}
              textAnchor="middle"
              className="floor-room-code"
            >
              {pointLabel(n)}
            </text>
            <text
              x={r.x + r.width / 2}
              y={byId.get(r.doorId)!.y === r.y ? r.y + r.height - 9 : r.y + 43}
              textAnchor="middle"
              className="floor-room-name"
            >
              {Array.from(short).slice(0, 16).join("")}
              {short.length > 16 ? "…" : ""}
            </text>
          </g>
        );
      })}
      {space.cores.map((r) => {
        const n = byId.get(r.nodeId)!;
        return (
          <g key={r.nodeId}>
            <rect
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              fill="#e6e9f2"
            />
            {r.walls.map(wall)}
            <text
              x={n.x}
              y={r.y + r.height - 10}
              textAnchor="middle"
              className="floor-room-name"
            >
              {n.kind === "stairs" ? c.stairs : c.lift}
            </text>
          </g>
        );
      })}
      {space.walls.map(wall)}
      {space.kind === "campus" &&
        mapBuildings.map((b) => (
          <g
            key={b.id}
            role="button"
            tabIndex={0}
            aria-label={`${c.building} ${b.id}`}
            onClick={() => onBuilding(b.id)}
            onKeyDown={(e) => keyboard(e, () => onBuilding(b.id))}
            className="map-building"
          >
            <rect x={b.x} y={b.y} width={b.width} height={b.height} rx="8" />
            <text x={b.x + b.width / 2} y={b.y + 33} textAnchor="middle">
              {b.id}
            </text>
            <text
              x={b.x + b.width / 2}
              y={b.y + 55}
              textAnchor="middle"
              style={{ fontSize: 10, fontWeight: 400 }}
            >
              {b.entranceOnly ? "?" : b.floors.join(" · ")}
            </text>
          </g>
        ))}
      {scene.edges.map((edge) => {
        const a = byId.get(edge.from)!,
          b = byId.get(edge.to)!;
        const onRoute = active.has(edge);
        // Orient arrows using route traversal, including reversed undirected edges.
        const index = route?.edges.indexOf(edge) ?? -1;
        const start = onRoute && index >= 0 ? route!.nodes[index] : a;
        const end = onRoute && index >= 0 ? route!.nodes[index + 1] : b;
        return (
          <g key={edge.id} aria-hidden="true">
            {onRoute && (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className="map-route-outline"
              />
            )}
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              className={onRoute ? "map-route-line" : "map-edge"}
              markerEnd={onRoute ? `url(#${arrowId})` : undefined}
              data-testid={onRoute ? "map-route-segment" : undefined}
            />
          </g>
        );
      })}
      {scene.nodes
        .filter((n) => n.kind !== "door")
        .map((n) => {
          const start = n.id === from,
            end = n.id === target;
          return (
            <g
              key={n.id}
              transform={`translate(${n.x} ${n.y})`}
              role="button"
              tabIndex={0}
              aria-label={mapLabel(n, locale)}
              aria-pressed={start}
              className={`map-node ${start ? "is-start" : ""} ${end ? "is-target" : ""} ${routeNodes.has(n.id) ? "on-route" : ""}`}
              data-testid={`map-node-${n.id}`}
              onClick={() => onChoose(n.id)}
              onKeyDown={(e) => keyboard(e, () => onChoose(n.id))}
            >
              <title>{mapLabel(n, locale)}</title>
              <circle r="18" fill="transparent" />
              {(start || end) && <circle r="15" className="map-node-halo" />}
              <circle
                r={
                  start ||
                  end ||
                  ["elevator", "stairs", "exit", "entrance", "gate"].includes(
                    n.kind,
                  )
                    ? 9
                    : 4
                }
                className="map-node-dot"
              />
              {(start ||
                end ||
                ["elevator", "stairs", "exit", "entrance", "gate"].includes(
                  n.kind,
                )) && (
                <text textAnchor="middle" dy="4" className="map-node-symbol">
                  {start ? "●" : end ? "★" : pointLabel(n)}
                </text>
              )}
              {n.kind === "checkpoint" && n.marker && (
                <text
                  x="12"
                  y={space.kind === "campus" ? -16 : 18}
                  className="floor-room-name"
                >
                  {n.marker}
                </text>
              )}
              {(n.kind === "gate" || n.kind === "entrance") && (
                <text textAnchor="middle" y="-20" className="map-node-label">
                  {mapLabel(n, locale)}
                </text>
              )}
            </g>
          );
        })}
      {position?.spaceId === spaceId && (
        <g
          data-testid="simulation-marker"
          data-space={spaceId}
          transform={`translate(${position.x},${position.y})`}
          aria-label="RTLS demo"
        >
          <circle r="13" fill="#fff" stroke="#7c3aed" strokeWidth="3" />
          <circle r="6" fill="#7c3aed" />
        </g>
      )}
    </svg>
  );
}
