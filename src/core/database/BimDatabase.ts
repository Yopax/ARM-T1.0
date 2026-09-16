import {
  BimCategory,
  BimElementDocument,
  BimGridDocument,
  BimLevelDocument,
  BimTypeParameters,
  ScheduleQueryOptions,
  ScheduleSummary,
} from './BimDatabaseTypes';

export type BimDatabaseChangeListener = (
  action: 'insert' | 'update' | 'delete' | 'clear',
  document?: BimElementDocument | BimGridDocument | BimLevelDocument
) => void;

/**
 * Generador de UUID v4 estándar RFC 4122 para GUIDs únicos mundiales (128-bit)
 */
function generateGuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Base de Datos Relacional Orientada a Objetos para BIM (MongoDB Ready)
 * Centraliza todas las entidades del modelo con asociatividad bidireccional.
 */
export class BimDatabase {
  private static instance: BimDatabase;

  // Secuencia numérica Revit Element ID (inicia en 100000)
  private nextElementId = 100001;

  // Colecciones documentales BSON-like
  private elements = new Map<string, BimElementDocument>(); // Key: uniqueId (GUID)
  private elementIdMap = new Map<number, string>(); // elementId -> uniqueId
  private legacyIdMap = new Map<string, string>(); // legacy id (ej: "COL-001") -> uniqueId

  private grids = new Map<string, BimGridDocument>();
  private levels = new Map<string, BimLevelDocument>();

  // Catálogo de Parámetros de Tipo predefinidos de familias
  private typeCatalog = new Map<string, BimTypeParameters>([
    [
      'ZAP-2.0x2.0',
      {
        typeName: '2.00 × 2.00 × 0.60 m',
        width: 2.0,
        depth: 2.0,
        height: 0.6,
        defaultMaterial: 'Concreto Armado f\'c 210 kg/cm²',
        concreteStrength: 210,
        unitCost: 140, // USD/m³
        structuralRole: 'Cimentación Aislada',
      },
    ],
    [
      'COL-0.4x0.4',
      {
        typeName: '0.40 × 0.40 m',
        width: 0.4,
        depth: 0.4,
        defaultMaterial: 'Concreto Armado f\'c 280 kg/cm²',
        concreteStrength: 280,
        unitCost: 175, // USD/m³
        structuralRole: 'Pilar Estructural',
      },
    ],
    [
      'VIG-0.4x0.55',
      {
        typeName: '0.40 × 0.55 m',
        width: 0.4,
        height: 0.55,
        defaultMaterial: 'Concreto Armado f\'c 280 kg/cm²',
        concreteStrength: 280,
        unitCost: 165, // USD/m³
        structuralRole: 'Viga de Pórtico Sismorresistente',
      },
    ],
    [
      'LOS-0.20',
      {
        typeName: 'Espesor e = 0.20 m',
        thickness: 0.2,
        defaultMaterial: 'Concreto Armado f\'c 210 kg/cm²',
        concreteStrength: 210,
        unitCost: 130, // USD/m³
        structuralRole: 'Losa / Diafragma Rígido',
      },
    ],
  ]);

  private listeners: Set<BimDatabaseChangeListener> = new Set();

  private constructor() {}

  public static getInstance(): BimDatabase {
    if (!BimDatabase.instance) {
      BimDatabase.instance = new BimDatabase();
    }
    return BimDatabase.instance;
  }

