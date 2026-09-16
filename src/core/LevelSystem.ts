import * as THREE from 'three';
import { updateActiveLevels, LevelInfo } from '../config/structural.config';
import { THEME } from '../config/theme.config';
import { DIMENSIONS } from '../config/dimensions.config';
import {
  LevelElement,
  LevelTemplateType,
  QuickGenerateLevelConfig,
} from './level/types/LevelTypes';
import { LevelQuickGenerator } from './level/generator/LevelQuickGenerator';

export class LevelSystem {
  public group = new THREE.Group();
  private levels: LevelElement[] = [];
  public selectedLevelId: string | null = null;

  constructor(scene: THREE.Scene) {
    this.group.name = 'BimLevelSystem';
    scene.add(this.group);

    // Cargar plantilla residencial inicial por defecto
    this.applyTemplate('residential');
  }

  /**
   * Aplica un esquema predeterminado de niveles
   */
  public applyTemplate(templateId: LevelTemplateType): LevelElement[] {
    const tmpl = LevelQuickGenerator.getTemplate(templateId);
    return this.quickGenerate(tmpl.config);
  }

  /**
   * Generación Rápida de Niveles en lote a partir de una configuración
   */
  public quickGenerate(config: QuickGenerateLevelConfig): LevelElement[] {
    const generated = LevelQuickGenerator.generate(config, DIMENSIONS.levels.boundsExtentDefault);
    this.setLevels(generated);
    return this.levels;
  }

  /**
   * Asigna la lista completa de niveles y actualiza el estado global de cotas
   */
  public setLevels(elements: LevelElement[]): void {
    this.levels = [...elements].sort((a, b) => a.elevation - b.elevation);

    // Sincronizar con el store global de niveles para cálculos estructurales y de interfaz
    const levelInfos: LevelInfo[] = this.levels.map((lvl, index) => ({
      index,
      name: lvl.name,
      elevation: lvl.elevation,
    }));
    updateActiveLevels(levelInfos);

    // Reconstruir visualización 3D y alzados
    this.rebuildMeshes();
  }

  public getLevels(): LevelElement[] {
    return [...this.levels];
  }

  public getLevel(id: string): LevelElement | undefined {
    return this.levels.find(l => l.id === id);
  }

  public updateLevel(id: string, partial: Partial<LevelElement>): void {
    const idx = this.levels.findIndex(l => l.id === id);
    if (idx !== -1) {
      this.levels[idx] = { ...this.levels[idx], ...partial };
      this.setLevels(this.levels);
    }
  }

  public toggleElbow(id: string, end: 'start' | 'end'): void {
    const lvl = this.getLevel(id);
    if (!lvl) return;

    if (end === 'end') {
      const current = lvl.endElbow?.active;
      lvl.endElbow = {
        active: !current,
        verticalOffset: current ? 0 : 0.8,
        breakDistance: 2.5,
      };
    } else {
      const current = lvl.startElbow?.active;
      lvl.startElbow = {
        active: !current,
        verticalOffset: current ? 0 : 0.8,
        breakDistance: 2.5,
      };
    }
    this.setLevels(this.levels);
  }

  public toggleBubble(id: string, end: 'start' | 'end'): void {
    const lvl = this.getLevel(id);
    if (!lvl) return;

    if (end === 'end') {
      lvl.showEndBubble = !lvl.showEndBubble;
    } else {
      lvl.showStartBubble = !lvl.showStartBubble;
    }
    this.setLevels(this.levels);
  }

  public toggleLock(id: string): void {
    const lvl = this.getLevel(id);
    if (!lvl) return;
    lvl.isLocked = !lvl.isLocked;
    this.setLevels(this.levels);
  }

