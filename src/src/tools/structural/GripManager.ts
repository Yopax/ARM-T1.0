import * as THREE from 'three';
import { ManagedElement, StructuralDefinition, Vector3D, ColumnDefinition, BeamDefinition, SlabDefinition, FootingDefinition } from './types';
import { WasmBridge } from '../../kernel/WasmBridge';
import { ElementFactory } from './ElementFactory';
import { BimDatabase } from '../../core/database/BimDatabase';
import { BimView } from '../../core/views/BimView';
import { VisualStyle } from '../../config/theme.config';

export interface GripHandleData {
  elementId: string;
  gripType: 'linear_start' | 'linear_end' | 'col_top' | 'col_base' | 'slab_vertex' | 'slab_edge_mid' | 'void_vertex';
  index?: number;
  originalPoint: Vector3D;
  edgeStartIndex?: number;
  edgeEndIndex?: number;
  voidIndex?: number;
}

export class GripManager {
  public gripsGroup = new THREE.Group();
  public activeGrip: THREE.Mesh | null = null;
  public isDragging = false;

  private currentElement: ManagedElement | null = null;
  private gripMeshes: THREE.Mesh[] = [];
  private initialDefinition: StructuralDefinition | null = null;
  private floatingBadge: HTMLElement | null = null;
  private dragPlane = new THREE.Plane();
  private raycaster = new THREE.Raycaster();

  constructor(
    private scene: THREE.Scene,
    private wasm: WasmBridge,
    private factory: ElementFactory,
    private activeViewGetter: () => BimView,
    private onElementModified: (element: ManagedElement) => void,
    private currentStyleGetter: () => VisualStyle
  ) {
    this.gripsGroup.name = 'structural-grips-group';
    this.scene.add(this.gripsGroup);
    this.createFloatingBadge();
  }

  private createFloatingBadge(): void {
    const existing = document.getElementById('bim-floating-dimension-badge');
    if (existing) existing.remove();

    this.floatingBadge = document.createElement('div');
    this.floatingBadge.id = 'bim-floating-dimension-badge';
    this.floatingBadge.className =
      'hidden fixed pointer-events-none z-50 bg-slate-950/90 text-sky-300 font-mono text-[11px] font-bold px-2 py-0.5 rounded shadow-lg border border-sky-400/60 backdrop-blur-xs select-none -translate-x-1/2 -translate-y-full mb-2 whitespace-nowrap transition-transform duration-75';
    document.body.appendChild(this.floatingBadge);
  }

  /**
   * Garantiza que cualquier elemento seleccionado posea una definición paramétrica 3D completa.
   */
  public ensureDefinition(element: ManagedElement): StructuralDefinition {
    if (element.definition) return element.definition;

    element.mesh.geometry.computeBoundingBox();
    const bb = element.mesh.geometry.boundingBox || new THREE.Box3();
    const min = bb.min;
    const max = bb.max;

    if (element.type === 'column') {
      const centerX = (min.x + max.x) / 2;
      const centerZ = (min.z + max.z) / 2;
      const width = Math.max(0.2, max.x - min.x);
      const depth = Math.max(0.2, max.z - min.z);
      const def: ColumnDefinition = {
        type: 'column',
        columnStyle: 'vertical',
        basePoint: { x: centerX, y: min.y, z: centerZ },
        topPoint: { x: centerX, y: max.y, z: centerZ },
        width,
        depth,
      };
      element.definition = def;
      return def;
    }

    if (element.type === 'beam') {
      const dx = max.x - min.x;
      const dz = max.z - min.z;
      const height = Math.max(0.2, max.y - min.y);
      let def: BeamDefinition;

      if (dx >= dz) {
        const midZ = (min.z + max.z) / 2;
        const width = Math.max(0.2, dz);
        def = {
          type: 'beam',
          startPoint: { x: min.x, y: max.y, z: midZ },
          endPoint: { x: max.x, y: max.y, z: midZ },
          width,
          height,
        };
      } else {
        const midX = (min.x + max.x) / 2;
        const width = Math.max(0.2, dx);
        def = {
          type: 'beam',
          startPoint: { x: midX, y: max.y, z: min.z },
          endPoint: { x: midX, y: max.y, z: max.z },
          width,
          height,
        };
      }
      element.definition = def;
      return def;
    }

    if (element.type === 'slab') {
      const thickness = Math.max(0.1, max.y - min.y);
      const elevY = min.y;
      const boundary: Vector3D[] = [
        { x: min.x, y: elevY, z: min.z },
        { x: max.x, y: elevY, z: min.z },
        { x: max.x, y: elevY, z: max.z },
        { x: min.x, y: elevY, z: max.z },
      ];
      const def: SlabDefinition = {
        type: 'slab',
        boundary,
        thickness,
        elevationY: elevY,
      };
      element.definition = def;
      return def;
    }

    // Footing
    const w = Math.max(0.5, max.x - min.x);
    const l = Math.max(0.5, max.z - min.z);
    const h = Math.max(0.2, max.y - min.y);
    const center: Vector3D = {
      x: (min.x + max.x) / 2,
      y: min.y,
      z: (min.z + max.z) / 2,
    };
    const def: FootingDefinition = {
      type: 'footing',
      center,
      width: w,
      length: l,
      height: h,
    };
    element.definition = def;
    return def;
  }

