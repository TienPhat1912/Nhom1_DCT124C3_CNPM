import { Button, Field, Notice } from "./components";
import {
  mapLabel,
  mapCopy,
  mapSpaceTitle,
  routeInstructions,
  routeLanguage,
  positionCopy,
  demoDeviationNode,
  type Locale,
  type MapGraph,
} from "@hospital/shared";
import { FloorPlan } from "./FloorPlan";
import { usePositionDemo } from "./usePositionDemo";

export function SimulationMap({
  graph,
  targetId,
  contextKey,
  locale,
}: {
  graph: MapGraph;
  targetId: string | null;
  contextKey?: string;
  locale: Locale;
}) {
  const { controller, snapshot } = usePositionDemo(graph, targetId, contextKey);
  const c = positionCopy[locale];
  if (!controller || !snapshot) return null;
  const p = snapshot.position;
  const space = graph.spaces?.find((s) => s.id === p.spaceId);
  const target = graph.nodes.find((n) => n.id === targetId);
  const choices = graph.nodes.filter((n) => !n.closed && n.kind !== "door");
  const proceed = () => {
    controller.start();
    const token = controller.getSnapshot().guidance;
    if (token) controller.continue(token);
  };
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
    <section
      className="hospital-map"
      data-testid="simulation-panel"
      data-target={targetId ?? ""}
    >
      <h3>{c.title}</h3>
      <Notice>{c.note}</Notice>
      <p>
        {mapCopy[locale].target}:{" "}
        {target ? mapLabel(target, locale) : mapCopy[locale].unmapped}
      </p>
      <Field label={c.origin}>
        <select
          value={p.nodeId ?? ""}
          onChange={(e) => controller.setOrigin(e.target.value)}
        >
          <option value="" disabled>
            —
          </option>
          {choices.map((n) => (
            <option key={n.id} value={n.id}>
              {mapLabel(n, locale)}
            </option>
          ))}
        </select>
      </Field>
      <p
        role="status"
        data-testid="simulation-status"
        data-status={snapshot.status}
      >
        {status}
      </p>
      <p data-testid="simulation-instruction">{text}</p>
      <div className="actions">
        <Button
          disabled={stopped || snapshot.status === "moving"}
          onClick={proceed}
        >
          {c.start}
        </Button>
        {snapshot.guidance && <Button onClick={proceed}>{c.ack}</Button>}
        <Button variant="secondary" onClick={() => controller.pause()}>
          {c.pause}
        </Button>
        <Button variant="secondary" onClick={reset}>
          {c.reset}
        </Button>
        <Button
          variant="secondary"
          disabled={!deviation}
          onClick={() => {
            if (deviation) controller.setOrigin(deviation.id);
          }}
        >
          {c.deviate}
        </Button>
        <Button
          variant="secondary"
          onClick={() => controller.setSignal("unavailable")}
        >
          {c.lose}
        </Button>
        <Button
          variant="secondary"
          onClick={() => controller.setSignal("stale")}
        >
          {c.stale}
        </Button>
        <Button
          variant="secondary"
          onClick={() => controller.setSignal("available")}
        >
          {c.recover}
        </Button>
      </div>
      <p
        data-testid="simulation-position"
        data-x={p.x}
        data-y={p.y}
        data-session={p.sessionId}
        data-space={p.spaceId}
      >
        {space ? mapSpaceTitle(space, locale) : p.spaceId} · {p.x.toFixed(1)},{" "}
        {p.y.toFixed(1)} · {new Date(p.timestamp).toISOString()}
      </p>
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
    </section>
  );
}
