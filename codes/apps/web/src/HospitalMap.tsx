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
  buildingFloors,
  destinationNode,
  hospitalMap,
  mapBuildings,
  mapCopy,
  mapFloors,
  mapLabel,
  routeInstructions,
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
  return (
    <MapPanel
      key={`${destination.id}:${destination.building}:${destination.floor}:${destination.room}`}
      destination={destination}
    />
  );
}
function MapPanel({ destination }: { destination: Destination }) {
  const { locale } = useRuntime();
  const c = mapCopy[locale];
  const [area, setArea] = useState("");
  const [level, setLevel] = useState("");
  const [from, setFrom] = useState("");
  const [routeStart, setRouteStart] = useState("");
  const [floor, setFloor] = useState("1");
  const [zoom, setZoom] = useState(1);
  const target = destinationNode(destination);
  const route =
    target && routeStart
      ? shortestPath(hospitalMap, routeStart, target.id)
      : null;
  const instructions = route ? routeInstructions(route, locale) : [];
  const speech = useRouteSpeech(
    route ? c.narrationIntro + instructions.join(" ") : "",
    locale,
    c.audioError,
  );
  const choices = startNodes(area, level);
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
    setFloor("1");
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
    ? c.unmapped
    : !routeStart
      ? c.select
      : !route
        ? c.unreachable
        : route.nodes.length === 1
          ? c.arrived
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
          {c.destination}
        </span>
        <DestinationCard destination={destination} />
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
              {buildingFloors(area).map((f) => (
                <option key={f} value={f}>
                  {c.floor} {f}
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
            <div className="map-floor-tabs" role="group" aria-label={c.shown}>
              {mapFloors.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={floor === f}
                  onClick={() => setFloor(f)}
                >
                  {c.floor} {f}
                  {route?.nodes.some((n) => n.floor === f) && (
                    <span className="map-floor-dot" aria-hidden="true" />
                  )}
                </button>
              ))}
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
            aria-label={`${c.title} · ${c.floor} ${floor}`}
          >
            <svg
              className="map-canvas"
              viewBox="0 0 604 666"
              style={{ width: `${zoom * 100}%` }}
              role="group"
              aria-label={`${c.title} · ${c.floor} ${floor}`}
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
              {mapBuildings.map((b) => (
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
                    aria-label={`${label(n)} · ${c.floor} ${n.floor}${end ? " · " + c.target : ""}`}
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
                      r={n.kind === "room" || start || end ? 11 : 7}
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
                        ? `${c.building} ${n.building} · ${c.floor} ${n.floor}`
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
