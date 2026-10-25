import { localizeText } from "@hospital/shared";
import { useState } from "react";
import {
  Flag,
  LocateFixed,
  MapPinned,
  Minus,
  Plus,
  RotateCcw,
  Volume2,
  Square,
} from "lucide-react";
import {
  configuredMapDepartments,
  departmentLabel,
  departmentLocation,
  departmentNodeId,
  searchDepartments,
  floorLabel,
  type MapDepartment,
  buildingFloors,
  destinationNode,
  configuredHospitalMap,
  mapBuildings,
  mapCopy,
  mapFloors,
  mapLabel,
  routeInstructions,
  routeLanguage,
  translator,
  shortestPath,
  startNodes,
  type Destination,
  type MapNode,
} from "@hospital/shared";
import { Button, DestinationCard, Field, Notice } from "./components";
import { useRuntime } from "./runtime";
import { useRouteSpeech } from "./useRouteSpeech";
import "./hospital-map.css";

export function HospitalMap({ destination }: { destination: Destination }) {
  const { locale, config } = useRuntime();
  const mapDepartments = configuredMapDepartments(
    config.departments,
    !!config.catalogVersion,
  );
  const [query, setQuery] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departmentFloor, setDepartmentFloor] = useState("");
  const department = mapDepartments.find((d) => d.id === departmentId);
  const results = searchDepartments(query, locale, mapDepartments);
  return (
    <>
      <details className="map-directory">
        <summary>
          {localizeText("Tra cứu khoa/phòng", locale)} ({mapDepartments.length})
        </summary>
        <p>
          {localizeText(
            "Có thể chọn một khoa làm điểm đến để tra cứu; thông tin trên phiếu không thay đổi.",
            locale,
          )}
        </p>
        <Field label={localizeText("Tìm khoa/phòng", locale)}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={localizeText("Tên khoa hoặc khu A–G", locale)}
          />
        </Field>
        <Field label={localizeText("Khoa/phòng cần đến", locale)}>
          <select
            value={departmentId}
            onChange={(e) => {
              const d = mapDepartments.find((d) => d.id === e.target.value);
              setDepartmentId(e.target.value);
              setDepartmentFloor(d?.floors.length === 1 ? d.floors[0] : "");
            }}
          >
            <option value="">
              {localizeText("Dùng phòng trên phiếu", locale)}
            </option>
            {department && !results.includes(department) && (
              <option value={department.id}>
                {departmentLabel(department, locale)} ·{" "}
                {departmentLocation(department, locale)}
              </option>
            )}
            {results.map((d) => (
              <option key={d.id} value={d.id}>
                {departmentLabel(d, locale)} · {departmentLocation(d, locale)}
              </option>
            ))}
          </select>
        </Field>
        {department && department.floors.length > 1 && (
          <Field label={localizeText("Tầng cần đến", locale)}>
            <select
              value={departmentFloor}
              onChange={(e) => setDepartmentFloor(e.target.value)}
            >
              <option value="">
                {localizeText("Chọn tầng cần đến", locale)}
              </option>
              {department.floors.map((f) => (
                <option key={f} value={f}>
                  {floorLabel(f, locale)}
                </option>
              ))}
            </select>
          </Field>
        )}
        {!results.length && (
          <p>{localizeText("Không tìm thấy khoa phù hợp.", locale)}</p>
        )}
      </details>
      <MapPanel
        key={`${destination.id}:${destination.building}:${destination.floor}:${destination.room}:${departmentId}:${departmentFloor}`}
        destination={destination}
        department={department}
        departmentFloor={departmentFloor}
      />
    </>
  );
}

