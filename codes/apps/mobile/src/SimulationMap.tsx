import { useState } from "react";
import { View, Switch } from "react-native";
import { Btn, Choice, Txt } from "./ui";
import {
  mapLabel,
  mapCopy,
  mapSpaceTitle,
  routeInstructions,
  routeLanguage,
  positionCopy,
  routeNarrationCopy,
  demoDeviationNode,
  type Locale,
  type MapGraph,
} from "@hospital/shared";
import { FloorPlan } from "./FloorPlan";
import { usePositionDemo } from "./usePositionDemo";
import { useRouteNarration } from "./useRouteNarration";

export function SimulationMap({
  graph,
  targetId,
  contextKey,
  autoplay = true,
  labelsReady = true,
  locale,
}: {
  graph: MapGraph;
  targetId: string | null;
  contextKey?: string;
  autoplay?: boolean;
  labelsReady?: boolean;
  locale: Locale;
}) {
  const { controller, snapshot } = usePositionDemo(graph, targetId, contextKey);
  const [showOrigins, setShowOrigins] = useState(false);
  const narration = useRouteNarration(
    controller,
    locale,
    autoplay,
    labelsReady,
  );
  const c = positionCopy[locale];
  if (!controller || !snapshot) return null;
  const p = snapshot.position;
  const space = graph.spaces?.find((s) => s.id === p.spaceId);
  const target = graph.nodes.find((n) => n.id === targetId);
  const choices = graph.nodes.filter((n) => !n.closed && n.kind !== "door");
  const proceed = () => narration.start();
  const reset = () => {
    controller.reset();
    controller.setTarget(targetId);
  };
  const deviation = demoDeviationNode(graph, p, snapshot.route);
  const text = snapshot.route
    ? routeInstructions(snapshot.route, routeLanguage(snapshot.route, locale))[
        snapshot.legIndex
      ]
    : "";
  const status =
    c[snapshot.status === "stale" ? "staleStatus" : snapshot.status];
  const stopped = ["lost", "stale", "disposed", "no-route", "arrived"].includes(
    snapshot.status,
  );
  return (
    <View style={{ gap: 12 }} testID="simulation-panel">
      <Txt tone="heading">{c.title}</Txt>
      <Txt tone="muted">{c.note}</Txt>
      <Txt>{routeNarrationCopy[locale].auto}</Txt>
      <Switch
        accessibilityLabel={routeNarrationCopy[locale].auto}
        value={!narration.muted}
        onValueChange={(v) => narration.setMuted(!v)}
      />
      {narration.error && (
        <Txt accessibilityRole="alert">{mapCopy[locale].audioError}</Txt>
      )}
      <Txt>
        {mapCopy[locale].target}:{" "}
        {target ? mapLabel(target, locale) : mapCopy[locale].unmapped}
      </Txt>
      <Btn secondary onPress={() => setShowOrigins(!showOrigins)}>
        {c.origin}
      </Btn>
      {showOrigins &&
        choices.map((n) => (
          <Choice
            key={n.id}
            label={mapLabel(n, locale)}
            selected={p.nodeId === n.id}
            onPress={() => {
              controller.setOrigin(n.id);
              setShowOrigins(false);
            }}
          />
        ))}
      <Txt accessibilityLiveRegion="polite" testID="simulation-status">
        {status}
      </Txt>
      <Txt>{text}</Txt>
      <View style={{ gap: 8 }}>
        <Btn
          disabled={
            !labelsReady ||
            !snapshot.route ||
            stopped ||
            snapshot.status === "moving"
          }
          onPress={proceed}
        >
          {c.start}
        </Btn>
        <Btn
          secondary
          disabled={
            !labelsReady ||
            !snapshot.route ||
            ["paused", "lost", "stale", "no-route", "disposed"].includes(
              snapshot.status,
            )
          }
          onPress={narration.replay}
        >
          {mapCopy[locale].listen}
        </Btn>
        <Btn secondary onPress={() => narration.pause()}>
          {c.pause}
        </Btn>
        <Btn secondary onPress={reset}>
          {c.reset}
        </Btn>
        <Btn
          secondary
          disabled={!deviation}
          onPress={() => {
            if (deviation) controller.setOrigin(deviation.id);
          }}
        >
          {c.deviate}
        </Btn>
        <Btn secondary onPress={() => controller.setSignal("unavailable")}>
          {c.lose}
        </Btn>
        <Btn secondary onPress={() => controller.setSignal("stale")}>
          {c.stale}
        </Btn>
        <Btn secondary onPress={() => controller.setSignal("available")}>
          {c.recover}
        </Btn>
      </View>
      <Txt tone="muted">
        {space ? mapSpaceTitle(space, locale) : p.spaceId} · {p.x.toFixed(1)},{" "}
        {p.y.toFixed(1)} · {new Date(p.timestamp).toISOString()}
      </Txt>
      <FloorPlan
        graph={controller.getGraph()}
        spaceId={p.spaceId}
        route={snapshot.route}
        from={p.nodeId ?? ""}
        target={targetId ?? undefined}
        position={p}
        locale={locale}
        zoom={1}
        onChoose={(id) => {
          if (graph.nodes.some((n) => n.id === id)) controller.setOrigin(id);
        }}
        onBuilding={(id) => controller.setOrigin("lobby-" + id.toLowerCase())}
      />
    </View>
  );
}
