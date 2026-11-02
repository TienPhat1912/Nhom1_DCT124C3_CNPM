import { localizeText } from "@hospital/shared";
import { useState } from "react";
import campusImage from "../assets/thu-duc-campus.jpg";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, G, Image, Line, Text as SvgText } from "react-native-svg";
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
} from "@hospital/shared";
import { Btn, Choice, DestinationBlock, Txt, Input } from "./ui";
import { useNative } from "./runtime";
import { useRouteSpeech } from "./useRouteSpeech";

export function HospitalMap({ destination }: { destination: Destination }) {
  const { locale, config } = useNative();
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
        key={`${destination.id}:${destination.building}:${destination.floor}:${destination.room}:${departmentId}:${departmentFloor}`}
        destination={destination}
        department={department}
        departmentFloor={departmentFloor}
      />
    </View>
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
  const { locale, config } = useNative();
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
  const [showChoices, setShowChoices] = useState(false);
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
  const highlighted = new Set(route?.edges);
  const choices = startNodes(area, level, hospitalMap);
  const routeIds = new Set(route?.nodes.map((n) => n.id));
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
    setShowChoices(value === "outside");
  };
  const chooseLevel = (value: string) => {
    clearRoute();
    setLevel(value);
    setFrom("");
    setFloor(value);
    setShowChoices(true);
  };
  const choose = (id: string) => {
    clearRoute();
    const n = hospitalMap.nodes.find((n) => n.id === id);
    setFrom(n?.id ?? "");
    if (n) {
      setArea(n.building ?? "outside");
      setLevel(n.building ? n.floor : "");
      setFloor(n.floor);
    }
    setShowChoices(false);
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
  return (
    <View style={s.container}>
      <Txt tone="heading">
        {c.title} · {c.sample}
      </Txt>
      <Txt style={s.warning}>{c.warning}</Txt>
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
      {area && area !== "outside" && (
        <>
          <Txt tone="heading">{c.level}</Txt>
          <View style={s.row} accessibilityRole="radiogroup">
            {buildingFloors(area, hospitalMap).map((f) => (
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
      {(area === "outside" || level) && (
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
            hospitalMap.nodes.find((n) => n.id === from)!,
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
      {speech.error && (
        <Txt accessibilityRole="alert" style={s.warning}>
          {speech.error}
        </Txt>
      )}
      <Txt accessibilityLiveRegion="polite" tone="heading">
        {status}
      </Txt>
      <Txt tone="muted">{c.shown}</Txt>
      <View style={s.row}>
        {mapFloors.map((f) => (
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
              {route?.nodes.some((n) => n.floor === f) ? " •" : ""}
            </Txt>
          </Pressable>
        ))}
      </View>
      <View style={s.canvas}>
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 604 666"
          accessibilityLabel={`${c.title} · ${floorLabel(floor, locale)}`}
        >
          <Image href={campusImage} width={604} height={2048} opacity={0.6} />
          {hospitalMap.edges
            .filter((e) => !e.closed && e.kind === "walk")
            .sort(
              (a, b) => Number(highlighted.has(a)) - Number(highlighted.has(b)),
            )
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
              const active = highlighted.has(edge);
              return (
                <G key={`${edge.from}-${edge.to}`}>
                  {active && (
                    <Line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="white"
                      strokeWidth={11}
                      strokeLinecap="round"
                    />
                  )}
                  <Line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={active ? "#1261df" : "#6a8395"}
                    strokeWidth={active ? 6 : 3}
                    strokeDasharray={active ? undefined : "4 5"}
                    strokeLinecap="round"
                  />
                </G>
              );
            })}
          {hospitalMap.nodes
            .filter((n) => !n.closed && n.floor === floor)
            .map((n) => {
              const start = n.id === from,
                end = n.id === target?.id;
              const available =
                choices.some((v) => v.id === n.id) ||
                (!area && !n.building) ||
                routeIds.has(n.id) ||
                end;
              return (
                <G
                  key={n.id}
                  onPress={() => {
                    if (available) choose(n.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${mapLabel(n, locale)} · ${floorLabel(n.floor, locale)}`}
                  accessibilityState={{ selected: start, disabled: !available }}
                  opacity={available ? 1 : 0.35}
                >
                  <Circle cx={n.x} cy={n.y} r={24} fill="transparent" />
                  {(start || end) && (
                    <Circle
                      cx={n.x}
                      cy={n.y}
                      r={18}
                      fill="white"
                      opacity={0.8}
                    />
                  )}
                  <Circle
                    cx={n.x}
                    cy={n.y}
                    r={
                      n.kind === "room" ||
                      n.kind === "department" ||
                      start ||
                      end
                        ? 12
                        : 8
                    }
                    fill={start ? "#0a6357" : end ? "#c15b08" : "white"}
                    stroke={start || end ? "white" : "#486878"}
                    strokeWidth={3}
                  />
                  <SvgText
                    x={n.x}
                    y={n.y + 4}
                    fontSize={12}
                    fill={start || end ? "white" : "#486878"}
                    textAnchor="middle"
                  >
                    {start
                      ? "●"
                      : end
                        ? "★"
                        : (n.marker ?? (n.kind === "elevator" ? "↕" : ""))}
                  </SvgText>
                  {(n.room || n.kind === "gate" || start) && (
                    <SvgText
                      x={n.x}
                      y={n.y - 22}
                      fontSize={14}
                      fontWeight="bold"
                      fill="#123e37"
                      stroke="white"
                      strokeWidth={0.4}
                      textAnchor="middle"
                    >
                      {n.room ?? (start ? c.current : mapLabel(n, locale))}
                    </SvgText>
                  )}
                </G>
              );
            })}
        </Svg>
      </View>
      <View style={s.row}>
        <Txt style={{ color: "#0a6357" }}>● {c.current}</Txt>
        <Txt style={{ color: "#c15b08" }}>★ {c.target}</Txt>
        <Txt style={{ color: "#1261df" }}>━ {c.route}</Txt>
      </View>
      {from && <Txt tone="muted">{c.selected}</Txt>}
      {route && (
        <>
          <Txt tone="heading">{c.steps}</Txt>
          {route.nodes.map((n, i) => (
            <View key={n.id} style={s.step}>
              <Txt>
                {i + 1}. {instructions[i]}
              </Txt>
              <Btn secondary onPress={() => choose(n.id)}>
                {c.update + ": " + mapLabel(n, locale)}
              </Btn>
            </View>
          ))}
          {!route.nodes.some((n) => n.floor === floor) && (
            <Txt>{c.noSegment}</Txt>
          )}
        </>
      )}
      {from && (
        <Btn secondary onPress={() => choose("")}>
          {c.reset}
        </Btn>
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
  canvas: {
    width: "100%",
    aspectRatio: 604 / 666,
    overflow: "hidden",
    borderRadius: 10,
    backgroundColor: "#f3f5f4",
  },
  step: {
    padding: 12,
    borderLeftWidth: 3,
    borderColor: "#1261df",
    gap: 4,
    backgroundColor: "#f3f7f3",
  },
});
