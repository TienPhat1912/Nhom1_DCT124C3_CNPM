import { localizeText } from "@hospital/shared";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { FloorPlan } from "./FloorPlan";
import { SimulationMap } from "./SimulationMap";
import { positionCopy } from "@hospital/shared";
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
import { Btn, Choice, DestinationBlock, Txt, Input } from "./ui";
import { useNative } from "./runtime";
import { useRouteSpeech } from "./useRouteSpeech";

export function HospitalMap({
  destination,
  contextKey,
}: {
  destination: Destination;
  contextKey?: string;
}) {
  const { locale, config, session } = useNative();
  const mapDepartments = configuredMapDepartments(
    config.departments,
    !!config.catalogVersion,
  );
  const [query, setQuery] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departmentFloor, setDepartmentFloor] = useState("");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const department = mapDepartments.find((d) => d.id === departmentId);
  return (
    <View style={{ gap: 12 }}>
      <Btn secondary onPress={() => setDirectoryOpen(!directoryOpen)}>
        {localizeText("Tra cứu khoa/phòng", locale) +
          " (" +
          mapDepartments.length +
          ")"}
      </Btn>
      {directoryOpen && (
        <>
          <Txt tone="muted">
            {localizeText(
              "Chọn khoa để tra cứu đường đi; thông tin trên phiếu không thay đổi.",
              locale,
            )}
          </Txt>
          <Input
            label={localizeText("Tìm khoa/phòng", locale)}
            value={query}
            onChangeText={setQuery}
          />
          <Btn
            secondary
            onPress={() => {
              setDepartmentId("");
              setDepartmentFloor("");
              setDirectoryOpen(false);
            }}
          >
            {localizeText("Dùng phòng trên phiếu", locale)}
          </Btn>
          {searchDepartments(query, locale, mapDepartments).map((d) => (
            <Choice
              key={d.id}
              label={
                departmentLabel(d, locale) +
                " · " +
                departmentLocation(d, locale)
              }
              selected={departmentId === d.id}
              onPress={() => {
                setDepartmentId(d.id);
                setDepartmentFloor(d.floors.length === 1 ? d.floors[0] : "");
                setDirectoryOpen(false);
              }}
            />
          ))}
        </>
      )}
      {department && department.floors.length > 1 && (
        <>
          <Txt tone="heading">{localizeText("Tầng cần đến", locale)}</Txt>
          {department.floors.map((f) => (
            <Choice
              key={f}
              label={floorLabel(f, locale)}
              selected={departmentFloor === f}
              onPress={() => setDepartmentFloor(f)}
            />
          ))}
        </>
      )}
      <MapPanel
        key={session.sessionId}
        destination={destination}
        contextKey={contextKey}
        department={department}
        departmentFloor={departmentFloor}
      />
    </View>
  );
}

