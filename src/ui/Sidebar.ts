import { ManagedElement } from '../tools/structural/types';
import { ViewManager } from '../core/views/ViewManager';
import { GridElement } from '../config/structural.config';

export class Sidebar {
  private propContent: HTMLElement;
  private currentElement: ManagedElement | null = null;
  private currentGrid: GridElement | null = null;

  constructor(
    private viewManager: ViewManager,
    private onDeleteRequested: (element: ManagedElement) => void
  ) {
    this.propContent = document.getElementById('properties-content')!;
    this.bindSidebarTabs();
    this.bindProjectBrowser();
    this.showEmptyProperties();
  }

  private bindSidebarTabs(): void {
    const tabBtns = document.querySelectorAll<HTMLButtonElement>('.sidebar-nav-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        tabBtns.forEach(b => {
          b.className = 'sidebar-nav-btn flex-1 bg-transparent text-slate-400 border-b-2 border-transparent py-2 text-xs font-semibold cursor-pointer hover:text-slate-200 transition-colors';
        });
        const target = e.currentTarget as HTMLButtonElement;
        target.className = 'sidebar-nav-btn flex-1 bg-slate-800 text-sky-400 border-b-2 border-sky-400 py-2 text-xs font-semibold cursor-pointer transition-colors';

        const tab = target.dataset.sidebarTab;
        document.getElementById('sidebar-properties')?.classList.toggle('hidden', tab !== 'properties');
        document.getElementById('sidebar-properties')?.classList.toggle('block', tab === 'properties');

