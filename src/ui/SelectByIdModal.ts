import { BimDatabase } from '../core/database/BimDatabase';
import { BimElementDocument } from '../core/database/BimDatabaseTypes';

export class SelectByIdModal {
  private container: HTMLElement;

  constructor(
    private onConfirmSelection: (doc: BimElementDocument) => void
  ) {
    this.container = document.createElement('div');
    this.container.id = 'bim-select-by-id-modal';
    this.container.className =
      'fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden';
    document.body.appendChild(this.container);

    this.render();
  }

  public open(): void {
    this.container.classList.remove('hidden');
    const input = document.getElementById('select-id-input') as HTMLInputElement;
    if (input) {
      input.value = '';
      input.focus();
    }
    const resultDiv = document.getElementById('select-id-result');
    if (resultDiv) {
      resultDiv.innerHTML = `
        <div class="text-center text-slate-500 py-6 text-xs">
          Ingresa un Element ID numérico (ej: 100001), un GUID (ej: 3b9d0e65-...) o una Marca (ej: C-1).
        </div>
      `;
    }
    const btnSelect = document.getElementById('btn-select-confirm') as HTMLButtonElement;
    if (btnSelect) btnSelect.disabled = true;
  }

  public close(): void {
    this.container.classList.add('hidden');
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="bg-slate-900 border border-slate-700 w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        <!-- HEADER -->
        <div class="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sm">
              🔍
            </div>
            <div>
              <h2 class="text-sm font-bold text-white">Seleccionar por ID (Revit Select by ID)</h2>
              <p class="text-[11px] text-slate-400">Localiza instancias mediante Element ID o UniqueId (GUID)</p>
            </div>
          </div>
          <button id="btn-select-id-close" class="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 text-base leading-none cursor-pointer">
            ✕
          </button>
        </div>

        <!-- BODY -->
        <div class="p-5 flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <label for="select-id-input" class="text-xs font-semibold text-slate-300">Identificador:</label>
            <input 
              id="select-id-input" 
              type="text" 
              placeholder="Ej: 100001, o f47ac10b..., o C-1" 
              class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-sm text-sky-400 font-mono outline-none focus:border-sky-500" 
            />
          </div>

          <!-- RESULTADO PREVIO -->
          <div id="select-id-result" class="bg-slate-950/80 border border-slate-800 rounded-lg p-3 min-h-[100px]">
            <!-- Renderizado dinámico -->
          </div>
        </div>

        <!-- FOOTER -->
        <div class="px-5 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-end gap-2">
          <button id="btn-select-cancel" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer">
            Cancelar
          </button>
          <button id="btn-select-confirm" disabled class="px-3 py-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-md transition-colors cursor-pointer flex items-center gap-1.5">
            <span>🎯</span> Seleccionar en Vista
          </button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    document.getElementById('btn-select-id-close')?.addEventListener('click', () => this.close());
    document.getElementById('btn-select-cancel')?.addEventListener('click', () => this.close());

    const input = document.getElementById('select-id-input') as HTMLInputElement;
    const resultDiv = document.getElementById('select-id-result');
    const btnSelect = document.getElementById('btn-select-confirm') as HTMLButtonElement;

    let matchedDoc: BimElementDocument | undefined;

    input?.addEventListener('input', () => {
      const val = input.value.trim();
      if (!val) {
        matchedDoc = undefined;
        btnSelect.disabled = true;
        if (resultDiv) {
          resultDiv.innerHTML = `
            <div class="text-center text-slate-500 py-6 text-xs">
              Ingresa un Element ID numérico (ej: 100001), un GUID o una Marca (ej: C-1).
            </div>
          `;
        }
        return;
      }

      matchedDoc = BimDatabase.getInstance().searchById(val);

      if (matchedDoc) {
        btnSelect.disabled = false;
        if (resultDiv) {
          resultDiv.innerHTML = `
            <div class="flex flex-col gap-2 text-xs">
              <div class="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span class="text-sky-400 font-bold text-sm">${matchedDoc.instanceParameters.mark}</span>
                <span class="text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded">ID: ${matchedDoc.elementId}</span>
              </div>
              <div class="text-slate-300 flex justify-between">
                <span class="text-slate-500">Categoría:</span>
                <span>${matchedDoc.categoryName}</span>
              </div>
              <div class="text-slate-300 flex justify-between">
                <span class="text-slate-500">Tipo:</span>
                <span class="font-medium">${matchedDoc.familyType}</span>
              </div>
              <div class="text-slate-300 flex justify-between">
                <span class="text-slate-500">Nivel:</span>
                <span>${matchedDoc.levelName}</span>
              </div>
              <div class="text-slate-300 flex justify-between font-mono">
                <span class="text-slate-500">Volumen:</span>
                <span class="text-emerald-400 font-bold">${matchedDoc.instanceParameters.volume.toFixed(3)} m³</span>
              </div>
              <div class="text-[10px] text-slate-500 font-mono truncate pt-1 border-t border-slate-800/80">
                GUID: ${matchedDoc.uniqueId}
              </div>
            </div>
          `;
        }
      } else {
        btnSelect.disabled = true;
        if (resultDiv) {
          resultDiv.innerHTML = `
            <div class="text-center text-red-400/80 py-6 text-xs">
              ⚠️ No se encontró ningún elemento en la base de datos con el identificador "${val}".
            </div>
          `;
        }
      }
    });

    btnSelect?.addEventListener('click', () => {
      if (matchedDoc) {
        this.close();
        this.onConfirmSelection(matchedDoc);
      }
    });
  }
}
