import type { MapGraph, MapNode, MapRoute } from "./mapModel.ts";
import { shortestPath } from "./mapRouting.ts";

export type PositionDemoConfig = {
  legMs: number;
  dwellMs: number;
  tickMs: number;
  staleMs: number;
  ttsTimeoutMs: number;
  defaultNodeId: string;
};
export const positionDemoConfig: Readonly<PositionDemoConfig> = Object.freeze({
  legMs: 5000,
  dwellMs: 1000,
  tickMs: 50,
  staleMs: 3000,
  ttsTimeoutMs: 15000,
  defaultNodeId: "gate-1",
});
export type PositionClock = {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
};
export type GuidanceToken = Readonly<{
  sessionId: string;
  routeId: string;
  legId: string;
  revision: number;
}>;
export type PositionFix = Readonly<{
  source: "simulation" | "manual";
  sessionId: string;
  buildingId: string | null;
  floorId: string;
  spaceId: string;
  x: number;
  y: number;
  timestamp: number;
  availability: "available" | "unavailable" | "stale";
  nodeId?: string | undefined;
  edge?: Readonly<{ from: string; to: string; progress: number }>;
}>;
export type PositionStatus =
  | "ready"
  | "guidance"
  | "moving"
  | "paused"
  | "lost"
  | "stale"
  | "no-route"
  | "arrived"
  | "disposed";
