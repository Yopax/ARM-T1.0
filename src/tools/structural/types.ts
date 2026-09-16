import * as THREE from 'three';

export type ElementCategory = 'footing' | 'column' | 'beam' | 'slab';

export interface ManagedElement {
  id: string;
  mesh: THREE.Mesh;
  line: THREE.LineSegments;
  type: ElementCategory;
  volume: number;
  levelName: string;
  dimensions: string;
}

export interface MetricsUpdate {
  count: number;
  volume: number;
  durationMs: number;
}
