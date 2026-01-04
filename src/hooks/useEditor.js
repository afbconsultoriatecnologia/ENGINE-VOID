import { useEffect, useRef, useState, useCallback } from 'react';
import { ThreeEngine } from '../editor/three/ThreeEngine';
import { editorState, EditorEvents } from '../editor/state/EditorState';

/**
 * Hook customizado para gerenciar o editor
 * Sincroniza ThreeEngine <-> EditorState
 * @param {Object} options - Opções de configuração da engine
 * @returns {Object} Objeto com a engine e estado
 */
export function useEditor(options = {}) {
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const [engine, setEngine] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [objects, setObjects] = useState([]);
  const [lights, setLights] = useState([]);
  const [selectedObject, setSelectedObject] = useState(null);
  const [selectedObjects, setSelectedObjects] = useState([]); // Array de nomes

  // Guardar projectType para detectar mudanças
  const projectTypeRef = useRef(options.projectType || '3d');

  // Sincronizar objeto Three.js com EditorState
  const syncObjectToState = useCallback((threeObject) => {
    if (!threeObject) return null;

    const entityData = {
      name: threeObject.name,
      type: threeObject.userData?.type || threeObject.geometry?.type || 'unknown',
      visible: threeObject.visible,
      transform: {
        position: threeObject.position.toArray(),
        rotation: [
          threeObject.rotation.x,
          threeObject.rotation.y,
          threeObject.rotation.z
        ],
        scale: threeObject.scale.toArray()
      },
      threeUuid: threeObject.uuid, // Referência ao objeto Three.js
      userData: { ...threeObject.userData }
    };

    // Verificar se já existe no state
    const existing = editorState.getEntityByThreeUuid(threeObject.uuid);
    if (existing) {
      editorState.updateEntity(existing.id, entityData);
      return existing.id;
    } else {
      return editorState.createEntity(entityData);
    }
  }, []);

  // Sincronizar todos os objetos da cena com EditorState
  const syncSceneToState = useCallback(() => {
    if (!engineRef.current) return;

    const threeObjects = engineRef.current.listObjects();
    threeObjects.forEach(obj => syncObjectToState(obj));
  }, [syncObjectToState]);

  // Efeito para criar/recriar engine quando container ou projectType mudar
  useEffect(() => {
    if (!containerRef.current) return;

    // Verificar se precisa recriar engine (mudança de projectType)
    const currentProjectType = options.projectType || '3d';
    const needsRecreate = engineRef.current && projectTypeRef.current !== currentProjectType;

    if (needsRecreate) {
      console.log(`[useEditor] Recreating engine: ${projectTypeRef.current} -> ${currentProjectType}`);
      engineRef.current.dispose();
      engineRef.current = null;
      setEngine(null);
      setIsReady(false);
    }

    // Atualizar ref do projectType
    projectTypeRef.current = currentProjectType;

    // Se já tem engine válida, não recriar
    if (engineRef.current) return;

    console.log(`[useEditor] Creating engine with projectType: ${currentProjectType}`);

    // Criar engine com callbacks
    engineRef.current = new ThreeEngine(containerRef.current, {
      ...options,
      onObjectSelected: (name, allNames = []) => {
        setSelectedObject(name);
        setSelectedObjects(allNames);

        // Sincronizar seleção com EditorState
        const selectedIds = allNames
          .map(n => {
            const obj = engineRef.current?.getObject(n);
            if (obj) {
              const entity = editorState.getEntityByThreeUuid(obj.uuid);
              return entity?.id;
            }
            return null;
          })
          .filter(Boolean);

        if (selectedIds.length > 0) {
          editorState.setSelection(selectedIds);
        } else {
          editorState.clearSelection();
        }
      },
      onObjectsChanged: () => {
        // Atualizar lista quando objetos são adicionados/removidos
        if (engineRef.current) {
          setObjects(engineRef.current.listObjects());
          setLights(Array.from(engineRef.current.lights.keys()));
          // Sincronizar com EditorState
          syncSceneToState();
        }
      },
      onTransformChanged: (object) => {
        // Sincronizar transform com EditorState
        if (object) {
          const entity = editorState.getEntityByThreeUuid(object.uuid);
          if (entity) {
            editorState.setTransform(entity.id, {
              position: object.position.toArray(),
              rotation: [
                object.rotation.x,
                object.rotation.y,
                object.rotation.z
              ],
              scale: object.scale.toArray()
            });
          }
        }
      }
    });

    // Iniciar animação
    engineRef.current.start();
    setEngine(engineRef.current);
    setIsReady(true);

    // Atualizar lista de objetos e luzes
    const updateLists = () => {
      if (engineRef.current) {
        setObjects(engineRef.current.listObjects());
        setLights(Array.from(engineRef.current.lights.keys()));
        // Sincronizar com EditorState
        syncSceneToState();
      }
    };
    updateLists();

    // Escutar mudanças no EditorState para atualizar a UI
    const unsubHistory = editorState.subscribe(EditorEvents.HISTORY_CHANGED, () => {
      // Forçar re-render para atualizar botões undo/redo
      setObjects(prev => [...prev]);
    });

    // Cleanup
    return () => {
      unsubHistory();
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
      setEngine(null);
      setIsReady(false);
    };
  }, [syncSceneToState, options.projectType]);

  /**
   * Adiciona um objeto à cena e atualiza a lista
   * @param {string} name - Nome do objeto
   * @param {Function} createFn - Função que cria o objeto usando a engine
   */
  const addObject = (name, createFn) => {
    if (engineRef.current) {
      createFn(engineRef.current);
      setObjects(engineRef.current.listObjects());
    }
  };

  /**
   * Remove um objeto da cena e atualiza a lista
   * @param {string} name - Nome do objeto
   */
  const removeObject = (name) => {
    if (engineRef.current) {
      engineRef.current.removeObject(name);
      setObjects(engineRef.current.listObjects());
    }
  };

  /**
   * Obtém um objeto da cena
   * @param {string} name - Nome do objeto
   * @returns {THREE.Object3D|null}
   */
  const getObject = (name) => {
    return engineRef.current?.getObject(name) || null;
  };

  /**
   * Atualiza a lista de objetos e luzes
   */
  const refreshObjects = () => {
    if (engineRef.current) {
      setObjects(engineRef.current.listObjects());
      setLights(Array.from(engineRef.current.lights.keys()));
    }
  };

  return {
    containerRef,
    engine,
    isReady,
    objects,
    lights,
    selectedObject,
    selectedObjects,
    addObject,
    removeObject,
    getObject,
    refreshObjects,
    // EditorState integration
    editorState,
    syncSceneToState
  };
}

// Re-export EditorState utilities for convenience
export { editorState, EditorEvents } from '../editor/state/EditorState';
export {
  useEditorState,
  useEntities,
  useEntity,
  useSelection,
  useHistory,
  useSettings,
  useScene,
  useClipboard,
  useEditor as useEditorHook
} from '../editor/state/useEditorState';