function MapPanel({
  destination,
  department,
  departmentFloor = "",
}: {
  destination: Destination;
  department?: MapDepartment;
  departmentFloor?: string;
}) {
  const { locale, config } = useRuntime();
  const hospitalMap = configuredHospitalMap(
    config.departments,
    !!config.catalogVersion,
  );
  const c = mapCopy[locale];
  const [area, setArea] = useState("");
  const [level, setLevel] = useState("");
  const [from, setFrom] = useState("");
  const [routeStart, setRouteStart] = useState("");
  const [floor, setFloor] = useState("0");
  const [zoom, setZoom] = useState(1);
  const target = department
    ? hospitalMap.nodes.find(
        (n) =>
          !n.closed &&
          n.id === departmentNodeId(department.id, departmentFloor),
      )
    : destinationNode(destination, hospitalMap);
  const route =
    target && routeStart
      ? shortestPath(hospitalMap, routeStart, target.id)
      : null;
  const contentLocale = routeLanguage(route, locale);
  const instructions = route
    ? routeInstructions(route, contentLocale, !department)
    : [];
  const speech = useRouteSpeech(
    route ? mapCopy[contentLocale].narrationIntro + instructions.join(" ") : "",
    contentLocale,
    c.audioError,
  );
  const choices = startNodes(area, level, hospitalMap);
  const routeIds = new Set(route?.nodes.map((n) => n.id));
  const label = (n: MapNode) => mapLabel(n, locale);
  const clearRoute = () => {
    speech.stop();
    setRouteStart("");
  };
  const chooseArea = (value: string) => {
    clearRoute();
    setArea(value);
    setLevel("");
    setFrom("");
    setFloor("0");
  };
  const chooseLevel = (value: string) => {
    clearRoute();
    setLevel(value);
    setFrom("");
    if (value) setFloor(value);
  };
  const choose = (id: string) => {
    clearRoute();
    const node = hospitalMap.nodes.find((n) => n.id === id);
    setFrom(node?.id ?? "");
    if (node) {
      setArea(node.building ?? "outside");
      setLevel(node.building ? node.floor : "");
      setFloor(node.floor);
    }
  };
  const status = !target
    ? department
      ? department.floors.length
        ? c.chooseTargetFloor
        : c.unconfirmed
      : c.unmapped
    : !routeStart
      ? c.select
      : !route
        ? c.unreachable
        : route.nodes.length === 1
          ? department
            ? c.departmentArrived
            : c.arrived
          : c.route;
  const visibleNodes = hospitalMap.nodes.filter(
    (n) => !n.closed && n.floor === floor,
  );
  return (
    <section className="hospital-map" aria-label={c.title}>
      <div className="hospital-map-heading">
        <div>
          <MapPinned size={22} />
          <h3>{c.title}</h3>
        </div>
        <span className="map-sample">{c.sample}</span>
      </div>
      <Notice>{c.warning}</Notice>
      <p className="map-intro">{c.hint}</p>
      <div className="map-destination">
        <span className="eyebrow">
          <Flag size={14} />
          {department ? c.departmentDestination : c.destination}
        </span>
        {department ? (
          <div className="destination">
            <Flag size={24} />
            <div>
              <strong>{departmentLabel(department, locale)}</strong>
              <p>{departmentLocation(department, locale)}</p>
              {departmentFloor && (
                <small>{floorLabel(departmentFloor, locale)}</small>
              )}
            </div>
          </div>
        ) : (
          <DestinationCard destination={destination} />
        )}
      </div>
      <div className="map-location-fields">
        <Field label={c.area}>
          <select value={area} onChange={(e) => chooseArea(e.target.value)}>
            <option value="">{c.chooseArea}</option>
            <option value="outside">{c.outside}</option>
            {mapBuildings.map((b) => (
              <option key={b.id} value={b.id}>
                {c.building} {b.id}
              </option>
            ))}
          </select>
        </Field>
        {area !== "outside" && (
          <Field label={c.level}>
            <select
              value={level}
              disabled={!area}
              onChange={(e) => chooseLevel(e.target.value)}
            >
              <option value="">{c.chooseFloor}</option>
              {buildingFloors(area, hospitalMap).map((f) => (
                <option key={f} value={f}>
                  {floorLabel(f, locale)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={c.start}>
          <select
            value={from}
            disabled={!area || (area !== "outside" && !level)}
            onChange={(e) => choose(e.target.value)}
          >
            <option value="">{c.chooseStart}</option>
            {choices.map((n) => (
              <option key={n.id} value={n.id}>
                {label(n)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="actions map-actions">
        <Button
          disabled={!from || !target}
          onClick={() => {
            speech.stop();
            setRouteStart(from);
          }}
        >
          <LocateFixed size={18} />
          {c.find}
        </Button>
        {route && (
          <Button variant="secondary" onClick={speech.play}>
            <Volume2 size={18} />
            {c.listen}
          </Button>
        )}
        {speech.playing && (
          <Button variant="quiet" onClick={speech.stop}>
            <Square size={16} />
            {c.stop}
          </Button>
        )}
        {from && (
          <Button variant="quiet" onClick={() => choose("")}>
            <RotateCcw size={16} />
            {c.reset}
          </Button>
        )}
      </div>
      {speech.error && <Notice kind="error">{speech.error}</Notice>}
      {contentLocale !== locale && (
        <Notice>{translator(locale)("fallback")}</Notice>
      )}
      <div
        className="map-route-status"
        role="status"
        aria-live="polite"
        data-testid="map-status"
      >
        {status}
      </div>
      <div className="map-layout">
        <div className="map-visual">
          <div className="map-toolbar">
            <div className="map-floor-select">
              <Field label={c.shown}>
                <select
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                >
                  {mapFloors.map((f) => (
                    <option key={f} value={f}>
                      {floorLabel(f, locale)}
                      {route?.nodes.some((n) => n.floor === f) ? " •" : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="map-zoom">
              <button
                type="button"
                aria-label={c.zoomOut}
                disabled={zoom <= 1}
                onClick={() => setZoom(Math.max(1, zoom - 0.5))}
              >
                <Minus size={17} />
              </button>
              <button
                type="button"
                aria-label={c.fit}
                onClick={() => setZoom(1)}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                aria-label={c.zoomIn}
                disabled={zoom >= 2.5}
                onClick={() => setZoom(Math.min(2.5, zoom + 0.5))}
              >
                <Plus size={17} />
              </button>
            </div>
          </div>
          <div
            className="map-canvas-scroll"
            tabIndex={0}
            aria-label={`${c.title} · ${floorLabel(floor, locale)}`}
          >
            <svg
              className="map-canvas"
              viewBox="0 0 604 666"
              style={{ width: `${zoom * 100}%` }}
              role="group"
              aria-label={`${c.title} · ${floorLabel(floor, locale)}`}
            >
              <title>
                {c.title} · {c.floor} {floor}
              </title>
              <image
                href="/maps/thu-duc-campus.jpg"
                width="604"
                height="2048"
                opacity="0.6"
                aria-hidden="true"
              />
              {mapBuildings
                .filter(() => floor === "0")
                .map((b) => (
                  <g
                    key={b.id}
                    transform={`translate(${b.x} ${b.y})`}
                    className={`map-building ${area === b.id ? "selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${c.building} ${b.id}`}
                    aria-pressed={area === b.id}
                    onClick={() => chooseArea(b.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        chooseArea(b.id);
                      }
                    }}
                  >
                    <rect x="-24" y="-20" width="48" height="40" rx="8" />
                    <text textAnchor="middle" dy="6">
                      {b.id}
                    </text>
                  </g>
                ))}
              {hospitalMap.edges
                .filter((e) => e.kind === "walk" && !e.closed)
                .map((edge) => {
                  const a = hospitalMap.nodes.find((n) => n.id === edge.from)!;
                  const b = hospitalMap.nodes.find((n) => n.id === edge.to)!;
                  if (
                    a.floor !== floor ||
                    b.floor !== floor ||
                    a.closed ||
                    b.closed
                  )
                    return null;
                  return (
                    <line
                      key={`${edge.from}-${edge.to}`}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      className="map-edge"
                      aria-hidden="true"
                    />
                  );
                })}
              {route?.edges
                .filter((e) => e.kind === "walk")
                .map((edge, i) => {
                  const a = hospitalMap.nodes.find((n) => n.id === edge.from)!;
                  const b = hospitalMap.nodes.find((n) => n.id === edge.to)!;
                  if (a.floor !== floor || b.floor !== floor) return null;
                  return (
                    <g key={i} aria-hidden="true">
                      <line
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        className="map-route-outline"
                      />
                      <line
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        className="map-route-line"
                        data-testid="map-route-segment"
                      />
                    </g>
                  );
                })}
              {visibleNodes.map((n) => {
                const start = n.id === from,
                  end = n.id === target?.id;
                const available =
                  choices.some((choice) => choice.id === n.id) ||
                  (!area && !n.building) ||
                  routeIds.has(n.id) ||
                  end;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x} ${n.y})`}
                    role={available ? "button" : undefined}
                    tabIndex={available ? 0 : undefined}
                    aria-label={`${label(n)} · ${floorLabel(n.floor, locale)}${end ? " · " + c.target : ""}`}
                    aria-pressed={available ? start : undefined}
                    className={`map-node ${start ? "is-start" : ""} ${end ? "is-target" : ""} ${available ? "" : "unavailable"} ${routeIds.has(n.id) ? "on-route" : ""}`}
                    data-testid={`map-node-${n.id}`}
                    onClick={() => {
                      if (available) choose(n.id);
                    }}
                    onKeyDown={(e) => {
                      if (available && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        choose(n.id);
                      }
                    }}
                  >
                    <title>{label(n)}</title>
                    <circle r="22" className="map-hit-area" />
                    {(start || end) && (
                      <circle r="18" className="map-node-halo" />
                    )}
                    <circle
                      r={
                        n.kind === "room" ||
                        n.kind === "department" ||
                        start ||
                        end
                          ? 11
                          : 7
                      }
                      className="map-node-dot"
                    />
                    <text
                      textAnchor="middle"
                      dy="4"
                      className="map-node-symbol"
                    >
                      {start
                        ? "●"
                        : end
                          ? "★"
                          : n.marker
                            ? n.marker
                            : n.kind === "elevator"
                              ? "↕"
                              : ""}
                    </text>
                    {(n.room || n.kind === "gate" || start) && (
                      <text
                        textAnchor="middle"
                        y="-23"
                        className="map-node-label"
                      >
                        {n.room ?? (start ? c.current : label(n))}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="map-legend">
            <span>
              <i className="legend-start" />
              {c.current}
            </span>
            <span>
              <i className="legend-target" />
              {c.target}
            </span>
            <span>
              <i className="legend-checkpoint" />
              {c.fixed}
            </span>
            <span>
              <i className="legend-route" />
              {c.route}
            </span>
          </div>
        </div>
        <aside className="map-itinerary">
          <details className="map-floor-directory">
            <summary>
              {c.floorDepartments} (
              {visibleNodes.filter((n) => n.kind === "department").length})
            </summary>
            {visibleNodes
              .filter((n) => n.kind === "department")
              .map((n) => (
                <button key={n.id} type="button" onClick={() => choose(n.id)}>
                  {n.building}.{n.marker} · {label(n)}
                </button>
              ))}
          </details>
          <h4>{c.steps}</h4>
          <p className="map-position-hint">{from ? c.selected : c.select}</p>
          {route && (
            <ol className="map-route-list">
              {route.nodes.map((n, i) => (
                <li key={n.id}>
                  <span className="map-step-index">{i + 1}</span>
                  <div>
                    <p>{instructions[i]}</p>
                    <small>
                      {n.building
                        ? `${c.building} ${n.building} · ${floorLabel(n.floor, locale)}`
                        : c.outside}
                    </small>
                    <button
                      type="button"
                      onClick={() => choose(n.id)}
                      aria-label={`${c.update}: ${label(n)}`}
                    >
                      {c.update}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {route && !route.nodes.some((n) => n.floor === floor) && (
            <p>{c.noSegment}</p>
          )}
        </aside>
      </div>
    </section>
  );
}
