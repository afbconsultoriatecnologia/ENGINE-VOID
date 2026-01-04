/**
 * useEditorState - Hook React para usar o EditorState
 *
 * Permite que componentes React se inscrevam para eventos
 * do EditorState e re-renderizem automaticamente.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { editorState, EditorEvents } from './EditorState';

/**
 * Hook principal para usar o EditorState
 * @param {string[]} [events] - Eventos para escutar (default: STATE_CHANGED)
 * @returns {Object} Estado e métodos do editor
 */
export function useEditorState(events = [EditorEvents.STATE_CHANGED]) {
  const [, forceUpdate] = useState({});

  // Forçar re-render quando eventos ocorrerem
  useEffect(() => {
    const unsubscribes = events.map(event =>
      editorState.subscribe(event, () => forceUpdate({}))
    );

    return () => unsubscribes.forEach(unsub => unsub());
  }, [events.join(',')]);

  return editorState;
}

/**
 * Hook para obter apenas as entidades
 * @param {Object} [filter] - Filtro opcional
 * @returns {Array} Lista de entidades
 */
export function useEntities(filter = {}) {
  const [entities, setEntities] = useState(() =>
    editorState.listEntities(filter)
  );

  useEffect(() => {
    const events = [
      EditorEvents.ENTITY_CREATED,
      EditorEvents.ENTITY_DELETED,
      EditorEvents.ENTITY_UPDATED
    ];

    const update = () => setEntities(editorState.listEntities(filter));

    const unsubscribes = events.map(event =>
      editorState.subscribe(event, update)
    );

    return () => unsubscribes.forEach(unsub => unsub());
  }, [JSON.stringify(filter)]);

  return entities;
}

/**
 * Hook para obter uma entidade específica
 * @param {string} id - ID da entidade
 * @returns {Object|null} Entidade ou null
 */
export function useEntity(id) {
  const [entity, setEntity] = useState(() => editorState.getEntity(id));

  useEffect(() => {
    const update = (data) => {
      if (data.id === id || data.entity?.id === id) {
        setEntity(editorState.getEntity(id));
      }
    };

    const events = [
      EditorEvents.ENTITY_UPDATED,
      EditorEvents.ENTITY_DELETED,
      EditorEvents.TRANSFORM_CHANGED
    ];

    const unsubscribes = events.map(event =>
      editorState.subscribe(event, update)
    );

    // Atualizar quando o ID mudar
    setEntity(editorState.getEntity(id));

    return () => unsubscribes.forEach(unsub => unsub());
  }, [id]);

  return entity;
}

/**
 * Hook para obter a seleção atual
 * @returns {Object} { selection, selectedEntities, setSelection, ... }
 */
export function useSelection() {
  const [selection, setSelectionState] = useState(() => editorState.selection);

  useEffect(() => {
    const unsubscribe = editorState.subscribe(
      EditorEvents.SELECTION_CHANGED,
      ({ selection }) => setSelectionState(selection)
    );

    return unsubscribe;
  }, []);

  const selectedEntities = useMemo(
    () => selection.map(id => editorState.getEntity(id)).filter(Boolean),
    [selection]
  );

  const setSelection = useCallback((ids) => {
    editorState.setSelection(ids);
  }, []);

  const addToSelection = useCallback((id) => {
    editorState.addToSelection(id);
  }, []);

  const removeFromSelection = useCallback((id) => {
    editorState.removeFromSelection(id);
  }, []);

  const toggleSelection = useCallback((id) => {
    editorState.toggleSelection(id);
  }, []);

  const clearSelection = useCallback(() => {
    editorState.clearSelection();
  }, []);

  return {
    selection,
    selectedEntities,
    setSelection,
    addToSelection,
    removeFromSelection,
    toggleSelection,
    clearSelection
  };
}

/**
 * Hook para histórico (undo/redo)
 * @returns {Object} { canUndo, canRedo, undo, redo }
 */
export function useHistory() {
  const [canUndo, setCanUndo] = useState(() => editorState.canUndo());
  const [canRedo, setCanRedo] = useState(() => editorState.canRedo());

  useEffect(() => {
    const unsubscribe = editorState.subscribe(
      EditorEvents.HISTORY_CHANGED,
      ({ canUndo, canRedo }) => {
        setCanUndo(canUndo);
        setCanRedo(canRedo);
      }
    );

    return unsubscribe;
  }, []);

  const undo = useCallback(() => editorState.undo(), []);
  const redo = useCallback(() => editorState.redo(), []);

  return { canUndo, canRedo, undo, redo };
}

/**
 * Hook para configurações do editor
 * @returns {Object} { settings, updateSettings }
 */
export function useSettings() {
  const [settings, setSettings] = useState(() => editorState.settings);

  useEffect(() => {
    const unsubscribe = editorState.subscribe(
      EditorEvents.SETTINGS_CHANGED,
      ({ settings }) => setSettings({ ...settings })
    );

    return unsubscribe;
  }, []);

  const updateSettings = useCallback((newSettings) => {
    editorState.updateSettings(newSettings);
  }, []);

  const updateSnapSettings = useCallback((snapSettings) => {
    editorState.updateSnapSettings(snapSettings);
  }, []);

  return { settings, updateSettings, updateSnapSettings };
}

/**
 * Hook para operações de cena
 * @returns {Object} { sceneName, save, load, clear }
 */
export function useScene() {
  const [sceneName, setSceneName] = useState(() => editorState.scene.name);

  useEffect(() => {
    const unsubscribe = editorState.subscribe(
      EditorEvents.SETTINGS_CHANGED,
      () => setSceneName(editorState.scene.name)
    );

    return unsubscribe;
  }, []);

  const save = useCallback(() => {
    return editorState.toJSON();
  }, []);

  const load = useCallback((json) => {
    editorState.fromJSON(json);
  }, []);

  const clear = useCallback(() => {
    editorState.clearScene();
  }, []);

  const setName = useCallback((name) => {
    editorState.setSceneName(name);
  }, []);

  return { sceneName, save, load, clear, setName };
}

/**
 * Hook para clipboard (copy/paste)
 * @returns {Object} { copy, paste, duplicate, hasClipboard }
 */
export function useClipboard() {
  const [hasClipboard, setHasClipboard] = useState(
    () => !!editorState.clipboard?.entities?.length
  );

  const copy = useCallback((ids) => {
    editorState.copy(ids);
    setHasClipboard(true);
  }, []);

  const paste = useCallback((offset) => {
    return editorState.paste(offset);
  }, []);

  const duplicate = useCallback((ids) => {
    return editorState.duplicate(ids);
  }, []);

  return { copy, paste, duplicate, hasClipboard };
}

/**
 * Hook combinado com todas as funcionalidades
 * @returns {Object} Todas as funcionalidades do editor
 */
export function useEditor() {
  const state = useEditorState();
  const selection = useSelection();
  const history = useHistory();
  const settings = useSettings();
  const scene = useScene();
  const clipboard = useClipboard();

  return {
    // State
    state,

    // Entities
    entities: state.listEntities(),
    getEntity: state.getEntity.bind(state),
    createEntity: state.createEntity.bind(state),
    deleteEntity: state.deleteEntity.bind(state),
    updateEntity: state.updateEntity.bind(state),

    // Selection
    ...selection,

    // History
    ...history,

    // Settings
    ...settings,

    // Scene
    ...scene,

    // Clipboard
    ...clipboard
  };
}

// Re-export EditorEvents for convenience
export { EditorEvents } from './EditorState';