  public subscribe(listener: BimDatabaseChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(
    action: 'insert' | 'update' | 'delete' | 'clear',
    doc?: BimElementDocument | BimGridDocument | BimLevelDocument
  ): void {
    this.listeners.forEach((fn) => {
      try {
        fn(action, doc);
      } catch (err) {
        console.error('Error en listener de BimDatabase:', err);
      }
    });
  }

  // ==========================================
  // INSERCIÓN Y CREACIÓN DE ELEMENTOS
  // ==========================================

  /**
   * Crea e inserta un nuevo documento de elemento estructural con IDs duales Revit y MongoDB
   */
  public registerElement(params: {
    legacyId: string;
    category: 'footing' | 'column' | 'beam' | 'slab';
    volume: number;
    levelName: string;
    dimensions: string;
    coordinates?: { x: number; y: number; z: number };
    length?: number;
    height?: number;
    markCode?: string;
  }): BimElementDocument {
    const guid = generateGuid();
    const elementId = this.nextElementId++;

    const categoryMap: Record<
      'footing' | 'column' | 'beam' | 'slab',
      {
        category: BimCategory;
        categoryName: string;
        family: string;
        typeId: string;
        prefix: string;
        ifcEntity: string;
      }
    > = {
      footing: {
        category: 'OST_StructuralFoundation',
        categoryName: 'Cimentación estructural',
        family: 'Zapata Aislada de Concreto',
        typeId: 'ZAP-2.0x2.0',
        prefix: 'Z-',
        ifcEntity: 'IfcFooting',
      },
      column: {
        category: 'OST_StructuralColumns',
        categoryName: 'Pilares estructurales',
        family: 'Columna de Concreto Rectangular',
        typeId: 'COL-0.4x0.4',
        prefix: 'C-',
        ifcEntity: 'IfcColumn',
      },
      beam: {
        category: 'OST_StructuralFraming',
        categoryName: 'Armazón estructural (Vigas)',
        family: 'Viga Peraltada de Concreto',
        typeId: 'VIG-0.4x0.55',
        prefix: 'V-',
        ifcEntity: 'IfcBeam',
      },
      slab: {
        category: 'OST_Floors',
        categoryName: 'Suelos (Losas)',
        family: 'Losa Maciza de Concreto',
        typeId: 'LOS-0.20',
        prefix: 'L-',
        ifcEntity: 'IfcSlab',
      },
    };

    const catInfo = categoryMap[params.category];
    const typeParams = this.typeCatalog.get(catInfo.typeId)!;

    // Cálculo del área de encofrado (superficie de contacto estimada)
    let surfaceArea = 0;
    if (params.category === 'column') {
      const h = params.height || (typeParams.depth && params.volume / (0.4 * 0.4)) || 3.5;
      surfaceArea = 2 * (0.4 + 0.4) * h; // Perímetro * altura
    } else if (params.category === 'beam') {
      const l = params.length || params.volume / (0.4 * 0.55);
      surfaceArea = (0.4 + 2 * 0.55) * l; // Fondo + dos laterales
    } else if (params.category === 'footing') {
      surfaceArea = 4 * 2.0 * 0.6; // 4 caras laterales de la zapata
    } else if (params.category === 'slab') {
      surfaceArea = params.volume / 0.2; // Área de encofrado de fondo
    }

    const markNumber = params.legacyId.split('-')[1] || elementId.toString().slice(-3);
    const mark = params.markCode || `${catInfo.prefix}${parseInt(markNumber, 10)}`;

    const now = new Date().toISOString();
    const doc: BimElementDocument = {
      _id: guid,
      elementId,
      uniqueId: guid,
      category: catInfo.category,
      categoryName: catInfo.categoryName,
      family: catInfo.family,
      familyType: typeParams.typeName,
      typeId: catInfo.typeId,
      levelId: params.levelName,
      levelName: params.levelName,
      typeParameters: { ...typeParams },
      instanceParameters: {
        mark,
        sector: 'Sector A',
        phase: 'Nueva Construcción',
        baseLevel: params.levelName,
        baseOffset: 0.0,
        length: params.length,
        height: params.height,
        volume: Number(params.volume.toFixed(3)),
        surfaceArea: Number(surfaceArea.toFixed(2)),
        concreteStrength: typeParams.concreteStrength,
        estimatedCost: Number((params.volume * typeParams.unitCost).toFixed(2)),
        comments: 'Elemento estructural verificado por motor BIM',
      },
      geometry: {
        origin: params.coordinates || { x: 0, y: 0, z: 0 },
        dimensionsString: params.dimensions,
      },
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
        software: 'Autodesk Revit Compatible BIM Engine v2026',
        ifcEntity: catInfo.ifcEntity,
      },
    };

    this.elements.set(guid, doc);
    this.elementIdMap.set(elementId, guid);
    this.legacyIdMap.set(params.legacyId, guid);

    this.notify('insert', doc);
    return doc;
  }

  // ==========================================
  // BÚSQUEDA Y CONSULTAS TIPO MONGODB
  // ==========================================

  public getByGuid(guid: string): BimElementDocument | undefined {
    return this.elements.get(guid);
  }

  public getByElementId(elementId: number): BimElementDocument | undefined {
    const guid = this.elementIdMap.get(elementId);
    return guid ? this.elements.get(guid) : undefined;
  }

