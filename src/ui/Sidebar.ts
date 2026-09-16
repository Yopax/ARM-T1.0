import { ManagedElement } from '../tools/structural/types';
import { ViewManager } from '../core/views/ViewManager';
import { GridElement } from '../config/structural.config';
import { Level } from '../core/level/types/LevelTypes';
import { LevelQuickGenerator } from '../core/level/generator/LevelQuickGenerator';

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
    document.querySelectorAll<HTMLElement>('#sidebar-browser .tree-item[data-open-view]').forEach(item => {
      const viewId = item.dataset.openView;
      if (!viewId) return;

      item.addEventListener('dblclick', (e) => {
        e.preventDefault();
        this.viewManager.openView(viewId);
      });

      item.addEventListener('click', () => {
        this.viewManager.openView(viewId);
      });
    });
  }

  /**
   * Sincroniza reactivamente el Navegador de Proyectos (Project Browser) con los niveles del proyecto
   */
  public updateProjectBrowser(levels: Level[], activeViewId: string): void {
    const list = document.getElementById('browser-floor-plans-list');
    const countBadge = document.getElementById('browser-plan-count');
    if (!list) return;

    const planLevels = levels.filter(l => l.hasPlanView !== false);
    if (countBadge) {
      countBadge.textContent = planLevels.length.toString();
    }

    list.innerHTML = '';

    if (planLevels.length === 0) {
      list.innerHTML = '<div class="text-[11px] text-slate-500 italic px-2 py-1 select-none">(Sin planos generados)</div>';
    } else {
      planLevels.forEach(lvl => {
        const sign = lvl.elevation >= 0 ? '+' : '';
        const formattedElev = `${sign}${lvl.elevation.toFixed(2)}m`;
        const cleanName = lvl.name.split('(')[0].trim();
        const viewId = `plan-${lvl.id}`;
        const isActive = activeViewId === viewId;

        const item = document.createElement('div');
        item.className = `tree-item flex items-center justify-between gap-1.5 px-2 py-1 rounded text-xs cursor-pointer select-none transition-colors ${
          isActive 
            ? 'bg-sky-500/20 text-sky-300 font-semibold border-l-2 border-sky-400' 
            : 'text-slate-300 hover:bg-white/5 hover:text-sky-400'
        }`;
        item.dataset.openView = viewId;
        item.title = `Doble clic para abrir: Planta - ${cleanName} (${formattedElev})`;

        item.innerHTML = `
          <div class="flex items-center gap-1.5 truncate flex-1 pointer-events-none">
            <span class="text-xs shrink-0">📐</span>
            <span class="truncate">Planta - ${cleanName}</span>
          </div>
          <span class="text-[10px] font-mono text-slate-400 shrink-0 font-normal">${formattedElev}</span>
        `;

        // Doble clic: abre la pestaña en el workspace de acuerdo al estándar Autodesk Revit
        item.addEventListener('dblclick', (e) => {
          e.preventDefault();
          this.viewManager.openView(viewId);
        });

        // Clic simple: también abre/activa para una navegación ágil
        item.addEventListener('click', () => {
          this.viewManager.openView(viewId);
        });

        list.appendChild(item);
      });
    }

    // Actualizar resaltado de vistas 3D y elevaciones fijas en el árbol
    document.querySelectorAll<HTMLElement>('#sidebar-browser .tree-item[data-open-view]').forEach(item => {
      const viewId = item.dataset.openView;
      if (viewId && !viewId.startsWith('plan-')) {
        const isActive = activeViewId === viewId;
        item.classList.toggle('bg-sky-500/20', isActive);
        item.classList.toggle('text-sky-300', isActive);
        item.classList.toggle('font-semibold', isActive);
        item.classList.toggle('border-l-2', isActive);
        item.classList.toggle('border-sky-400', isActive);
        item.classList.toggle('text-slate-300', !isActive);
      }
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

  public showLevelProperties(
    level: Level,
    onUpdate: (updated: Level) => void,
    onDelete: (id: string) => void
  ): void {
    this.currentElement = null;
    this.currentGrid = null;

    const shortName = level.name.split('(')[0]?.trim() || level.name;
    const elevFormatted = level.elevation.toFixed(2);

    this.propContent.innerHTML = `
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between border-b border-sky-500/30 pb-2">
          <div class="flex items-center gap-1.5">
            <span class="text-sky-400 font-bold text-sm">Nivel BIM</span>
            <span class="text-[10px] bg-sky-950 text-sky-400 border border-sky-800 px-1.5 py-0.5 rounded font-mono">${LevelQuickGenerator.formatElevation(level.elevation)}</span>
          </div>
          <span class="text-[10px] text-slate-500 font-mono">${level.id}</span>
        </div>

        <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Identidad</div>
        <div class="flex justify-between items-center text-xs text-slate-400 py-1">
          <span>Nombre de Nivel:</span>
          <input id="lvl-name-input" type="text" value="${shortName}" class="w-28 px-2 py-0.5 bg-slate-950 border border-sky-500/40 rounded text-slate-100 text-xs font-bold text-center outline-none focus:border-sky-400" />
        </div>

        <div class="text-[10px] text-slate-400 uppercase font-bold mt-2 tracking-wider">Cota y Elevación</div>
        <div class="flex justify-between items-center text-xs text-slate-400 py-1">
          <span>Cota Global (Y):</span>
          <div class="flex items-center gap-1">
            <input id="lvl-elev-input" type="number" step="0.1" value="${elevFormatted}" class="w-20 px-2 py-0.5 bg-slate-950 border border-sky-500/40 rounded text-sky-400 text-xs font-mono font-bold text-center outline-none focus:border-sky-400" />
            <span class="text-xs text-slate-400">m</span>
          </div>
        </div>
        <div class="flex justify-between text-xs text-slate-400 py-0.5">
          <span>Vista de Plano:</span>
          <strong class="${level.hasPlanView ? 'text-sky-400' : 'text-slate-500'} font-medium">
            ${level.hasPlanView ? 'Asociada (Cabezal Azul)' : 'Sin Vista (Cabezal Gris)'}
          </strong>
        </div>

        <div class="text-[10px] text-slate-400 uppercase font-bold mt-2 tracking-wider">Cabezales y Burbujas</div>
        <div class="flex flex-col gap-1 text-xs text-slate-300 py-1">
          <label class="flex items-center gap-2 cursor-pointer">
            <input id="lvl-prop-bubble-start" type="checkbox" ${level.showStartBubble ? 'checked' : ''} class="accent-sky-500 rounded" />
            <span>Mostrar Cabezal en Extremo Inicial (Izquierda)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input id="lvl-prop-bubble-end" type="checkbox" ${level.showEndBubble ? 'checked' : ''} class="accent-sky-500 rounded" />
            <span>Mostrar Cabezal en Extremo Final (Derecha)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer mt-1">
            <input id="lvl-prop-locked" type="checkbox" ${level.isLocked ? 'checked' : ''} class="accent-sky-500 rounded" />
            <span>🔒 Bloquear Alineación con Grupo (Revit Lock)</span>
          </label>
        </div>

        <div class="text-[10px] text-slate-400 uppercase font-bold mt-2 tracking-wider">Codo / Quiebre (Level Elbow)</div>
        <div class="flex flex-col gap-1.5 text-xs text-slate-300 py-1">
          <label class="flex items-center gap-2 cursor-pointer">
            <input id="lvl-prop-elbow-end" type="checkbox" ${level.endElbow?.active ? 'checked' : ''} class="accent-purple-500 rounded" />
            <span>Quiebre de Hombro en Extremo Derecho</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input id="lvl-prop-elbow-start" type="checkbox" ${level.startElbow?.active ? 'checked' : ''} class="accent-purple-500 rounded" />
            <span>Quiebre de Hombro en Extremo Izquierdo</span>
          </label>
        </div>

        <div class="pt-3 border-t border-slate-800 flex flex-col gap-2">
          <button id="btn-delete-lvl-prop" class="w-full py-1.5 px-3 bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 hover:text-red-200 text-xs font-semibold rounded cursor-pointer transition-colors flex items-center justify-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            <span>Eliminar Nivel</span>
          </button>
        </div>
      </div>
    `;

    const nameInput = document.getElementById('lvl-name-input') as HTMLInputElement;
    nameInput?.addEventListener('change', () => {
      const val = nameInput.value.trim();
      if (val) {
        level.name = `${val} (${LevelQuickGenerator.formatElevation(level.elevation)})`;
        onUpdate(level);
      }
    });

    const elevInput = document.getElementById('lvl-elev-input') as HTMLInputElement;
    elevInput?.addEventListener('change', () => {
      const val = parseFloat(elevInput.value);
      if (!isNaN(val)) {
        level.elevation = Number(val.toFixed(2));
        const pureName = level.name.split('(')[0]?.trim() || level.name;
        level.name = `${pureName} (${LevelQuickGenerator.formatElevation(level.elevation)})`;
        onUpdate(level);
      }
    });

    const startCb = document.getElementById('lvl-prop-bubble-start') as HTMLInputElement;
    startCb?.addEventListener('change', () => {
      level.showStartBubble = startCb.checked;
      onUpdate(level);
    });

    const endCb = document.getElementById('lvl-prop-bubble-end') as HTMLInputElement;
    endCb?.addEventListener('change', () => {
      level.showEndBubble = endCb.checked;
      onUpdate(level);
    });

    const lockCb = document.getElementById('lvl-prop-locked') as HTMLInputElement;
    lockCb?.addEventListener('change', () => {
      level.isLocked = lockCb.checked;
      onUpdate(level);
    });

    const startElbowCb = document.getElementById('lvl-prop-elbow-start') as HTMLInputElement;
    startElbowCb?.addEventListener('change', () => {
      if (!level.startElbow) {
        level.startElbow = { active: startElbowCb.checked, verticalOffset: 0.8, breakDistance: 3.0 };
      } else {
        level.startElbow.active = startElbowCb.checked;
      }
      onUpdate(level);
    });

    const endElbowCb = document.getElementById('lvl-prop-elbow-end') as HTMLInputElement;
    endElbowCb?.addEventListener('change', () => {
      if (!level.endElbow) {
        level.endElbow = { active: endElbowCb.checked, verticalOffset: 0.8, breakDistance: 3.0 };
      } else {
        level.endElbow.active = endElbowCb.checked;
      }
      onUpdate(level);
    });

    document.getElementById('btn-delete-lvl-prop')?.addEventListener('click', () => {
      onDelete(level.id);
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