  /**
   * Reconstruye los gráficos 3D (Líneas de datum, planos y cabezales con shoulder break y lock)
   */
  public rebuildMeshes(boundsExtent: number = DIMENSIONS.levels.boundsExtentDefault): void {
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

    const half = boundsExtent;

    this.levels.forEach((lvl, index) => {
      const y = lvl.elevation;
      const levelGroup = new THREE.Group();
      levelGroup.name = `LevelDatum-${lvl.id || index}`;

      // 1. Líneas de contorno de datum en el plano XZ a la cota Y
      const pts = [
        new THREE.Vector3(-half, y, -half),
        new THREE.Vector3(half, y, -half),
        new THREE.Vector3(half, y, half),
        new THREE.Vector3(-half, y, half),
        new THREE.Vector3(-half, y, -half),
      ];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineDashedMaterial({
        color: THEME.levels.contourLine,
        dashSize: DIMENSIONS.levels.dashSize,
        gapSize: DIMENSIONS.levels.gapSize,
        transparent: true,
        opacity: DIMENSIONS.levels.opacityLine,
      });
      const line = new THREE.Line(lineGeom, lineMat);
      line.computeLineDistances();
      levelGroup.add(line);

      // 2. Plano de referencia sutil del nivel
      const planeGeom = new THREE.PlaneGeometry(half * 2, half * 2);
      planeGeom.rotateX(-Math.PI / 2);
      planeGeom.translate(0, y, 0);
      const planeMat = new THREE.MeshBasicMaterial({
        color: THEME.levels.datumPlane,
        transparent: true,
        opacity: DIMENSIONS.levels.opacityPlane,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const planeMesh = new THREE.Mesh(planeGeom, planeMat);
      levelGroup.add(planeMesh);

      // 3. Cabezal de Nivel Revit 3D / Alzados (Level Head con Elbow y Candado)
      if (lvl.showEndBubble) {
        const headSprite = this.createLevelHeadSprite(lvl, 'end');
        const elbowY = (lvl.endElbow?.active ? lvl.endElbow.verticalOffset : 0);
        headSprite.position.set(half + DIMENSIONS.levels.headOffset, y + elbowY, 0);
        levelGroup.add(headSprite);

        // Cabezal frontal en eje Z
        const headFront = this.createLevelHeadSprite(lvl, 'end');
        headFront.position.set(0, y + elbowY, half + DIMENSIONS.levels.headOffset);
        levelGroup.add(headFront);
      }

      if (lvl.showStartBubble) {
        const headSpriteStart = this.createLevelHeadSprite(lvl, 'start');
        const elbowY = (lvl.startElbow?.active ? lvl.startElbow.verticalOffset : 0);
        headSpriteStart.position.set(-half - DIMENSIONS.levels.headOffset, y + elbowY, 0);
        levelGroup.add(headSpriteStart);

        const headFrontStart = this.createLevelHeadSprite(lvl, 'start');
        headFrontStart.position.set(0, y + elbowY, -half - DIMENSIONS.levels.headOffset);
        levelGroup.add(headFrontStart);
      }

      this.group.add(levelGroup);
    });
  }

  private createLevelHeadSprite(lvl: LevelElement, _end: 'start' | 'end'): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = DIMENSIONS.levels.headCanvasWidth;
    canvas.height = DIMENSIONS.levels.headCanvasHeight;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bubbleX = DIMENSIONS.levels.headBubbleX;
    const bubbleY = DIMENSIONS.levels.headBubbleY;
    const radius = DIMENSIONS.levels.headBubbleRadius;

    // Si tiene vista asociada (hasPlanView): azul Revit (0x0284c7). Si no: negro / gris oscuro
    const circleColor = lvl.hasPlanView ? '#0284c7' : '#475569';
    const quadrantColor = '#ffffff';

    // Círculo exterior
    ctx.beginPath();
    ctx.arc(bubbleX, bubbleY, radius, 0, Math.PI * 2);
    ctx.fillStyle = circleColor;
    ctx.fill();

    // Cuadrantes diana estilo Revit
    ctx.beginPath();
    ctx.moveTo(bubbleX, bubbleY);
    ctx.arc(bubbleX, bubbleY, radius, 0, Math.PI / 2);
    ctx.fillStyle = quadrantColor;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(bubbleX, bubbleY);
    ctx.arc(bubbleX, bubbleY, radius, Math.PI, (3 * Math.PI) / 2);
    ctx.fillStyle = quadrantColor;
    ctx.fill();

    ctx.lineWidth = DIMENSIONS.levels.headLineWidth;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Línea directriz horizontal detrás del texto
    ctx.beginPath();
    ctx.moveTo(bubbleX + radius, bubbleY);
    ctx.lineTo(240, bubbleY);
    ctx.strokeStyle = circleColor;
    ctx.lineWidth = DIMENSIONS.levels.headLeaderLineWidth;
    ctx.stroke();

    // Nombre del Nivel (arriba de la línea)
    ctx.font = `bold ${DIMENSIONS.levels.headTitleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    const shortName = lvl.name.split('(')[0]?.trim() || lvl.name;
    ctx.fillText(shortName, bubbleX + radius + 8, bubbleY - 4);

    // Cota / Elevación formateada (debajo de la línea)
    const elevText = LevelQuickGenerator.formatElevation(lvl.elevation);
    ctx.font = `600 ${DIMENSIONS.levels.headElevationFontSize}px "Courier New", monospace`;
    ctx.fillStyle = '#0369a1';
    ctx.fillText(elevText, bubbleX + radius + 8, bubbleY + 22);

    // Indicador de candado de alineación (si está bloqueado)
    if (lvl.isLocked) {
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#0284c7';
      ctx.fillText('🔒', bubbleX + radius + 140, bubbleY + 20);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(
      DIMENSIONS.levels.headSpriteScale.x,
      DIMENSIONS.levels.headSpriteScale.y,
      DIMENSIONS.levels.headSpriteScale.z
    );
    sprite.renderOrder = DIMENSIONS.renderOrders.levelSystemDatum;
    return sprite;
  }
}
export default LevelSystem;
