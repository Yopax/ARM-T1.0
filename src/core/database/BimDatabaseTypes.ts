export type BimCategory =
  | 'OST_StructuralFoundation'
  | 'OST_StructuralColumns'
  | 'OST_StructuralFraming'
  | 'OST_Floors'
  | 'OST_Grids'
  | 'OST_Levels';

export interface BimTypeParameters {
  typeName: string;
  width?: number;
  depth?: number;
  height?: number;
  thickness?: number;
  defaultMaterial: string;
  concreteStrength: number; // f'c en kg/cm²
  unitCost: number; // USD por m³
  structuralRole: string;
}

export interface BimInstanceParameters {
  mark: string; // Código de elemento (ej. C-1, V-101, Z-1)
  sector: string; // Sector de vaciado (ej. Sector A, Sector B)
  phase: 'Nueva Construcción' | 'Existente' | 'Demolición';
  baseLevel: string;
  topLevel?: string;
  baseOffset: number;
  topOffset?: number;
  length?: number;
  height?: number;
  volume: number; // m³
  surfaceArea: number; // Área de encofrado en m²
  concreteStrength: number; // f'c individual o heredado
  estimatedCost: number; // Calculado: volumen * unitCost
  comments?: string;
}

export interface BimElementDocument {
  _id: string; // MongoDB BSON _id (mapeado al UniqueId GUID)
  elementId: number; // Revit Element ID secuencial (ej. 100101)
  uniqueId: string; // Revit / OpenBIM IFC GUID (128-bit)
  category: BimCategory;
  categoryName: string;
  family: string;
  familyType: string;
  typeId: string;
  levelId: string;
  levelName: string;
  typeParameters: BimTypeParameters;
  instanceParameters: BimInstanceParameters;
  geometry: {
    origin: { x: number; y: number; z: number };
    dimensionsString: string;
    boundingBox?: {
      min: [number, number, number];
      max: [number, number, number];
    };
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
    software: string;
    ifcEntity: string; // ej. IfcColumn, IfcBeam, IfcFooting, IfcSlab
  };
}

export interface BimGridDocument {
  _id: string;
  elementId: number;
  uniqueId: string;
  category: 'OST_Grids';
  categoryName: 'Rejillas';
  family: 'Rejilla Estándar Circular 6.5mm';
  name: string;
  geomType: 'line' | 'arc';
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  length: number;
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
  };
}

export interface BimLevelDocument {
  _id: string;
  elementId: number;
  uniqueId: string;
  category: 'OST_Levels';
  categoryName: 'Niveles';
  family: 'Nivel con Cota 8mm';
  name: string;
  elevation: number;
  hasFloorPlan: boolean;
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
  };
}

export interface ScheduleQueryOptions {
  category?: BimCategory | 'ALL';
  levelName?: string;
  sector?: string;
  search?: string;
  groupByType?: boolean;
}

export interface ScheduleSummary {
  totalCount: number;
  totalVolume: number;
  totalSurfaceArea: number;
  totalCost: number;
}