        document.getElementById('sidebar-browser')?.classList.toggle('hidden', tab !== 'browser');
        document.getElementById('sidebar-browser')?.classList.toggle('block', tab === 'browser');
      });
    });
  }

  private bindProjectBrowser(): void {
    document.querySelectorAll<HTMLElement>('.tree-item[data-open-view]').forEach(item => {
      item.addEventListener('click', (e) => {
        const viewId = (e.currentTarget as HTMLElement).dataset.openView;
        if (viewId) this.viewManager.openView(viewId);
      });
    });
  }

  public showElementProperties(element: ManagedElement): void {
    this.currentElement = element;
    const icons = { footing: '🧱 Zapata', column: '🏛️ Columna', beam: '📏 Viga', slab: '🏠 Losa / Techo' };
    const icon = icons[element.type];

    this.propContent.innerHTML = `
      <div class="flex flex-col gap-1.5">
        <div class="flex justify-between items-center border-b border-white/10 pb-2 mb-1">
          <span class="font-semibold text-sm text-sky-400">${icon}</span>
          <span class="bg-slate-950 px-2 py-0.5 rounded text-xs border border-white/10 font-mono text-slate-300">${element.id}</span>
        </div>

        <div class="text-[10px] text-slate-400 uppercase font-bold mt-2 tracking-wider">Restricciones</div>
        <div class="flex justify-between text-xs text-slate-400 py-0.5">
          <span>Nivel:</span>
          <strong class="text-slate-200 font-medium">${element.levelName}</strong>
        </div>

        <div class="text-[10px] text-slate-400 uppercase font-bold mt-2 tracking-wider">Cotas y Geometría</div>
        <div class="flex justify-between text-xs text-slate-400 py-0.5">
          <span>Dimensiones:</span>
          <strong class="text-slate-200 font-medium">${element.dimensions}</strong>
        </div>
        <div class="flex justify-between text-xs text-slate-400 py-0.5">
          <span>Volumen:</span>
          <strong class="text-emerald-400 font-bold">${element.volume.toFixed(3)} m³</strong>
        </div>

        <div class="text-[10px] text-slate-400 uppercase font-bold mt-2 tracking-wider">Materiales y Acabados</div>
        <div class="flex justify-between text-xs text-slate-400 py-0.5">
          <span>Material:</span>
          <strong class="text-slate-200 font-medium">Concreto f'c 210 kg/cm²</strong>
        </div>

        <button id="btn-delete-prop" class="mt-4 bg-red-500/20 text-red-300 hover:bg-red-600 hover:text-white border border-red-500/40 py-1.5 px-2 rounded-md text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1">
          🗑️ Suprimir Elemento
        </button>
      </div>
    `;

    document.getElementById('btn-delete-prop')?.addEventListener('click', () => {
      if (this.currentElement) {
        this.onDeleteRequested(this.currentElement);
        this.showEmptyProperties();
      }
    });

    (document.querySelector('.sidebar-nav-btn[data-sidebar-tab="properties"]') as HTMLElement)?.click();
  }

  public showGridProperties(
    grid: GridElement,
    onUpdate: (updatedGrid: GridElement) => void,
    onDelete: (gridId: string) => void
  ): void {
    this.currentElement = null;
    this.currentGrid = grid;

    const length =
      grid.geomType === 'line'
        ? Math.hypot(grid.end.x - grid.start.x, grid.end.z - grid.start.z).toFixed(2)
        : ((grid.radius || 10) * Math.abs((grid.endAngle || Math.PI) - (grid.startAngle || 0))).toFixed(2);

    this.propContent.innerHTML = `
      <div class="flex flex-col gap-1.5">
        <div class="flex justify-between items-center border-b border-white/10 pb-2 mb-1">
          <span class="font-semibold text-sm text-sky-400">🌐 Rejilla (Grid Datum)</span>
          <span class="bg-slate-950 px-2 py-0.5 rounded text-xs border border-white/10 font-mono text-slate-300">${grid.id}</span>
        </div>

        <div class="text-[10px] text-slate-400 uppercase font-bold mt-2 tracking-wider">Identificación</div>
        <div class="flex justify-between items-center text-xs text-slate-400 py-1">
          <span>Nombre de Rejilla:</span>
          <input id="grid-name-input" type="text" value="${grid.name}" class="w-16 px-2 py-0.5 bg-slate-950 border border-sky-500/40 rounded text-slate-100 text-xs font-bold text-center outline-none focus:border-sky-400" />
        </div>

        <div class="text-[10px] text-slate-400 uppercase font-bold mt-2 tracking-wider">Geometría</div>
        <div class="flex justify-between text-xs text-slate-400 py-0.5">
          <span>Tipo:</span>
          <strong class="text-slate-200 font-medium">${grid.geomType === 'line' ? 'Línea Recta' : 'Arco'}</strong>
        </div>
        <div class="flex justify-between text-xs text-slate-400 py-0.5">
          <span>Longitud:</span>
          <strong class="text-sky-400 font-bold">${length} m</strong>
        </div>
        ${
          grid.radius
            ? `<div class="flex justify-between text-xs text-slate-400 py-0.5">
                <span>Radio de Curvatura:</span>
                <strong class="text-emerald-400 font-bold">${grid.radius.toFixed(2)} m</strong>
              </div>`
            : ''
        }

        <div class="text-[10px] text-slate-400 uppercase font-bold mt-2 tracking-wider">Burbujas y Extremos</div>
        <div class="flex flex-col gap-1 text-xs text-slate-300 py-1">
          <label class="flex items-center gap-2 cursor-pointer">
            <input id="grid-prop-bubble-start" type="checkbox" ${grid.showStartBubble ? 'checked' : ''} class="accent-sky-500 rounded" />
            <span>Mostrar Burbuja en Extremo Inicial (1)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input id="grid-prop-bubble-end" type="checkbox" ${grid.showEndBubble ? 'checked' : ''} class="accent-sky-500 rounded" />
            <span>Mostrar Burbuja en Extremo Final (2)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer mt-1">
            <input id="grid-prop-locked" type="checkbox" ${grid.isLocked !== false ? 'checked' : ''} class="accent-sky-500 rounded" />
            <span>🔒 Bloquear Alineación con Grupo (Revit Lock)</span>
          </label>
        </div>

        <div class="text-[10px] text-slate-400 uppercase font-bold mt-2 tracking-wider">Codos de Rejilla (Grid Elbow / Jog)</div>
        <div class="flex flex-col gap-1.5 text-xs text-slate-300 py-1">
          <label class="flex items-center gap-2 cursor-pointer">
            <input id="grid-prop-elbow-start" type="checkbox" ${grid.startElbow?.active ? 'checked' : ''} class="accent-purple-500 rounded" />
            <span>⚡ Activar Codo en Extremo Inicial</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input id="grid-prop-elbow-end" type="checkbox" ${grid.endElbow?.active ? 'checked' : ''} class="accent-purple-500 rounded" />
            <span>⚡ Activar Codo en Extremo Final</span>
          </label>
        </div>

        <button id="btn-delete-grid-prop" class="mt-4 bg-red-500/20 text-red-300 hover:bg-red-600 hover:text-white border border-red-500/40 py-1.5 px-2 rounded-md text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1">
          🗑️ Eliminar Rejilla
        </button>
      </div>
    `;

    const nameInput = document.getElementById('grid-name-input') as HTMLInputElement;
    nameInput?.addEventListener('input', () => {
      grid.name = nameInput.value;
      onUpdate(grid);
    });

    const startCb = document.getElementById('grid-prop-bubble-start') as HTMLInputElement;
    startCb?.addEventListener('change', () => {
      grid.showStartBubble = startCb.checked;
      onUpdate(grid);
    });

    const endCb = document.getElementById('grid-prop-bubble-end') as HTMLInputElement;
    endCb?.addEventListener('change', () => {
      grid.showEndBubble = endCb.checked;
      onUpdate(grid);
    });

    const lockCb = document.getElementById('grid-prop-locked') as HTMLInputElement;
    lockCb?.addEventListener('change', () => {
      grid.isLocked = lockCb.checked;
      onUpdate(grid);
    });

    const startElbowCb = document.getElementById('grid-prop-elbow-start') as HTMLInputElement;
    startElbowCb?.addEventListener('change', () => {
      if (!grid.startElbow) {
        grid.startElbow = { active: startElbowCb.checked, lateralOffset: -2.5, breakDistance: 4.0 };
      } else {
        grid.startElbow.active = startElbowCb.checked;
      }
      onUpdate(grid);
    });

    const endElbowCb = document.getElementById('grid-prop-elbow-end') as HTMLInputElement;
    endElbowCb?.addEventListener('change', () => {
      if (!grid.endElbow) {
        grid.endElbow = { active: endElbowCb.checked, lateralOffset: -2.5, breakDistance: 4.0 };
      } else {
        grid.endElbow.active = endElbowCb.checked;
      }
      onUpdate(grid);
    });

    document.getElementById('btn-delete-grid-prop')?.addEventListener('click', () => {
      onDelete(grid.id);
      this.showEmptyProperties();
    });

    (document.querySelector('.sidebar-nav-btn[data-sidebar-tab="properties"]') as HTMLElement)?.click();
  }

  public showEmptyProperties(): void {
    this.currentElement = null;
    this.propContent.innerHTML = `
      <div class="flex flex-col items-center justify-center h-48 text-center text-slate-400 gap-1.5 p-4">
        <div class="text-3xl opacity-40 mb-1">📐</div>
        <p class="font-medium text-slate-300">Ningún elemento seleccionado</p>
        <span class="text-[11px] text-slate-500 leading-relaxed">Selecciona un elemento en cualquier vista para ver y editar sus parámetros BIM.</span>
      </div>
    `;
  }
}