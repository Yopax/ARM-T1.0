import * as THREE from 'three';
import { BimElementDocument } from '../../core/database/BimDatabaseTypes';

export type ElementCategory = 'footing' | 'column' | 'beam' | 'slab';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface ColumnDefinition {
  type: 'column';
  columnStyle: 'vertical' | 'slanted';
  basePoint: Vector3D;
  topPoint: Vector3D;
  width: number;
  depth: number;
  baseOffset?: number;
  topOffset?: number;
}

export interface BeamDefinition {
  type: 'beam';
  startPoint: Vector3D;
  endPoint: Vector3D;
  width: number;
  height: number;
}

export interface SlabDefinition {
  type: 'slab';
  boundary: Vector3D[];
  voids?: Vector3D[][]; // Contornos interiores (shaft openings / vacíos)
  thickness: number;
  elevationY: number;
}

export interface FootingDefinition {
  type: 'footing';
  center: Vector3D;
  width: number;
  length: number;
  height: number;
}

export type StructuralDefinition = ColumnDefinition | BeamDefinition | SlabDefinition | FootingDefinition;

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
  definition?: StructuralDefinition; // Definición paramétrica 3D completa
}

export interface MetricsUpdate {
  count: number;
  volume: number;
  durationMs: number;
}

export interface AlignReference {
  type: 'grid' | 'element_edge' | 'level' | 'element_face';
  label: string;
  point: Vector3D;
  direction?: Vector3D; // Vector directriz de la línea o normal del plano
  axis?: 'X' | 'Z' | 'Y';
  coordinate?: number;
}

export interface ArrayOptions {
  type: 'linear' | 'radial';
  count: number;
  spacingMethod: 'second' | 'last'; // Mover al 2º elemento vs Mover al último
  delta?: Vector3D;
  center?: Vector3D; // Centro para matriz radial
  angleDegrees?: number; // Ángulo total para matriz radial
}
