import { useEffect, useState } from "react";

import {
  DemoPositionSource,
  type MapGraph,
  type PositionSnapshot,
} from "@hospital/shared";
export function usePositionDemo(
  graph: MapGraph,
  targetId: string | null,
  contextKey?: string,
) {
  const [controller, setController] = useState<DemoPositionSource | null>(null);
  const [snapshot, setSnapshot] = useState<PositionSnapshot | null>(null);
  useEffect(() => {
    const source = new DemoPositionSource(graph);
    const unsubscribe = source.subscribe((next) => setSnapshot(next));
    setController(source);
    setSnapshot(source.getSnapshot());
    return () => {
      unsubscribe();
      source.dispose();
    };
  }, [graph]);
  useEffect(() => {
    controller?.setTarget(targetId);
  }, [controller, targetId, contextKey]);
  useEffect(() => {
    if (!controller) return;
    const hidden = () => {
      if (document.hidden) controller.pause();
    };
    document.addEventListener("visibilitychange", hidden);
    hidden();
    return () => document.removeEventListener("visibilitychange", hidden);
  }, [controller]);
  return { controller, snapshot };
}
