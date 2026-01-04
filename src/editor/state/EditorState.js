/**
 * EditorState - Fonte única da verdade para o estado do editor
 *
 * Centraliza todo o estado do editor, preparando para
 * futura integração com backend TypeScript ou Rust/WASM.
 */

// ==================== Tipos ====================

/**
 * @typedef {Object} Vec3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} Transform
 * @property {Vec3} position
 * @property {Vec3} rotation - Euler angles em radianos
 * @property {Vec3} scale
 */

/**
 * @typedef {'mesh'|'light'|'camera'|'empty'} EntityType
 */

/**
 * @typedef {Object} MaterialData
 * @property {string} color
 * @property {number} metalness
 * @property {number} roughness
 * @property {number} opacity
 * @property {boolean} transparent
 * @property {string} emissive
 * @property {number} emissiveIntensity
 */

/**
 * @typedef {Object} GeometryData
 * @property {string} type
 * @property {Object} params
 */

/**
 * @typedef {Object} LightData
 * @property {string} lightType
 * @property {string} color
 * @property {number} intensity
 * @property {boolean} castShadow
 * @property {Object} [params]
 */

/**
 * @typedef {Object} EntityData
 * @property {string} id
 * @property {string} name
 * @property {EntityType} type
 * @property {Transform} transform
 * @property {string|null} parent
 * @property {string[]} children
 * @property {boolean} visible
 * @property {boolean} locked
 * @property {MaterialData} [material]
 * @property {GeometryData} [geometry]
 * @property {LightData} [light]
 */

/**
 * @typedef {Object} SceneData
 * @property {string} version
 * @property {string} name
 * @property {EntityData[]} entities
 * @property {Object} environment
 * @property {Object} settings
 */

// ==================== Event Types ====================

export const EditorEvents = {
  // Entity events
  ENTITY_CREATED: 'entity:created',
  ENTITY_DELETED: 'entity:deleted',
  ENTITY_UPDATED: 'entity:updated',
  ENTITY_RENAMED: 'entity:renamed',

  // Selection events
  SELECTION_CHANGED: 'selection:changed',

  // Transform events
  TRANSFORM_CHANGED: 'transform:changed',

  // Scene events
  SCENE_LOADED: 'scene:loaded',
  SCENE_SAVED: 'scene:saved',
  SCENE_CLEARED: 'scene:cleared',

  // Settings events
  SETTINGS_CHANGED: 'settings:changed',

  // History events
  HISTORY_CHANGED: 'history:changed',

  // General
  STATE_CHANGED: 'state:changed'
};

// ==================== Utility Functions ====================

/**
 * Gera um ID único curto
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Cria um transform padrão
 */
function createDefaultTransform() {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  };
}