export type PositionSnapshot = Readonly<{
  position: PositionFix;
  status: PositionStatus;
  route: MapRoute | null;
  legIndex: number;
  guidance: GuidanceToken | null;
  revision: number;
}>;
export type PositionEvent = "position" | "guidance" | "state" | "arrived";
export interface PositionSource {
  getSnapshot(): PositionSnapshot;
  subscribe(
    listener: (snapshot: PositionSnapshot, event: PositionEvent) => void,
  ): () => void;
  start(): void;
  pause(): void;
  resume(): void;
  reset(nodeId?: string): void;
  dispose(): void;
}
let sequence = 0;
/** A deliberate, walkable off-route point; never a fabricated coordinate. */
export function demoDeviationNode(
  graph: MapGraph,
  fix: PositionFix,
  route: MapRoute | null,
) {
  const routeIds = new Set(route?.nodes.map((n) => n.id));
  const candidates = graph.nodes.filter(
    (n) =>
      !n.closed &&
      n.spaceId &&
      n.id !== fix.nodeId &&
      !["room", "department", "door"].includes(n.kind) &&
      !routeIds.has(n.id),
  );
  return candidates.find((n) => n.spaceId === fix.spaceId) ?? candidates[0];
}
const systemClock: PositionClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/** One clock/controller for both clients. No speech, network or business mutations. */
export class DemoPositionSource implements PositionSource {
  private readonly clock: PositionClock;
  readonly config: typeof positionDemoConfig;
  private listeners = new Set<
    (snapshot: PositionSnapshot, event: PositionEvent) => void
  >();
  private timer: unknown;
  private generation = 0;
  private revision = 0;
  private sessionId = "";
  private status: PositionStatus = "ready";
  private position!: PositionFix;
  private route: MapRoute | null = null;
  private legIndex = 0;
  private guidance: GuidanceToken | null = null;
  private acknowledged = false;
  private dwellAt = 0;
  private elapsed = 0;
  private lastAt = 0;
  private targetId: string | null = null;
  private snapshot!: PositionSnapshot;
  private signal: PositionFix["availability"] = "available";
  private started = false;
  private completed = false;
  private routeGraph: MapGraph;
  private readonly graph: MapGraph;
  readonly source: "simulation" | "manual";
  constructor(
    graph: MapGraph,
    source: "simulation" | "manual" = "simulation",
    options: {
      clock?: PositionClock;
      config?: Partial<typeof positionDemoConfig>;
      originId?: string;
    } = {},
  ) {
    this.graph = graph;
    this.source = source;
    this.clock = options.clock ?? systemClock;
    this.routeGraph = graph;
    this.config = Object.freeze({ ...positionDemoConfig, ...options.config });
    for (const key of [
      "legMs",
      "dwellMs",
      "tickMs",
      "staleMs",
      "ttsTimeoutMs",
    ] as const)
      if (!Number.isFinite(this.config[key]) || this.config[key] <= 0)
        throw new Error(`Invalid position config: ${key}`);
    this.reset(options.originId ?? this.config.defaultNodeId);
  }
  private node(id: string) {
    const node = this.graph.nodes.find(
      (n) => n.id === id && !n.closed && n.spaceId,
    );
    if (!node) throw new Error(`Unavailable map origin: ${id}`);
    return node;
  }
  private fix(node: MapNode): PositionFix {
    return Object.freeze({
      source: this.source,
      sessionId: this.sessionId,
      buildingId: node.building ?? null,
      floorId: node.floor,
      spaceId: node.spaceId!,
      x: node.x,
      y: node.y,
      timestamp: this.clock.now(),
      availability: this.signal,
      nodeId: node.id,
    });
  }
  private notify(event: PositionEvent) {
    this.snapshot = Object.freeze({
      position: this.position,
      status: this.status,
      route: this.route,
      legIndex: this.legIndex,
      guidance: this.guidance,
      revision: this.revision,
    });
    const generation = this.generation;
    for (const listener of [...this.listeners]) {
      if (generation !== this.generation) break;
      try {
        listener(this.snapshot, event);
      } catch {
        /* Consumers cannot strand the source timer. */
      }
    }
  }
  getSnapshot() {
    return this.snapshot;
  }
  subscribe(
    listener: (snapshot: PositionSnapshot, event: PositionEvent) => void,
  ) {
    if (this.status === "disposed") return () => {};
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private cancel() {
    this.generation++;
    if (this.timer !== undefined) this.clock.clearTimeout(this.timer);
    this.timer = undefined;
  }
  private schedule() {
    if (
      !this.started ||
      this.source === "manual" ||
      ["paused", "lost", "stale", "disposed"].includes(this.status) ||
      this.timer !== undefined
    )
      return;
    const generation = this.generation;
    this.timer = this.clock.setTimeout(() => {
      if (generation !== this.generation) return;
      this.timer = undefined;
      // A suspended event loop must not catch up movement on return.
      if (this.clock.now() - this.position.timestamp > this.config.staleMs) {
        this.setSignal("stale");
        return;
      }
      const event = this.sample();
      this.notify(event);
      this.schedule();
    }, this.config.tickMs);
  }
  private prompt() {
    this.status = "guidance";
    this.acknowledged = false;
    this.dwellAt = this.clock.now();
    this.guidance = Object.freeze({
      sessionId: this.sessionId,
      routeId: this.route!.id,
      legId: this.route!.legs[this.legIndex].id,
      revision: ++this.revision,
    });
  }
  private sample(): PositionEvent {
    const now = this.clock.now();
    if (
      now - this.position.timestamp > this.config.staleMs &&
      this.status === "moving"
    ) {
      this.setSignal("stale");
      return "state";
    }
    let event: PositionEvent = "position";
    if (this.status === "moving" && this.route) {
      this.elapsed = Math.min(
        this.config.legMs,
        this.elapsed + Math.max(0, now - this.lastAt),
      );
      const leg = this.route.legs[this.legIndex];
      if (this.elapsed >= this.config.legMs) {
        this.position = this.fix(leg.nodes.at(-1)!);
        this.legIndex++;
        this.elapsed = 0;
        this.prompt();
        event = "guidance";
      } else if (!leg.transition) {
        const lengths = leg.edges.map((_, i) =>
          Math.hypot(
            leg.nodes[i + 1].x - leg.nodes[i].x,
            leg.nodes[i + 1].y - leg.nodes[i].y,
          ),
        );
        let distance =
          (lengths.reduce((a, b) => a + b, 0) * this.elapsed) /
          this.config.legMs;
        let index = 0;
        while (index < lengths.length - 1 && distance > lengths[index])
          distance -= lengths[index++];
        const a = leg.nodes[index],
          b = leg.nodes[index + 1],
          progress = lengths[index] ? distance / lengths[index] : 0;
        this.position = Object.freeze({
          ...this.fix(a),
          nodeId: undefined,
          x: a.x + (b.x - a.x) * progress,
          y: a.y + (b.y - a.y) * progress,
          edge: Object.freeze({ from: a.id, to: b.id, progress }),
        });
      }
    } else if (
      this.status === "guidance" &&
      this.acknowledged &&
      now - this.dwellAt >= this.config.dwellMs
    ) {
      this.guidance = null;
      if (this.route!.legs[this.legIndex].action === "arrive") {
        this.status = "arrived";
        this.completed = true;
        event = "arrived";
      } else this.status = "moving";
    }
    this.lastAt = now;
    this.position = Object.freeze({
      ...this.position,
      timestamp: now,
      availability: this.signal,
    });
    return event;
  }
  start() {
    if (this.status === "disposed") return;
    if (["paused", "lost", "stale"].includes(this.status)) {
      this.resume();
      return;
    }
    if (this.started) return;
    this.started = true;
    this.lastAt = this.clock.now();
    this.position = Object.freeze({ ...this.position, timestamp: this.lastAt });
    this.schedule();
  }
  /** Ack only the live prompt; a delayed TTS callback cannot advance a new route. */
  continue(token: GuidanceToken) {
    const live = this.guidance;
    if (
      this.source === "manual" ||
      this.status !== "guidance" ||
      !live ||
      !this.started ||
      this.signal !== "available" ||
      token.sessionId !== live.sessionId ||
      token.routeId !== live.routeId ||
      token.legId !== live.legId ||
      token.revision !== live.revision
    )
      return false;
    this.acknowledged = true;
    const event = this.sample();
    this.notify(event);
    this.schedule();
    return true;
  }
  pause() {
    if (this.status === "disposed") return;
    if (this.status === "moving") this.sample();
    this.cancel();
    this.started = false;
    this.guidance = null;
    this.revision++;
    this.status =
      this.signal === "stale"
        ? "stale"
        : this.signal === "unavailable"
          ? "lost"
          : "paused";
    this.notify("state");
  }
  resume() {
    if (this.status === "disposed" || this.signal !== "available") return;
    if (!["paused", "lost", "stale"].includes(this.status)) {
      this.start();
      return;
    }
    this.started = true;
    this.lastAt = this.clock.now();
    if (this.completed) this.status = "arrived";
    else if (
      this.route &&
      this.source === "simulation" &&
      this.legIndex < this.route.legs.length
    )
      this.prompt();
    else this.status = this.targetId && !this.route ? "no-route" : "ready";
    this.position = Object.freeze({
      ...this.position,
      timestamp: this.clock.now(),
    });
    this.notify(this.guidance ? "guidance" : "state");
    this.schedule();
  }
  reset(nodeId = this.config.defaultNodeId) {
    if (this.status === "disposed") return;
    const node = this.node(nodeId);
    this.cancel();
    this.started = false;
    this.sessionId = `position-${this.clock.now()}-${++sequence}`;
    this.signal = "available";
    this.position = this.fix(node);
    this.route = null;
    this.targetId = null;
    this.routeGraph = this.graph;
    this.status = "ready";
    this.guidance = null;
    this.legIndex = 0;
    this.elapsed = 0;
    this.completed = false;
    this.revision++;
    this.notify("state");
  }
  /** Graph for rerouting includes the exact current point on its original edge. */
  graphAtPosition(): { graph: MapGraph; originId: string } {
    if (this.status === "moving") this.sample();
    const p = this.position;
    if (p.nodeId) return { graph: this.routeGraph, originId: p.nodeId };
    const a = this.routeGraph.nodes.find((n) => n.id === p.edge!.from)!,
      b = this.routeGraph.nodes.find((n) => n.id === p.edge!.to)!;
    const original = this.routeGraph.edges.find(
      (e) =>
        (e.from === a.id && e.to === b.id) ||
        (!e.oneWay && e.to === a.id && e.from === b.id),
    );
    if (!original || original.closed)
      return { graph: this.graph, originId: "" };
    const id = `position-origin:${this.sessionId}:${this.revision}`;
    const point: MapNode = {
      spaceId: a.spaceId!,
      building: a.building!,
      floor: a.floor,
      id,
      x: p.x,
      y: p.y,
      kind: "checkpoint",
      nameVi: "Vị trí mô phỏng",
      nameEn: "Simulated position",
    };
    const f = original.from === a.id ? p.edge!.progress : 1 - p.edge!.progress;
    if (f <= 1e-9) return { graph: this.routeGraph, originId: original.from };
    if (f >= 1 - 1e-9) return { graph: this.routeGraph, originId: original.to };
    return {
      graph: {
        ...this.routeGraph,
        nodes: [...this.routeGraph.nodes, point],
        edges: [
          ...this.routeGraph.edges,
          {
            ...original,
            id: `${id}:a`,
            from: original.from,
            to: id,
            weight: original.weight * f,
          },
          {
            ...original,
            id: `${id}:b`,
            from: id,
            to: original.to,
            weight: original.weight * (1 - f),
          },
        ],
      },
      originId: id,
    };
  }
  setTarget(targetId: string | null) {
    if (this.status === "disposed") return;
    const origin = this.graphAtPosition();
    this.routeGraph = origin.graph;
    this.cancel();
    this.revision++;
    this.targetId = targetId;
    this.completed = false;
    this.route = targetId
      ? shortestPath(origin.graph, origin.originId, targetId)
      : null;
    this.legIndex = 0;
    this.elapsed = 0;
    this.guidance = null;
    if (this.signal !== "available")
      this.status = this.signal === "stale" ? "stale" : "lost";
    else if (!this.route) this.status = "no-route";
    else if (this.source === "simulation") this.prompt();
    else this.status = "ready";
    this.lastAt = this.clock.now();
    this.notify(this.guidance ? "guidance" : "state");
    this.schedule();
  }
  setOrigin(nodeId: string) {
    const target = this.targetId;
    this.reset(nodeId);
    this.setTarget(target);
  }
  getGraph() {
    return this.routeGraph;
  }
  setSignal(signal: PositionFix["availability"]) {
    if (this.status === "disposed") return;
    // Do not sample a stale event-loop gap: that would run movement while hidden.
    if (
      this.status === "moving" &&
      this.clock.now() - this.position.timestamp <= this.config.staleMs
    )
      this.sample();
    this.cancel();
    this.started = false;
    this.signal = signal;
    this.guidance = null;
    this.revision++;
    this.position = Object.freeze({
      ...this.position,
      availability: signal,
      ...(signal === "available" ? { timestamp: this.clock.now() } : {}),
    });
    this.status =
      signal === "available" ? "paused" : signal === "stale" ? "stale" : "lost";
    this.notify("state");
  }
  dispose() {
    if (this.status === "disposed") return;
    this.cancel();
    this.started = false;
    this.guidance = null;
    this.status = "disposed";
    this.revision++;
    this.notify("state");
    this.listeners.clear();
  }
}