  /**
   * Actualiza y dibuja los grips para el elemento seleccionado
   */
  public updateGripsForElement(element: ManagedElement | null): void {
    this.clearGrips();
    if (!element) {
      this.currentElement = null;
      return;
    }

    this.currentElement = element;
    const def = this.ensureDefinition(element);

    if (def.type === 'beam') {
      this.addLinearGrip(element.id, 'linear_start', def.startPoint, 0);
      this.addLinearGrip(element.id, 'linear_end', def.endPoint, 1);
    } else if (def.type === 'column') {
      if (def.columnStyle === 'slanted') {
        this.addLinearGrip(element.id, 'col_base', def.basePoint, 0);
        this.addLinearGrip(element.id, 'col_top', def.topPoint, 1);
      } else {
        this.addColumnHeightGrip(element.id, 'col_base', def.basePoint);
        this.addColumnHeightGrip(element.id, 'col_top', def.topPoint);
      }
    } else if (def.type === 'slab') {
      // 1. Vértices del contorno exterior
      def.boundary.forEach((pt, idx) => {
        this.addVertexGrip(element.id, 'slab_vertex', pt, idx);
      });
      // 2. Puntos medios de los bordes para desplazamiento de aristas completas
      for (let i = 0; i < def.boundary.length; i++) {
        const j = (i + 1) % def.boundary.length;
        const mid: Vector3D = {
          x: (def.boundary[i].x + def.boundary[j].x) / 2,
          y: (def.boundary[i].y + def.boundary[j].y) / 2,
          z: (def.boundary[i].z + def.boundary[j].z) / 2,
        };
        this.addEdgeMidGrip(element.id, mid, i, j);
      }
      // 3. Vértices de huecos interiores (voids/shafts)
      if (def.voids) {
        def.voids.forEach((vPoly, vIdx) => {
          vPoly.forEach((vPt, pIdx) => {
            this.addVoidVertexGrip(element.id, vPt, vIdx, pIdx);
          });
        });
      }
    } else if (def.type === 'footing') {
      // Grips perimetrales para zapatas
      const halfW = def.width / 2;
      const halfL = def.length / 2;
      const corners: Vector3D[] = [
        { x: def.center.x - halfW, y: def.center.y, z: def.center.z - halfL },
        { x: def.center.x + halfW, y: def.center.y, z: def.center.z - halfL },
        { x: def.center.x + halfW, y: def.center.y, z: def.center.z + halfL },
        { x: def.center.x - halfW, y: def.center.y, z: def.center.z + halfL },
      ];
      corners.forEach((c, idx) => {
        this.addVertexGrip(element.id, 'slab_vertex', c, idx);
      });
    }
  }

