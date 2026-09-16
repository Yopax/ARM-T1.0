import * as THREE from 'three';
import { BimElementDocument } from '../../core/database/BimDatabaseTypes';

export type ElementCategory = 'footing' | 'column' | 'beam' | 'slab';

export interface ManagedElement {
  id: string; // Legacy ID (ej. COL-001)
  elementId?: number; // Revit Element ID numérico secuencial (ej. 100042)
  uniqueId?: string; // Revit UniqueId / GUID de 128-bit (MongoDB _id)
  bimDoc?: BimElementDocument; // Documento relacional BSON completo
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
