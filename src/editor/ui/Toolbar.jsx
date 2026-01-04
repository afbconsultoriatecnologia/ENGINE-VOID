import { useState, useEffect, useRef, useCallback } from 'react';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import SceneSettings from './SceneSettings';
import './Toolbar.css';

/**
 * Barra de ferramentas superior estilo Unity
 * Contém: Modo Dev/Game, Ferramentas de transformação, Undo/Redo, Save/Load, Ciclo Solar
 */
export default function Toolbar({
  mode,
  activeTool,
  onModeChange,
  onToolChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  engine,
  panelVisibility = { hierarchy: true, inspector: true, project: true },
  onTogglePanel,
  currentProject,
  onBackToHub
}) {
  // Estado do ciclo solar
  const [sunCycleActive, setSunCycleActive] = useState(false);
  const [sunSpeed, setSunSpeed] = useState(1);
  const sunAngleRef = useRef(0);
  const animationRef = useRef(null);

  // Estado do painel de configurações
  const [showSettings, setShowSettings] = useState(false);

  // Salvar cena (usando Tauri native dialog)
  const handleSaveScene = useCallback(async () => {
    if (!engine) return;

    try {
      const sceneData = engine.serializeScene();
      const json = JSON.stringify(sceneData, null, 2);

      // Abrir diálogo nativo de salvar
      const filePath = await save({
        defaultPath: `scene_${Date.now()}.json`,
        filters: [{
          name: 'Scene',
          extensions: ['json']
        }]
      });

      if (filePath) {
        await writeTextFile(filePath, json);
        console.log('Cena salva com sucesso:', filePath);
      }
    } catch (error) {
      console.error('Erro ao salvar cena:', error);
    }
  }, [engine]);

  // Carregar cena (usando Tauri native dialog)
  const handleLoadScene = useCallback(async () => {
    if (!engine) return;

    try {
      // Abrir diálogo nativo de abrir arquivo
      const filePath = await open({
        multiple: false,
        filters: [{
          name: 'Scene',
          extensions: ['json']
        }]
      });

      if (filePath) {
        const content = await readTextFile(filePath);
        const sceneData = JSON.parse(content);
        await engine.loadScene(sceneData);
        console.log('Cena carregada com sucesso:', filePath);
      }
    } catch (error) {
      console.error('Erro ao carregar cena:', error);
    }
  }, [engine]);

  // Animação do ciclo solar
  useEffect(() => {
    if (!sunCycleActive || !engine) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const directionalLight = engine.lights?.get('Directional Light');
    if (!directionalLight) return;

    let lastTime = performance.now();

    const animate = (currentTime) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Atualizar ângulo do sol (velocidade em graus por segundo)
      sunAngleRef.current += deltaTime * sunSpeed * 30; // 30 graus/s base
      if (sunAngleRef.current >= 360) sunAngleRef.current -= 360;

      const angleRad = sunAngleRef.current * Math.PI / 180;
      const radius = 15;
      const height = 10 + Math.sin(angleRad) * 8; // Varia altura entre 2 e 18

      // Posição circular do sol
      const x = Math.cos(angleRad) * radius;
      const z = Math.sin(angleRad) * radius;
      const y = Math.max(2, height); // Nunca abaixo de 2

      directionalLight.position.set(x, y, z);

      // Atualizar helper visual
      engine.updateLightHelper?.('Directional Light');

      // Atualizar o céu se estiver ativo
      engine.updateSkyFromDirectionalLight?.();

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [sunCycleActive, sunSpeed, engine]);

  const tools = [
    { id: 'select', icon: '🖱', title: 'Modo Padrão (Q/Esc) - Cancela transformação' },
    { id: 'grab', icon: '✥', title: 'Mover (G) - Move com mouse, X/Y/Z para eixo' },
    { id: 'rotate', icon: '↻', title: 'Rotacionar (R) - Gira com mouse, X/Y/Z para eixo' },
    { id: 'scale', icon: '⤢', title: 'Escalar (S) - Escala com mouse, X/Y/Z para eixo' },
  ];

  return (
    <div className="toolbar">
      {/* Botão Voltar ao Hub */}
      {onBackToHub && (
        <button
          className="tool-btn back-btn"
          onClick={onBackToHub}
          title="Voltar ao Project Hub"
        >
          ◀
        </button>
      )}

      {/* Logo/Título + Nome do Projeto */}
      <div className="toolbar-brand">
        <span className="brand-icon">◈</span>
        <span className="brand-text">ENGINE VOID</span>
        {currentProject && (
          <>
            <span className="brand-separator">|</span>
            <span className="project-name">{currentProject.name}</span>
            <span className="project-type-badge">{currentProject.type?.toUpperCase()}</span>
          </>
        )}
      </div>

      <div className="toolbar-divider" />

      {/* Modo Dev/Game */}
      <div className="toolbar-group mode-toggle">
        <button
          className={`mode-btn ${mode === 'dev' ? 'active' : ''}`}
          onClick={() => onModeChange('dev')}
          title="Modo de edição"
        >
          Dev
        </button>
        <button
          className={`mode-btn ${mode === 'game' ? 'active' : ''}`}
          onClick={() => onModeChange('game')}
          title="Modo de jogo"
        >
          Game
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Ferramentas de transformação */}
      <div className="toolbar-group transform-tools">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => onToolChange(tool.id)}
            title={tool.title}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      {/* Undo/Redo */}
      <div className="toolbar-group history-tools">
        <button
          className="tool-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Desfazer (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          className="tool-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Refazer (Ctrl+Y)"
        >
          ↷
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Ciclo Solar */}
      <div className="toolbar-group sun-cycle">
        <button
          className={`tool-btn ${sunCycleActive ? 'active' : ''}`}
          onClick={() => setSunCycleActive(!sunCycleActive)}
          title={sunCycleActive ? 'Parar ciclo solar' : 'Iniciar ciclo solar'}
        >
          {sunCycleActive ? '⏸' : '☀'}
        </button>
        {sunCycleActive && (
          <div className="speed-control">
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={sunSpeed}
              onChange={(e) => setSunSpeed(parseFloat(e.target.value))}
              title={`Velocidade: ${sunSpeed.toFixed(1)}x`}
            />
            <span className="speed-label">{sunSpeed.toFixed(1)}x</span>
          </div>
        )}
      </div>

      <div className="toolbar-divider" />

      {/* Save/Load */}
      <div className="toolbar-group file-tools">
        <button
          className="tool-btn"
          onClick={handleSaveScene}
          title="Salvar Cena (Ctrl+S)"
        >
          💾
        </button>
        <button
          className="tool-btn"
          onClick={handleLoadScene}
          title="Carregar Cena (Ctrl+O)"
        >
          📂
        </button>
      </div>

      {/* Espaço flexível */}
      <div className="toolbar-spacer" />

      {/* Controles à direita */}
      <div className="toolbar-group">
        {/* Toggle de painéis */}
        {onTogglePanel && (
          <>
            <button
              className={`tool-btn ${panelVisibility.hierarchy ? 'active' : ''}`}
              onClick={() => onTogglePanel('hierarchy')}
              title={panelVisibility.hierarchy ? 'Esconder Hierarchy' : 'Mostrar Hierarchy'}
            >
              ☰
            </button>
            <button
              className={`tool-btn ${panelVisibility.inspector ? 'active' : ''}`}
              onClick={() => onTogglePanel('inspector')}
              title={panelVisibility.inspector ? 'Esconder Inspector' : 'Mostrar Inspector'}
            >
              ⚙
            </button>
            <button
              className={`tool-btn ${panelVisibility.project ? 'active' : ''}`}
              onClick={() => onTogglePanel('project')}
              title={panelVisibility.project ? 'Esconder Project' : 'Mostrar Project'}
            >
              📁
            </button>
            <div className="toolbar-divider" style={{ height: '24px', margin: '0 4px' }} />
          </>
        )}
        <button
          className={`tool-btn ${showSettings ? 'active' : ''}`}
          onClick={() => setShowSettings(!showSettings)}
          title="Configurações da Cena"
        >
          🎨
        </button>
      </div>

      {/* Modal de configurações */}
      <SceneSettings
        engine={engine}
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}
