import { GridDrawMode, ToolType } from '../config/structural.config';

export interface ContextualActions {
  onDrawModeChange?: (mode: GridDrawMode) => void;
  onOffsetChange?: (offset: number) => void;
  onChainChange?: (chain: boolean) => void;
  onFilletRadiusChange?: (radius: number) => void;
  onApplyTemplate?: (template: '5x5' | '4x4' | '6x6') => void;
  onQuickGenerate?: (hSpacing: number, vSpacing: number, countX?: number, countZ?: number) => void;
  onAtGrid?: () => void;
  onCancel?: () => void;
  onClearSelection?: () => void;
  onDeleteSelected?: () => void;
  onToggleGrid?: () => void;
}

export class ContextualSubheader {
  private container: HTMLElement;
  public currentOffset = 0.0;
  public drawMode: GridDrawMode = 'line';
  public isChain = false;
  public filletRadius = 0.0;

  constructor(private actions: ContextualActions) {
    this.container = document.createElement('div');
    this.container.id = 'contextual-subbar';
    this.container.className =
      'h-9 bg-emerald-50 border-t border-emerald-200 border-b-2 border-b-emerald-600 text-emerald-950 flex items-center px-3 gap-2 text-xs z-40 select-none shadow-xs shrink-0 overflow-x-auto';

    const header = document.getElementById('app-header')!;
    header.appendChild(this.container);

    this.renderGeneralOptions('Nivel 1 (+3.50m)');
  }

  public updateForTool(tool: ToolType, levelName: string): void {
    if (tool === 'select') {
      this.renderGeneralOptions(levelName);
    } else if (tool === 'grid') {
      this.renderGridOptions();
    } else {
      this.renderStructuralOptions(tool, levelName);
    }
  }

  /**
   * ESTADO 1: Barra de herramientas generales (Modificar / Selección)
   */
  private renderGeneralOptions(levelName: string): void {
    this.container.innerHTML = `
      <div class="flex items-center gap-1.5 bg-emerald-800 text-white px-2 py-0.5 rounded text-[11px] font-bold tracking-wide shadow-xs shrink-0">
        <span class="text-emerald-300 text-xs">●</span>
        <span>Modificar</span>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-emerald-900 font-semibold text-[11px]">Nivel Activo:</span>
        <strong class="text-emerald-950 font-bold">${levelName}</strong>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <div class="flex items-center gap-1 shrink-0">
        <button id="btn-ctx-clear-sel" class="bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors" title="Deseleccionar todo">
          Deseleccionar
        </button>
        <button id="btn-ctx-delete" class="bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors" title="Eliminar elemento seleccionado (Supr)">
          🗑️ Eliminar
        </button>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <div class="flex items-center gap-1.5 shrink-0">
        <button id="btn-ctx-toggle-grid" class="bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors" title="Alternar visibilidad de grilla">
          🌐 Visibilidad Grillas
        </button>
      </div>

      <div class="ml-auto flex items-center gap-2 shrink-0">
        <span class="text-emerald-800 text-[11px] font-medium italic">💡 Clic para seleccionar • Supr para borrar • Selecciona Rejilla para trazar ejes</span>
      </div>
    `;

    document.getElementById('btn-ctx-clear-sel')?.addEventListener('click', () => this.actions.onClearSelection?.());
    document.getElementById('btn-ctx-delete')?.addEventListener('click', () => this.actions.onDeleteSelected?.());
    document.getElementById('btn-ctx-toggle-grid')?.addEventListener('click', () => this.actions.onToggleGrid?.());
  }

