import { useState, useEffect, useMemo, useCallback } from 'react';
import { useEditor } from './hooks/useEditor';
import ProjectHub from './hub/ProjectHub';
import EditorLayout from './editor/ui/EditorLayout';
import KeyboardShortcuts from './editor/ui/KeyboardShortcuts';
import projectManager from './hub/ProjectManager';
import './App.css';

/**
 * Componente principal da aplicação
 * Gerencia o Project Hub e o Editor 3D/2D
 */
function App() {
  // Estado do aplicativo: 'hub' ou 'editor'
  const [appState, setAppState] = useState('hub');
  const [currentProject, setCurrentProject] = useState(null);

  // Determinar tipo de projeto (2d ou 3d)
  const projectType = currentProject?.type || '3d';

  const {
    containerRef,
    engine,
    isReady,
    objects,
    lights,
    selectedObject: selectedObjectName,
    selectedObjects: selectedObjectNames,
    addObject,
    removeObject,
    refreshObjects
  } = useEditor({
    backgroundColor: projectType === '2d' ? 0x222222 : 0x1a1a1a,
    enableShadows: projectType === '3d',
    antialias: true,
    mode: 'dev',
    projectType: projectType
  });

  // Obter objeto Three.js a partir do nome selecionado
  const selectedObject = useMemo(() => {
    if (!engine || !selectedObjectName) return null;
    return engine.getObject(selectedObjectName);
  }, [engine, selectedObjectName]);

  // Obter todos os objetos Three.js selecionados
  const selectedObjects = useMemo(() => {
    if (!engine || !selectedObjectNames) return [];
    return selectedObjectNames.map(name => engine.getObject(name)).filter(Boolean);
  }, [engine, selectedObjectNames]);

  /**
   * Callback quando um projeto é aberto
   */
  const handleProjectOpen = async (project) => {
    console.log('[App] Opening project:', project.name);
    setCurrentProject(project);
    setAppState('editor');

    // Carregar cena do projeto se existir
    if (engine && project.settings?.defaultScene) {
      try {
        const sceneData = await projectManager.loadScene(project.settings.defaultScene);
        if (sceneData) {
          console.log('[App] Loading scene:', project.settings.defaultScene);
          // TODO: Carregar cena no engine
          // engine.loadScene(sceneData);
        }
      } catch (e) {
        console.warn('[App] Failed to load default scene:', e);
      }
    }
  };

  /**
   * Callback para voltar ao Hub
   */
  const handleBackToHub = () => {
    setAppState('hub');
    setCurrentProject(null);
    // Limpar cena atual
    if (engine) {
      engine.clearScene?.();
    }
  };

  /**
   * Inicializa a cena com objetos padrão quando a engine estiver pronta
   */
  useEffect(() => {
    if (!isReady || !engine || appState !== 'editor') return;

    // Verificar se já foi inicializado (usar marcador diferente para 2D/3D)
    const initMarker = engine.is2D ? '__2d_initialized__' : 'Cylinder';
    if (engine.objects.has(initMarker) || engine.scene.getObjectByName(initMarker)) {
      console.log('Scene already initialized, skipping...');
      return;
    }

    console.log(`=== INITIALIZING ${engine.is2D ? '2D' : '3D'} SCENE ===`);

    if (engine.is2D) {
      // ============ CENA 2D ============
      // Adicionar luz ambiente (suficiente para ver sprites)
      engine.addAmbientLight('Ambient Light', {
        color: 0xffffff,
        intensity: 1.0
      });

      // Criar sprite de exemplo
      const sprite = engine.createSprite('Player Sprite', {
        width: 1,
        height: 1,
        color: 0x4a90d9,
        position: { x: 0, y: 0 },
        sortingLayer: 'Default',
        sortingOrder: 0
      });

      // Criar outro sprite para background
      engine.createSprite('Background', {
        width: 5,
        height: 5,
        color: 0x2a5a8a,
        position: { x: 0, y: 0 },
        sortingLayer: 'Background',
        sortingOrder: 0
      });

      // Marcador de inicialização 2D
      const marker = { name: '__2d_initialized__' };
      engine.objects.set('__2d_initialized__', marker);

    } else {
      // ============ CENA 3D ============
      // Adicionar luzes padrão (com ícone visual e na hierarquia)
      engine.addAmbientLight('Ambient Light', {
        color: 0xffffff,
        intensity: 0.3  // Baixo para permitir mais contraste
      });

      engine.addDirectionalLight('Directional Light', {
        color: 0xffffff,
        intensity: 1.0,  // Alto para sombras mais definidas
        position: [10, 10, 5],
        castShadow: true
      });

      // Adicionar plano (chão) - rotacionado para ficar horizontal
      // Floor é travado por padrão (não pode ser selecionado/deletado)
      engine.createPlane('Floor', {
        color: 0x808080,
        position: [0, 0, 0],
        rotation: [-Math.PI / 2, 0, 0],  // Rotaciona para ficar horizontal
        width: 20,
        height: 20,
        metalness: 0.1,
        roughness: 0.9,
        locked: true  // Travado por padrão
      });

      // Adicionar cilindro padrão
      engine.createCylinder('Cylinder', {
        color: 0x4a90d9,
        position: [0, 1, 0],
        radiusTop: 0.5,
        radiusBottom: 0.5,
        height: 2,
        metalness: 0.3,
        roughness: 0.7
      });

      // Adicionar helpers (apenas visíveis em dev mode)
      engine.addGridHelper('grid', {
        size: 20,
        divisions: 20,
        colorCenterLine: 0xff5555,  // Linha central vermelha
        colorGrid: 0xaaaaaa         // Grid bem mais clara
      });

      engine.addAxesHelper('axes', { size: 5 });
    }

    // Atualizar lista de objetos
    refreshObjects();
  }, [isReady, engine, appState]);

  const handleSelectObject = (obj, addToSelection = false) => {
    if (!engine) return;

    if (!obj) {
      // Desselecionar tudo
      engine.selectObjects([]);
      return;
    }

    const objName = obj.name || obj.uuid;

    if (addToSelection) {
      // Shift+Click: toggle na seleção
      const currentSelected = engine.getSelectedObjects();
      const isAlreadySelected = currentSelected.includes(objName);

      if (isAlreadySelected) {
        // Remover da seleção
        engine.selectObjects(currentSelected.filter(n => n !== objName));
      } else {
        // Adicionar à seleção
        engine.selectObjects([...currentSelected, objName]);
      }
    } else {
      // Click normal: selecionar apenas este objeto
      engine.selectObject(objName);
    }
  };

  const handleRemoveObject = (obj) => {
    if (obj) {
      // Não permitir remover objetos travados
      if (obj.userData?.locked) {
        console.warn('Não é possível remover objeto travado:', obj.name);
        return;
      }
      const name = obj.name || obj.uuid;
      // Usar função do hook que remove e atualiza a lista
      removeObject(name);
    }
  };

  // Renderizar Project Hub ou Editor baseado no estado
  if (appState === 'hub') {
    return <ProjectHub onProjectOpen={handleProjectOpen} />;
  }

  return (
    <div className="app">
      <EditorLayout
        engine={engine}
        containerRef={containerRef}
        objects={objects}
        selectedObject={selectedObject}
        selectedObjects={selectedObjects}
        onAddObject={addObject}
        onRemoveObject={handleRemoveObject}
        onSelectObject={handleSelectObject}
        currentProject={currentProject}
        onBackToHub={handleBackToHub}
      />
      <KeyboardShortcuts inputManager={engine?.inputManager} />
    </div>
  );
}

export default App;
