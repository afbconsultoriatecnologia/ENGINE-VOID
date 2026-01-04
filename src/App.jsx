import { useEffect, useMemo } from 'react';
import { useEditor } from './hooks/useEditor';
import EditorLayout from './editor/ui/EditorLayout';
import KeyboardShortcuts from './editor/ui/KeyboardShortcuts';
import './App.css';

/**
 * Componente principal da aplicação
 * Gerencia a engine Three.js e a interface de edição estilo Unity
 */
function App() {
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
    backgroundColor: 0x1a1a1a,
    enableShadows: true,
    antialias: true,
    mode: 'dev'
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
   * Inicializa a cena com objetos padrão quando a engine estiver pronta
   */
  useEffect(() => {
    if (!isReady || !engine) return;

    // Verificar se já foi inicializado
    if (engine.objects.has('Cylinder')) {
      console.log('Scene already initialized, skipping...');
      return;
    }

    console.log('=== INITIALIZING SCENE ===');

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

    // Atualizar lista de objetos
    refreshObjects();

    // Adicionar helpers (apenas visíveis em dev mode)
    engine.addGridHelper('grid', {
      size: 20,
      divisions: 20,
      colorCenterLine: 0xff5555,  // Linha central vermelha
      colorGrid: 0xaaaaaa         // Grid bem mais clara
    });

    engine.addAxesHelper('axes', { size: 5 });
  }, [isReady, engine]);

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
      />
      <KeyboardShortcuts inputManager={engine?.inputManager} />
    </div>
  );
}

export default App;
