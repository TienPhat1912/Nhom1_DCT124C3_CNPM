export type MapNode = {
  id: string;
  x: number;
  y: number;
  /** Coordinate frame; points in different spaces must never be interpolated. */
  spaceId?: string;
  floor: string;
  building?: string;
  name?: string;
  fallback?: boolean;
  nameVi: string;
  nameEn: string;
  kind:
    | "room"
    | "department"
    | "gate"
    | "checkpoint"
    | "elevator"
    | "stairs"
    | "door"
    | "lobby"
    | "exit"
    | "entrance";
  room?: string;
  departmentId?: string;
  marker?: string;
  closed?: boolean;
};
export type MapEdge = {
  id?: string;
  from: string;
  to: string;
  /** Uncalibrated demo routing cost, NOT metres or seconds. */
  weight: number;
  kind: "walk" | "elevator" | "stairs" | "connector";
  zone?: "corridor" | "room-access" | "campus";
  closed?: boolean;
  oneWay?: boolean;
  transition?: {
    fromSpace: string;
    toSpace: string;
    fromFloor: string;
    toFloor: string;
  };
};
export type MapRect = { x: number; y: number; width: number; height: number };
export type MapWall = { x1: number; y1: number; x2: number; y2: number };
export type MapRoom = MapRect & {
  nodeId: string;
  doorId: string;
  walls: MapWall[];
};
export type MapSpace = {
  id: string;
  kind: "campus" | "floor";
  building?: string;
  floor: string;
  width: number;
  height: number;
  entranceOnly?: boolean;
  outline?: MapRect;
  walls: MapWall[];
  corridors: MapRect[];
  rooms: MapRoom[];
  cores: Array<MapRect & { nodeId: string; walls: MapWall[] }>;
};
export type MapGraph = {
  nodes: MapNode[];
  edges: MapEdge[];
  spaces?: MapSpace[];
  version?: string;
};
export type MapAction =
  | "start"
  | "straight"
  | "left"
  | "right"
  | "uturn"
  | "elevator"
  | "stairs"
  | "enter"
  | "exit"
  | "transfer"
  | "arrive";
export type MapLeg = {
  id: string;
  action: MapAction;
  /** Instruction is spoken at nodes[0], BEFORE traversing this leg. */
  nodes: MapNode[];
  edges: MapEdge[];
  fromSpace: string;
  toSpace: string;
  transition: boolean;
};
export type MapRoute = {
  id: string;
  nodes: MapNode[];
  edges: MapEdge[];
  weight: number;
  legs: MapLeg[];
};
export const floorSpaceId = (building: string, floor: string) =>
  `floor:${building}:${floor}`;
