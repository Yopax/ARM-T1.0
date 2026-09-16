import { LEVELS } from '../config/structural.config';

export class LevelSelector {
  private select = document.getElementById('level-select') as HTMLSelectElement;

  constructor(private onChange: (levelIdx: number) => void) {
    this.select.innerHTML = LEVELS.map(l => 
      `<option value="${l.index}">${l.name}</option>`
    ).join('');

    this.select.addEventListener('change', () => {
      this.onChange(parseInt(this.select.value));
    });
  }
}
