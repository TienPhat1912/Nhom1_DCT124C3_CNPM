import { useEffect, useState } from "react";
import { AppState } from "react-native";
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
    if (AppState.currentState !== "active") controller.pause();
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") controller.pause();
    });
    return () => sub.remove();
  }, [controller]);
  return { controller, snapshot };
}
