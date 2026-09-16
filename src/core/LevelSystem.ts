import * as THREE from 'three';
import { LEVELS, LevelInfo } from '../config/structural.config';

export class LevelSystem {
  public group = new THREE.Group();
  private levelMeshes: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene) {
    this.group.name = 'BimLevelSystem';
    this.buildLevels();
    scene.add(this.group);
  }

  public buildLevels(boundsExtent = 20): void {
    // Limpiar geometrías previas
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
      this.group.remove(child);
    }
    this.levelMeshes = [];

    LEVELS.forEach((lvl: LevelInfo) => {
      const y = lvl.elevation;
      const levelGroup = new THREE.Group();
      levelGroup.name = `LevelDatum-${lvl.index}`;

      // 1. Líneas de contorno de datum en el plano XZ a la cota Y
      const half = boundsExtent;
      const pts = [
        new THREE.Vector3(-half, y, -half),
        new THREE.Vector3(half, y, -half),
        new THREE.Vector3(half, y, half),
        new THREE.Vector3(-half, y, half),
        new THREE.Vector3(-half, y, -half),
      ];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineDashedMaterial({
        color: 0x38bdf8,
        dashSize: 0.8,
        gapSize: 0.4,
        transparent: true,
        opacity: 0.55,
      });
      const line = new THREE.Line(lineGeom, lineMat);
      line.computeLineDistances();
      levelGroup.add(line);

      // 2. Plano sutil de referencia del nivel
      const planeGeom = new THREE.PlaneGeometry(half * 2, half * 2);
      planeGeom.rotateX(-Math.PI / 2);
      planeGeom.translate(0, y, 0);
      const planeMat = new THREE.MeshBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.03,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const planeMesh = new THREE.Mesh(planeGeom, planeMat);
      levelGroup.add(planeMesh);

      // 3. Cabezal de Nivel Revit 3D / Elevación (Revit Level Head)
      const headSprite = this.createLevelHeadSprite(lvl.name, lvl.elevation);
      headSprite.position.set(half + 2.5, y, 0);
      levelGroup.add(headSprite);

      // Cabezal frontal también
      const headFront = this.createLevelHeadSprite(lvl.name, lvl.elevation);
      headFront.position.set(0, y, half + 2.5);
      levelGroup.add(headFront);

      this.group.add(levelGroup);
    });
  }

  private createLevelHeadSprite(name: string, elevation: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo y borde del cabezal estilo Revit (Símbolo de nivel triangular / diana azul)
    const bubbleX = 36;
    const bubbleY = 48;
    const radius = 24;

    // Círculo exterior azul
    ctx.beginPath();
    ctx.arc(bubbleX, bubbleY, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#0284c7';
    ctx.fill();

    // Cuadrante estilo diana Revit
    ctx.beginPath();
    ctx.moveTo(bubbleX, bubbleY);
    ctx.arc(bubbleX, bubbleY, radius, 0, Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(bubbleX, bubbleY);
    ctx.arc(bubbleX, bubbleY, radius, Math.PI, (3 * Math.PI) / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0284c7';
    ctx.stroke();

    // Línea de referencia horizontal detrás del texto
    ctx.beginPath();
    ctx.moveTo(bubbleX + radius, bubbleY);
    ctx.lineTo(250, bubbleY);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Nombre del Nivel (arriba de la línea)
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    // Nombre corto
    const shortName = name.split(':')[1]?.trim() || name;
    ctx.fillText(shortName, bubbleX + radius + 8, bubbleY - 4);

    // Cota / Elevación (debajo de la línea)
    const sign = elevation >= 0 ? '+' : '';
    const elevText = `${sign}${elevation.toFixed(2)} m`;
    ctx.font = '500 17px "Courier New", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(elevText, bubbleX + radius + 8, bubbleY + 22);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4.8, 1.8, 1);
    sprite.renderOrder = 990;
    return sprite;
  }
}
