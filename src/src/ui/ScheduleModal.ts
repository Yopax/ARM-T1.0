import { BimDatabase } from '../core/database/BimDatabase';
import { BimCategory, BimElementDocument, GroupedScheduleRow } from '../core/database/BimDatabaseTypes';

export class ScheduleModal {
  private container: HTMLElement;
  private currentCategory: BimCategory | 'ALL' = 'ALL';
  private currentLevel = 'ALL';
  private currentSector = 'ALL';
  private currentSearch = '';
  private itemizeEveryInstance = true; // Revit "Detallar cada ejemplar"

  constructor(
    private onSelectElement: (elementId: number | string) => void,
    private onDeleteElement?: (elementId: number | string) => void
  ) {
    this.container = document.createElement('div');
    this.container.id = 'bim-schedule-modal';
    this.container.className =
      'fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden';
    document.body.appendChild(this.container);

    this.render();

    // Escuchar cambios reactivos de la base de datos BIM
    BimDatabase.getInstance().subscribe(() => {
      if (!this.container.classList.contains('hidden')) {
        this.renderTable();
      }
    });
  }

  public open(defaultCategory: BimCategory | 'ALL' = 'ALL'): void {
    this.currentCategory = defaultCategory;
    const catSelect = document.getElementById('sched-filter-category') as HTMLSelectElement;
    if (catSelect) {
      catSelect.value = defaultCategory;
    }
    this.container.classList.remove('hidden');
    this.renderTable();
  }