type MapPanelProps = {
  contextKey?: string;
  destination: Destination;
  department?: MapDepartment;
  departmentFloor?: string;
};
export function MapPanel(props: MapPanelProps) {
  const { locale, config } = useNative();
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
    <View style={{ gap: 12 }}>
      <Choice
        label={positionCopy[locale].title}
        selected={mode === "simulation"}
        onPress={() => setMode("simulation")}
      />
      <Choice
        label={positionCopy[locale].manual}
        selected={mode === "manual"}
        onPress={() => setMode("manual")}
      />
      {mode === "simulation" ? (
        <SimulationMap
          graph={graph}
          targetId={target?.id ?? null}
          contextKey={props.contextKey}
          locale={locale}
        />
      ) : (
        <ManualMapPanel
          key={`${props.destination.id}:${props.destination.building}:${props.destination.floor}:${props.destination.room}:${props.department?.id}:${props.departmentFloor}:${props.contextKey}`}
          {...props}
        />
      )}
    </View>
  );
}
export function ManualMapPanel({
  destination,
  department,
  departmentFloor = "",
}: {
  destination: Destination;
  department?: MapDepartment;
  departmentFloor?: string;
}) {
  const { locale, config } = useNative();
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
  const [showChoices, setShowChoices] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
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
  const scene = mapScene(graph, spaceId, route),
    choices = startNodes(area, level, graph);
  const inventory = mapInventory(graph, config.locations, config.departments);
  const unknown = [...inventory.departments, ...inventory.locations].filter(
    (i) => i.status !== "mapped",
  );
  const showSpace = (id: string) => {
    const space = graph.spaces?.find((s) => s.id === id);
    if (space) {
      setViewBuilding(space.building ?? "campus");
      setFloor(space.floor);
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
    setViewBuilding(value === "outside" ? "campus" : value);
    setFloor("0");
    setShowChoices(value === "outside");
  };
  const chooseLevel = (value: string) => {
    clearRoute();
    setLevel(value);
    setFrom("");
    setViewBuilding(area);
    setFloor(value);
    setShowChoices(true);
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
    setShowChoices(false);
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
    <View style={s.container}>
      <Txt tone="heading">
        {c.title} · {c.sample}
      </Txt>
      <Txt style={s.warning}>{u.demo}</Txt>
      <Txt tone="muted">{c.hint}</Txt>
      <Txt tone="eyebrow">
        {department ? c.departmentDestination : c.destination}
      </Txt>
      {department ? (
        <View>
          <Txt tone="heading">{departmentLabel(department, locale)}</Txt>
          <Txt>{departmentLocation(department, locale)}</Txt>
          {departmentFloor && <Txt>{floorLabel(departmentFloor, locale)}</Txt>}
        </View>
      ) : (
        <DestinationBlock destination={destination} />
      )}
      <Txt tone="heading">{c.area}</Txt>
      <View style={s.row} accessibilityRole="radiogroup">
        <Choice
          label={c.outside}
          selected={area === "outside"}
          onPress={() => chooseArea("outside")}
        />
        {mapBuildings.map((b) => (
          <Choice
            key={b.id}
            label={`${c.building} ${b.id}`}
            selected={area === b.id}
            onPress={() => chooseArea(b.id)}
          />
        ))}
      </View>
      {!!area && area !== "outside" && (
        <>
          <Txt tone="heading">{c.level}</Txt>
          <View style={s.row} accessibilityRole="radiogroup">
            {buildingFloors(area, graph).map((f) => (
              <Choice
                key={f}
                label={floorLabel(f, locale)}
                selected={level === f}
                onPress={() => chooseLevel(f)}
              />
            ))}
          </View>
        </>
      )}
      {(area === "outside" || !!level) && (
        <>
          <Btn secondary onPress={() => setShowChoices(!showChoices)}>
            {c.start}
          </Btn>
          {showChoices && (
            <View accessibilityRole="radiogroup">
              {choices.map((n) => (
                <Choice
                  key={n.id}
                  label={mapLabel(n, locale)}
                  selected={from === n.id}
                  onPress={() => choose(n.id)}
                />
              ))}
            </View>
          )}
        </>
      )}
      {from && (
        <Txt>
          {c.current}:{" "}
          {mapLabel(
            graph.nodes.find((n) => n.id === from)!,
            locale,
          )}
        </Txt>
      )}
      <Btn
        disabled={!from || !target}
        onPress={() => {
          speech.stop();
          setRouteStart(from);
        }}
      >
        {c.find}
      </Btn>
      {route && (
        <Btn secondary onPress={() => void speech.play()}>
          {c.listen}
        </Btn>
      )}
      {speech.playing && (
        <Btn secondary onPress={speech.stop}>
          {c.stop}
        </Btn>
      )}
      {contentLocale !== locale && <Txt>{translator(locale)("fallback")}</Txt>}
      {!!speech.error && (
        <Txt accessibilityRole="alert" style={s.warning}>
          {speech.error}
        </Txt>
      )}
      <Txt accessibilityLiveRegion="polite" tone="heading">
        {status}
      </Txt>
      <Txt tone="muted">{u.shownBuilding}</Txt>
      <View style={s.row}>
        <Choice
          label={u.campus}
          selected={viewBuilding === "campus"}
          onPress={() => {
            setViewBuilding("campus");
            setFloor("0");
          }}
        />
        {mapBuildings.map((b) => (
          <Choice
            key={b.id}
            label={`${u.shownBuilding}: ${c.building} ${b.id}`}
            selected={viewBuilding === b.id}
            onPress={() => {
              setViewBuilding(b.id);
              setFloor("0");
            }}
          />
        ))}
      </View>
      {viewBuilding !== "campus" && (
        <>
          <Txt tone="muted">{c.shown}</Txt>
          <View style={s.row}>
            {buildingFloors(viewBuilding, graph).map((f) => (
              <Pressable
                key={f}
                accessibilityRole="button"
                accessibilityState={{ selected: floor === f }}
                accessibilityLabel={`${c.shown} ${f}`}
                onPress={() => setFloor(f)}
                style={[s.floor, floor === f && s.selected]}
              >
                <Txt style={floor === f ? s.selectedText : undefined}>
                  {floorLabel(f, locale)}
                  {route?.nodes.some(
                    (n) => n.spaceId === floorSpaceId(viewBuilding, f),
                  )
                    ? " •"
                    : ""}
                </Txt>
              </Pressable>
            ))}
          </View>
        </>
      )}
      {scene.space && (
        <Txt tone="heading">{mapSpaceTitle(scene.space, locale)}</Txt>
      )}
      {scene.space?.entranceOnly && (
        <Txt style={s.warning}>{u.entranceOnly}</Txt>
      )}
      <View style={s.row}>
        <Btn
          secondary
          disabled={zoom <= 1}
          onPress={() => setZoom(Math.max(1, zoom - 0.5))}
        >
          {c.zoomOut}
        </Btn>
        <Btn secondary onPress={() => setZoom(1)}>
          {c.fit}
        </Btn>
        <Btn
          secondary
          disabled={zoom >= 2.5}
          onPress={() => setZoom(Math.min(2.5, zoom + 0.5))}
        >
          {c.zoomIn}
        </Btn>
      </View>
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
      <View style={s.row}>
        <Txt>● {c.current}</Txt>
        <Txt>★ {c.target}</Txt>
        <Txt>━ {c.route}</Txt>
        <Txt>
          {u.room} · {u.corridor}
        </Txt>
      </View>
      {route && !route.nodes.some((n) => n.spaceId === spaceId) && (
        <Txt>{u.noSegment}</Txt>
      )}
      {route && (
        <>
          <Txt tone="heading">{c.steps}</Txt>
          {route.legs.map((leg, i) => (
            <View key={leg.id} style={s.step}>
              <Txt>
                {i + 1}. {instructions[i]}
              </Txt>
              <Btn
                secondary
                onPress={() =>
                  showSpace(leg.transition ? leg.toSpace : leg.fromSpace)
                }
              >
                {u.view}
              </Btn>
              <Btn secondary onPress={() => choose(leg.nodes[0].id)}>
                {c.update + ": " + mapLabel(leg.nodes[0], locale)}
              </Btn>
            </View>
          ))}
        </>
      )}
      {from && (
        <Btn secondary onPress={() => choose("")}>
          {c.reset}
        </Btn>
      )}
      <Btn secondary onPress={() => setShowInventory(!showInventory)}>
        {u.coverage + " · " + unknown.length}
      </Btn>
      {showInventory && (
        <>
          {mapBuildings.map((b) => (
            <Txt key={b.id}>
              {c.building} {b.id}:{" "}
              {b.floors.map((f) => floorLabel(f, locale)).join(", ")}
              {b.entranceOnly ? ` · ${u.entranceOnly}` : ""}
            </Txt>
          ))}
          {unknown.map((item, i) => (
            <Txt key={`${item.id}:${i}`}>
              {localizeText(item.name, locale)} · {item.building} ·{" "}
              {item.floors.join(", ") || "?"}
              {item.room ? ` · ${item.room}` : ""} — {u[item.status]}
            </Txt>
          ))}
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  container: { gap: 12 },
  warning: {
    color: "#77540b",
    backgroundColor: "#fff1cc",
    padding: 12,
    borderRadius: 10,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  floor: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#dce7de",
    borderRadius: 8,
  },
  selected: { backgroundColor: "#0a6357" },
  selectedText: { color: "white" },
  step: {
    padding: 12,
    borderLeftWidth: 3,
    borderColor: "#1261df",
    gap: 4,
    backgroundColor: "#f3f7f3",
  },
});
