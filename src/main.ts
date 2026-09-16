import * as THREE from 'three';
import { Viewer } from './core/Viewer';
import { GridSystem } from './core/GridSystem';
import { LevelSystem } from './core/LevelSystem';
import { WasmBridge } from './kernel/WasmBridge';
import { SnappingManager } from './tools/SnappingManager';
import { StructuralManager } from './tools/StructuralManager';
import { SelectionManager } from './tools/SelectionManager';
import { PlacementPreview } from './tools/PlacementPreview';
import { GridDrawingManager } from './tools/GridDrawingManager';
import { HeaderRibbon } from './ui/HeaderRibbon';
import { ContextualSubheader } from './ui/ContextualSubheader';
import { Sidebar } from './ui/Sidebar';
import { ViewTabsBar } from './ui/ViewTabsBar';
import { FooterStatusBar } from './ui/FooterStatusBar';
import { LEVELS, LEVELS_Y } from './config/structural.config';
import { DIMENSIONS } from './config/dimensions.config';

async function bootstrap() {
  const viewer = new Viewer();
  // 1. ESCENA LIMPIA: El sistema de grillas inicia vacío
  const gridSystem = new GridSystem(viewer.scene);
  // 2. Sistema de Niveles visible en 3D
  const levelSystem = new LevelSystem(viewer.scene);

  const footer = new FooterStatusBar();
  const preview = new PlacementPreview(viewer.scene);

  const wasm = new WasmBridge();
  await wasm.init();

  const structural = new StructuralManager(viewer.scene, wasm, metrics => {
    footer.updateMetrics(metrics.count, metrics.volume, metrics.durationMs, 60);
  });

  viewer.setFpsCallback(fps => {
    footer.updateMetrics(structural.elementCount, structural.totalVolume, 0, fps);
  });

  const snapping = new SnappingManager(viewer.scene, () => viewer.viewManager.getActiveView());

  const sidebar = new Sidebar(viewer.viewManager, (element) => {
    structural.removeElement(element);
    selection.clearSelection();
  });

  const selection = new SelectionManager(
    viewer.scene,
    () => viewer.viewManager.getActiveView(),
    structural.registry,
    (element) => {
      if (element) {
        gridSystem.selectGrid(null);
        sidebar.showElementProperties(element);
      } else {
        sidebar.showEmptyProperties();
      }
    }
  );

  const tabsBar = new ViewTabsBar(viewer.viewManager);
  viewer.viewManager.setCallbacks(
    (activeView) => footer.setMessage(`Vista activa: ${activeView.title}`),
    (views, activeId) => tabsBar.renderTabs(views, activeId)
  );

  // Herramienta de Dibujo de Grillas Autodesk Revit Style
  const gridDrawingManager = new GridDrawingManager(
    viewer.scene,
    gridSystem,
    structural.registry,
    () => viewer.viewManager.getActiveView(),
    (msg) => footer.setMessage(msg)
  );

  // REGLAS DE VISIBILIDAD POR VISTA:
  // Grillas: Ocultas en vista 3D, visibles únicamente en vistas 2D de planta.
  // Niveles: Visibles en vista 3D y elevaciones.
  viewer.viewManager.onBeforeRenderView = (view) => {
    const isPlan = view.type === 'plan';
    gridSystem.group.visible = isPlan;
    gridDrawingManager.previewGroup.visible = isPlan;
    levelSystem.group.visible = (view.type === '3d' || view.type === 'elevation');
  };

  // Helper para mantener sincronizado el selector de niveles del ribbon superior
  const updateRibbonLevelSelector = () => {
    const sel = document.getElementById('ribbon-level-select') as HTMLSelectElement;
    if (!sel) return;
    const currentLevels = levelSystem.getLevels();
    sel.innerHTML = '';
    currentLevels.forEach((lvl, idx) => {
      const opt = document.createElement('option');
      opt.value = idx.toString();
      const sign = lvl.elevation >= 0 ? '+' : '';
      opt.textContent = `${lvl.name} (${sign}${lvl.elevation.toFixed(2)}m)`;
      if (idx === snapping.activeLevelIdx) {
        opt.selected = true;
      }
      sel.appendChild(opt);
    });
    if (snapping.activeLevelIdx >= currentLevels.length) {
      snapping.activeLevelIdx = Math.max(0, currentLevels.length - 1);
    }
  };

  // Subheader Contextual
  let contextualBar: ContextualSubheader;
  contextualBar = new ContextualSubheader({
    onDrawModeChange: (mode) => {
      gridDrawingManager.setMode(mode);
      footer.setMessage(`Modo dibujo rejilla Revit: ${mode.toUpperCase()}`);
    },
    onOffsetChange: (offset) => {
      gridDrawingManager.setOffset(offset);
      footer.setMessage(`Desfase (Offset): ${offset.toFixed(2)}m`);
    },
    onChainChange: (chain) => {
      gridDrawingManager.setChain(chain);
      footer.setMessage(`Cadena: ${chain ? 'Activada' : 'Desactivada'}`);
    },
    onFilletRadiusChange: (radius) => {
      gridDrawingManager.setFilletRadius(radius);
    },
    onApplyTemplate: (template) => {
      gridSystem.applyTemplate(template);
      footer.setMessage(`Plantilla de rejilla aplicada: ${template}`);
    },
    onQuickGenerate: (h, v, countX, countZ) => {
      gridSystem.quickGenerate(h, v, countX || 5, countZ || 5);
      footer.setMessage(`Rejilla generada: ${h}m × ${v}m (${countX || 5}x${countZ || 5} ejes)`);
    },
    // Acciones de Niveles (Niveles Revit)
    onLevelDrawModeChange: (mode) => {
      footer.setMessage(`Modo colocación nivel: ${mode === 'line' ? 'Línea (2 clics horizontal en alzado)' : 'Pick Line (Desfase desde nivel existente)'}`);
    },
    onLevelOffsetChange: (offset) => {
      footer.setMessage(`Desfase de nivel: ${offset.toFixed(2)}m`);
    },
    onLevelMakePlanViewChange: (makePlan) => {
      footer.setMessage(`Crear vista de plano de planta asociada: ${makePlan ? 'Activado' : 'Desactivado'}`);
    },
    onApplyLevelTemplate: (template) => {
      const generated = levelSystem.applyTemplate(template);
      updateRibbonLevelSelector();
      viewer.viewManager.syncPlanViews(generated);
      footer.setMessage(`Plantilla de niveles aplicada: ${template.toUpperCase()} (${generated.length} niveles generados)`);
    },
    onQuickGenerateLevels: (config) => {
      const generated = levelSystem.quickGenerate(config);
      updateRibbonLevelSelector();
      if (config.createPlanViews) {
        viewer.viewManager.syncPlanViews(generated);
      }
      footer.setMessage(`⚡ Quick Generate completado: Torre de ${generated.length} niveles generada con éxito.`);
    },
    onAtGrid: () => {
      const tool = ribbon.activeTool;
      if (tool !== 'select' && tool !== 'grid') {
        if (!gridSystem.hasGrids()) {
          gridSystem.loadDefaultTestGrid();
        }
        structural.placeAtGridIntersections(tool, snapping.activeLevelIdx);
        footer.setMessage(`Colocados ${tool.toUpperCase()} en todas las intersecciones.`);
      }
    },
    onCancel: () => {
      ribbon.setTool('select');
    },
    onClearSelection: () => {
      selection.clearSelection();
      gridSystem.selectGrid(null);
      sidebar.showEmptyProperties();
      footer.setMessage('Selección limpiada.');
    },
    onDeleteSelected: () => {
      if (gridSystem.selectedGridId) {
        const id = gridSystem.selectedGridId;
        gridSystem.deleteGrid(id);
        sidebar.showEmptyProperties();
        footer.setMessage(`Rejilla ${id} eliminada.`);
      } else if (selection.selectedElement) {
        structural.removeElement(selection.selectedElement);
        selection.clearSelection();
        sidebar.showEmptyProperties();
        footer.setMessage('Elemento estructural eliminado.');
      } else {
        footer.setMessage('No hay ningún elemento seleccionado para eliminar.');
      }
    },
    onToggleGrid: () => {
      const mode = gridSystem.toggleQuick();
      footer.setMessage(`Visibilidad de rejilla: ${mode.toUpperCase()}`);
    },
  });

  // Ribbon superior
  let ribbon: HeaderRibbon;
  ribbon = new HeaderRibbon(
    (tool) => {
      snapping.enabled = tool !== 'select' && tool !== 'grid' && tool !== 'level';
      const levelName = LEVELS[snapping.activeLevelIdx]?.name || 'Nivel Activo';

      contextualBar.updateForTool(tool, levelName);

      if (tool === 'grid') {
        // En Revit, las rejillas se dibujan en planta
        const activeView = viewer.viewManager.getActiveView();
        if (activeView.type !== 'plan') {
          viewer.viewManager.openView('plan-1');
          footer.setMessage('Cambiando a Vista de Planta Nivel 1 para dibujar rejillas.');
        }
        gridDrawingManager.activate();
        gridDrawingManager.setOffset(contextualBar.currentOffset);
        gridDrawingManager.setChain(contextualBar.isChain);
        selection.clearSelection();
        preview.hide();
        footer.setMessage('Herramienta Rejilla activa: Clic en planta para trazar ejes.');
      } else if (tool === 'level') {
        gridDrawingManager.deactivate();
        preview.hide();
        selection.clearSelection();
        // En Revit, los niveles se crean en vistas de alzado o sección
        const activeView = viewer.viewManager.getActiveView();
        if (activeView.type === 'plan') {
          viewer.viewManager.openView('elev-south');
          footer.setMessage('Cambiando a Vista de Alzado Sur para trabajar con Niveles.');
        } else {
          footer.setMessage('Herramienta Nivel activa (LL): Usa Quick Generate o dibuja cotas en alzado.');
        }
      } else {
        gridDrawingManager.deactivate();
        if (tool === 'select') {
          preview.hide();
          gridSystem.clearHighlight();
          gridSystem.hideGuideLine();
          footer.setMessage('Listo | Modo Selección');
        } else {
          selection.clearSelection();
          selection.clearHover();
          gridSystem.selectGrid(null);
          footer.setMessage(`Herramienta activa: ${tool.toUpperCase()} (Previsualización activa)`);
        }
      }
    },
    () => {
      // At Grid
      const tool = ribbon.activeTool === 'select' ? 'columna' : ribbon.activeTool;
      if (tool !== 'grid') {
        if (!gridSystem.hasGrids()) {
          gridSystem.loadDefaultTestGrid();
        }
        structural.placeAtGridIntersections(tool, snapping.activeLevelIdx);
        footer.setMessage(`Generado en grilla: ${tool.toUpperCase()}`);
      }
    },
    () => {
      // Modelo de prueba (5 Pisos): Carga automáticamente las rejillas por defecto si no existen
      if (!gridSystem.hasGrids()) {
        gridSystem.loadDefaultTestGrid();
      }
      structural.buildFullBuilding();
      footer.setMessage('Modelo de prueba (Edificio 5 Pisos con Rejillas) generado con éxito.');
    },
    () => {
      structural.clear();
      gridSystem.clear();
      selection.clearSelection();
      sidebar.showEmptyProperties();
      footer.setMessage('Escena limpiada por completo.');
    },
    (style) => structural.setVisualStyle(style, viewer, gridSystem),
    () => gridSystem.toggleQuick(),
    (levelIdx) => {
      snapping.activeLevelIdx = levelIdx;
      gridSystem.setActiveLevel(levelIdx);
      contextualBar.updateForTool(ribbon.activeTool, LEVELS[levelIdx]?.name || '');
    }
  );

  updateRibbonLevelSelector();
  contextualBar.updateForTool('select', LEVELS[snapping.activeLevelIdx]?.name || 'Nivel 1 (+3.50m)');
  structural.setVisualStyle('hidden_line', viewer, gridSystem);

  // Sincronizar propiedades en barra lateral si se renombra un eje inline
  gridSystem.onGridRenamed = (updatedGrid) => {
    if (gridSystem.selectedGridId === updatedGrid.id) {
      sidebar.showGridProperties(
        updatedGrid,
        () => gridSystem.rebuildSystem(),
        (id) => gridSystem.deleteGrid(id)
      );
    }
  };

  // Utilidad de proyección en el plano XZ de la vista activa
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersectPoint = new THREE.Vector3();

  function getPlaneIntersection(e: MouseEvent): THREE.Vector2 | null {
    const activeView = viewer.viewManager.getActiveView();
    if (!activeView) return null;
    const rect = activeView.domElement.getBoundingClientRect();
    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom
    ) {
      return null;
    }
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, activeView.camera);
    const elev = LEVELS_Y[gridSystem.activeLevelIdx] || 0;
    plane.constant = -elev;
    if (raycaster.ray.intersectPlane(plane, intersectPoint)) {
      return new THREE.Vector2(intersectPoint.x, intersectPoint.z);
    }
    return null;
  }

  // Pointerdown: Detección de agarre de Grip para redimensionamiento grupal alineado y codos
  window.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('#app-header') ||
      target.closest('#app-sidebar') ||
      target.closest('#view-tabs-bar') ||
      target.closest('#app-footer') ||
      target.closest('.view-panel-header')
    ) {
      return;
    }

    const activeView = viewer.viewManager.getActiveView();
    if (activeView.type !== 'plan') return;

    const rect = activeView.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, activeView.camera);

    // 1. Verificar si se hizo clic en un Grip de Codo (Elbow Grip)
    const elbowGripMeshes = gridSystem.elbowGrips.map(g => g.mesh);
    const elbowHits = raycaster.intersectObjects(elbowGripMeshes);
    if (elbowHits.length > 0) {
      const hitElbow = elbowHits[0].object;
      const elbowData = hitElbow.userData as { gridId: string; end: 'start' | 'end' };
      if (elbowData) {
        gridSystem.startElbowDrag(elbowData.gridId, elbowData.end);
        footer.setMessage('Arrastrando codo de rejilla (Ajuste lateral paramétrico activo)');
        e.stopPropagation();
        return;
      }
    }

    // 2. Verificar si se hizo clic en un Grip estándar de alineación
    const gripMeshes = gridSystem.gripHandles.map(g => g.mesh);
    const gripHits = raycaster.intersectObjects(gripMeshes);
    if (gripHits.length > 0) {
      const hitGrip = gripHits[0].object;
      const gripData = hitGrip.userData as { gridId: string; end: 'start' | 'end' };
      if (gripData) {
        gridSystem.startGripDrag(gripData.gridId, gripData.end);
        footer.setMessage('Arrastrando extremo de rejilla (Ajuste grupal de alineación activo)');
        e.stopPropagation();
        return;
      }
    }
  });

  // Pointermove
  window.addEventListener('pointermove', (e) => {
    // 1. Arrastre de Grip estándar
    if (gridSystem.isDraggingGrip) {
      const pt = getPlaneIntersection(e);
      if (pt) {
        gridSystem.updateGripDrag({ x: pt.x, z: pt.y });
      }
      return;
    }

    // 1.1 Arrastre de Grip de Codo
    if (gridSystem.isDraggingElbowGrip) {
      const pt = getPlaneIntersection(e);
      if (pt) {
        gridSystem.updateElbowDrag({ x: pt.x, z: pt.y });
      }
      return;
    }

    // 2. Modo Dibujo de Rejilla
    if (ribbon.activeTool === 'grid') {
      gridDrawingManager.handlePointerMove(e);
      return;
    }

    // 3. Selección y Snapping Estructural
    selection.handlePointerMove(e);

    // 4. Hover y previsualización de Rejillas en modo Selección
    if (ribbon.activeTool === 'select') {
      const activeView = viewer.viewManager.getActiveView();
      if (activeView.type === 'plan') {
        const rect = activeView.domElement.getBoundingClientRect();
        if (
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom
        ) {
          const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );
          raycaster.setFromCamera(mouse, activeView.camera);

          // Controles interactivos (Grips, Codos, Checkboxes)
          const gripMeshes = gridSystem.gripHandles.map(g => g.mesh);
          const elbowGripMeshes = gridSystem.elbowGrips.map(g => g.mesh);
          const elbowToggleMeshes = gridSystem.elbowToggles.map(t => t.mesh);
          const toggleMeshes = gridSystem.toggleBoxes.map(t => t.mesh);
          const controlHits = raycaster.intersectObjects([
            ...gripMeshes,
            ...elbowGripMeshes,
            ...elbowToggleMeshes,
            ...toggleMeshes,
          ]);

          const hitMeshes = gridSystem.gridHitMeshes;
          const bubbleSprites = gridSystem.bubbleSprites;
          const hits = raycaster.intersectObjects([...hitMeshes, ...bubbleSprites]);

          if (controlHits.length > 0) {
            document.body.style.cursor = 'pointer';
          } else if (hits.length > 0) {
            const hId = hits[0].object.userData?.gridId || null;
            gridSystem.setHoveredGrid(hId);
            document.body.style.cursor = 'pointer';
          } else {
            // Detección directa de raycast sobre las líneas dasheadas
            const gridLines = gridSystem.getLineMeshes();
            raycaster.params.Line = { threshold: 0.8 };
            const lineHits = raycaster.intersectObjects(gridLines);
            if (lineHits.length > 0) {
              gridSystem.setHoveredGrid(lineHits[0].object.name);
              document.body.style.cursor = 'pointer';
            } else {
              gridSystem.setHoveredGrid(null);
              if (!selection.hoveredElement) {
                document.body.style.cursor = 'default';
              }
            }
          }
        } else {
          gridSystem.setHoveredGrid(null);
          if (!selection.hoveredElement) {
            document.body.style.cursor = 'default';
          }
        }
      } else {
        gridSystem.setHoveredGrid(null);
        if (!selection.hoveredElement) {
          document.body.style.cursor = 'default';
        }
      }
    } else {
      gridSystem.setHoveredGrid(null);
    }

    if (snapping.currentSnappedPosition && ribbon.activeTool !== 'select') {
      const { x, z } = snapping.currentSnappedPosition;
      footer.setCoordinates(x, z, snapping.activeLevelIdx * 3.5);

      gridSystem.highlightAxes(x, z);
      gridSystem.hideGuideLine();
      preview.update(
        ribbon.activeTool,
        x,
        z,
        snapping.activeLevelIdx,
        gridSystem.getGridX(),
        gridSystem.getGridZ()
      );
    } else {
      gridSystem.clearHighlight();
      gridSystem.hideGuideLine();
      preview.hide();
    }
  });

  // Pointerup
  window.addEventListener('pointerup', () => {
    if (gridSystem.isDraggingGrip) {
      gridSystem.endGripDrag();
      footer.setMessage('Alineación de rejilla completada.');
    }
    if (gridSystem.isDraggingElbowGrip) {
      gridSystem.endElbowDrag();
      footer.setMessage('Codo de rejilla ajustado.');
    }
  });

  // Doble clic para edición interactiva del nombre de la burbuja (Revit inline rename)
  window.addEventListener('dblclick', (e) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('#app-header') ||
      target.closest('#app-sidebar') ||
      target.closest('#view-tabs-bar') ||
      target.closest('#app-footer') ||
      target.closest('.view-panel-header') ||
      target.id === 'grid-inline-bubble-input'
    ) {
      return;
    }

    const activeView = viewer.viewManager.getActiveView();
    if (activeView.type !== 'plan') return;

    const rect = activeView.domElement.getBoundingClientRect();
    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom
    ) {
      return;
    }

    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, activeView.camera);

    const bubbleMeshes = gridSystem.bubbleHits.map(b => b.mesh);
    const bubbleSprites = gridSystem.bubbleSprites;
    const hits = raycaster.intersectObjects([...bubbleMeshes, ...bubbleSprites]);

    let targetGridId: string | null = null;
    let targetEnd: 'start' | 'end' | undefined = undefined;

    if (hits.length > 0) {
      const hitObj = hits[0].object;
      const uData = hitObj.userData as { gridId?: string; end?: 'start' | 'end' };
      if (uData?.gridId) {
        targetGridId = uData.gridId;
        targetEnd = uData.end;
      }
    }

    // Si no golpeó directamente una burbuja, verificar si golpeó cerca de una burbuja o en la grilla
    if (!targetGridId) {
      const allGridHits = raycaster.intersectObjects(gridSystem.gridHitMeshes);
      if (allGridHits.length > 0) {
        const hitData = allGridHits[0].object.userData as { gridId?: string; end?: 'start' | 'end'; isBubbleHit?: boolean };
        if (hitData?.gridId && hitData.isBubbleHit) {
          targetGridId = hitData.gridId;
          targetEnd = hitData.end;
        } else if (hitData?.gridId) {
          const hitPoint = allGridHits[0].point;
          const nearestBubble = gridSystem.bubbleHits
            .filter(b => b.gridId === hitData.gridId)
            .sort((a, b) => a.worldPos.distanceTo(hitPoint) - b.worldPos.distanceTo(hitPoint))[0];
          if (nearestBubble && nearestBubble.worldPos.distanceTo(hitPoint) < DIMENSIONS.grid.bubbleDoubleClickMaxDist) {
            targetGridId = nearestBubble.gridId;
            targetEnd = nearestBubble.end;
          }
        }
      }
    }

    if (targetGridId) {
      const opened = gridSystem.openBubbleRename(
        targetGridId,
        targetEnd,
        activeView.camera,
        activeView.domElement,
        (warning) => {
          footer.setMessage(warning);
        }
      );
      if (opened) {
        gridSystem.selectGrid(targetGridId);
        const selGrid = gridSystem.getSelectedGrid();
        if (selGrid) {
          sidebar.showGridProperties(
            selGrid,
            () => gridSystem.rebuildSystem(),
            (id) => gridSystem.deleteGrid(id)
          );
        }
        footer.setMessage('Editando identificador de burbuja. Escribe el nuevo nombre y presiona Enter.');
        e.stopPropagation();
      }
    }
  });

  // Clic en escena
  window.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('#app-header') ||
      target.closest('#app-sidebar') ||
      target.closest('#view-tabs-bar') ||
      target.closest('#app-footer') ||
      target.closest('.view-panel-header')
    ) {
      return;
    }

    const activeView = viewer.viewManager.getActiveView();

    // 1. Si está en modo dibujo de rejilla
    if (ribbon.activeTool === 'grid') {
      const handled = gridDrawingManager.handlePointerClick(e);
      if (handled) return;
    }

    // 2. Interacción de Selección de Rejilla y Toggles de Burbujas en Vistas de Planta
    if (activeView.type === 'plan') {
      const rect = activeView.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, activeView.camera);

      // A. Comprobar si se hizo clic en una casilla (checkbox) de burbuja
      const toggleMeshes = gridSystem.toggleBoxes.map(t => t.mesh);
      const toggleHits = raycaster.intersectObjects(toggleMeshes);
      if (toggleHits.length > 0) {
        const hitToggle = toggleHits[0].object;
        const toggleData = hitToggle.userData as { gridId: string; end: 'start' | 'end' };
        if (toggleData) {
          gridSystem.toggleBubble(toggleData.gridId, toggleData.end);
          const grid = gridSystem.getSelectedGrid();
          if (grid) {
            sidebar.showGridProperties(
              grid,
              (updated) => {
                gridSystem.rebuildSystem();
              },
              (id) => {
                gridSystem.deleteGrid(id);
              }
            );
          }
          footer.setMessage(`Burbuja de rejilla ${toggleData.end === 'start' ? 'inicial' : 'final'} alternada.`);
          return;
        }
      }

      // A.2 Comprobar si se hizo clic en un icono de Codo (Elbow Toggle Icon estilo Revit)
      const elbowToggleMeshes = gridSystem.elbowToggles.map(t => t.mesh);
      const elbowHits = raycaster.intersectObjects(elbowToggleMeshes);
      if (elbowHits.length > 0) {
        const hitElbow = elbowHits[0].object;
        const elbowData = hitElbow.userData as { gridId: string; end: 'start' | 'end' };
        if (elbowData) {
          gridSystem.toggleElbow(elbowData.gridId, elbowData.end);
          const grid = gridSystem.getSelectedGrid();
          if (grid) {
            sidebar.showGridProperties(
              grid,
              (updated) => {
                gridSystem.rebuildSystem();
              },
              (id) => {
                gridSystem.deleteGrid(id);
              }
            );
          }
          footer.setMessage(`Codo de rejilla ${elbowData.end === 'start' ? 'inicial' : 'final'} alternado.`);
          return;
        }
      }

      // B. Comprobar si se hizo clic en una línea de rejilla o burbuja
      if (ribbon.activeTool === 'select') {
        const hitMeshes = gridSystem.gridHitMeshes;
        const meshHits = raycaster.intersectObjects(hitMeshes);
        let selectedGridId: string | null = null;

        if (meshHits.length > 0) {
          selectedGridId = (meshHits[0].object.userData?.gridId as string) || null;
        } else {
          const gridLines = gridSystem.getLineMeshes();
          raycaster.params.Line = { threshold: 0.6 };
          const lineHits = raycaster.intersectObjects(gridLines);
          if (lineHits.length > 0) {
            selectedGridId = lineHits[0].object.name;
          }
        }

        if (selectedGridId) {
          gridSystem.selectGrid(selectedGridId);
          selection.clearSelection();

          const selGrid = gridSystem.getSelectedGrid();
          if (selGrid) {
            sidebar.showGridProperties(
              selGrid,
              (updated) => {
                gridSystem.rebuildSystem();
              },
              (id) => {
                gridSystem.deleteGrid(id);
              }
            );
            footer.setMessage(`Rejilla seleccionada: Eje ${selGrid.name}. Arrastra los círculos en los extremos para alinear.`);
          }
          return;
        }
      }
    }

    // 3. Selección de Elementos Estructurales
    const didSelect = selection.handlePointerClick(e);
    if (didSelect) {
      gridSystem.selectGrid(null);
      return;
    }

    // 4. Clic en espacio vacío en modo Selección
    if (ribbon.activeTool === 'select') {
      selection.clearSelection();
      gridSystem.selectGrid(null);
      sidebar.showEmptyProperties();
      return;
    }

    // 5. Colocación de Elementos Estructurales
    if (snapping.currentSnappedPosition) {
      structural.placeSingle(
        ribbon.activeTool,
        snapping.currentSnappedPosition.x,
        snapping.currentSnappedPosition.z,
        snapping.activeLevelIdx
      );
      footer.setMessage(`${ribbon.activeTool.toUpperCase()} colocado en el modelo.`);
    }
  });

  // Atajos de teclado
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      gridDrawingManager.cancelCurrentDraw();
      ribbon.setTool('select');
      preview.hide();
      gridSystem.clearHighlight();
      gridSystem.hideGuideLine();
      gridSystem.selectGrid(null);
      selection.clearSelection();
      sidebar.showEmptyProperties();
      footer.setMessage('Modo Selección | Listo');
    }
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
    if (!isTyping) {
      if (e.key.toLowerCase() === 'l') {
        ribbon.setTool('level');
      } else if (e.key.toLowerCase() === 'g') {
        ribbon.setTool('grid');
      }
    }
    if ((e.key === 'Delete' || e.key === 'Backspace')) {
      if (gridSystem.selectedGridId) {
        const id = gridSystem.selectedGridId;
        gridSystem.deleteGrid(id);
        sidebar.showEmptyProperties();
        footer.setMessage(`Rejilla ${id} eliminada.`);
      } else if (selection.selectedElement) {
        structural.removeElement(selection.selectedElement);
        selection.clearSelection();
        sidebar.showEmptyProperties();
        footer.setMessage('Elemento eliminado.');
      }
    }
  });
}

bootstrap();
