import {
  LevelElement,
  LevelTemplate,
  LevelTemplateType,
  QuickGenerateLevelConfig,
} from '../types/LevelTypes';

export const LEVEL_TEMPLATES: Record<LevelTemplateType, LevelTemplate> = {
  residential: {
    id: 'residential',
    name: 'Residencial Estándar',
    badge: '1S + PB + 4P',
    description: '1 Sótano (-2.80m), Planta Baja (3.50m) y 4 Niveles típicos (3.00m)',
    config: {
      baseElevation: 0.0,
      basementCount: 1,
      basementHeight: 2.8,
      groundFloorHeight: 3.5,
      groundFloorName: 'Planta Baja',
      upperFloorCount: 4,
      upperFloorHeight: 3.0,
      namingPattern: 'standard',
      prefixUpper: 'Nivel',
      prefixBasement: 'Sótano',
      createPlanViews: true,
    },
  },
  commercial: {
    id: 'commercial',
    name: 'Comercial / Corporativo',
    badge: '2S + Lobby + 8P',
    description: '2 Sótanos (-3.20m), Lobby de doble altura (5.00m) y 8 Pisos corporativos (3.80m)',
    config: {
      baseElevation: 0.0,
      basementCount: 2,
      basementHeight: 3.2,
      groundFloorHeight: 5.0,
      groundFloorName: 'Lobby Principal',
      upperFloorCount: 8,
      upperFloorHeight: 3.8,
      namingPattern: 'floor',
      prefixUpper: 'Piso',
      prefixBasement: 'Subsuelo',
      createPlanViews: true,
    },
  },
  house_2lvl: {
    id: 'house_2lvl',
    name: 'Vivienda 2 Niveles',
    badge: 'PB + PA + Techo',
    description: 'Casa unifamiliar: Planta Baja (2.80m), Planta Alta (2.60m) y Cubierta',
    config: {
      baseElevation: 0.0,
      basementCount: 0,
      basementHeight: 0.0,
      groundFloorHeight: 2.8,
      groundFloorName: 'Planta Baja',
      upperFloorCount: 2,
      upperFloorHeight: 2.6,
      namingPattern: 'custom',
      prefixUpper: 'Nivel',
      prefixBasement: 'Sótano',
      createPlanViews: true,
    },
  },
  tower_10: {
    id: 'tower_10',
    name: 'Torre en Altura (10 Pisos)',
    badge: '2S + PB + 10P',
    description: 'Torre urbana: 2 Sótanos (-3.00m), Planta Baja (4.50m) y 10 Pisos de departamentos (3.00m)',
    config: {
      baseElevation: 0.0,
      basementCount: 2,
      basementHeight: 3.0,
      groundFloorHeight: 4.5,
      groundFloorName: 'Planta Baja',
      upperFloorCount: 10,
      upperFloorHeight: 3.0,
      namingPattern: 'floor',
      prefixUpper: 'Piso',
      prefixBasement: 'Sótano',
      createPlanViews: true,
    },
  },
};

export class LevelQuickGenerator {
  /**
   * Genera en lote un array de niveles (LevelElement) calculando cotas exactas,
   * etiquetas, nombres e inicializando elbows si los niveles son muy contiguos.
   */
  public static generate(
    config: QuickGenerateLevelConfig,
    halfExtent: number = 22.0
  ): LevelElement[] {
    const levels: LevelElement[] = [];

    // 1. Sótanos (desde el más profundo hasta el primer sótano bajo tierra)
    if (config.basementCount > 0 && config.basementHeight > 0) {
      for (let b = config.basementCount; b >= 1; b--) {
        const elev = config.baseElevation - b * config.basementHeight;
        const name = `${config.prefixBasement} ${b}`;
        levels.push({
          id: `lvl-sub-${b}`,
          name: `${name} (${this.formatElevation(elev)})`,
          elevation: Number(elev.toFixed(2)),
          start: { x: -halfExtent, z: -halfExtent },
          end: { x: halfExtent, z: halfExtent },
          showStartBubble: true,
          showEndBubble: true,
          isLocked: true,
          hasPlanView: config.createPlanViews,
        });
      }
    }

    // 2. Planta Baja / Nivel Base
    const groundElev = config.baseElevation;
    const groundTitle = config.groundFloorName || 'Nivel 0: Planta Baja';
    levels.push({
      id: 'lvl-0',
      name: `${groundTitle} (${this.formatElevation(groundElev)})`,
      elevation: Number(groundElev.toFixed(2)),
      start: { x: -halfExtent, z: -halfExtent },
      end: { x: halfExtent, z: halfExtent },
      showStartBubble: true,
      showEndBubble: true,
      isLocked: true,
      hasPlanView: config.createPlanViews,
    });

    // 3. Pisos Superiores
    let runningElevation = groundElev + (config.groundFloorHeight || 3.5);
    for (let u = 1; u <= config.upperFloorCount; u++) {
      const isRoof = u === config.upperFloorCount;
      let label = '';

      if (isRoof) {
        label = `Cubierta / Techo (${this.formatElevation(runningElevation)})`;
      } else {
        label = `${config.prefixUpper} ${u} (${this.formatElevation(runningElevation)})`;
      }

      levels.push({
        id: `lvl-${u}`,
        name: label,
        elevation: Number(runningElevation.toFixed(2)),
        start: { x: -halfExtent, z: -halfExtent },
        end: { x: halfExtent, z: halfExtent },
        showStartBubble: true,
        showEndBubble: true,
        isLocked: true,
        hasPlanView: config.createPlanViews,
      });

      runningElevation += config.upperFloorHeight || 3.0;
    }

    // 4. Detección de proximidad para Elbow automático (shoulder break estilo Revit)
    // Si dos niveles consecutivos están a menos de 1.20m, alternar quiebre vertical
    for (let i = 0; i < levels.length - 1; i++) {
      const delta = Math.abs(levels[i + 1].elevation - levels[i].elevation);
      if (delta < 1.20) {
        levels[i].endElbow = {
          active: true,
          verticalOffset: -0.6,
          breakDistance: 3.0,
        };
        levels[i + 1].endElbow = {
          active: true,
          verticalOffset: 0.6,
          breakDistance: 3.0,
        };
      }
    }

    // Ordenar de menor cota a mayor cota
    return levels.sort((a, b) => a.elevation - b.elevation);
  }

  /**
   * Formatea la cota de elevación para visualización CAD (+3.50 m, 0.00 m, -3.00 m)
   */
  public static formatElevation(elevation: number): string {
    const fixed = elevation.toFixed(2);
    if (elevation > 0) return `+${fixed} m`;
    if (elevation === 0 || Math.abs(elevation) < 0.001) return '0.00 m';
    return `${fixed} m`;
  }

  /**
   * Obtiene la plantilla predeterminada por su identificador
   */
  public static getTemplate(templateId: LevelTemplateType): LevelTemplate {
    return LEVEL_TEMPLATES[templateId] || LEVEL_TEMPLATES.residential;
  }
}
