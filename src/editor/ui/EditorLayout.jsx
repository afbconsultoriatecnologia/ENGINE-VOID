import { useState, useCallback, useEffect, useRef } from 'react';
import Toolbar from './Toolbar';
import HierarchyPanel from './HierarchyPanel';
import InspectorPanel from './InspectorPanel';
import ProjectPanel from './ProjectPanel';
import TransformOverlay from './TransformOverlay';
import ConsolePanel from './ConsolePanel';
import ScriptEditor from './ScriptEditor';
import MinimapOverlay from './MinimapOverlay';
import { useHistory } from '../state/useEditorState';
import './EditorLayout.css';

/**
 * Layout principal do editor estilo Unity
 * Organiza os painéis: Toolbar, Hierarchy, Viewport, Inspector, Project
 * Suporta redimensionamento e esconder/mostrar painéis
 */
export default function EditorLayout({
  engine,
  containerRef,
  objects,
  selectedObject,
  selectedObjects = [],
  onAddObject,
  onRemoveObject,
  onSelectObject
}) {
  const [mode, setMode] = useState('dev');
  const [activeTool, setActiveTool] = useState('select');

  // Estado dos painéis - tamanhos e visibilidade
  const [panelSizes, setPanelSizes] = useState({
    hierarchy: 250,
    inspector: 300,
    project: 180
  });

  const [panelVisibility, setPanelVisibility] = useState({
    hierarchy: true,
    inspector: true,
    project: true
  });

  // Estado do editor de scripts
  const [editingScript, setEditingScript] = useState(null); // { scriptId, code }
  const [minimizedScripts, setMinimizedScripts] = useState([]); // [{ scriptId, code, hasChanges }]
  const [isScriptMaximized, setIsScriptMaximized] = useState(false);
  const [showConsole, setShowConsole] = useState(false);

  // Guardar estado dos painéis antes de entrar no Game mode
  const panelVisibilityBeforeGame = useRef(null);

  // Estado do resize
  const [resizing, setResizing] = useState(null); // 'hierarchy' | 'inspector' | 'project' | null
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef(0);

  // Integrar com EditorState para histórico
  const { canUndo: stateCanUndo, canRedo: stateCanRedo } = useHistory();

  const handleModeChange = (newMode) => {
    setMode(newMode);
    engine?.setMode(newMode);

    // No Game mode, esconder todos os painéis
    if (newMode === 'game') {
      // Salvar estado atual antes de esconder
      panelVisibilityBeforeGame.current = { ...panelVisibility };
      setPanelVisibility({
        hierarchy: false,
        inspector: false,
        project: false
      });
    } else if (newMode === 'dev') {
      // Restaurar painéis ao voltar para Dev mode
      if (panelVisibilityBeforeGame.current) {
        setPanelVisibility(panelVisibilityBeforeGame.current);
        panelVisibilityBeforeGame.current = null;
      } else {
        // Default se não tinha estado salvo
        setPanelVisibility({
          hierarchy: true,
          inspector: true,
          project: true
        });
      }
    }

    // Notificar Three.js para redimensionar após layout mudar
    setTimeout(() => {
      engine?.handleResize?.();
    }, 100);
  };

  const handleToolChange = (tool) => {
    setActiveTool(tool);

    if (!engine) return;

    if (tool === 'select') {
      engine.setTransformMode('translate');
      if (engine.selectionController) {
        engine.selectionController.cancelTransform();
      }
    } else if (tool === 'grab') {
      engine.setTransformMode('translate');
    } else if (tool === 'rotate') {
      engine.setTransformMode('rotate');
    } else if (tool === 'scale') {
      engine.setTransformMode('scale');
    }
  };

  // Obter ScriptManager do RuntimeEngine (memoizado para evitar loops)
  const scriptManager = engine?.runtimeEngine?.getScriptManager?.() || null;

  // Abrir editor de script
  const handleOpenScriptEditor = async (scriptId) => {
    if (!scriptManager) return;

    try {
      const code = await scriptManager.getScriptCode(scriptId);
      setEditingScript({ scriptId, code });
    } catch (error) {
      console.error('Failed to open script:', error);
    }
  };

  // Salvar script
  const handleSaveScript = (code) => {
    if (!editingScript) return;

    if (scriptManager) {
      scriptManager.updateScriptCode(editingScript.scriptId, code);
    }
    setEditingScript({ ...editingScript, code });
  };

  // Fechar editor de script
  const handleCloseScriptEditor = () => {
    setEditingScript(null);
    setIsScriptMaximized(false);
  };

  // Minimizar editor de script
  const handleMinimizeScript = ({ scriptId, code, hasChanges }) => {
    // Adicionar à lista de minimizados (evitar duplicatas)
    setMinimizedScripts(prev => {
      const exists = prev.find(s => s.scriptId === scriptId);
      if (exists) {
        // Atualizar código se já existe
        return prev.map(s => s.scriptId === scriptId ? { scriptId, code, hasChanges } : s);
      }
      return [...prev, { scriptId, code, hasChanges }];
    });
    setEditingScript(null);
    setIsScriptMaximized(false);
  };

  // Restaurar script minimizado
  const handleRestoreScript = (scriptId) => {
    const script = minimizedScripts.find(s => s.scriptId === scriptId);
    if (script) {
      setEditingScript({ scriptId: script.scriptId, code: script.code });
      setMinimizedScripts(prev => prev.filter(s => s.scriptId !== scriptId));
    }
  };

  // Fechar script minimizado
  const handleCloseMinimizedScript = (scriptId) => {
    setMinimizedScripts(prev => prev.filter(s => s.scriptId !== scriptId));
  };

  // Toggle maximizar script editor
  const handleToggleMaximize = () => {
    setIsScriptMaximized(prev => !prev);
  };

  const handleUndo = useCallback(() => engine?.undo(), [engine]);
  const handleRedo = useCallback(() => engine?.redo(), [engine]);

  const canUndo = stateCanUndo || (engine?.canUndo() || false);
  const canRedo = stateCanRedo || (engine?.canRedo() || false);

  // Toggle visibilidade do painel
  const togglePanel = (panel) => {
    setPanelVisibility(prev => ({
      ...prev,
      [panel]: !prev[panel]
    }));
  };

  // Handlers de resize
  const handleResizeStart = (panel, e) => {
    e.preventDefault();
    setResizing(panel);
    resizeStartPos.current = { x: e.clientX, y: e.clientY };
    resizeStartSize.current = panelSizes[panel];
  };

  const handleResizeMove = useCallback((e) => {
    if (!resizing) return;

    let delta;
    let newSize;

    if (resizing === 'hierarchy') {
      delta = e.clientX - resizeStartPos.current.x;
      newSize = Math.max(150, Math.min(500, resizeStartSize.current + delta));
    } else if (resizing === 'inspector') {
      delta = resizeStartPos.current.x - e.clientX;
      newSize = Math.max(200, Math.min(500, resizeStartSize.current + delta));
    } else if (resizing === 'project') {
      delta = resizeStartPos.current.y - e.clientY;
      newSize = Math.max(100, Math.min(400, resizeStartSize.current + delta));
    }

    setPanelSizes(prev => ({
      ...prev,
      [resizing]: newSize
    }));
  }, [resizing]);

  const handleResizeEnd = useCallback(() => {
    setResizing(null);
  }, []);

  // Event listeners globais para resize
  useEffect(() => {
    if (resizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = resizing === 'project' ? 'ns-resize' : 'ew-resize';
      document.body.style.userSelect = 'none';

      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [resizing, handleResizeMove, handleResizeEnd]);

  // Calcular grid template columns/rows baseado nos painéis visíveis
  const getGridStyle = () => {
    const hierarchyWidth = panelVisibility.hierarchy ? `${panelSizes.hierarchy}px` : '0px';
    const inspectorWidth = panelVisibility.inspector ? `${panelSizes.inspector}px` : '0px';
    const projectHeight = panelVisibility.project ? `${panelSizes.project}px` : '0px';

    return {
      gridTemplateColumns: `${hierarchyWidth} 1fr ${inspectorWidth}`,
      gridTemplateRows: `48px 1fr ${projectHeight}`
    };
  };

  return (
    <div className={`editor-layout ${resizing ? 'resizing' : ''} ${mode === 'game' ? 'game-mode' : ''}`} style={getGridStyle()}>
      <Toolbar
        mode={mode}
        activeTool={activeTool}
        onModeChange={handleModeChange}
        onToolChange={handleToolChange}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        engine={engine}
        panelVisibility={panelVisibility}
        onTogglePanel={mode === 'dev' ? togglePanel : null}
      />

      {/* Hierarchy Panel */}
      {panelVisibility.hierarchy && (
        <HierarchyPanel
          objects={objects}
          selectedObject={selectedObject}
          selectedObjects={selectedObjects}
          onSelectObject={onSelectObject}
          onRemoveObject={onRemoveObject}
          onAddObject={onAddObject}
          engine={engine}
        />
      )}

      {/* Resize Handle - Hierarchy */}
      {panelVisibility.hierarchy && (
        <div
          className="resize-handle resize-handle-vertical resize-hierarchy"
          style={{ left: panelSizes.hierarchy - 2 }}
          onMouseDown={(e) => handleResizeStart('hierarchy', e)}
        />
      )}

      {/* Scene View */}
      <div className={`scene-view ${mode === 'game' ? 'game-mode' : ''}`} ref={containerRef}>
        {mode === 'dev' && <TransformOverlay engine={engine} />}
        {mode === 'game' && engine?.runtimeEngine && (
          <MinimapOverlay runtimeEngine={engine.runtimeEngine} />
        )}

        {/* Botões para reabrir painéis fechados (só no Dev mode) */}
        {mode === 'dev' && (
          <div className="panel-toggles">
            {!panelVisibility.hierarchy && (
              <button
                className="panel-toggle-btn left"
                onClick={() => togglePanel('hierarchy')}
                title="Mostrar Hierarchy"
              >
                ◂
              </button>
            )}
            {!panelVisibility.inspector && (
              <button
                className="panel-toggle-btn right"
                onClick={() => togglePanel('inspector')}
                title="Mostrar Inspector"
              >
                ▸
              </button>
            )}
            {!panelVisibility.project && (
              <button
                className="panel-toggle-btn bottom"
                onClick={() => togglePanel('project')}
                title="Mostrar Project"
              >
                ▾
              </button>
            )}
          </div>
        )}
      </div>

      {/* Resize Handle - Inspector */}
      {panelVisibility.inspector && (
        <div
          className="resize-handle resize-handle-vertical resize-inspector"
          style={{ right: panelSizes.inspector - 2 }}
          onMouseDown={(e) => handleResizeStart('inspector', e)}
        />
      )}

      {/* Inspector Panel */}
      {panelVisibility.inspector && (
        <InspectorPanel
          engine={engine}
          selectedObject={selectedObject}
          scriptManager={scriptManager}
          onOpenScriptEditor={handleOpenScriptEditor}
        />
      )}

      {/* Resize Handle - Project */}
      {panelVisibility.project && (
        <div
          className="resize-handle resize-handle-horizontal resize-project"
          style={{ bottom: panelSizes.project - 2 }}
          onMouseDown={(e) => handleResizeStart('project', e)}
        />
      )}

      {/* Project Panel */}
      {panelVisibility.project && (
        <ProjectPanel
          onAddObject={onAddObject}
          engine={engine}
          minimizedScripts={minimizedScripts}
          onRestoreScript={handleRestoreScript}
          onCloseMinimizedScript={handleCloseMinimizedScript}
        />
      )}

      {/* Console Panel - aparece como overlay na parte inferior */}
      {showConsole && (
        <div className="console-overlay">
          <div className="console-overlay-header">
            <span>Console</span>
            <button onClick={() => setShowConsole(false)}>×</button>
          </div>
          <ConsolePanel
            scriptConsole={scriptManager?.console}
            isVisible={true}
          />
        </div>
      )}

      {/* Script Editor - aparece como overlay modal */}
      {editingScript && (
        <div className={`script-editor-overlay ${isScriptMaximized ? 'maximized' : ''}`}>
          <ScriptEditor
            scriptId={editingScript.scriptId}
            initialCode={editingScript.code}
            language="javascript"
            onSave={handleSaveScript}
            onClose={handleCloseScriptEditor}
            onMinimize={handleMinimizeScript}
            onToggleMaximize={handleToggleMaximize}
            isMaximized={isScriptMaximized}
            scriptManager={scriptManager}
          />
        </div>
      )}

    </div>
  );
}
