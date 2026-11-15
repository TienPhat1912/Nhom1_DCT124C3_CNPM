import { localizeText } from "@hospital/shared";
import { useMemo, useState } from "react";
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
  floorSpaceId,
  mapInventory,
  mapScene,
  mapSpaceTitle,
  mapUiCopy,
  mapLabel,
  routeInstructions,
  routeLanguage,
  translator,
  shortestPath,
  startNodes,
  type Destination,
} from "@hospital/shared";
import { Button, DestinationCard, Field, Notice } from "./components";
import { useRuntime } from "./runtime";
import { useRouteSpeech } from "./useRouteSpeech";
import { FloorPlan } from "./FloorPlan";
import { SimulationMap } from "./SimulationMap";
import { positionCopy } from "@hospital/shared";
import "./hospital-map.css";

export function HospitalMap({
  destination,
  contextKey,
  autoplay = true,
}: {
  autoplay?: boolean;
  destination: Destination;
  contextKey?: string;
}) {
  const { locale, config, session } = useRuntime();
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
        key={session.sessionId}
        destination={destination}
        contextKey={contextKey}
        autoplay={autoplay}
        department={department}
        departmentFloor={departmentFloor}
      />
    </>
  );
}

type MapPanelProps = {
  autoplay?: boolean;
  contextKey?: string;
  destination: Destination;
  department?: MapDepartment;
  departmentFloor?: string;
};
function MapPanel(props: MapPanelProps) {
  const { locale, config, configLocale } = useRuntime();
  const [mode, setMode] = useState("simulation");
  const signature = JSON.stringify([
    config.departments,
    !!config.catalogVersion,
  ]);
  const graph = useMemo(() => {
    const [departments, authoritative] = JSON.parse(signature);
    return configuredHospitalMap(departments, authoritative);
  }, [signature]);
  const target = props.department
    ? graph.nodes.find(
        (n) =>
          !n.closed &&
          n.id ===
            departmentNodeId(props.department!.id, props.departmentFloor ?? ""),
      )
    : destinationNode(props.destination, graph);
  return (
    <>
      <div
        className="actions"
        role="group"
        aria-label={positionCopy[locale].title}
      >
        <Button
          variant={mode === "simulation" ? "primary" : "secondary"}
          onClick={() => setMode("simulation")}
        >
          {positionCopy[locale].title}
        </Button>
        <Button
          variant={mode === "manual" ? "primary" : "secondary"}
          onClick={() => setMode("manual")}
        >
          {positionCopy[locale].manual}
        </Button>
      </div>
      {mode === "simulation" ? (
        <SimulationMap
          graph={graph}
          labelsReady={!configLocale || configLocale === locale}
          targetId={target?.id ?? null}
          contextKey={props.contextKey}
          autoplay={props.autoplay}
          locale={locale}
        />
      ) : (
        <ManualMapPanel
          key={`${props.destination.id}:${props.destination.building}:${props.destination.floor}:${props.destination.room}:${props.department?.id}:${props.departmentFloor}:${props.contextKey}`}
          {...props}
        />
      )}
    </>
  );
}
function ManualMapPanel({
  destination,
  department,
  departmentFloor = "",
}: {
  destination: Destination;
  department?: MapDepartment;
  departmentFloor?: string;
}) {
  const { locale, config } = useRuntime();
  const graph = useMemo(
    () => configuredHospitalMap(config.departments, !!config.catalogVersion),
    [config.departments, config.catalogVersion],
  );
  const c = mapCopy[locale],
    u = mapUiCopy[locale];
  const [area, setArea] = useState("");
  const [level, setLevel] = useState("");
  const [from, setFrom] = useState("");
  const [routeStart, setRouteStart] = useState("");
  const [viewBuilding, setViewBuilding] = useState("campus");
  const [floor, setFloor] = useState("0");
  const [zoom, setZoom] = useState(1);
  const target = department
    ? graph.nodes.find(
        (n) =>
          !n.closed &&
          n.id === departmentNodeId(department.id, departmentFloor),
      )
    : destinationNode(destination, graph);
  const route =
    target && routeStart ? shortestPath(graph, routeStart, target.id) : null;
  const contentLocale = routeLanguage(route, locale);
  const instructions = route
    ? routeInstructions(route, contentLocale, !department)
    : [];
  const speech = useRouteSpeech(
    route ? mapCopy[contentLocale].narrationIntro + instructions.join(" ") : "",
    contentLocale,
    c.audioError,
  );
  const spaceId =
    viewBuilding === "campus" ? "campus" : floorSpaceId(viewBuilding, floor);
  const scene = mapScene(graph, spaceId, route);
  const choices = startNodes(area, level, graph);
  const inventory = mapInventory(graph, config.locations, config.departments);
  const unknown = [...inventory.departments, ...inventory.locations].filter(
    (i) => i.status !== "mapped",
  );
  const showSpace = (id: string) => {
    const s = graph.spaces?.find((s) => s.id === id);
    if (s) {
      setViewBuilding(s.building ?? "campus");
      setFloor(s.floor);
    }
  };
  const clearRoute = () => {
    speech.stop();
    setRouteStart("");
  };
  const chooseArea = (value: string) => {
    clearRoute();
    setArea(value);
    setLevel("");
    setFrom("");
    setViewBuilding(value && value !== "outside" ? value : "campus");
    setFloor("0");
  };
  const chooseLevel = (value: string) => {
    clearRoute();
    setLevel(value);
    setFrom("");
    if (value) {
      setViewBuilding(area);
      setFloor(value);
    }
  };
  const choose = (id: string) => {
    clearRoute();
    const n = graph.nodes.find((n) => n.id === id && !n.closed);
    setFrom(n?.id ?? "");
    if (n) {
      setArea(n.building ?? "outside");
      setLevel(n.building ? n.floor : "");
      showSpace(n.spaceId!);
    }
  };
  const status = !target
    ? department
      ? department.active === false
        ? u.inactive
        : !department.building || !department.floors.length
          ? c.unconfirmed
          : !departmentFloor
            ? c.chooseTargetFloor
            : u.unmapped
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
  return (
    <section className="hospital-map" aria-label={c.title}>
      <div className="hospital-map-heading">
        <div>
          <MapPinned size={22} />
          <h3>{c.title}</h3>
        </div>
        <span className="map-sample">{c.sample}</span>
      </div>
      <Notice>{u.demo}</Notice>
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
              {buildingFloors(area, graph).map((f) => (
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
                {mapLabel(n, locale)}
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
            <div className="map-view-selects">
              <Field label={u.shownBuilding}>
                <select
                  value={viewBuilding}
                  onChange={(e) => {
                    setViewBuilding(e.target.value);
                    setFloor("0");
                  }}
                >
                  <option value="campus">{u.campus}</option>
                  {mapBuildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {c.building} {b.id}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={c.shown}>
                <select
                  value={floor}
                  disabled={viewBuilding === "campus"}
                  onChange={(e) => setFloor(e.target.value)}
                >
                  {(viewBuilding === "campus"
                    ? ["0"]
                    : buildingFloors(viewBuilding, graph)
                  ).map((f) => (
                    <option key={f} value={f}>
                      {floorLabel(f, locale)}
                      {route?.nodes.some(
                        (n) => n.spaceId === floorSpaceId(viewBuilding, f),
                      )
                        ? " •"
                        : ""}
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
          {scene.space && (
            <h4 className="map-space-title" data-testid="map-space-title">
              {mapSpaceTitle(scene.space, locale)}
            </h4>
          )}
          {scene.space?.entranceOnly && <Notice>{u.entranceOnly}</Notice>}
          <div
            className="map-canvas-scroll"
            tabIndex={0}
            aria-label={
              scene.space ? mapSpaceTitle(scene.space, locale) : c.title
            }
          >
            <FloorPlan
              graph={graph}
              spaceId={spaceId}
              route={route}
              from={from}
              target={target?.id}
              locale={locale}
              zoom={zoom}
              onChoose={choose}
              onBuilding={chooseArea}
            />
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
              <i className="legend-route" />
              {c.route}
            </span>
            <span>{u.room}</span>
            <span>{u.corridor}</span>
          </div>
          {route && !route.nodes.some((n) => n.spaceId === spaceId) && (
            <p className="map-position-hint">{u.noSegment}</p>
          )}
        </div>
        <aside className="map-itinerary">
          <details className="map-floor-directory">
            <summary>
              {c.floorDepartments} (
              {scene.nodes.filter((n) => n.kind === "department").length})
            </summary>
            {scene.nodes
              .filter((n) => n.kind === "department")
              .map((n) => (
                <button type="button" key={n.id} onClick={() => choose(n.id)}>
                  {n.building}.{n.marker} · {mapLabel(n, locale)}
                </button>
              ))}
          </details>
          <h4>{c.steps}</h4>
          <p className="map-position-hint">{from ? c.selected : c.select}</p>
          {route && (
            <ol className="map-route-list">
              {route.legs.map((leg, i) => (
                <li key={leg.id} data-testid="map-leg" data-action={leg.action}>
                  <span className="map-step-index">{i + 1}</span>
                  <div>
                    <p>{instructions[i]}</p>
                    <small>
                      {leg.nodes
                        .map((n) => n.spaceId)
                        .filter((v, i, a) => a.indexOf(v) === i)
                        .map((id) => {
                          const s = graph.spaces?.find((s) => s.id === id);
                          return s ? mapSpaceTitle(s, locale) : "";
                        })
                        .join(" → ")}
                    </small>
                    <button
                      type="button"
                      onClick={() =>
                        showSpace(leg.transition ? leg.toSpace : leg.fromSpace)
                      }
                    >
                      {u.view}
                    </button>
                    <button
                      type="button"
                      onClick={() => choose(leg.nodes[0].id)}
                    >
                      {c.update}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
      <details className="map-coverage">
        <summary>
          {u.coverage} · {inventory.departments.length} /{" "}
          {inventory.locations.length} · {u.unmapped}: {unknown.length}
        </summary>
        <p>{u.demo}</p>
        <ul>
          {mapBuildings.map((b) => (
            <li key={b.id}>
              {u.building} {b.id}:{" "}
              {b.floors.map((f) => floorLabel(f, locale)).join(", ")}
              {b.entranceOnly ? ` · ${u.entranceOnly}` : ""}
            </li>
          ))}
        </ul>
        <ul>
          {unknown.map((item, i) => (
            <li key={`${item.id}:${i}`}>
              {localizeText(item.name, locale)} · {item.building} ·{" "}
              {item.floors.join(", ") || "?"}
              {item.room ? ` · ${item.room}` : ""} — {u[item.status]}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
