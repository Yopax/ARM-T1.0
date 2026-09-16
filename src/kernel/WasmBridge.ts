import * as THREE from 'three';
import { THEME, VisualStyle } from '../config/theme.config';

export interface MeshData {
  geometry: THREE.BufferGeometry;
  volume: number;
}

function createBoxGeometry(
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number
): THREE.BufferGeometry {
  const width = Math.max(0.001, maxX - minX);
  const height = Math.max(0.001, maxY - minY);
  const depth = Math.max(0.001, maxZ - minZ);
  const geom = new THREE.BoxGeometry(width, height, depth);
  geom.translate(minX + width / 2, minY + height / 2, minZ + depth / 2);
  return geom;
}

export class WasmBridge {
  private ready = false;

  // 1. MATERIAL LÍNEA OCULTA (Revit Hidden Line): Blanco puro opaco en AMBAS caras para tapar aristas traseras
  public hiddenLineMaterial = new THREE.MeshBasicMaterial({ 
    color: THEME.styles.hidden_line.surface,
    side: THREE.DoubleSide, // CLAVE: Dibuja la cara frontal y ocluye las aristas de atrás
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });

  // 2. MATERIAL ALÁMBRICO (Revit Wireframe)
  public wireframeMaterial = new THREE.MeshBasicMaterial({ 
    colorWrite: false, 
    depthWrite: false 
  });

  // 3. MATERIALES COLORES COHERENTES (Revit Consistent Colors)
  public consistentMaterials = {
    footing: new THREE.MeshBasicMaterial({ color: THEME.elements.footing.surface, side: THREE.DoubleSide }),
    column:  new THREE.MeshBasicMaterial({ color: THEME.elements.column.surface, side: THREE.DoubleSide }),
    beam:    new THREE.MeshBasicMaterial({ color: THEME.elements.beam.surface, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    slab:    new THREE.MeshBasicMaterial({ color: THEME.elements.slab.surface, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  };

  // 4. MATERIALES SOMBREADOS (Revit Shaded - PBR con sombras)
  public shadedMaterials = {
    footing: new THREE.MeshStandardMaterial({ color: THEME.elements.footing.surface, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide }),
    column:  new THREE.MeshStandardMaterial({ color: THEME.elements.column.surface, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide }),
    beam:    new THREE.MeshStandardMaterial({ color: THEME.elements.beam.surface, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    slab:    new THREE.MeshStandardMaterial({ color: THEME.elements.slab.surface, roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  };

  public async init(): Promise<void> {
    this.ready = true;
    console.log('[Kernel] Motor de cálculo estructural inicializado.');
  }

  public isReady(): boolean {
    return this.ready;
  }

  public getMaterial(type: 'footing' | 'column' | 'beam' | 'slab', style: VisualStyle): THREE.Material {
    switch (style) {
      case 'hidden_line':
        return this.hiddenLineMaterial;
      case 'wireframe':
        return this.wireframeMaterial;
      case 'consistent_colors':
        return this.consistentMaterials[type];
      case 'shaded':
      default:
        return this.shadedMaterials[type];
    }
  }

  public buildGeometry(meshData: MeshData): THREE.BufferGeometry {
    return meshData.geometry;
  }

  public createFooting(x: number, y: number, z: number, w: number, l: number, h: number): MeshData {
    const minX = x - w / 2;
    const maxX = x + w / 2;
    const minY = y;
    const maxY = y + h;
    const minZ = z - l / 2;
    const maxZ = z + l / 2;
    const geometry = createBoxGeometry(minX, minY, minZ, maxX, maxY, maxZ);
    const volume = w * l * h;
    return { geometry, volume };
  }

  public createColumn(x: number, z: number, y0: number, y1: number, w: number, d: number): MeshData {
    const minX = x - w / 2;
    const maxX = x + w / 2;
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    const minZ = z - d / 2;
    const maxZ = z + d / 2;
    const height = Math.max(0.001, maxY - minY);
    const geometry = createBoxGeometry(minX, minY, minZ, maxX, maxY, maxZ);
    const volume = w * d * height;
    return { geometry, volume };
  }

  public createBeam(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, w: number, h: number): MeshData {
    const minY = Math.min(y1, y2) - h;
    const maxY = Math.max(y1, y2);
    const dx = Math.abs(x2 - x1);
    const dz = Math.abs(z2 - z1);

    let minX: number;
    let maxX: number;
    let minZ: number;
    let maxZ: number;
    let length: number;

    if (dx >= dz) {
      minX = Math.min(x1, x2);
      maxX = Math.max(x1, x2);
      const midZ = (z1 + z2) / 2;
      minZ = midZ - w / 2;
      maxZ = midZ + w / 2;
      length = Math.max(0.001, maxX - minX);
    } else {
      const midX = (x1 + x2) / 2;
      minX = midX - w / 2;
      maxX = midX + w / 2;
      minZ = Math.min(z1, z2);
      maxZ = Math.max(z1, z2);
      length = Math.max(0.001, maxZ - minZ);
    }

    const geometry = createBoxGeometry(minX, minY, minZ, maxX, maxY, maxZ);
    const volume = length * w * h;
    return { geometry, volume };
  }

  public createSlab(cx: number, cy: number, cz: number, wx: number, lz: number, th: number): MeshData {
    const minX = cx - wx / 2;
    const maxX = cx + wx / 2;
    const minY = cy;
    const maxY = cy + th;
    const minZ = cz - lz / 2;
    const maxZ = cz + lz / 2;
    const geometry = createBoxGeometry(minX, minY, minZ, maxX, maxY, maxZ);
    const volume = wx * lz * th;
    return { geometry, volume };
  }
}
