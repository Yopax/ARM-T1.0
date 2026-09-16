import { BimView } from '../core/views/BimView';
import { SplitLayout, ViewManager } from '../core/views/ViewManager';

export class ViewTabsBar {
  private tabsContainer: HTMLElement;

  constructor(private viewManager: ViewManager) {
    this.tabsContainer = document.getElementById('view-tabs-list')!;
    this.bindLayoutButtons();
  }

  public renderTabs(views: BimView[], activeId: string): void {
    this.tabsContainer.innerHTML = '';
    views.forEach(v => {
      const tab = document.createElement('div');
      const isActive = v.id === activeId;
      tab.className = `flex items-center gap-1.5 px-2.5 py-1 rounded text-xs cursor-pointer transition-colors ${
        isActive 
          ? 'bg-slate-800 text-sky-400 font-semibold border-t-2 border-sky-400' 
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
      }`;
      tab.innerHTML = `<span>${v.title}</span>`;
      tab.addEventListener('click', () => this.viewManager.openView(v.id));
      this.tabsContainer.appendChild(tab);
    });
  }

  private bindLayoutButtons(): void {
    const layouts: { id: string; mode: SplitLayout }[] = [
      { id: 'layout-single', mode: 'single' },
      { id: 'layout-split-v', mode: 'split-v' },
      { id: 'layout-split-h', mode: 'split-h' },
      { id: 'layout-grid-4', mode: 'grid-4' },
    ];

    layouts.forEach(l => {
      document.getElementById(l.id)?.addEventListener('click', (e) => {
        layouts.forEach(x => {
          const btn = document.getElementById(x.id);
          if (btn) {
            btn.className = 'layout-btn px-2 py-0.5 rounded text-xs border border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200 cursor-pointer transition-colors';
          }
        });
        const current = e.currentTarget as HTMLElement;
        current.className = 'layout-btn px-2 py-0.5 rounded text-xs border border-sky-400 bg-sky-600 text-white font-medium cursor-pointer transition-colors';
        this.viewManager.setLayout(l.mode);
      });
    });
  }
}