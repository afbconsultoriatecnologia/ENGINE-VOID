import * as THREE from 'three';

/**
 * Classe base para comandos
 * Todos os comandos devem implementar execute() e undo()
 */
export class Command {
  /**
   * Executa o comando
   */
  execute() {
    throw new Error('Command.execute() must be implemented');
  }

  /**
   * Desfaz o comando
   */
  undo() {
    throw new Error('Command.undo() must be implemented');
  }

  /**
   * Retorna uma descrição do comando para exibição
   * @returns {string}
   */
  getDescription() {
    return 'Unknown action';
  }
}

/**
 * Comando para transformações de objetos (position, rotation, scale)
 */
export class TransformCommand extends Command {
  /**
   * @param {THREE.Object3D} object - Objeto a transformar
   * @param {string} property - 'position' | 'rotation' | 'scale'
   * @param {THREE.Vector3|THREE.Euler} oldValue - Valor anterior
   * @param {THREE.Vector3|THREE.Euler} newValue - Novo valor
   * @param {string} objectName - Nome do objeto para descrição
   */
  constructor(object, property, oldValue, newValue, objectName = 'Object') {
    super();
    this.object = object;
    this.property = property;
    this.oldValue = oldValue.clone();
    this.newValue = newValue.clone();
    this.objectName = objectName;
  }

  execute() {
    if (this.property === 'rotation') {
      this.object.rotation.copy(this.newValue);
    } else {
      this.object[this.property].copy(this.newValue);
    }
  }

  undo() {
    if (this.property === 'rotation') {
      this.object.rotation.copy(this.oldValue);
    } else {
      this.object[this.property].copy(this.oldValue);
    }
  }

  getDescription() {
    const propertyNames = {
      position: 'Mover',
      rotation: 'Rotacionar',
      scale: 'Escalar'
    };
    return `${propertyNames[this.property] || 'Transformar'} ${this.objectName}`;
  }
}

/**
 * Comando para criar objetos
 */
export class CreateObjectCommand extends Command {
  /**
   * @param {THREE.Scene} scene - Cena onde adicionar o objeto
   * @param {THREE.Object3D} object - Objeto a adicionar
   * @param {string} name - Nome do objeto
   * @param {Map} objectsMap - Mapa de objetos do engine
   */
  constructor(scene, object, name, objectsMap) {
    super();
    this.scene = scene;
    this.object = object;
    this.name = name;
    this.objectsMap = objectsMap;
  }

  execute() {
    this.scene.add(this.object);
    this.objectsMap.set(this.name, this.object);
  }

  undo() {
    this.scene.remove(this.object);
    this.objectsMap.delete(this.name);
  }

  getDescription() {
    return `Criar ${this.name}`;
  }
}

/**
 * Comando para deletar objetos
 */
export class DeleteObjectCommand extends Command {
  /**
   * @param {THREE.Scene} scene - Cena de onde remover
   * @param {THREE.Object3D} object - Objeto a remover
   * @param {string} name - Nome do objeto
   * @param {Map} objectsMap - Mapa de objetos do engine
   */
  constructor(scene, object, name, objectsMap) {
    super();
    this.scene = scene;
    this.object = object;
    this.name = name;
    this.objectsMap = objectsMap;

    // Salvar estado para restauração
    this.parent = object.parent;
    this.position = object.position.clone();
    this.rotation = object.rotation.clone();
    this.scale = object.scale.clone();
  }

  execute() {
    this.scene.remove(this.object);
    this.objectsMap.delete(this.name);
  }

  undo() {
    // Restaurar posição/rotação/escala
    this.object.position.copy(this.position);
    this.object.rotation.copy(this.rotation);
    this.object.scale.copy(this.scale);

    this.scene.add(this.object);
    this.objectsMap.set(this.name, this.object);
  }

  getDescription() {
    return `Deletar ${this.name}`;
  }
}

/**
 * Comando para duplicar objetos
 */
export class DuplicateCommand extends Command {
  /**
   * @param {THREE.Scene} scene - Cena
   * @param {THREE.Object3D} originalObject - Objeto original
   * @param {THREE.Object3D} clonedObject - Objeto clonado
   * @param {string} originalName - Nome do objeto original
   * @param {string} clonedName - Nome do clone
   * @param {Map} objectsMap - Mapa de objetos
   */
  constructor(scene, originalObject, clonedObject, originalName, clonedName, objectsMap) {
    super();
    this.scene = scene;
    this.originalObject = originalObject;
    this.clonedObject = clonedObject;
    this.originalName = originalName;
    this.clonedName = clonedName;
    this.objectsMap = objectsMap;
  }

  execute() {
    this.scene.add(this.clonedObject);
    this.objectsMap.set(this.clonedName, this.clonedObject);
  }

  undo() {
    this.scene.remove(this.clonedObject);
    this.objectsMap.delete(this.clonedName);
  }

