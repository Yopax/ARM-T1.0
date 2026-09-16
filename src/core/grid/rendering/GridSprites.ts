import * as THREE from 'three';

export class GridSprites {
  /**
   * Genera el sprite de burbuja con textura nítida estilo Autodesk Revit.
   */
  public static createBubbleSprite(
    text: string,
    isHighlighted: boolean,
    isHovered = false
  ): THREE.Sprite {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Sprite();

    ctx.clearRect(0, 0, size, size);

    // Color de relleno y borde
    let fill = '#ffffff';
    let stroke = '#1e293b';
    let textColor = '#0f172a';
    let strokeWidth = 6;

    if (isHighlighted) {
      fill = '#0284c7';
      stroke = '#38bdf8';
      textColor = '#ffffff';
      strokeWidth = 7;
    } else if (isHovered) {
      fill = '#f0f9ff';
      stroke = '#0284c7';
      textColor = '#0284c7';
      strokeWidth = 8;
    }

    // Círculo principal
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - strokeWidth, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();

    // Borde exterior
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();

    // Texto identificador
    ctx.font = 'bold 54px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2 + 3);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.4, 2.4, 1);
    sprite.renderOrder = 950;
    return sprite;
  }

  /**
   * Checkbox de visibilidad de burbuja estilo Revit.
   */
  public static createCheckboxSprite(isChecked: boolean): THREE.Sprite {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Sprite();

    ctx.clearRect(0, 0, size, size);

    // Cuadrado fondo
    ctx.fillStyle = isChecked ? '#0284c7' : '#ffffff';
    ctx.beginPath();
    ctx.roundRect(8, 8, 48, 48, 6);
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = isChecked ? '#0369a1' : '#475569';
    ctx.stroke();

    if (isChecked) {
      // Checkmark blanco ✓
      ctx.beginPath();
      ctx.moveTo(18, 32);
      ctx.lineTo(28, 42);
      ctx.lineTo(46, 20);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#ffffff';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.7, 0.7, 1);
    sprite.renderOrder = 960;
    return sprite;
  }

  /**
   * Candado de alineación estilo Revit (🔒).
   */
  public static createLockSprite(isLocked: boolean): THREE.Sprite {
    const size = 48;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Sprite();

    ctx.clearRect(0, 0, size, size);

    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isLocked ? '🔒' : '🔓', size / 2, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.65, 0.65, 1);
    sprite.renderOrder = 960;
    return sprite;
  }

  /**
   * Icono interactivo de codo (Grid Elbow / Jog) estilo Autodesk Revit.
   */
  public static createElbowIconSprite(isActive: boolean): THREE.Sprite {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Sprite();

    ctx.clearRect(0, 0, size, size);

    // Fondo circular blanco con borde
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = isActive ? '#0284c7' : '#9333ea';
    ctx.stroke();

    // Glifo de codo escalonado tipo Revit
    ctx.beginPath();
    ctx.moveTo(32, 12);
    ctx.lineTo(32, 24);
    ctx.lineTo(20, 38);
    ctx.lineTo(20, 52);
    ctx.lineWidth = 5;
    ctx.strokeStyle = isActive ? '#0284c7' : '#9333ea';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.8, 0.8, 1);
    sprite.renderOrder = 965;
    return sprite;
  }
}
