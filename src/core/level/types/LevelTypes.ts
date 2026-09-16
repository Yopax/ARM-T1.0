export interface LevelElbowData {
  active: boolean;
  verticalOffset: number; // Desplazamiento vertical en metros (+/- para separar etiquetas contiguas)
  breakDistance: number;  // Distancia horizontal donde ocurre el quiebre estilo hombro Revit
}

export interface LevelElement {
  id: string;
  name: string;
  elevation: number; // Cota en metros (Y axis)
  start: { x: number; z: number };
  end: { x: number; z: number };
  showStartBubble: boolean;
  showEndBubble: boolean;
  isLocked: boolean; // Candado de alineación con otros niveles (estilo Revit)
  hasPlanView: boolean; // Si tiene vista de planta asociada (cabezal azul vs negro)
  startElbow?: LevelElbowData;
  endElbow?: LevelElbowData;
}

export type LevelDrawMode = 'line' | 'pick_lines';

export type LevelNamingPattern = 'standard' | 'floor' | 'custom';

export interface QuickGenerateLevelConfig {
  baseElevation: number;       // Cota inicial / Nivel base (ej. 0.00m)
  basementCount: number;       // Número de sótanos / subsuelos (ej. 2)
  basementHeight: number;      // Altura típica de sótanos (ej. 3.00m)
  groundFloorHeight: number;   // Altura especial de planta baja / lobby (ej. 4.50m)
  groundFloorName: string;     // Nombre de planta baja (ej. 'Planta Baja' o 'Nivel 1')
  upperFloorCount: number;     // Número de niveles superiores típicos (ej. 10)
  upperFloorHeight: number;    // Altura entrepiso de niveles superiores (ej. 3.00m)
  namingPattern: LevelNamingPattern; // Prefijos: 'Nivel {n}', 'Piso {n}' o personalizado
  prefixUpper: string;         // Prefijo para pisos superiores (ej. 'Nivel', 'Piso')
  prefixBasement: string;      // Prefijo para sótanos (ej. 'Sótano', 'Subsuelo')
  createPlanViews: boolean;    // Crear vista de plano asociada por cada nivel
}

export type LevelTemplateType = 'residential' | 'commercial' | 'house_2lvl' | 'tower_10';

export interface LevelTemplate {
  id: LevelTemplateType;
  name: string;
  badge: string;
  description: string;
  config: QuickGenerateLevelConfig;
}
