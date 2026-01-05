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
    console.log('[App] Opening project:', project.name, 'type:', project.type, 'template:', project.template);

    // Limpar cena anterior se existir
    if (engine) {
      engine.clearScene?.();
      engine._sceneInitialized = false;
    }

    // Configurar projeto no ProjectManager para que loadScene funcione
    projectManager.currentProject = project;

    // Primeiro definir o projeto, depois mudar o estado
    // Isso garante que quando o EditorLayout renderizar, o projectType já esteja correto
    setCurrentProject(project);

    // Usar setTimeout para garantir que o estado foi atualizado antes de mudar para editor
    setTimeout(() => {
      setAppState('editor');
    }, 0);
  };

  /**
   * Callback para voltar ao Hub
   */
  const handleBackToHub = () => {
    setAppState('hub');
    setCurrentProject(null);
    // Limpar cena atual e reset flag
    if (engine) {
      engine.clearScene?.();
      engine._sceneInitialized = false;
    }
    // Limpar projeto do manager
    projectManager.currentProject = null;
  };

  /**
   * Carrega a cena do projeto quando a engine estiver pronta
   */
  useEffect(() => {
    if (!isReady || !engine || appState !== 'editor' || !currentProject) return;

    // Verificar se já foi inicializado
    if (engine._sceneInitialized) {
      console.log('Scene already initialized, skipping...');
      return;
    }

    const loadProjectScene = async () => {
      console.log(`=== LOADING PROJECT SCENE: ${currentProject.name} (${currentProject.type}) ===`);
      console.log('Template:', currentProject.template);
      console.log('Project path:', currentProject.path);

      try {
        // Carregar cena do projeto
        const sceneData = await projectManager.loadScene('main');
        console.log('Scene data loaded:', sceneData);

        if (sceneData && (sceneData.objects?.length > 0 || sceneData.lights?.length > 0)) {
          console.log('Loading scene with', sceneData.objects?.length || 0, 'objects and', sceneData.lights?.length || 0, 'lights');
          await loadSceneData(engine, sceneData);
        } else {
          console.log('No scene data found, creating default scene');
          // Fallback: criar cena padrão se não houver dados
          createDefaultScene(engine);
        }
      } catch (error) {
        console.warn('Could not load project scene, creating default:', error);
        console.error('Error details:', error.message);
        createDefaultScene(engine);
      }

      // Adicionar helpers (apenas visíveis em dev mode)
      if (!engine.is2D) {
        engine.addGridHelper('grid', {
          size: 20,
          divisions: 20,
          colorCenterLine: 0xff5555,
          colorGrid: 0xaaaaaa
        });
        engine.addAxesHelper('axes', { size: 5 });
      }

      engine._sceneInitialized = true;
      refreshObjects();
    };

    loadProjectScene();
  }, [isReady, engine, appState, currentProject]);

  /**
   * Carrega dados da cena no engine
   */
  const loadSceneData = async (engine, sceneData) => {
    // Carregar luzes
    if (sceneData.lights) {
      for (const light of sceneData.lights) {
        const color = light.color ? parseInt(light.color.replace('#', '0x')) : 0xffffff;

        switch (light.type) {
          case 'ambient':
            engine.addAmbientLight(light.name, {
              color,
              intensity: light.intensity || 0.5
            });
            break;
          case 'directional':
            engine.addDirectionalLight(light.name, {
              color,
              intensity: light.intensity || 1,
              position: [light.position?.x || 5, light.position?.y || 10, light.position?.z || 5],
              castShadow: light.castShadow !== false
            });
            break;
          case 'point':
            engine.addPointLight(light.name, {
              color,
              intensity: light.intensity || 1,
              position: [light.position?.x || 0, light.position?.y || 5, light.position?.z || 0],
              distance: light.distance || 0,
              decay: light.decay || 2
            });
            break;
        }
      }
    }

    // Carregar objetos
    if (sceneData.objects) {
      console.log('Creating objects from scene data...');
      for (const obj of sceneData.objects) {
        console.log('Creating object:', obj.name, 'type:', obj.type, 'userData:', obj.userData);
        const color = obj.material?.color ? parseInt(obj.material.color.replace('#', '0x')) : 0x888888;
        const position = [obj.position?.x || 0, obj.position?.y || 0, obj.position?.z || 0];
        const rotation = [
          (obj.rotation?.x || 0) * Math.PI / 180,
          (obj.rotation?.y || 0) * Math.PI / 180,
          (obj.rotation?.z || 0) * Math.PI / 180
        ];
        const scale = [obj.scale?.x || 1, obj.scale?.y || 1, obj.scale?.z || 1];

        const baseOptions = {
          color,
          position,
          rotation,
          scale,
          metalness: obj.material?.metalness || 0,
          roughness: obj.material?.roughness || 0.5,
          locked: obj.userData?.isLocked || false,
          userData: obj.userData || {}
        };

        switch (obj.type) {
          case 'plane':
            engine.createPlane(obj.name, {
              ...baseOptions,
              width: obj.scale?.x || 10,
              height: obj.scale?.y || 10
            });
            break;
          case 'box':
            engine.createBox(obj.name, {
              ...baseOptions,
              width: 1,
              height: 1,
              depth: 1
            });
            break;
          case 'sphere':
            engine.createSphere(obj.name, {
              ...baseOptions,
              radius: 0.5
            });
            break;
          case 'cylinder':
            engine.createCylinder(obj.name, {
              ...baseOptions,
              radiusTop: 0.5,
              radiusBottom: 0.5,
              height: 1
            });
            break;
          case 'capsule':
            // Capsule com parâmetros corretos
            if (engine.createCapsule) {
              engine.createCapsule(obj.name, {
                ...baseOptions,
                radius: obj.scale?.x || 0.5,
                length: obj.scale?.y || 1
              });
            } else {
              // Fallback para cylinder se não houver createCapsule
              engine.createCylinder(obj.name, {
                ...baseOptions,
                radiusTop: obj.scale?.x || 0.3,
                radiusBottom: obj.scale?.x || 0.3,
                height: obj.scale?.y || 1
              });
            }
            break;
          case 'sprite':
            // Para projetos 2D
            if (engine.createSprite) {
              const spriteColor = obj.sprite?.color ? parseInt(obj.sprite.color.replace('#', '0x')) : color;
              engine.createSprite(obj.name, {
                width: obj.sprite?.width || 32,
                height: obj.sprite?.height || 32,
                color: spriteColor,
                position: { x: obj.position?.x || 0, y: obj.position?.y || 0 },
                scale: { x: obj.scale?.x || 1, y: obj.scale?.y || 1 },
                sortingLayer: obj.userData?.sortingLayer || 'Default',
                sortingOrder: obj.userData?.sortingOrder || 0,
                userData: obj.userData || {}
              });
            }
            break;
        }

        // Aplicar userData ao objeto criado
        if (obj.userData) {
          const createdObj = engine.getObject(obj.name);
          if (createdObj) {
            createdObj.userData = { ...createdObj.userData, ...obj.userData };
          }
        }
      }
    }
  };

  /**
   * Cria cena padrão (fallback)
   */
  const createDefaultScene = (engine) => {
    if (engine.is2D) {
      engine.addAmbientLight('Ambient Light', { color: 0xffffff, intensity: 1.0 });
      engine.createSprite('Player Sprite', {
        width: 1, height: 1, color: 0x4a90d9,
        position: { x: 0, y: 0 },
        sortingLayer: 'Default', sortingOrder: 0
      });
    } else {
      engine.addAmbientLight('Ambient Light', { color: 0xffffff, intensity: 0.3 });
      engine.addDirectionalLight('Directional Light', {
        color: 0xffffff, intensity: 1.0,
        position: [10, 10, 5], castShadow: true
      });
      engine.createPlane('Floor', {
        color: 0x808080, position: [0, 0, 0],
        rotation: [-Math.PI / 2, 0, 0],
        width: 20, height: 20,
        metalness: 0.1, roughness: 0.9, locked: true
      });
    }
  };

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
