import * as THREE from 'three';
import { BimView } from './BimView';

export type SplitLayout = 'single' | 'split-v' | 'split-h' | 'grid-4';

export class ViewManager {
  private views = new Map<string, BimView>();
  public activeViewId = 'view-3d';
  public layoutMode: SplitLayout = 'single';
  private container: HTMLElement;
  private rendererDom: HTMLElement;

  private onActiveViewChanged?: (view: BimView) => void;
  private onTabsUpdated?: (views: BimView[], activeId: string) => void;
  public onBeforeRenderView?: (view: BimView, scene: THREE.Scene) => void;

  constructor(containerId: string, rendererDom: HTMLElement) {
    this.container = document.getElementById(containerId)!;
    this.rendererDom = rendererDom;
    this.initDefaultViews();
  }

  private initDefaultViews(): void {
    const defaultViews = [
      { id: 'view-3d', title: '{3D} - Vista General', type: '3d' as const },
      { id: 'plan-1', title: 'Planta - Nivel 1 (+3.50m)', type: 'plan' as const, level: 1 },
      { id: 'elev-south', title: 'Elevación Sur (Frontal)', type: 'elevation' as const },
      { id: 'elev-east', title: 'Elevación Este (Lateral)', type: 'elevation' as const },
    ];

    defaultViews.forEach(v => {
      const view = new BimView(v.id, v.title, v.type, this.container, this.rendererDom, v.level);
      this.views.set(v.id, view);

      view.domElement.addEventListener('pointerdown', () => {
        this.setActiveView(v.id);
      });
    });

    this.setLayout('single');
  }

  public getActiveView(): BimView {
    return this.views.get(this.activeViewId) || this.views.values().next().value!;
  }

  public getActiveCamera(): THREE.Camera {
    return this.getActiveView().camera;
  }

  public getAllViews(): BimView[] {
    return Array.from(this.views.values());
  }

  public setActiveView(id: string): void {
    if (!this.views.has(id)) return;
    this.activeViewId = id;
    this.updatePanelClasses();
    const active = this.getActiveView();
    if (this.onActiveViewChanged) this.onActiveViewChanged(active);
    if (this.onTabsUpdated) this.onTabsUpdated(this.getAllViews(), this.activeViewId);
  }

  public setLayout(mode: SplitLayout): void {
    this.layoutMode = mode;
    
    const layoutClasses = {
      'single': 'grid-cols-1 grid-rows-1',
      'split-v': 'grid-cols-2 grid-rows-1',
      'split-h': 'grid-cols-1 grid-rows-2',
      'grid-4': 'grid-cols-2 grid-rows-2',
    };

    // CORREGIDO: w-full h-[calc(100%-2rem)] garantiza que la cuadrícula cubra todo el espacio vertical
    this.container.className = `absolute top-8 left-0 right-0 bottom-0 w-full h-[calc(100%-2rem)] grid gap-0.5 bg-transparent pointer-events-none z-10 ${layoutClasses[mode]}`;
    this.updatePanelClasses();
  }

  public openView(id: string): void {
    this.setActiveView(id);
    if (this.layoutMode === 'single') {
      this.setLayout('single');
    }
  }

  private updatePanelClasses(): void {
    this.views.forEach(v => {
      const isActive = v.id === this.activeViewId;

      v.domElement.classList.toggle('border-sky-400', isActive);
      v.domElement.classList.toggle('ring-1', isActive);
      v.domElement.classList.toggle('ring-sky-400', isActive);
      v.domElement.classList.toggle('border-white/10', !isActive);

      v.titleSpan.classList.toggle('text-sky-400', isActive);
      v.titleSpan.classList.toggle('font-semibold', isActive);

      if (this.layoutMode === 'single') {
        v.domElement.style.display = isActive ? 'flex' : 'none';
      } else if (this.layoutMode === 'split-v' || this.layoutMode === 'split-h') {
        const visibleIds = ['view-3d', this.activeViewId === 'view-3d' ? 'plan-1' : this.activeViewId];
        v.domElement.style.display = visibleIds.includes(v.id) ? 'flex' : 'none';
      } else {
        v.domElement.style.display = 'flex';
      }
    });
  }

  public setCallbacks(
    onActiveViewChanged: (view: BimView) => void,
    onTabsUpdated: (views: BimView[], activeId: string) => void
  ): void {
    this.onActiveViewChanged = onActiveViewChanged;
    this.onTabsUpdated = onTabsUpdated;
    this.onTabsUpdated(this.getAllViews(), this.activeViewId);
  }

  public renderViewports(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    const containerRect = this.container.getBoundingClientRect();
    if (containerRect.width <= 0 || containerRect.height <= 0) return;

    // Sincronización continua de resolución si hay desfase de tamaño
    const canvasSize = renderer.getSize(new THREE.Vector2());
    if (Math.abs(canvasSize.x - containerRect.width) > 1 || Math.abs(canvasSize.y - containerRect.height) > 1) {
      renderer.setSize(containerRect.width, containerRect.height);
    }

    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);

    this.views.forEach(view => {
      if (view.domElement.style.display === 'none') return;

      const rect = view.domElement.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const left = rect.left - containerRect.left;
      const bottom = containerRect.bottom - rect.bottom;

      if (width <= 0 || height <= 0) return;

      if (this.onBeforeRenderView) {
        this.onBeforeRenderView(view, scene);
      }

      view.updateProjection(width, height);
      view.controls.update();

      renderer.setViewport(left, bottom, width, height);
      renderer.setScissor(left, bottom, width, height);
      renderer.render(scene, view.camera);
    });
  }
}

export default ViewManager;