  public close(): void {
    this.container.classList.add('hidden');
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="bg-slate-900 border border-slate-700 w-full max-w-6xl max-h-[92vh] rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        <!-- HEADER -->
        <div class="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-lg">
              📊
            </div>
            <div>
              <h2 class="text-sm font-bold text-white flex items-center gap-2">
                Tabla de Planificación y Cuantificación de Materiales
                <span class="text-[10px] bg-sky-950 text-sky-400 border border-sky-800 px-2 py-0.5 rounded font-mono">Revit Schedule / BSON Ready</span>
              </h2>
              <p class="text-[11px] text-slate-400">Metodología Relacional Orientada a Objetos • Bidireccionalidad 3D ⇄ Base de Datos</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-sched-export-csv" class="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer">
              <span>📥</span> Exportar CSV (Excel)
            </button>
            <button id="btn-sched-export-json" class="px-2.5 py-1 text-xs font-semibold bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer">
              <span>🍃</span> Exportar MongoDB JSON
            </button>
            <button id="btn-sched-close" class="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 text-base leading-none cursor-pointer">
              ✕
            </button>
          </div>
        </div>

        <!-- FILTROS, AGRUPACIÓN Y BÚSQUEDA -->
        <div class="px-5 py-2.5 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-3 text-xs">
            <div class="flex items-center gap-1.5">
              <label class="text-[11px] font-semibold text-slate-400 uppercase">Categoría:</label>
              <select id="sched-filter-category" class="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-sky-500">
                <option value="ALL">Todo el Modelo (General)</option>
                <option value="OST_StructuralColumns">Pilares Estructurales (Columnas)</option>
                <option value="OST_StructuralFraming">Armazón Estructural (Vigas)</option>
                <option value="OST_StructuralFoundation">Cimentación Estructural (Zapatas)</option>
                <option value="OST_Floors">Suelos y Losas de Concreto</option>
              </select>
            </div>

            <div class="flex items-center gap-1.5">
              <label class="text-[11px] font-semibold text-slate-400 uppercase">Sector:</label>
              <select id="sched-filter-sector" class="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-sky-500">
                <option value="ALL">Todos los Sectores</option>
                <option value="Sector A">Sector A</option>
                <option value="Sector B">Sector B</option>
                <option value="Sector C">Sector C</option>
                <option value="Sector D">Sector D</option>
              </select>
            </div>

            <!-- Revit "Detallar cada ejemplar" -->
            <div class="flex items-center gap-2 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded">
              <input type="checkbox" id="sched-check-itemize" checked class="cursor-pointer accent-sky-500" />
              <label for="sched-check-itemize" class="text-[11px] text-slate-300 font-medium cursor-pointer select-none">
                Detallar cada ejemplar
              </label>
            </div>

            <div class="flex items-center gap-1.5">
              <label class="text-[11px] font-semibold text-slate-400 uppercase">Buscar:</label>
              <input id="sched-filter-search" type="text" placeholder="ID, GUID, Marca..." class="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-sky-500 w-32" />
            </div>
          </div>

          <!-- TARJETAS DE RESUMEN Y TOTALES GENERALES -->
          <div id="sched-summary-cards" class="flex items-center gap-2.5 text-xs">
            <!-- Renderizado dinámico -->
          </div>
        </div>

        <!-- CONTENEDOR DE TABLA -->
        <div class="flex-1 overflow-auto p-0 min-h-[300px] max-h-[56vh]">
          <table class="w-full border-collapse text-left text-xs">
            <thead id="sched-thead" class="sticky top-0 bg-slate-950 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800 z-10">
              <!-- Renderizado dinámico según modo detallado vs agrupado -->
            </thead>
            <tbody id="sched-tbody" class="divide-y divide-slate-800/60 font-mono text-[11px]">
              <!-- Filas renderizadas dinámicamente -->
            </tbody>
          </table>
        </div>

        <!-- FOOTER INFO Y TOTALES -->
        <div class="px-5 py-2.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-400">
          <span class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Base de datos orientada a objetos sincronizada en tiempo real.
          </span>
          <span class="text-slate-400">
            Bidireccional: Editar la Marca o Sector en la tabla actualiza el modelo 3D y la paleta de propiedades.
          </span>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    document.getElementById('btn-sched-close')?.addEventListener('click', () => this.close());

    const catSelect = document.getElementById('sched-filter-category') as HTMLSelectElement;
    catSelect?.addEventListener('change', () => {
      this.currentCategory = catSelect.value as BimCategory | 'ALL';
      this.renderTable();
    });

    const secSelect = document.getElementById('sched-filter-sector') as HTMLSelectElement;
    secSelect?.addEventListener('change', () => {
      this.currentSector = secSelect.value;
      this.renderTable();
    });

    const checkItemize = document.getElementById('sched-check-itemize') as HTMLInputElement;
    checkItemize?.addEventListener('change', () => {
      this.itemizeEveryInstance = checkItemize.checked;
      this.renderTable();
    });

    const searchInput = document.getElementById('sched-filter-search') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.currentSearch = searchInput.value;
      this.renderTable();
    });

    document.getElementById('btn-sched-export-csv')?.addEventListener('click', () => {
      const csv = BimDatabase.getInstance().exportScheduleCsv(this.currentCategory);
      this.downloadFile(csv, `bim_schedule_${this.currentCategory.toLowerCase()}.csv`, 'text/csv');
    });

    document.getElementById('btn-sched-export-json')?.addEventListener('click', () => {
      const json = BimDatabase.getInstance().exportMongoDump();
      this.downloadFile(json, 'bim_mongodb_export.json', 'application/json');
    });
  }

  private renderTable(): void {
    const db = BimDatabase.getInstance();
    const { records, groupedRecords, summary } = db.querySchedule({
      category: this.currentCategory,
      sector: this.currentSector,
      search: this.currentSearch,
      groupByType: !this.itemizeEveryInstance,
    });

    // Actualizar Tarjetas de Resumen
    const summaryCards = document.getElementById('sched-summary-cards');
    if (summaryCards) {
      summaryCards.innerHTML = `
        <div class="px-2.5 py-1 bg-slate-800/80 rounded border border-slate-700">
          <span class="text-slate-400 text-[10px] uppercase font-bold block">Elementos</span>
          <span class="text-sky-400 font-bold font-mono text-xs">${summary.totalCount}</span>
        </div>
        <div class="px-2.5 py-1 bg-slate-800/80 rounded border border-slate-700">
          <span class="text-slate-400 text-[10px] uppercase font-bold block">Volumen Total</span>
          <span class="text-emerald-400 font-bold font-mono text-xs">${summary.totalVolume.toFixed(3)} m³</span>
        </div>
        <div class="px-2.5 py-1 bg-slate-800/80 rounded border border-slate-700">
          <span class="text-slate-400 text-[10px] uppercase font-bold block">Encofrado</span>
          <span class="text-amber-400 font-bold font-mono text-xs">${summary.totalSurfaceArea.toFixed(2)} m²</span>
        </div>
        <div class="px-2.5 py-1 bg-slate-800/80 rounded border border-slate-700">
          <span class="text-slate-400 text-[10px] uppercase font-bold block">Costo Est.</span>
          <span class="text-purple-400 font-bold font-mono text-xs">$${summary.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      `;
    }

    const thead = document.getElementById('sched-thead');
    const tbody = document.getElementById('sched-tbody');
    if (!tbody || !thead) return;

    if (!this.itemizeEveryInstance) {
      // MODO AGRUPADO POR TIPO (Revit: desmarcado "Detallar cada ejemplar")
      thead.innerHTML = `
        <tr>
          <th class="py-2.5 px-3">Categoría</th>
          <th class="py-2.5 px-3">Tipo de Familia</th>
          <th class="py-2.5 px-3 text-center">Conteo (Piezas)</th>
          <th class="py-2.5 px-3">Niveles</th>
          <th class="py-2.5 px-3">f'c (kg/cm²)</th>
          <th class="py-2.5 px-3 text-right">Volumen Acumulado (m³)</th>
          <th class="py-2.5 px-3 text-right">Encofrado Acumulado (m²)</th>
          <th class="py-2.5 px-3 text-right">Costo Acumulado ($)</th>
        </tr>
      `;

      if (!groupedRecords || groupedRecords.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="py-12 text-center text-slate-500 font-sans">
              No se encontraron elementos con los filtros seleccionados.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = groupedRecords
        .map((g) => `
          <tr class="hover:bg-slate-800/40 transition-colors text-slate-300">
            <td class="py-2 px-3 font-sans text-slate-400">${g.categoryName}</td>
            <td class="py-2 px-3 font-sans font-bold text-slate-100">${g.familyType}</td>
            <td class="py-2 px-3 text-center text-sky-400 font-bold">${g.count} uds</td>
            <td class="py-2 px-3 font-sans text-slate-400">${g.levelNames.join(', ')}</td>
            <td class="py-2 px-3 text-slate-300">${g.avgConcreteStrength} kg/cm²</td>
            <td class="py-2 px-3 text-right text-emerald-400 font-bold">${g.totalVolume.toFixed(3)}</td>
            <td class="py-2 px-3 text-right text-amber-400">${g.totalSurfaceArea.toFixed(2)}</td>
            <td class="py-2 px-3 text-right text-purple-400 font-bold">$${g.totalCost.toFixed(2)}</td>
          </tr>
        `)
        .join('');

    } else {
      // MODO DETALLADO (Cada ejemplar con Element ID y GUID)
      thead.innerHTML = `
        <tr>
          <th class="py-2.5 px-3">Element ID</th>
          <th class="py-2.5 px-3">GUID (128-bit)</th>
          <th class="py-2.5 px-3">Categoría</th>
          <th class="py-2.5 px-3">Tipo de Familia</th>
          <th class="py-2.5 px-3">Código / Marca</th>
          <th class="py-2.5 px-3">Nivel Base</th>
          <th class="py-2.5 px-3">Sector</th>
          <th class="py-2.5 px-3">f'c (kg/cm²)</th>
          <th class="py-2.5 px-3 text-right">Volumen (m³)</th>
          <th class="py-2.5 px-3 text-right">Encofrado (m²)</th>
          <th class="py-2.5 px-3 text-right">Costo Est. ($)</th>
          <th class="py-2.5 px-3 text-center">Acción</th>
        </tr>
      `;

      if (records.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="12" class="py-12 text-center text-slate-500 font-sans">
              No se encontraron elementos estructurales en la base de datos con los filtros seleccionados.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = records
        .map((r) => {
          const shortGuid = `${r.uniqueId.slice(0, 8)}...${r.uniqueId.slice(-4)}`;
          return `
            <tr class="hover:bg-slate-800/40 transition-colors text-slate-300" data-guid="${r.uniqueId}">
              <td class="py-2 px-3 text-sky-400 font-bold">${r.elementId}</td>
              <td class="py-2 px-3 text-slate-500 font-mono" title="${r.uniqueId}">
                <div class="flex items-center gap-1">
                  <span>${shortGuid}</span>
                  <button class="btn-copy-guid opacity-60 hover:opacity-100 text-[10px] hover:text-white cursor-pointer" data-guid="${r.uniqueId}" title="Copiar GUID">📋</button>
                </div>
              </td>
              <td class="py-2 px-3 font-sans text-slate-400">${r.categoryName}</td>
              <td class="py-2 px-3 font-sans font-medium text-slate-200">${r.familyType}</td>
              <td class="py-2 px-3">
                <input type="text" value="${r.instanceParameters.mark}" class="input-mark w-20 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-sky-300 font-bold outline-none focus:border-sky-400" data-guid="${r.uniqueId}" />
              </td>
              <td class="py-2 px-3 font-sans text-slate-400">${r.levelName}</td>
              <td class="py-2 px-3">
                <select class="select-sector bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-slate-300 outline-none focus:border-sky-400" data-guid="${r.uniqueId}">
                  <option value="Sector A" ${r.instanceParameters.sector === 'Sector A' ? 'selected' : ''}>Sector A</option>
                  <option value="Sector B" ${r.instanceParameters.sector === 'Sector B' ? 'selected' : ''}>Sector B</option>
                  <option value="Sector C" ${r.instanceParameters.sector === 'Sector C' ? 'selected' : ''}>Sector C</option>
                  <option value="Sector D" ${r.instanceParameters.sector === 'Sector D' ? 'selected' : ''}>Sector D</option>
                </select>
              </td>
              <td class="py-2 px-3">
                <select class="select-fc bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-slate-300 outline-none focus:border-sky-400" data-guid="${r.uniqueId}">
                  <option value="210" ${r.instanceParameters.concreteStrength === 210 ? 'selected' : ''}>210 kg/cm²</option>
                  <option value="280" ${r.instanceParameters.concreteStrength === 280 ? 'selected' : ''}>280 kg/cm²</option>
                  <option value="350" ${r.instanceParameters.concreteStrength === 350 ? 'selected' : ''}>350 kg/cm²</option>
                </select>
              </td>
              <td class="py-2 px-3 text-right text-emerald-400 font-bold">${r.instanceParameters.volume.toFixed(3)}</td>
              <td class="py-2 px-3 text-right text-amber-400">${r.instanceParameters.surfaceArea.toFixed(2)}</td>
              <td class="py-2 px-3 text-right text-purple-400 font-semibold">$${r.instanceParameters.estimatedCost.toFixed(2)}</td>
              <td class="py-2 px-3 text-center">
                <div class="flex items-center justify-center gap-1.5">
                  <button class="btn-focus-element px-2 py-0.5 bg-sky-950 hover:bg-sky-900 text-sky-400 border border-sky-800 rounded font-sans text-[10px] font-semibold cursor-pointer transition-colors" data-guid="${r.uniqueId}" data-element-id="${r.elementId}" title="Ver y seleccionar en 3D">
                    🎯 3D
                  </button>
                  <button class="btn-delete-element px-1.5 py-0.5 bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-800 rounded font-sans text-[10px] font-semibold cursor-pointer transition-colors" data-guid="${r.uniqueId}" data-element-id="${r.elementId}" title="Eliminar elemento del modelo">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');

      this.bindTableInteractions();
    }
  }

  private bindTableInteractions(): void {
    const db = BimDatabase.getInstance();

    // Copiar GUID
    this.container.querySelectorAll<HTMLButtonElement>('.btn-copy-guid').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const guid = btn.dataset.guid;
        if (guid) {
          navigator.clipboard.writeText(guid);
          btn.textContent = '✓';
          setTimeout(() => (btn.textContent = '📋'), 1500);
        }
      });
    });

    // Edición bidireccional de Marca / Código
    this.container.querySelectorAll<HTMLInputElement>('.input-mark').forEach((inp) => {
      inp.addEventListener('change', () => {
        const guid = inp.dataset.guid;
        if (guid && inp.value.trim()) {
          db.updateInstanceParameters(guid, { mark: inp.value.trim() });
        }
      });
    });

    // Edición bidireccional de Sector
    this.container.querySelectorAll<HTMLSelectElement>('.select-sector').forEach((sel) => {
      sel.addEventListener('change', () => {
        const guid = sel.dataset.guid;
        if (guid) {
          db.updateInstanceParameters(guid, { sector: sel.value });
        }
      });
    });

    // Edición bidireccional de f'c
    this.container.querySelectorAll<HTMLSelectElement>('.select-fc').forEach((sel) => {
      sel.addEventListener('change', () => {
        const guid = sel.dataset.guid;
        if (guid) {
          db.updateInstanceParameters(guid, { concreteStrength: parseInt(sel.value, 10) });
        }
      });
    });

    // Seleccionar y enfocar en el modelo 3D (Botón '🎯 3D')
    this.container.querySelectorAll<HTMLButtonElement>('.btn-focus-element').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const elementId = btn.dataset.elementId;
        const guid = btn.dataset.guid;
        // Preferir GUID por ser único e inequívoco, o el elementId
        const targetId = guid || (elementId ? parseInt(elementId, 10) : undefined);
        if (targetId) {
          this.close();
          this.onSelectElement(targetId);
        }
      });
    });

    // Doble clic en cualquier fila de la tabla enfoca y selecciona el elemento en 3D (Estándar Revit)
    this.container.querySelectorAll<HTMLTableRowElement>('tbody tr[data-guid]').forEach((tr) => {
      tr.addEventListener('dblclick', (e) => {
        const target = e.target as HTMLElement;
        // Evitar activar si se estaba interactuando con un input, select o botón
        if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'BUTTON') return;
        const guid = tr.dataset.guid;
        if (guid) {
          this.close();
          this.onSelectElement(guid);
        }
      });
    });

    // Eliminar elemento bidireccionalmente del modelo 3D y la base de datos
    this.container.querySelectorAll<HTMLButtonElement>('.btn-delete-element').forEach((btn) => {
      btn.addEventListener('click', () => {
        const elementId = btn.dataset.elementId;
        const guid = btn.dataset.guid;
        const idToDelete = elementId ? parseInt(elementId, 10) : guid;
        if (idToDelete && confirm(`¿Eliminar elemento ${idToDelete} del modelo 3D y la base de datos?`)) {
          if (this.onDeleteElement) {
            this.onDeleteElement(idToDelete);
          } else if (guid) {
            db.deleteElement(guid);
          }
        }
      });
    });
  }

  private downloadFile(content: string, fileName: string, contentType: string): void {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}
