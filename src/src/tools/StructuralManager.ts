import * as THREE from 'three';
import { ToolType } from '../config/structural.config';
import { VisualStyle } from '../config/theme.config';
import { WasmBridge } from '../kernel/WasmBridge';
import { Viewer } from '../core/Viewer';
import { GridSystem } from '../core/GridSystem';
import { ManagedElement, MetricsUpdate } from './structural/types';
import { ElementRegistry } from './structural/ElementRegistry';
import { ElementFactory } from './structural/ElementFactory';
import { VisualStyleController } from './structural/VisualStyleController';
import { BuildingGenerator } from './structural/BuildingGenerator';

export class StructuralManager {
  public registry = new ElementRegistry();
  public factory: ElementFactory;
  private styleController: VisualStyleController;
  private generator: BuildingGenerator;

  constructor(
    private scene: THREE.Scene, 
    private wasm: WasmBridge,
    private onMetrics: (metrics: MetricsUpdate) => void
  ) {
    this.factory = new ElementFactory(this.wasm);
    this.styleController = new VisualStyleController(this.wasm, this.factory);
    this.generator = new BuildingGenerator(this.scene, this.wasm, this.factory, this.registry);
  }

  public get totalVolume(): number { return this.registry.totalVolume; }
  public get elementCount(): number { return this.registry.count; }
  public get currentStyle(): VisualStyle { return this.styleController.currentStyle; }

  public updateMetrics(): void {
    this.emitMetrics(0);
  }

  public setVisualStyle(style: VisualStyle, viewer: Viewer, gridSystem: GridSystem): void {
    this.styleController.apply(style, this.registry.getAll(), viewer, gridSystem);
  }

  public placeSingle(tool: ToolType, x: number, z: number, levelIdx: number): void {
    if (!this.wasm.isReady()) return;
    const t0 = performance.now();
    this.generator.buildSingle(tool, x, z, levelIdx, this.currentStyle);
    this.emitMetrics(performance.now() - t0);
  }

  public placeAtGridIntersections(tool: ToolType, levelIdx: number): void {
    if (!this.wasm.isReady()) return;
    const t0 = performance.now();
    this.generator.buildAtGridIntersections(tool, levelIdx, this.currentStyle);
    this.emitMetrics(performance.now() - t0);
  }

  public buildFullBuilding(): void {
    if (!this.wasm.isReady()) return;
    this.clear();
    const t0 = performance.now();
    this.generator.buildFullBuilding(this.currentStyle);
    this.emitMetrics(performance.now() - t0);
  }

  public removeElement(element: ManagedElement): void {
    this.registry.remove(element, this.scene);
    this.emitMetrics(0);
  }

  public clear(): void {
    this.registry.clear(this.scene);
    this.emitMetrics(0);
  }

  private emitMetrics(durationMs: number): void {
    this.onMetrics({
      count: this.elementCount,
      volume: this.totalVolume,
      durationMs
    });
  }
}