  private addLinearGrip(
    elementId: string,
    role: 'linear_start' | 'linear_end' | 'col_base' | 'col_top',
    pos: Vector3D,
    index: number
  ): void {
    const geo = new THREE.SphereGeometry(0.18, 16, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.renderOrder = 10000;

    // Núcleo central blanco brillante para máximo contraste
    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false })
    );
    inner.renderOrder = 10001;
    mesh.add(inner);

    mesh.userData = {
      elementId,
      gripType: role,
      index,
      originalPoint: { ...pos },
    } as GripHandleData;

    this.gripMeshes.push(mesh);
    this.gripsGroup.add(mesh);
  }

  private addColumnHeightGrip(
    elementId: string,
    role: 'col_base' | 'col_top',
    pos: Vector3D
  ): void {
    const isTop = role === 'col_top';
    const geo = new THREE.ConeGeometry(0.18, 0.32, 16);
    if (!isTop) {
      geo.rotateX(Math.PI);
    }
    const mat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + (isTop ? 0.16 : -0.16), pos.z);
    mesh.renderOrder = 10000;

    mesh.userData = {
      elementId,
      gripType: role,
      originalPoint: { ...pos },
    } as GripHandleData;

    this.gripMeshes.push(mesh);
    this.gripsGroup.add(mesh);
  }

  private addVertexGrip(
    elementId: string,
    type: 'slab_vertex',
    pos: Vector3D,
    index: number
  ): void {
    const geo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + 0.12, pos.z);
    mesh.renderOrder = 10000;

    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false })
    );
    outline.renderOrder = 10001;
    mesh.add(outline);

    mesh.userData = {
      elementId,
      gripType: type,
      index,
      originalPoint: { ...pos },
    } as GripHandleData;

    this.gripMeshes.push(mesh);
    this.gripsGroup.add(mesh);
  }

  private addEdgeMidGrip(
    elementId: string,
    pos: Vector3D,
    startIndex: number,
    endIndex: number
  ): void {
    const geo = new THREE.OctahedronGeometry(0.16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + 0.1, pos.z);
    mesh.renderOrder = 10000;

    mesh.userData = {
      elementId,
      gripType: 'slab_edge_mid',
      edgeStartIndex: startIndex,
      edgeEndIndex: endIndex,
      originalPoint: { ...pos },
    } as GripHandleData;

    this.gripMeshes.push(mesh);
    this.gripsGroup.add(mesh);
  }

  private addVoidVertexGrip(
    elementId: string,
    pos: Vector3D,
    voidIndex: number,
    pointIndex: number
  ): void {
    const geo = new THREE.SphereGeometry(0.15, 12, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + 0.1, pos.z);
    mesh.renderOrder = 10000;

    mesh.userData = {
      elementId,
      gripType: 'void_vertex',
      voidIndex,
      index: pointIndex,
      originalPoint: { ...pos },
    } as GripHandleData;

    this.gripMeshes.push(mesh);
    this.gripsGroup.add(mesh);
  }

  public clearGrips(): void {
    while (this.gripsGroup.children.length > 0) {
      const obj = this.gripsGroup.children[0];
      this.gripsGroup.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else (obj.material as THREE.Material).dispose();
      }
    }
    this.gripMeshes = [];
    this.activeGrip = null;
    this.isDragging = false;
    this.hideFloatingBadge();
  }

  public getGripMeshes(): THREE.Mesh[] {
    return this.gripMeshes;
  }

  /**
   * Detección de puntero sobre un grip
   */
  public testPointerIntersection(e: MouseEvent): THREE.Mesh | null {
    if (this.gripMeshes.length === 0) return null;

    const activeView = this.activeViewGetter();
    const rect = activeView.domElement.getBoundingClientRect();
    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom
    ) {
      return null;
    }

    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(mouse, activeView.camera);

    const hits = this.raycaster.intersectObjects(this.gripMeshes, true);
    if (hits.length > 0) {
      const topObj = hits[0].object;
      const gripMesh = (topObj.parent && topObj.parent instanceof THREE.Mesh && topObj.parent.userData?.gripType)
        ? topObj.parent
        : (topObj instanceof THREE.Mesh ? topObj : null);
      return gripMesh;
    }
    return null;
  }

  /**
   * Inicia el arrastre interactivo de un grip
   */
  public startDrag(gripMesh: THREE.Mesh, e: MouseEvent): boolean {
    if (!this.currentElement || !this.currentElement.definition) return false;

    this.activeGrip = gripMesh;
    this.isDragging = true;
    this.initialDefinition = JSON.parse(JSON.stringify(this.currentElement.definition));

    const activeView = this.activeViewGetter();
    const gripData = gripMesh.userData as GripHandleData;

    // Configurar el plano de arrastre 3D
    if (this.currentElement.type === 'column' && (gripData.gripType === 'col_top' || gripData.gripType === 'col_base')) {
      // Para columnas verticales, arrastrar en plano vertical orientado hacia la cámara
      const camDir = new THREE.Vector3();
      activeView.camera.getWorldDirection(camDir);
      camDir.y = 0;
      if (camDir.lengthSq() < 0.001) camDir.set(0, 0, -1);
      camDir.normalize();
      this.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), gripMesh.position);
    } else {
      // Para vigas, losas y zapatas, plano horizontal en la elevación del grip
      this.dragPlane.set(new THREE.Vector3(0, 1, 0), -gripMesh.position.y);
    }

    this.showFloatingBadge(e.clientX, e.clientY, 'Ajustando...');
    return true;
  }

  /**
   * Actualiza el arrastre en tiempo real recalculando geometría con Snapping
   */
  public updateDrag(
    e: MouseEvent,
    gridCoordsX: number[],
    gridCoordsZ: number[],
    levelsY: number[]
  ): void {
    if (!this.isDragging || !this.activeGrip || !this.currentElement || !this.initialDefinition) return;

    const activeView = this.activeViewGetter();
    const rect = activeView.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(mouse, activeView.camera);

    const hitPoint = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, hitPoint)) return;

    // 1. Snapping inteligente
    let snappedX = hitPoint.x;
    let snappedY = hitPoint.y;
    let snappedZ = hitPoint.z;

    const SNAP_DIST = 0.35;

    // Snap a rejillas en X y Z
    if (gridCoordsX.length > 0) {
      const nearX = gridCoordsX.reduce((p, c) => (Math.abs(c - hitPoint.x) < Math.abs(p - hitPoint.x) ? c : p));
      if (Math.abs(nearX - hitPoint.x) < SNAP_DIST) snappedX = nearX;
      else snappedX = Math.round(snappedX * 20) / 20; // Snap fino a 5cm
    } else {
      snappedX = Math.round(snappedX * 10) / 10;
    }

    if (gridCoordsZ.length > 0) {
      const nearZ = gridCoordsZ.reduce((p, c) => (Math.abs(c - hitPoint.z) < Math.abs(p - hitPoint.z) ? c : p));
      if (Math.abs(nearZ - hitPoint.z) < SNAP_DIST) snappedZ = nearZ;
      else snappedZ = Math.round(snappedZ * 20) / 20;
    } else {
      snappedZ = Math.round(snappedZ * 10) / 10;
    }

    // Snap a niveles en Y
    if (levelsY && levelsY.length > 0) {
      const nearY = levelsY.reduce((p, c) => (Math.abs(c - hitPoint.y) < Math.abs(p - hitPoint.y) ? c : p));
      if (Math.abs(nearY - hitPoint.y) < SNAP_DIST) snappedY = nearY;
      else snappedY = Math.round(snappedY * 20) / 20;
    }

    const gripData = this.activeGrip.userData as GripHandleData;
    const def = this.currentElement.definition!;
    let badgeText = '';

    // ==========================================
    // A. VIGAS LINEALES
    // ==========================================
    if (def.type === 'beam') {
      if (gripData.gripType === 'linear_start') {
        def.startPoint = { x: snappedX, y: snappedY, z: snappedZ };
      } else if (gripData.gripType === 'linear_end') {
        def.endPoint = { x: snappedX, y: snappedY, z: snappedZ };
      }

      const p1 = new THREE.Vector3(def.startPoint.x, def.startPoint.y, def.startPoint.z);
      const p2 = new THREE.Vector3(def.endPoint.x, def.endPoint.y, def.endPoint.z);
      const newLen = p1.distanceTo(p2);
      badgeText = `Longitud L: ${newLen.toFixed(2)} m`;

      // Reconstruir geometría interactiva de viga
      const meshData = this.wasm.createArbitraryBeam(def.startPoint, def.endPoint, def.width, def.height);
      this.applyLiveGeometry(meshData.geometry);
      def.height = def.height;
    }

    // ==========================================
    // B. COLUMNAS
    // ==========================================
    else if (def.type === 'column') {
      if (def.columnStyle === 'slanted') {
        if (gripData.gripType === 'col_base') {
          def.basePoint = { x: snappedX, y: snappedY, z: snappedZ };
        } else if (gripData.gripType === 'col_top') {
          def.topPoint = { x: snappedX, y: snappedY, z: snappedZ };
        }
        const p1 = new THREE.Vector3(def.basePoint.x, def.basePoint.y, def.basePoint.z);
        const p2 = new THREE.Vector3(def.topPoint.x, def.topPoint.y, def.topPoint.z);
        badgeText = `Longitud Inclinada: ${p1.distanceTo(p2).toFixed(2)} m (ΔY: ${(p2.y - p1.y).toFixed(2)}m)`;
        const meshData = this.wasm.createSlantedColumn(def.basePoint, def.topPoint, def.width, def.depth);
        this.applyLiveGeometry(meshData.geometry);
      } else {
        // Vertical pura
        if (gripData.gripType === 'col_top') {
          def.topPoint.y = Math.max(def.basePoint.y + 0.5, snappedY);
          const h = def.topPoint.y - def.basePoint.y;
          badgeText = `Altura h: ${h.toFixed(2)} m (Cota Sup: ${def.topPoint.y >= 0 ? '+' : ''}${def.topPoint.y.toFixed(2)}m)`;
        } else if (gripData.gripType === 'col_base') {
          def.basePoint.y = Math.min(def.topPoint.y - 0.5, snappedY);
          const h = def.topPoint.y - def.basePoint.y;
          badgeText = `Altura h: ${h.toFixed(2)} m (Cota Base: ${def.basePoint.y >= 0 ? '+' : ''}${def.basePoint.y.toFixed(2)}m)`;
        }
        const meshData = this.wasm.createColumn(
          def.basePoint.x,
          def.basePoint.z,
          def.basePoint.y,
          def.topPoint.y,
          def.width,
          def.depth
        );
        this.applyLiveGeometry(meshData.geometry);
      }
    }

    // ==========================================
    // C. LOSAS / SUELOS
    // ==========================================
    else if (def.type === 'slab') {
      if (gripData.gripType === 'slab_vertex' && gripData.index !== undefined) {
        def.boundary[gripData.index] = { x: snappedX, y: def.elevationY, z: snappedZ };
        badgeText = `Vértice ${gripData.index + 1}: (${snappedX.toFixed(2)}m, ${snappedZ.toFixed(2)}m)`;
      } else if (gripData.gripType === 'slab_edge_mid' && gripData.edgeStartIndex !== undefined && gripData.edgeEndIndex !== undefined) {
        const i = gripData.edgeStartIndex;
        const j = gripData.edgeEndIndex;
        const initialMid = gripData.originalPoint;
        const deltaX = snappedX - initialMid.x;
        const deltaZ = snappedZ - initialMid.z;

        const initDef = this.initialDefinition as SlabDefinition;
        def.boundary[i] = {
          x: initDef.boundary[i].x + deltaX,
          y: def.elevationY,
          z: initDef.boundary[i].z + deltaZ,
        };
        def.boundary[j] = {
          x: initDef.boundary[j].x + deltaX,
          y: def.elevationY,
          z: initDef.boundary[j].z + deltaZ,
        };
        badgeText = `Desfase de Arista: ΔX=${deltaX >= 0 ? '+' : ''}${deltaX.toFixed(2)}m, ΔZ=${deltaZ >= 0 ? '+' : ''}${deltaZ.toFixed(2)}m`;
      } else if (gripData.gripType === 'void_vertex' && gripData.voidIndex !== undefined && gripData.index !== undefined && def.voids) {
        def.voids[gripData.voidIndex][gripData.index] = { x: snappedX, y: def.elevationY, z: snappedZ };
        badgeText = `Hueco Interior - Vértice ${gripData.index + 1}`;
      }

      const meshData = this.wasm.createPolygonSlab(def.boundary, def.voids, def.thickness, def.elevationY);
      this.applyLiveGeometry(meshData.geometry);
    }

    // ==========================================
    // D. ZAPATAS
    // ==========================================
    else if (def.type === 'footing') {
      const idx = gripData.index || 0;
      const halfW = Math.max(0.5, Math.abs(snappedX - def.center.x));
      const halfL = Math.max(0.5, Math.abs(snappedZ - def.center.z));
      def.width = halfW * 2;
      def.length = halfL * 2;
      badgeText = `Cimentación: ${def.width.toFixed(2)}m × ${def.length.toFixed(2)}m`;
      const meshData = this.wasm.createFooting(
        def.center.x,
        def.center.y,
        def.center.z,
        def.width,
        def.length,
        def.height
      );
      this.applyLiveGeometry(meshData.geometry);
    }

    // Mover posición visual del grip activo
    this.activeGrip.position.set(snappedX, snappedY + (this.currentElement.type === 'column' ? 0.16 : 0.05), snappedZ);
    this.showFloatingBadge(e.clientX, e.clientY, badgeText);
  }

  private applyLiveGeometry(newGeom: THREE.BufferGeometry): void {
    if (!this.currentElement) return;

    this.currentElement.mesh.geometry.dispose();
    this.currentElement.mesh.geometry = newGeom;

    // Actualizar aristas nítidas CAD
    this.currentElement.line.geometry.dispose();
    this.currentElement.line.geometry = new THREE.EdgesGeometry(newGeom, 20);

    this.currentElement.mesh.updateMatrixWorld(true);
  }

  /**
   * Finaliza el arrastre y consolida el elemento en la base de datos BIM
   */
  public endDrag(): void {
    if (!this.isDragging || !this.currentElement || !this.currentElement.definition) {
      this.clearGrips();
      return;
    }

    const element = this.currentElement;
    const def = element.definition!;
    const style = this.currentStyleGetter();

    let newVolume = 0;
    let newDims = '';

    if (def.type === 'beam') {
      const p1 = new THREE.Vector3(def.startPoint.x, def.startPoint.y, def.startPoint.z);
      const p2 = new THREE.Vector3(def.endPoint.x, def.endPoint.y, def.endPoint.z);
      const length = p1.distanceTo(p2);
      newVolume = length * def.width * def.height;
      newDims = `${def.width.toFixed(2)}m × ${def.height.toFixed(2)}m (L=${length.toFixed(2)}m)`;
      element.volume = newVolume;
      element.dimensions = newDims;
    } else if (def.type === 'column') {
      const p1 = new THREE.Vector3(def.basePoint.x, def.basePoint.y, def.basePoint.z);
      const p2 = new THREE.Vector3(def.topPoint.x, def.topPoint.y, def.topPoint.z);
      const h = p1.distanceTo(p2);
      newVolume = def.width * def.depth * h;
      newDims = `${def.width.toFixed(2)}m × ${def.depth.toFixed(2)}m (${def.columnStyle === 'slanted' ? 'Inclinada L' : 'h'}=${h.toFixed(2)}m)`;
      element.volume = newVolume;
      element.dimensions = newDims;
    } else if (def.type === 'slab') {
      const meshData = this.wasm.createPolygonSlab(def.boundary, def.voids, def.thickness, def.elevationY);
      newVolume = meshData.volume;
      newDims = `Losa Perimetral N=${def.boundary.length} (e=${def.thickness.toFixed(2)}m)`;
      element.volume = newVolume;
      element.dimensions = newDims;
    } else if (def.type === 'footing') {
      newVolume = def.width * def.length * def.height;
      newDims = `${def.width.toFixed(2)}m × ${def.length.toFixed(2)}m × ${def.height.toFixed(2)}m`;
      element.volume = newVolume;
      element.dimensions = newDims;
    }

    // Actualizar registro en MongoDB / BimDatabase
    if (element.uniqueId) {
      BimDatabase.getInstance().updateInstanceParameters(element.uniqueId, {
        volume: newVolume,
        comments: `Editado por manipulador directo (Grip). ${newDims}`,
      });
    }

    this.isDragging = false;
    this.activeGrip = null;
    this.initialDefinition = null;
    this.hideFloatingBadge();

    // Re-posicionar todos los grips con la geometría consolidada
    this.updateGripsForElement(element);
    this.onElementModified(element);
  }

  private showFloatingBadge(clientX: number, clientY: number, text: string): void {
    if (!this.floatingBadge) return;
    this.floatingBadge.textContent = text;
    this.floatingBadge.style.left = `${clientX + 16}px`;
    this.floatingBadge.style.top = `${clientY - 24}px`;
    this.floatingBadge.classList.remove('hidden');
  }

  private hideFloatingBadge(): void {
    if (!this.floatingBadge) return;
    this.floatingBadge.classList.add('hidden');
  }
}