  /**
   * ESTADO 2: Específico de Grilla (Autodesk Revit Style)
   */
  private renderGridOptions(): void {
    this.container.innerHTML = `
      <div class="flex items-center gap-1.5 bg-emerald-800 text-white px-2 py-0.5 rounded text-[11px] font-bold tracking-wide shadow-xs shrink-0">
        <span class="text-emerald-300 text-xs">●</span>
        <span>Modificar | Colocar Rejilla (Grid)</span>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <!-- Herramientas de Dibujo de Rejilla -->
      <div class="flex items-center gap-1 shrink-0">
        <span class="text-emerald-900 font-semibold text-[11px]">Dibujar:</span>
        <div class="flex bg-emerald-100 border border-emerald-300 rounded overflow-hidden">
          <button class="ctx-draw-btn px-2 py-0.5 text-xs ${this.drawMode === 'line' ? 'bg-emerald-700 text-white font-semibold' : 'text-emerald-950 hover:bg-emerald-200'} transition-colors cursor-pointer" data-draw="line" title="Línea recta (individual o cadena)">📏 Línea</button>
          <button class="ctx-draw-btn px-2 py-0.5 text-xs ${this.drawMode === 'arc_start_end_radius' ? 'bg-emerald-700 text-white font-semibold' : 'text-emerald-950 hover:bg-emerald-200'} transition-colors cursor-pointer" data-draw="arc_start_end_radius" title="Arco por inicio, fin y radio (3 clics)">↷ Arco I-F-R</button>
          <button class="ctx-draw-btn px-2 py-0.5 text-xs ${this.drawMode === 'arc_center_ends' ? 'bg-emerald-700 text-white font-semibold' : 'text-emerald-950 hover:bg-emerald-200'} transition-colors cursor-pointer" data-draw="arc_center_ends" title="Arco por centro y puntos finales">◡ Arco Centro</button>
          <button class="ctx-draw-btn px-2 py-0.5 text-xs ${this.drawMode === 'pick_lines' ? 'bg-emerald-700 text-white font-semibold' : 'text-emerald-950 hover:bg-emerald-200'} transition-colors cursor-pointer" data-draw="pick_lines" title="Seleccionar líneas / bordes de estructura (Tab cicla aristas)">⇥ Pick Lines</button>
        </div>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <!-- Opciones de Cadena y Desfase -->
      <div class="flex items-center gap-2 shrink-0">
        <label class="flex items-center gap-1 text-emerald-900 font-semibold text-[11px] cursor-pointer">
          <input id="grid-chain-checkbox" type="checkbox" ${this.isChain ? 'checked' : ''} class="accent-emerald-700 cursor-pointer rounded" />
          <span>Cadena</span>
        </label>

        <div class="flex items-center gap-1 ml-1">
          <label for="grid-offset-input" class="text-emerald-900 font-semibold text-[11px]">Desfase:</label>
          <input id="grid-offset-input" type="number" step="0.5" min="0" value="${this.currentOffset.toFixed(2)}" class="w-16 px-1.5 py-0.5 border border-emerald-400 rounded bg-white text-slate-900 text-xs font-semibold outline-none focus:ring-1 focus:ring-emerald-600" />
          <span class="text-emerald-700 font-semibold text-[11px]">m</span>
        </div>

        <div class="flex items-center gap-1 ml-1">
          <label for="grid-radius-input" class="text-emerald-900 font-semibold text-[11px]">Radio:</label>
          <input id="grid-radius-input" type="number" step="0.5" min="0" value="${this.filletRadius.toFixed(2)}" class="w-14 px-1.5 py-0.5 border border-emerald-400 rounded bg-white text-slate-900 text-xs font-semibold outline-none focus:ring-1 focus:ring-emerald-600" />
          <span class="text-emerald-700 font-semibold text-[11px]">m</span>
        </div>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <!-- Generación Rápida -->
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-emerald-900 font-semibold text-[11px]">Plantilla:</span>
        <select id="grid-template-select" class="px-1.5 py-0.5 border border-emerald-400 rounded bg-white text-slate-900 text-xs font-medium outline-none focus:ring-1 focus:ring-emerald-600">
          <option value="5x5" selected>5x5 (6m)</option>
          <option value="4x4">4x4 (6m)</option>
          <option value="6x6">6x6 (5m)</option>
        </select>
        <span class="text-emerald-900 font-semibold text-[11px] ml-1">H:</span>
        <input id="h-spacing-input" type="number" value="6" step="1" min="1" class="w-11 px-1 py-0.5 border border-emerald-400 rounded bg-white text-slate-900 text-xs font-semibold outline-none text-center" />
        <span class="text-emerald-900 font-semibold text-[11px]">V:</span>
        <input id="v-spacing-input" type="number" value="6" step="1" min="1" class="w-11 px-1 py-0.5 border border-emerald-400 rounded bg-white text-slate-900 text-xs font-semibold outline-none text-center" />
        <button id="btn-quick-generate" class="bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800 px-2 py-0.5 rounded text-xs font-semibold shadow-xs cursor-pointer transition-colors" title="Generar rejilla ortogonal con las separaciones">
          ⚡ Quick Generate
        </button>
      </div>

      <!-- Finalizar -->
      <div class="ml-auto flex items-center gap-2 shrink-0">
        <span class="text-emerald-800 text-[11px] font-medium italic">⌨️ Esc para cancelar</span>
        <button id="btn-ctx-cancel" class="bg-red-50 text-red-700 hover:bg-red-600 hover:text-white border border-red-200 px-2.5 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors">
          ✖ Finalizar (Esc)
        </button>
      </div>
    `;

    this.bindGridEvents();
  }

