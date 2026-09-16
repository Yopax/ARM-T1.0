export type VisualStyle = 'hidden_line' | 'wireframe' | 'consistent_colors' | 'shaded';

export const THEME = {
  // 1. ENTORNO Y VISOR
  viewport: {
    background: 0x0f172a, // Fondo por defecto para modo sombreado
  },

  // 2. ILUMINACIÓN
  lights: {
    ambient: 0xffffff,
    hemiSky: 0xffffff,
    hemiGround: 0x64748b,
    directional: 0xffffff,
  },

  // 3. GRILLAS
  grids: {
    baseCenter: 0x38bdf8,
    baseLines: 0x334155,
    levelCenter: 0x64748b,
    levelLines: 0x334155,
    opacity: 0.25,
  },
  snapping: {
    ring: 0x38bdf8,
  },

  // 4. ELEMENTOS ESTRUCTURALES (Modo Sombreado)
  elements: {
    footing: { surface: 0x9A9A92, edge: 0x000000 },
    column:  { surface: 0x9A9A92, edge: 0x000000 },
    beam:    { surface: 0x9A9A92, edge: 0x000000 },
    slab:    { surface: 0x3d85c6, edge: 0x000000 },
  },

  // 5. PRESETS PARA ESTILOS VISUALES REVIT
  styles: {
    hidden_line: {
      background: 0xffffff, // Fondo blanco papel
      surface: 0xffffff,    // Caras blancas opacas que tapan lo que hay detrás
      edge: 0x000000,       // Aristas negras nítidas de tinta
      gridCenter: 0x94a3b8, // Grilla tenue en plano blanco
      gridLines: 0xe2e8f0,
    },
    wireframe: {
      background: 0xffffff, // Fondo blanco
      edge: 0x000000,       // Todas las aristas visibles a través del modelo
    },
    consistent_colors: {
      background: 0xffffff, // Fondo claro
      edge: 0x000000,       // Aristas negras delimitadoras
    },
    shaded: {
      background: 0x0f172a, // Fondo oscuro CAD
    }
  }
};