/**
 * Deep clone de um objeto
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ==================== EditorState Class ====================

export class EditorState {
  constructor() {
    /** @type {Map<string, EntityData>} */
    this.entities = new Map();

    /** @type {string[]} */
    this.selection = [];

    /** @type {Object|null} */
    this.clipboard = null;

    /** @type {Object} */
    this.scene = {
      name: 'Untitled Scene',
      version: '1.0.0',
      environment: {
        backgroundColor: '#1a1a1a',
        ambientLight: { color: '#ffffff', intensity: 0.3 },
        fog: null,
        sky: null
      }
    };

    /** @type {Object} */
    this.settings = {
      transformSpace: 'world',
      snapSettings: {
        gridSnap: false,
        gridSize: 1,
        rotationSnap: false,
        rotationSnapAngle: 15,
        scaleSnap: false,
        scaleSnapSize: 0.1
      },
      activeCamera: 'perspective',
      showGrid: true,
      showAxes: true,
      showStats: false
    };

    /** @type {Object[]} */
    this.history = [];

    /** @type {number} */
    this.historyIndex = -1;

    /** @type {number} */
    this.maxHistorySize = 50;

    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();

    /** @type {boolean} */
    this.isRecordingHistory = true;
  }

  // ==================== Event System ====================

  /**
   * Inscreve um callback para um evento
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Inscreve para múltiplos eventos
   * @param {string[]} events
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  subscribeMany(events, callback) {
    const unsubscribes = events.map(e => this.subscribe(e, callback));
    return () => unsubscribes.forEach(unsub => unsub());
  }

  /**
   * Emite um evento
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    this.listeners.get(event)?.forEach(cb => {
      try {
        cb(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });

    // Também emite o evento genérico de mudança de estado
    if (event !== EditorEvents.STATE_CHANGED) {
      this.listeners.get(EditorEvents.STATE_CHANGED)?.forEach(cb => {
        try {
          cb({ event, data });
        } catch (error) {
          console.error('Error in state change listener:', error);
        }
      });
    }
  }

  // ==================== Entity Management ====================

  /**
   * Cria uma nova entidade
   * @param {Partial<EntityData>} data
   * @returns {EntityData}
   */
  createEntity(data) {
    const id = data.id || generateId();

    /** @type {EntityData} */
    const entity = {
      id,
      name: data.name || `Entity_${id.substr(0, 4)}`,
      type: data.type || 'empty',
      transform: data.transform || createDefaultTransform(),
      parent: data.parent || null,
      children: data.children || [],
      visible: data.visible !== false,
      locked: data.locked || false,
      material: data.material || null,
      geometry: data.geometry || null,
      light: data.light || null
    };

    // Registrar no histórico
    this.recordHistory('create', { entity: deepClone(entity) });

    this.entities.set(id, entity);

    // Se tem parent, adicionar como filho
    if (entity.parent) {
      const parent = this.entities.get(entity.parent);
      if (parent && !parent.children.includes(id)) {
        parent.children.push(id);
      }
    }

    this.emit(EditorEvents.ENTITY_CREATED, entity);
    return entity;
  }

  /**
   * Remove uma entidade
   * @param {string} id
   * @returns {boolean}
   */
  deleteEntity(id) {
    const entity = this.entities.get(id);
    if (!entity) return false;

    // Registrar no histórico
    this.recordHistory('delete', { entity: deepClone(entity) });

    // Remover dos filhos do parent
    if (entity.parent) {
      const parent = this.entities.get(entity.parent);
      if (parent) {
        parent.children = parent.children.filter(c => c !== id);
      }
    }

    // Remover filhos recursivamente
    entity.children.forEach(childId => {
      this.deleteEntity(childId);
    });

    // Remover da seleção
    this.selection = this.selection.filter(s => s !== id);

    this.entities.delete(id);
    this.emit(EditorEvents.ENTITY_DELETED, { id, entity });
    return true;
  }

  /**
   * Atualiza uma entidade
   * @param {string} id
   * @param {Partial<EntityData>} changes
   * @returns {EntityData|null}
   */
  updateEntity(id, changes) {
    const entity = this.entities.get(id);
    if (!entity) return null;

    const oldData = deepClone(entity);

    // Registrar no histórico
    this.recordHistory('update', {
      id,
      oldData,
      newData: changes
    });

    // Aplicar mudanças
    Object.assign(entity, changes);

    // Se mudou o nome, emitir evento específico
    if (changes.name && changes.name !== oldData.name) {
      this.emit(EditorEvents.ENTITY_RENAMED, {
        id,
        oldName: oldData.name,
        newName: changes.name
      });
    }

    // Se mudou o transform, emitir evento específico
    if (changes.transform) {
      this.emit(EditorEvents.TRANSFORM_CHANGED, {
        id,
        transform: entity.transform
      });
    }

    this.emit(EditorEvents.ENTITY_UPDATED, { id, entity, changes });
    return entity;
  }

  /**
   * Obtém uma entidade
   * @param {string} id
   * @returns {EntityData|null}
   */
  getEntity(id) {
    return this.entities.get(id) || null;
  }

  /**
   * Obtém uma entidade pelo UUID do Three.js
   * @param {string} threeUuid - UUID do objeto Three.js
   * @returns {EntityData|null}
   */
  getEntityByThreeUuid(threeUuid) {
    for (const entity of this.entities.values()) {
      if (entity.threeUuid === threeUuid) {
        return entity;
      }
    }
    return null;
  }

  /**
   * Lista todas as entidades
   * @param {Object} [filter]
   * @returns {EntityData[]}
   */
  listEntities(filter = {}) {
    let result = Array.from(this.entities.values());

    if (filter.type) {
      result = result.filter(e => e.type === filter.type);
    }

    if (filter.parent !== undefined) {
      result = result.filter(e => e.parent === filter.parent);
    }

    if (filter.visible !== undefined) {
      result = result.filter(e => e.visible === filter.visible);
    }

    return result;
  }

  /**
   * Obtém entidades raiz (sem parent)
   * @returns {EntityData[]}
   */
  getRootEntities() {
    return this.listEntities({ parent: null });
  }

  // ==================== Selection ====================

  /**
   * Define a seleção atual
   * @param {string[]} ids
   */
  setSelection(ids) {
    const validIds = ids.filter(id => this.entities.has(id));
    const oldSelection = [...this.selection];

    this.selection = validIds;

    this.emit(EditorEvents.SELECTION_CHANGED, {
      selection: validIds,
      oldSelection
    });
  }

  /**
   * Adiciona à seleção
   * @param {string} id
   */
  addToSelection(id) {
    if (!this.entities.has(id)) return;
    if (this.selection.includes(id)) return;

    this.setSelection([...this.selection, id]);
  }

  /**
   * Remove da seleção
   * @param {string} id
   */
  removeFromSelection(id) {
    this.setSelection(this.selection.filter(s => s !== id));
  }

  /**
   * Toggle seleção
   * @param {string} id
   */
  toggleSelection(id) {
    if (this.selection.includes(id)) {
      this.removeFromSelection(id);
    } else {
      this.addToSelection(id);
    }
  }

  /**
   * Limpa a seleção
   */
  clearSelection() {
    this.setSelection([]);
  }

  /**
   * Obtém entidades selecionadas
   * @returns {EntityData[]}
   */
  getSelectedEntities() {
    return this.selection
      .map(id => this.entities.get(id))
      .filter(Boolean);
  }

  // ==================== Transform ====================

  /**
   * Atualiza o transform de uma entidade
   * @param {string} id
   * @param {Partial<Transform>} transform
   */
  setTransform(id, transform) {
    const entity = this.entities.get(id);
    if (!entity) return;

    const newTransform = {
      ...entity.transform,
      ...transform,
      position: { ...entity.transform.position, ...transform.position },
      rotation: { ...entity.transform.rotation, ...transform.rotation },
      scale: { ...entity.transform.scale, ...transform.scale }
    };

    this.updateEntity(id, { transform: newTransform });
  }

  /**
   * Atualiza a posição de uma entidade
   * @param {string} id
   * @param {Partial<Vec3>} position
   */
  setPosition(id, position) {
    const entity = this.entities.get(id);
    if (!entity) return;

    this.setTransform(id, {
      position: { ...entity.transform.position, ...position }
    });
  }

  /**
   * Atualiza a rotação de uma entidade
   * @param {string} id
   * @param {Partial<Vec3>} rotation
   */
  setRotation(id, rotation) {
    const entity = this.entities.get(id);
    if (!entity) return;

    this.setTransform(id, {
      rotation: { ...entity.transform.rotation, ...rotation }
    });
  }

  /**
   * Atualiza a escala de uma entidade
   * @param {string} id
   * @param {Partial<Vec3>} scale
   */
  setScale(id, scale) {
    const entity = this.entities.get(id);
    if (!entity) return;

    this.setTransform(id, {
      scale: { ...entity.transform.scale, ...scale }
    });
  }

  // ==================== History (Undo/Redo) ====================

  /**
   * Registra uma ação no histórico
   * @param {string} action
   * @param {Object} data
   */
  recordHistory(action, data) {
    if (!this.isRecordingHistory) return;

    // Remover ações futuras se estamos no meio do histórico
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push({
      action,
      data,
      timestamp: Date.now()
    });

    // Limitar tamanho do histórico
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }

    this.emit(EditorEvents.HISTORY_CHANGED, {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    });
  }

  /**
   * Pode desfazer?
   */
  canUndo() {
    return this.historyIndex >= 0;
  }

  /**
   * Pode refazer?
   */
  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }

  /**
   * Desfaz a última ação
   */
  undo() {
    if (!this.canUndo()) return;

    const entry = this.history[this.historyIndex];
    this.historyIndex--;

    this.isRecordingHistory = false;
    this.applyHistoryEntry(entry, true);
    this.isRecordingHistory = true;

    this.emit(EditorEvents.HISTORY_CHANGED, {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    });
  }

  /**
   * Refaz a última ação desfeita
   */
  redo() {
    if (!this.canRedo()) return;

    this.historyIndex++;
    const entry = this.history[this.historyIndex];

    this.isRecordingHistory = false;
    this.applyHistoryEntry(entry, false);
    this.isRecordingHistory = true;

    this.emit(EditorEvents.HISTORY_CHANGED, {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    });
  }

  /**
   * Aplica uma entrada do histórico
   * @param {Object} entry
   * @param {boolean} isUndo
   */
  applyHistoryEntry(entry, isUndo) {
    switch (entry.action) {
      case 'create':
        if (isUndo) {
          this.entities.delete(entry.data.entity.id);
          this.emit(EditorEvents.ENTITY_DELETED, { id: entry.data.entity.id });
        } else {
          this.entities.set(entry.data.entity.id, deepClone(entry.data.entity));
          this.emit(EditorEvents.ENTITY_CREATED, entry.data.entity);
        }
        break;

      case 'delete':
        if (isUndo) {
          this.entities.set(entry.data.entity.id, deepClone(entry.data.entity));
          this.emit(EditorEvents.ENTITY_CREATED, entry.data.entity);
        } else {
          this.entities.delete(entry.data.entity.id);
          this.emit(EditorEvents.ENTITY_DELETED, { id: entry.data.entity.id });
        }
        break;

      case 'update':
        const entity = this.entities.get(entry.data.id);
        if (entity) {
          if (isUndo) {
            Object.assign(entity, entry.data.oldData);
          } else {
            Object.assign(entity, entry.data.newData);
          }
          this.emit(EditorEvents.ENTITY_UPDATED, { id: entry.data.id, entity });
        }
        break;
    }
  }

  /**
   * Limpa o histórico
   */
  clearHistory() {
    this.history = [];
    this.historyIndex = -1;
    this.emit(EditorEvents.HISTORY_CHANGED, {
      canUndo: false,
      canRedo: false
    });
  }

  // ==================== Settings ====================

  /**
   * Atualiza as configurações
   * @param {Partial<Object>} settings
   */
  updateSettings(settings) {
    const oldSettings = deepClone(this.settings);
    this.settings = { ...this.settings, ...settings };

    this.emit(EditorEvents.SETTINGS_CHANGED, {
      settings: this.settings,
      changes: settings,
      oldSettings
    });
  }

  /**
   * Atualiza configurações de snap
   * @param {Partial<Object>} snapSettings
   */
  updateSnapSettings(snapSettings) {
    this.updateSettings({
      snapSettings: { ...this.settings.snapSettings, ...snapSettings }
    });
  }

  // ==================== Serialization ====================

  /**
   * Serializa o estado para JSON
   * @returns {SceneData}
   */
  serialize() {
    return {
      version: '1.0.0',
      name: this.scene.name,
      entities: Array.from(this.entities.values()).map(e => deepClone(e)),
      environment: deepClone(this.scene.environment),
      settings: deepClone(this.settings)
    };
  }

  /**
   * Deserializa JSON para o estado
   * @param {SceneData} data
   */
  deserialize(data) {
    // Limpar estado atual
    this.entities.clear();
    this.selection = [];
    this.clearHistory();

    // Carregar dados
    if (data.entities) {
      data.entities.forEach(entity => {
        this.entities.set(entity.id, entity);
      });
    }

    if (data.environment) {
      this.scene.environment = data.environment;
    }

    if (data.settings) {
      this.settings = { ...this.settings, ...data.settings };
    }

    this.scene.name = data.name || 'Untitled Scene';

    this.emit(EditorEvents.SCENE_LOADED, data);
  }

  /**
   * Exporta para JSON string
   * @returns {string}
   */
  toJSON() {
    return JSON.stringify(this.serialize(), null, 2);
  }

  /**
   * Importa de JSON string
   * @param {string} json
   */
  fromJSON(json) {
    const data = JSON.parse(json);
    this.deserialize(data);
  }

  // ==================== Scene Management ====================

  /**
   * Limpa a cena
   */
  clearScene() {
    this.entities.clear();
    this.selection = [];
    this.clearHistory();
    this.scene.name = 'Untitled Scene';

    this.emit(EditorEvents.SCENE_CLEARED, {});
  }

  /**
   * Define o nome da cena
   * @param {string} name
   */
  setSceneName(name) {
    this.scene.name = name;
    this.emit(EditorEvents.SETTINGS_CHANGED, { sceneName: name });
  }

  // ==================== Clipboard ====================

  /**
   * Copia entidades para o clipboard
   * @param {string[]} ids
   */
  copy(ids = this.selection) {
    const entities = ids
      .map(id => this.entities.get(id))
      .filter(Boolean)
      .map(e => deepClone(e));

    this.clipboard = { entities };
  }

  /**
   * Cola entidades do clipboard
   * @param {Vec3} [offset]
   * @returns {string[]} IDs das novas entidades
   */
  paste(offset = { x: 1, y: 0, z: 0 }) {
    if (!this.clipboard?.entities?.length) return [];

    const newIds = [];

    this.clipboard.entities.forEach(entity => {
      const newEntity = this.createEntity({
        ...entity,
        id: undefined, // Gerar novo ID
        name: `${entity.name}_copy`,
        transform: {
          ...entity.transform,
          position: {
            x: entity.transform.position.x + offset.x,
            y: entity.transform.position.y + offset.y,
            z: entity.transform.position.z + offset.z
          }
        }
      });

      newIds.push(newEntity.id);
    });

    // Selecionar novas entidades
    this.setSelection(newIds);

    return newIds;
  }

  /**
   * Duplica entidades
   * @param {string[]} ids
   * @returns {string[]}
   */
  duplicate(ids = this.selection) {
    this.copy(ids);
    return this.paste();
  }
}

// ==================== Singleton Instance ====================

export const editorState = new EditorState();

// ==================== React Hook ====================

/**
 * Hook para usar o EditorState em componentes React
 * @param {string[]} events - Eventos para escutar
 * @returns {EditorState}
 */
export function useEditorState(events = [EditorEvents.STATE_CHANGED]) {
  // Este hook será implementado quando integrarmos com React
  // Por enquanto retorna apenas a instância
  return editorState;
}
