import * as THREE from 'three';
import { ManagedElement } from '../tools/structural/types';
import { ElementRegistry } from '../tools/structural/ElementRegistry';
import { BimView } from '../core/views/BimView';

export class SelectionManager {
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  public selectedElement: ManagedElement | null = null;
  public hoveredElement: ManagedElement | null = null;

  private selectionBox: THREE.BoxHelper | null = null;
  private hoverBox: THREE.BoxHelper | null = null;

  constructor(
    private scene: THREE.Scene,
    private activeViewGetter: () => BimView,
    private registry: ElementRegistry,
    private onSelectionChanged: (element: ManagedElement | null) => void
  ) {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.clearSelection();
        this.clearHover();
      }
    });
  }

  private updateRaycaster(event: MouseEvent): boolean {
    const activeView = this.activeViewGetter();
    const rect = activeView.domElement.getBoundingClientRect();

    if (
      event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom
    ) {
      return false;
    }

    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, activeView.camera);
    return true;
  }

  public handlePointerMove(event: MouseEvent): void {
    if (this.isOverUI(event) || !this.updateRaycaster(event)) {
      this.clearHover();
      return;
    }

    const meshes = this.registry.getMeshes();
    const intersects = this.raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as THREE.Mesh;
      const element = this.registry.findByMesh(hitMesh);

      if (element) {
        if (this.selectedElement === element) {
          this.clearHover();
          document.body.style.cursor = 'pointer';
          return;
        }

        if (this.hoveredElement !== element) {
          this.hoveredElement = element;
          this.updateHoverHighlight(element.mesh);
        }
        document.body.style.cursor = 'pointer';
        return;
      }
    }

    this.clearHover();
  }

  public handlePointerClick(event: MouseEvent): boolean {
    if (this.isOverUI(event) || !this.updateRaycaster(event)) return false;

    const meshes = this.registry.getMeshes();
    const intersects = this.raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as THREE.Mesh;
      const element = this.registry.findByMesh(hitMesh);
      if (element) {
        this.clearHover();
        this.select(element);
        return true;
      }
    }

    return false;
  }

  public select(element: ManagedElement): void {
    this.clearHover();
    this.selectedElement = element;
    this.updateSelectionHighlight(element.mesh);
    this.onSelectionChanged(element);
  }

  public clearSelection(): void {
    if (this.selectionBox) {
      this.scene.remove(this.selectionBox);
      this.selectionBox.geometry.dispose();
      this.selectionBox = null;
    }
    this.selectedElement = null;
    this.onSelectionChanged(null);
  }

  public clearHover(): void {
    if (this.hoverBox) {
      this.scene.remove(this.hoverBox);
      this.hoverBox.geometry.dispose();
      this.hoverBox = null;
    }
    if (this.hoveredElement) {
      this.hoveredElement = null;
      document.body.style.cursor = 'default';
    }
  }

  private updateHoverHighlight(mesh: THREE.Mesh): void {
    if (this.hoverBox) {
      this.scene.remove(this.hoverBox);
      this.hoverBox.geometry.dispose();
    }
    this.hoverBox = new THREE.BoxHelper(mesh, 0x38bdf8);
    const mat = this.hoverBox.material as THREE.LineBasicMaterial;
    mat.depthTest = false;
    this.hoverBox.renderOrder = 998;
    this.scene.add(this.hoverBox);
  }

  private updateSelectionHighlight(mesh: THREE.Mesh): void {
    if (this.selectionBox) {
      this.scene.remove(this.selectionBox);
      this.selectionBox.geometry.dispose();
    }
    this.selectionBox = new THREE.BoxHelper(mesh, 0x0284c7);
    const mat = this.selectionBox.material as THREE.LineBasicMaterial;
    mat.depthTest = false;
    this.selectionBox.renderOrder = 999;
    this.scene.add(this.selectionBox);
  }

  private isOverUI(event: MouseEvent): boolean {
    const target = event.target as HTMLElement;
    return !!(
      target.closest('#app-header') ||
      target.closest('#app-sidebar') ||
      target.closest('#view-tabs-bar') ||
      target.closest('.view-panel-header') ||
      target.closest('#app-footer')
    );
  }
}