  getDescription() {
    return `Duplicar ${this.originalName}`;
  }
}

/**
 * Comando para alterar propriedades de material
 */
export class MaterialCommand extends Command {
  /**
   * @param {THREE.Object3D} object - Objeto com o material
   * @param {string} property - Propriedade do material
   * @param {*} oldValue - Valor anterior
   * @param {*} newValue - Novo valor
   * @param {string} objectName - Nome do objeto
   */
  constructor(object, property, oldValue, newValue, objectName = 'Object') {
    super();
    this.object = object;
    this.property = property;
    this.oldValue = oldValue instanceof THREE.Color ? oldValue.clone() : oldValue;
    this.newValue = newValue instanceof THREE.Color ? newValue.clone() : newValue;
    this.objectName = objectName;
  }

  _getMaterial() {
    if (this.object.material) {
      return this.object.material;
    }
    // Procurar material em filhos
    let material = null;
    this.object.traverse((child) => {
      if (child.material && !material) {
        material = child.material;
      }
    });
    return material;
  }

  execute() {
    const material = this._getMaterial();
    if (material) {
      if (this.newValue instanceof THREE.Color) {
        material[this.property].copy(this.newValue);
      } else {
        material[this.property] = this.newValue;
      }
      material.needsUpdate = true;
    }
  }

  undo() {
    const material = this._getMaterial();
    if (material) {
      if (this.oldValue instanceof THREE.Color) {
        material[this.property].copy(this.oldValue);
      } else {
        material[this.property] = this.oldValue;
      }
      material.needsUpdate = true;
    }
  }

  getDescription() {
    return `Alterar ${this.property} de ${this.objectName}`;
  }
}

/**
 * Comando composto para agrupar múltiplos comandos
 */
export class CompositeCommand extends Command {
  /**
   * @param {Command[]} commands - Lista de comandos a agrupar
   * @param {string} description - Descrição do comando composto
   */
  constructor(commands, description = 'Multiple actions') {
    super();
    this.commands = commands;
    this.description = description;
  }

  execute() {
    for (const command of this.commands) {
      command.execute();
    }
  }

  undo() {
    // Desfazer em ordem reversa
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  getDescription() {
    return this.description;
  }
}

/**
 * Comando para transformações de múltiplos objetos (alinhamento, distribuição)
 */
export class MultiTransformCommand extends Command {
  /**
   * @param {Map<THREE.Object3D, THREE.Vector3>} originalPositions - Map de objeto -> posição original
   * @param {string} description - Descrição da ação
   */
  constructor(originalPositions, description = 'Transform multiple objects') {
    super();
    this.originalPositions = new Map();
    this.newPositions = new Map();

    // Clonar posições originais e salvar novas posições
    for (const [obj, pos] of originalPositions) {
      this.originalPositions.set(obj, pos.clone());
      this.newPositions.set(obj, obj.position.clone());
    }

    this.description = description;
  }

  execute() {
    for (const [obj, pos] of this.newPositions) {
      obj.position.copy(pos);
    }
  }

  undo() {
    for (const [obj, pos] of this.originalPositions) {
      obj.position.copy(pos);
    }
  }

  getDescription() {
    return this.description;
  }
}

/**
 * Comando para resetar transform de um objeto
 */
export class ResetTransformCommand extends Command {
  /**
   * @param {THREE.Object3D} object - Objeto a resetar
   * @param {Object} options - { position: boolean, rotation: boolean, scale: boolean }
   * @param {string} objectName - Nome do objeto
   */
  constructor(object, options = {}, objectName = 'Object') {
    super();
    this.object = object;
    this.objectName = objectName;
    this.options = {
      position: options.position !== false,
      rotation: options.rotation !== false,
      scale: options.scale !== false
    };

    // Salvar valores originais
    this.originalPosition = object.position.clone();
    this.originalRotation = object.rotation.clone();
    this.originalScale = object.scale.clone();
  }

  execute() {
    if (this.options.position) {
      this.object.position.set(0, 0, 0);
    }
    if (this.options.rotation) {
      this.object.rotation.set(0, 0, 0);
    }
    if (this.options.scale) {
      this.object.scale.set(1, 1, 1);
    }
  }

  undo() {
    if (this.options.position) {
      this.object.position.copy(this.originalPosition);
    }
    if (this.options.rotation) {
      this.object.rotation.copy(this.originalRotation);
    }
    if (this.options.scale) {
      this.object.scale.copy(this.originalScale);
    }
  }

