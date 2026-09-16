import * as THREE from 'three';
import { ManagedElement } from './types';
import { BimDatabase } from '../../core/database/BimDatabase';

export class ElementRegistry {
  private elements: ManagedElement[] = [];
  public totalVolume = 0;

  public add(element: ManagedElement, scene: THREE.Scene): void {
    scene.add(element.mesh);
    this.elements.push(element);
    this.totalVolume += element.volume;
  }

  public getAll(): ManagedElement[] {
    return this.elements;
  }

  public getMeshes(): THREE.Mesh[] {
    return this.elements.map(el => el.mesh);
  }

  public findByMesh(mesh: THREE.Mesh): ManagedElement | undefined {
    return this.elements.find(el => el.mesh === mesh);
  }

  public findById(id: string | number): ManagedElement | undefined {
    if (typeof id === 'number') {
      return this.elements.find(el => el.elementId === id);
    }
    return this.elements.find(el => el.id === id || el.uniqueId === id);
  }

  public remove(element: ManagedElement, scene: THREE.Scene): void {
    const idx = this.elements.indexOf(element);
    if (idx !== -1) {
      this.totalVolume = Math.max(0, this.totalVolume - element.volume);
      if (element.uniqueId) {
        BimDatabase.getInstance().deleteElement(element.uniqueId);
      }
      element.mesh.geometry.dispose();
      element.line.geometry.dispose();
      (element.line.material as THREE.Material).dispose();
      scene.remove(element.mesh);
      this.elements.splice(idx, 1);
    }
  }

  public get count(): number {
    return this.elements.length;
  }

  public clear(scene: THREE.Scene): void {
    this.elements.forEach(el => {
      el.mesh.geometry.dispose();
      el.line.geometry.dispose();
      (el.line.material as THREE.Material).dispose();
      scene.remove(el.mesh);
    });

    BimDatabase.getInstance().clearAll();
    this.elements = [];
    this.totalVolume = 0;
  }
}
