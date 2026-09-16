export interface GridAxis {
  id: string;
  name: string;
  type: 'x' | 'z';
  coord: number;
}

export type GridDrawMode = 'line' | 'arc_start_end_radius' | 'arc_center_ends' | 'pick_lines';

export interface GridElbowData {
  active: boolean;
  lateralOffset: number; // Desfase lateral perpendicular (en metros, p. ej. -2.0 o +2.0)
  breakDistance: number; // Distancia desde el extremo donde inicia el quiebre (en metros)
}

export interface GridElement {
  id: string;
  name: string;
  geomType: 'line' | 'arc';
  start: { x: number; z: number };
  end: { x: number; z: number };
  center?: { x: number; z: number };
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  clockwise?: boolean;
  showStartBubble: boolean;
  showEndBubble: boolean;
  isLocked?: boolean;
  startElbow?: GridElbowData;
  endElbow?: GridElbowData;
}

export const DEFAULT_GRID_X: GridAxis[] = [
  { id: 'x-1', name: '1', type: 'x', coord: -12 },
  { id: 'x-2', name: '2', type: 'x', coord: -6 },
  { id: 'x-3', name: '3', type: 'x', coord: 0 },
  { id: 'x-4', name: '4', type: 'x', coord: 6 },
  { id: 'x-5', name: '5', type: 'x', coord: 12 },
];

export const DEFAULT_GRID_Z: GridAxis[] = [
  { id: 'z-a', name: 'A', type: 'z', coord: -12 },
  { id: 'z-b', name: 'B', type: 'z', coord: -6 },
  { id: 'z-c', name: 'C', type: 'z', coord: 0 },
  { id: 'z-d', name: 'D', type: 'z', coord: 6 },
  { id: 'z-e', name: 'E', type: 'z', coord: 12 },
];

export let GRID_X: number[] = [];
export let GRID_Z: number[] = [];

export function updateActiveGrids(coordsX: number[], coordsZ: number[]): void {
  GRID_X.length = 0;
  GRID_X.push(...coordsX);
  GRID_Z.length = 0;
  GRID_Z.push(...coordsZ);
}

export interface LevelInfo {
  index: number;
  name: string;
  elevation: number;
}

export const LEVELS: LevelInfo[] = [
  { index: 0, name: 'Nivel 0: Terreno / Cimientos (0.00m)', elevation: 0.0 },
  { index: 1, name: 'Nivel 1: Piso 1 (+3.50m)', elevation: 3.5 },
  { index: 2, name: 'Nivel 2: Piso 2 (+7.00m)', elevation: 7.0 },
  { index: 3, name: 'Nivel 3: Piso 3 (+10.50m)', elevation: 10.5 },
  { index: 4, name: 'Nivel 4: Piso 4 (+14.00m)', elevation: 14.0 },
  { index: 5, name: 'Nivel 5: Cubierta (+17.50m)', elevation: 17.5 },
];

export const LEVELS_Y = LEVELS.map(l => l.elevation);

export function updateActiveLevels(newLevels: LevelInfo[]): void {
  LEVELS.length = 0;
  LEVELS.push(...newLevels);
  LEVELS_Y.length = 0;
  LEVELS_Y.push(...newLevels.map(l => l.elevation));
}

export const STRUCTURAL_SPECS = {
  column: { width: 0.40, depth: 0.40 },
  beam: { width: 0.40, height: 0.55 },
  slab: { thickness: 0.20 },
  footing: { width: 2.0, length: 2.0, height: 0.60 }
};

export type ToolType = 'select' | 'grid' | 'level' | 'zapata' | 'columna' | 'viga' | 'techo';