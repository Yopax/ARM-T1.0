import * as THREE from 'three';

export interface InlineEditorOptions {
  worldPos: THREE.Vector3;
  currentName: string;
  camera: THREE.Camera;
  domElement: HTMLElement;
  existingNames: string[];
  onCommit: (newName: string) => void;
  onCancel?: () => void;
  onValidationWarning?: (msg: string) => void;
}

export class GridInlineEditor {
  private activeInput: HTMLInputElement | null = null;
  private isCommitting = false;

  /**
   * Abre un campo de texto flotante centrado sobre la burbuja en coordenadas de pantalla.
   */
  public open(options: InlineEditorOptions): void {
    this.close();

    const {
      worldPos,
      currentName,
      camera,
      domElement,
      existingNames,
      onCommit,
      onCancel,
      onValidationWarning,
    } = options;

    // Proyectar coordenadas del espacio 3D a la pantalla 2D
    const p = worldPos.clone().project(camera);
    if (p.z > 1) return; // Fuera del frustum (detrás de la cámara)

    const rect = domElement.getBoundingClientRect();
    const screenX = ((p.x + 1) / 2) * rect.width + rect.left;
    const screenY = ((-p.y + 1) / 2) * rect.height + rect.top;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.id = 'grid-inline-bubble-input';
    input.maxLength = 5;
    input.spellcheck = false;
    input.autocomplete = 'off';

    // Estilos inline de alta precisión emulando la burbuja de Revit
    Object.assign(input.style, {
      position: 'fixed',
      left: `${screenX}px`,
      top: `${screenY}px`,
      transform: 'translate(-50%, -50%)',
      width: '56px',
      height: '56px',
      borderRadius: '50%',
      border: '3px solid #0284c7',
      backgroundColor: '#ffffff',
      color: '#0f172a',
      fontSize: '22px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: 'bold',
      textAlign: 'center',
      outline: 'none',
      boxShadow: '0 4px 20px rgba(2, 132, 199, 0.5), 0 0 0 4px rgba(56, 189, 248, 0.35)',
      zIndex: '9999',
      cursor: 'text',
      userSelect: 'text',
      padding: '0',
      margin: '0',
    });

    const commitChange = () => {
      if (this.isCommitting) return;
      this.isCommitting = true;

      const val = input.value.trim().toUpperCase();
      if (!val) {
        onValidationWarning?.('El identificador de rejilla no puede estar vacío');
        this.close();
        onCancel?.();
        return;
      }

      if (val !== currentName.toUpperCase()) {
        const isDuplicate = existingNames.some(
          n => n.toUpperCase() === val && n.toUpperCase() !== currentName.toUpperCase()
        );
        if (isDuplicate) {
          onValidationWarning?.(`El nombre "${val}" ya está en uso por otro eje.`);
          // Advertencia visual
          input.style.border = '3px solid #ef4444';
          input.style.boxShadow = '0 4px 16px rgba(239, 68, 68, 0.5)';
          this.isCommitting = false;
          return;
        }
      }

      this.close();
      onCommit(val);
    };

    const cancelChange = () => {
      this.close();
      onCancel?.();
    };

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        commitChange();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelChange();
      }
    });

    input.addEventListener('blur', () => {
      commitChange();
    });

    input.addEventListener('pointerdown', (e: PointerEvent) => {
      e.stopPropagation();
    });

    input.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
    });

    input.addEventListener('dblclick', (e: MouseEvent) => {
      e.stopPropagation();
    });

    document.body.appendChild(input);
    this.activeInput = input;

    // Enfocar y seleccionar texto
    setTimeout(() => {
      input.focus();
      input.select();
    }, 10);
  }

  /**
   * Cierra el editor activo si está abierto.
   */
  public close(): void {
    if (this.activeInput && this.activeInput.parentNode) {
      this.activeInput.parentNode.removeChild(this.activeInput);
    }
    this.activeInput = null;
    this.isCommitting = false;
  }

  public isOpen(): boolean {
    return this.activeInput !== null;
  }
}