  private renderStructuralOptions(tool: ToolType, levelName: string): void {
    const titles: Record<string, string> = {
      zapata: 'Modificar | Colocar Zapata Aislada (2.0x2.0m)',
      columna: 'Modificar | Colocar Columna de Concreto (0.40x0.40m)',
      viga: 'Modificar | Colocar Viga de Pórtico (0.40x0.55m)',
      techo: 'Modificar | Colocar Losa de Entrepiso (e=0.20m)',
    };

    this.container.innerHTML = `
      <div class="flex items-center gap-1.5 bg-emerald-800 text-white px-2 py-0.5 rounded text-[11px] font-bold tracking-wide shadow-xs shrink-0">
        <span class="text-emerald-300 text-xs">●</span>
        <span>${titles[tool] || 'Colocar Elemento'}</span>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-emerald-900 font-semibold text-[11px]">Nivel Activo:</span>
        <strong class="text-emerald-950 font-bold">${levelName}</strong>
      </div>

      <div class="w-px h-4 bg-emerald-300 shrink-0"></div>

      <div class="flex items-center gap-1.5 shrink-0">
        <button id="btn-ctx-at-grid" class="bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800 px-2.5 py-0.5 rounded text-xs font-semibold shadow-xs cursor-pointer transition-colors">
          🎯 Colocar en todas las Grillas (At Grid)
        </button>
      </div>

      <div class="ml-auto flex items-center gap-2 shrink-0">
        <span class="text-emerald-800 text-[11px] font-medium italic">Previsualización activa • Clic para colocar</span>
        <button id="btn-ctx-cancel" class="bg-red-50 text-red-700 hover:bg-red-600 hover:text-white border border-red-200 px-2.5 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors">
          ✖ Finalizar (Esc)
        </button>
      </div>
    `;

    document.getElementById('btn-ctx-at-grid')?.addEventListener('click', () => this.actions.onAtGrid?.());
    document.getElementById('btn-ctx-cancel')?.addEventListener('click', () => this.actions.onCancel?.());
  }

  private bindGridEvents(): void {
    const btns = this.container.querySelectorAll<HTMLButtonElement>('.ctx-draw-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        btns.forEach(b => {
          b.className = 'ctx-draw-btn px-2 py-0.5 text-xs text-emerald-950 hover:bg-emerald-200 transition-colors cursor-pointer';
        });
        const target = e.currentTarget as HTMLButtonElement;
        target.className = 'ctx-draw-btn px-2 py-0.5 text-xs bg-emerald-700 text-white font-semibold transition-colors cursor-pointer';
        this.drawMode = target.dataset.draw as GridDrawMode;
        this.actions.onDrawModeChange?.(this.drawMode);
      });
    });

    const chainCb = document.getElementById('grid-chain-checkbox') as HTMLInputElement;
    chainCb?.addEventListener('change', () => {
      this.isChain = chainCb.checked;
      this.actions.onChainChange?.(this.isChain);
    });

    const offsetInp = document.getElementById('grid-offset-input') as HTMLInputElement;
    const handleOffset = () => {
      this.currentOffset = parseFloat(offsetInp.value) || 0.0;
      this.actions.onOffsetChange?.(this.currentOffset);
    };
    offsetInp?.addEventListener('input', handleOffset);
    offsetInp?.addEventListener('change', handleOffset);

    const radiusInp = document.getElementById('grid-radius-input') as HTMLInputElement;
    const handleRadius = () => {
      this.filletRadius = parseFloat(radiusInp.value) || 0.0;
      this.actions.onFilletRadiusChange?.(this.filletRadius);
    };
    radiusInp?.addEventListener('input', handleRadius);
    radiusInp?.addEventListener('change', handleRadius);

    const templateSelect = document.getElementById('grid-template-select') as HTMLSelectElement;
    templateSelect?.addEventListener('change', () => {
      const val = templateSelect.value as '5x5' | '4x4' | '6x6';
      const hInput = document.getElementById('h-spacing-input') as HTMLInputElement;
      const vInput = document.getElementById('v-spacing-input') as HTMLInputElement;
      if (val === '6x6') {
        if (hInput) hInput.value = '5';
        if (vInput) vInput.value = '5';
      } else {
        if (hInput) hInput.value = '6';
        if (vInput) vInput.value = '6';
      }
    });

    document.getElementById('btn-quick-generate')?.addEventListener('click', () => {
      const hInput = document.getElementById('h-spacing-input') as HTMLInputElement;
      const vInput = document.getElementById('v-spacing-input') as HTMLInputElement;
      const h = parseFloat(hInput?.value) || 6;
      const v = parseFloat(vInput?.value) || 6;
      const tmpl = templateSelect?.value as '5x5' | '4x4' | '6x6';

      let countX = 5;
      let countZ = 5;
      if (tmpl === '4x4') {
        countX = 4;
        countZ = 4;
      } else if (tmpl === '6x6') {
        countX = 6;
        countZ = 6;
      }

      if (this.actions.onQuickGenerate) {
        this.actions.onQuickGenerate(h, v, countX, countZ);
      } else if (this.actions.onApplyTemplate) {
        this.actions.onApplyTemplate(tmpl);
      }
    });

    document.getElementById('btn-ctx-cancel')?.addEventListener('click', () => this.actions.onCancel?.());
  }
}