  public getByLegacyId(legacyId: string): BimElementDocument | undefined {
    const guid = this.legacyIdMap.get(legacyId);
    return guid ? this.elements.get(guid) : undefined;
  }

  /**
   * Busca un elemento ya sea por Element ID numérico (ej. 100045) o por GUID completo/parcial
   */
  public searchById(idString: string): BimElementDocument | undefined {
    const trimmed = idString.trim();
    if (!trimmed) return undefined;

    // Probar número entero directo
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && this.elementIdMap.has(num)) {
      return this.getByElementId(num);
    }

    // Probar GUID exacto
    if (this.elements.has(trimmed)) {
      return this.elements.get(trimmed);
    }

    // Probar coincidencia parcial de GUID o legacyId
    for (const [guid, doc] of this.elements.entries()) {
      if (guid.toLowerCase().startsWith(trimmed.toLowerCase())) {
        return doc;
      }
      if (doc.instanceParameters.mark.toLowerCase() === trimmed.toLowerCase()) {
        return doc;
      }
    }

    // Probar por legacyId (COL-001, etc.)
    return this.getByLegacyId(trimmed);
  }

  public getAllElements(): BimElementDocument[] {
    return Array.from(this.elements.values());
  }

  /**
   * Consulta filtrada para Tablas de Planificación (Schedules)
   */
  public querySchedule(options: ScheduleQueryOptions = {}): {
    records: BimElementDocument[];
    summary: ScheduleSummary;
  } {
    let list = Array.from(this.elements.values());

    if (options.category && options.category !== 'ALL') {
      list = list.filter((e) => e.category === options.category);
    }

    if (options.levelName && options.levelName !== 'ALL') {
      list = list.filter((e) => e.levelName === options.levelName);
    }

    if (options.sector && options.sector !== 'ALL') {
      list = list.filter((e) => e.instanceParameters.sector === options.sector);
    }

    if (options.search) {
      const q = options.search.toLowerCase();
      list = list.filter(
        (e) =>
          e.elementId.toString().includes(q) ||
          e.uniqueId.toLowerCase().includes(q) ||
          e.instanceParameters.mark.toLowerCase().includes(q) ||
          e.familyType.toLowerCase().includes(q)
      );
    }

    // Ordenar de manera lógica: por Categoría, luego por Nivel, luego por Element ID
    list.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (a.levelName !== b.levelName) return a.levelName.localeCompare(b.levelName);
      return a.elementId - b.elementId;
    });

    const summary: ScheduleSummary = list.reduce(
      (acc, el) => {
        acc.totalCount += 1;
        acc.totalVolume += el.instanceParameters.volume;
        acc.totalSurfaceArea += el.instanceParameters.surfaceArea;
        acc.totalCost += el.instanceParameters.estimatedCost;
        return acc;
      },
      { totalCount: 0, totalVolume: 0, totalSurfaceArea: 0, totalCost: 0 }
    );

    summary.totalVolume = Number(summary.totalVolume.toFixed(3));
    summary.totalSurfaceArea = Number(summary.totalSurfaceArea.toFixed(2));
    summary.totalCost = Number(summary.totalCost.toFixed(2));

    return { records: list, summary };
  }

  // ==========================================
  // MODIFICACIONES BIDIRECCIONALES
  // ==========================================

  /**
   * Actualiza parámetros de ejemplar de un elemento con sincronización bidireccional
   */
  public updateInstanceParameters(
    guid: string,
    updates: Partial<BimElementDocument['instanceParameters']>
  ): BimElementDocument | undefined {
    const doc = this.elements.get(guid);
    if (!doc) return undefined;

    Object.assign(doc.instanceParameters, updates);

    // Si cambió el volumen, recalcular el costo estimado
    if (updates.volume !== undefined) {
      doc.instanceParameters.estimatedCost = Number(
        (doc.instanceParameters.volume * doc.typeParameters.unitCost).toFixed(2)
      );
    }

    doc.metadata.updatedAt = new Date().toISOString();
    doc.metadata.version += 1;

    this.notify('update', doc);
    return doc;
  }

  public deleteElement(guid: string): boolean {
    const doc = this.elements.get(guid);
    if (!doc) return false;

    this.elements.delete(guid);
    this.elementIdMap.delete(doc.elementId);
    for (const [k, v] of this.legacyIdMap.entries()) {
      if (v === guid) {
        this.legacyIdMap.delete(k);
        break;
      }
    }

    this.notify('delete', doc);
    return true;
  }

  public clearAll(): void {
    this.elements.clear();
    this.elementIdMap.clear();
    this.legacyIdMap.clear();
    this.nextElementId = 100001;
    this.notify('clear');
  }

  // ==========================================
  // REJILLAS Y NIVELES EN LA BD
  // ==========================================

  public registerGrid(grid: {
    id: string;
    name: string;
    geomType: 'line' | 'arc';
    start: { x: number; y: number; z: number };
    end: { x: number; y: number; z: number };
    length: number;
  }): BimGridDocument {
    const guid = generateGuid();
    const elementId = this.nextElementId++;
    const now = new Date().toISOString();

    const doc: BimGridDocument = {
      _id: guid,
      elementId,
      uniqueId: guid,
      category: 'OST_Grids',
      categoryName: 'Rejillas',
      family: 'Rejilla Estándar Circular 6.5mm',
      name: grid.name,
      geomType: grid.geomType,
      start: grid.start,
      end: grid.end,
      length: grid.length,
      metadata: { createdAt: now, updatedAt: now, version: 1 },
    };

    this.grids.set(grid.id, doc);
    return doc;
  }

  public registerLevel(level: {
    id: string;
    name: string;
    elevation: number;
    hasFloorPlan: boolean;
  }): BimLevelDocument {
    const guid = generateGuid();
    const elementId = this.nextElementId++;
    const now = new Date().toISOString();

    const doc: BimLevelDocument = {
      _id: guid,
      elementId,
      uniqueId: guid,
      category: 'OST_Levels',
      categoryName: 'Niveles',
      family: 'Nivel con Cota 8mm',
      name: level.name,
      elevation: level.elevation,
      hasFloorPlan: level.hasFloorPlan,
      metadata: { createdAt: now, updatedAt: now, version: 1 },
    };

    this.levels.set(level.id, doc);
    return doc;
  }

  // ==========================================
  // EXPORTACIÓN Y COMPATIBILIDAD CON MONGODB
  // ==========================================

  /**
   * Genera el dump en JSON BSON-ready listo para `mongoimport` o consumo por MongoDB
   */
  public exportMongoDump(): string {
    const dump = {
      database: 'bim_structural_db',
      exportedAt: new Date().toISOString(),
      version: '2.0.0',
      collections: {
        elements: Array.from(this.elements.values()),
        grids: Array.from(this.grids.values()),
        levels: Array.from(this.levels.values()),
        types: Array.from(this.typeCatalog.entries()).map(([key, value]) => ({
          _id: key,
          ...value,
        })),
      },
      stats: {
        totalElements: this.elements.size,
        totalGrids: this.grids.size,
        totalLevels: this.levels.size,
        totalVolume: Number(
          Array.from(this.elements.values())
            .reduce((sum, e) => sum + e.instanceParameters.volume, 0)
            .toFixed(3)
        ),
      },
    };

    return JSON.stringify(dump, null, 2);
  }

  /**
   * Genera archivo CSV para presupuestos, compatibilidad con Excel / Cost-It / Presto
   */
  public exportScheduleCsv(category: BimCategory | 'ALL' = 'ALL'): string {
    const { records } = this.querySchedule({ category });
    const headers = [
      'Element ID',
      'UniqueId (GUID)',
      'Categoría',
      'Familia',
      'Tipo',
      'Código / Marca',
      'Nivel',
      'Sector',
      'Fase',
      'Volumen (m3)',
      'Encofrado (m2)',
      'f\'c (kg/cm2)',
      'Costo Est. ($)',
    ];

    const rows = records.map((r) => [
      r.elementId,
      r.uniqueId,
      `"${r.categoryName}"`,
      `"${r.family}"`,
      `"${r.familyType}"`,
      `"${r.instanceParameters.mark}"`,
      `"${r.levelName}"`,
      `"${r.instanceParameters.sector}"`,
      `"${r.instanceParameters.phase}"`,
      r.instanceParameters.volume.toFixed(3),
      r.instanceParameters.surfaceArea.toFixed(2),
      r.instanceParameters.concreteStrength,
      r.instanceParameters.estimatedCost.toFixed(2),
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }
}