  getDescription() {
    const parts = [];
    if (this.options.position) parts.push('posição');
    if (this.options.rotation) parts.push('rotação');
    if (this.options.scale) parts.push('escala');
    return `Resetar ${parts.join(', ')} de ${this.objectName}`;
  }
}

/**
 * Comando para colar transform de um objeto para outro
 */
export class PasteTransformCommand extends Command {
  /**
   * @param {THREE.Object3D} target - Objeto alvo
   * @param {{ position?: THREE.Vector3, rotation?: THREE.Euler, scale?: THREE.Vector3 }} sourceTransform
   * @param {Object} options - { position: boolean, rotation: boolean, scale: boolean }
   * @param {string} objectName - Nome do objeto
   */
  constructor(target, sourceTransform, options = {}, objectName = 'Object') {
    super();
    this.target = target;
    this.objectName = objectName;
    this.options = {
      position: options.position !== false,
      rotation: options.rotation !== false,
      scale: options.scale !== false
    };

    // Salvar valores originais
    this.originalPosition = target.position.clone();
    this.originalRotation = target.rotation.clone();
    this.originalScale = target.scale.clone();

    // Salvar valores a colar
    this.sourcePosition = sourceTransform.position?.clone();
    this.sourceRotation = sourceTransform.rotation?.clone();
    this.sourceScale = sourceTransform.scale?.clone();
  }

  execute() {
    if (this.options.position && this.sourcePosition) {
      this.target.position.copy(this.sourcePosition);
    }
    if (this.options.rotation && this.sourceRotation) {
      this.target.rotation.copy(this.sourceRotation);
    }
    if (this.options.scale && this.sourceScale) {
      this.target.scale.copy(this.sourceScale);
    }
  }

  undo() {
    if (this.options.position) {
      this.target.position.copy(this.originalPosition);
    }
    if (this.options.rotation) {
      this.target.rotation.copy(this.originalRotation);
    }
    if (this.options.scale) {
      this.target.scale.copy(this.originalScale);
    }
  }

  getDescription() {
    return `Colar transform em ${this.objectName}`;
  }
}

/**
 * CommandHistory - Gerencia histórico de comandos para undo/redo
 */
export class CommandHistory {
  /**
   * @param {number} maxSize - Tamanho máximo do histórico
   */
  constructor(maxSize = 50) {
    this.maxSize = maxSize;
    this.undoStack = [];
    this.redoStack = [];

    // Callbacks para notificar mudanças
    this.onChangeCallbacks = [];
  }

  /**
   * Executa um comando e adiciona ao histórico
   * @param {Command} command - Comando a executar
   */
  execute(command) {
    command.execute();
    this.undoStack.push(command);

    // Limpar redo stack quando novo comando é executado
    this.redoStack = [];

    // Limitar tamanho do histórico
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }

    this._notifyChange();
  }

  /**
   * Desfaz o último comando
   * @returns {boolean} true se conseguiu desfazer
   */
  undo() {
    if (!this.canUndo()) return false;

    const command = this.undoStack.pop();
    command.undo();
    this.redoStack.push(command);

    this._notifyChange();
    return true;
  }

  /**
   * Refaz o último comando desfeito
   * @returns {boolean} true se conseguiu refazer
   */
  redo() {
    if (!this.canRedo()) return false;

    const command = this.redoStack.pop();
    command.execute();
    this.undoStack.push(command);

    this._notifyChange();
    return true;
  }

  /**
   * Verifica se pode desfazer
   * @returns {boolean}
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * Verifica se pode refazer
   * @returns {boolean}
   */
  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Obtém a descrição do próximo comando a desfazer
   * @returns {string|null}
   */
  getUndoDescription() {
    if (!this.canUndo()) return null;
    return this.undoStack[this.undoStack.length - 1].getDescription();
  }

  /**
   * Obtém a descrição do próximo comando a refazer
   * @returns {string|null}
   */
  getRedoDescription() {
    if (!this.canRedo()) return null;
    return this.redoStack[this.redoStack.length - 1].getDescription();
  }

  /**
   * Limpa todo o histórico
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this._notifyChange();
  }

  /**
   * Obtém o número de comandos no undo stack
   * @returns {number}
   */
  getUndoCount() {
    return this.undoStack.length;
  }

  /**
   * Obtém o número de comandos no redo stack
   * @returns {number}
   */
  getRedoCount() {
    return this.redoStack.length;
  }

  /**
   * Registra callback para mudanças no histórico
   * @param {Function} callback
   */
  onChange(callback) {
    this.onChangeCallbacks.push(callback);
  }

  /**
   * Remove callback de mudanças
   * @param {Function} callback
   */
  offChange(callback) {
    const index = this.onChangeCallbacks.indexOf(callback);
    if (index !== -1) {
      this.onChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Notifica todos os callbacks sobre mudança
   */
  _notifyChange() {
    const state = {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoDescription: this.getUndoDescription(),
      redoDescription: this.getRedoDescription(),
      undoCount: this.getUndoCount(),
      redoCount: this.getRedoCount()
    };

    for (const callback of this.onChangeCallbacks) {
      callback(state);
    }
  }

  /**
   * Destrói o histórico
   */
  dispose() {
    this.clear();
    this.onChangeCallbacks = [];
  }
}
