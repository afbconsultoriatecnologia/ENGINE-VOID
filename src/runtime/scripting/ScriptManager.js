import ScriptConsole from './ScriptConsole.js';
import ScriptContext from './ScriptContext.js';
import ScriptLoader from './ScriptLoader.js';
import ScriptComponent from './ScriptComponent.js';
import { ScriptInputManager, ScriptTimeManager } from './ScriptAPI.js';

/**
 * ScriptManager - Orquestrador principal do sistema de scripts
 * Gerencia criação, execução e lifecycle de todos os scripts
 */
export default class ScriptManager {
  constructor(scene) {
    this.scene = scene;

    // Componentes do sistema
    this.console = new ScriptConsole();
    this.context = new ScriptContext(this.console);
    this.loader = new ScriptLoader(this);
    this.inputManager = new ScriptInputManager();
    this.timeManager = new ScriptTimeManager();

    // Mapa de scripts ativos: objectId -> ScriptComponent[]
    this.activeScripts = new Map();

    // Lista de todos os componentes para update rápido
    this.allComponents = [];

    // Estado
    this.isRunning = false;

    // Listeners para mudanças
    this.listeners = new Set();
  }

  /**
   * Inicia o sistema de scripts (Game mode)
   */
  start(domElement) {
    if (this.isRunning) return;

    this.console.info('ScriptManager', 'Starting script system...');

    // Ativar input
    this.inputManager.enable(domElement);

    // Resetar tempo
    this.timeManager.reset();

    // Inicializar scripts em todos os objetos
    this.initializeAllScripts();

    // Chamar start() em todos os scripts
    this.startAllScripts();

    this.isRunning = true;
    this.console.info('ScriptManager', `Started ${this.allComponents.length} scripts`);
  }

  /**
   * Para o sistema de scripts (volta ao Editor)
   */
  stop() {
    if (!this.isRunning) return;

    this.console.info('ScriptManager', 'Stopping script system...');

    // Chamar onDestroy em todos os scripts
    this.destroyAllScripts();

    // Desativar input
    this.inputManager.disable();

    // Limpar scripts ativos
    this.activeScripts.clear();
    this.allComponents = [];

    this.isRunning = false;
    this.console.info('ScriptManager', 'Script system stopped');
  }

  /**
   * Inicializa scripts de todos os objetos da cena
   */
  initializeAllScripts() {
    this.scene.traverse((object) => {
      if (object.userData.scripts && object.userData.scripts.length > 0) {
        this.initializeObjectScripts(object);
      }
    });
  }

  /**
   * Inicializa scripts de um objeto específico
   */
  async initializeObjectScripts(object) {
    const scriptIds = object.userData.scripts || [];
    const savedProperties = object.userData.scriptProperties || {};

    const components = [];

    for (const scriptId of scriptIds) {
      try {
        // Carregar código do script
        const code = await this.loader.load(scriptId);

        // Criar componente
        const component = new ScriptComponent(
          scriptId,
          code,
          object,
          this
        );

        // Restaurar propriedades salvas
        if (savedProperties[scriptId]) {
          for (const [name, value] of Object.entries(savedProperties[scriptId])) {
            component.setProperty(name, value);
          }
        }

        // Inicializar API
        component.initializeAPI(
          this.scene,
          this.inputManager,
          this.timeManager
        );

        components.push(component);
        this.allComponents.push(component);

      } catch (error) {
        this.console.error(
          'ScriptManager',
          `Failed to initialize script "${scriptId}" on "${object.name}": ${error.message}`
        );
      }
    }

    if (components.length > 0) {
      this.activeScripts.set(object.uuid, components);
    }
  }

  /**
   * Chama start() em todos os scripts
   */
  startAllScripts() {
    for (const component of this.allComponents) {
      component.start();
    }
  }

  /**
   * Chama onDestroy() em todos os scripts
   */
  destroyAllScripts() {
    for (const component of this.allComponents) {
      component.destroy();
    }
  }

  /**
   * Update chamado todo frame
   */
  update(deltaTime) {
    if (!this.isRunning) return;

    // Atualizar tempo
    this.timeManager.update(deltaTime);

    // Update em todos os scripts
    for (const component of this.allComponents) {
      component.update(deltaTime);
    }

    // Limpar estado de input do frame
    this.inputManager.endFrame();
  }

  /**
   * FixedUpdate chamado em timestep fixo
   */
  fixedUpdate(fixedDeltaTime) {
    if (!this.isRunning) return;

    for (const component of this.allComponents) {
      component.fixedUpdate(fixedDeltaTime);
    }
  }

  // ==================== GERENCIAMENTO DE SCRIPTS ====================

  /**
   * Anexa um script a um objeto
   */
  async attachScript(object, scriptId) {
    // Adicionar ao userData
    if (!object.userData.scripts) {
      object.userData.scripts = [];
    }
    if (!object.userData.scripts.includes(scriptId)) {
      object.userData.scripts.push(scriptId);
    }

    // Se estiver rodando, criar e iniciar o componente
    if (this.isRunning) {
      try {
        const code = await this.loader.load(scriptId);
        const component = new ScriptComponent(scriptId, code, object, this);

        component.initializeAPI(
          this.scene,
          this.inputManager,
          this.timeManager
        );

        // Adicionar aos mapas
        if (!this.activeScripts.has(object.uuid)) {
          this.activeScripts.set(object.uuid, []);
        }
        this.activeScripts.get(object.uuid).push(component);
        this.allComponents.push(component);

        // Iniciar
        component.start();

        this.console.info('ScriptManager', `Attached "${scriptId}" to "${object.name}"`);
      } catch (error) {
        this.console.error('ScriptManager', `Failed to attach script: ${error.message}`);
      }
    }

    this.notifyListeners('scriptAttached', { object, scriptId });
  }

  /**
   * Remove um script de um objeto
   */
  detachScript(object, scriptId) {
    // Remover do userData
    if (object.userData.scripts) {
      const index = object.userData.scripts.indexOf(scriptId);
      if (index !== -1) {
        object.userData.scripts.splice(index, 1);
      }
    }

    // Remover propriedades salvas
    if (object.userData.scriptProperties) {
      delete object.userData.scriptProperties[scriptId];
    }

    // Se estiver rodando, destruir o componente
    if (this.isRunning && this.activeScripts.has(object.uuid)) {
      const components = this.activeScripts.get(object.uuid);
      const index = components.findIndex(c => c.scriptId === scriptId);

      if (index !== -1) {
        const component = components[index];
        component.destroy();

        // Remover dos arrays
        components.splice(index, 1);
        const allIndex = this.allComponents.indexOf(component);
        if (allIndex !== -1) {
          this.allComponents.splice(allIndex, 1);
        }
      }
    }

    this.console.info('ScriptManager', `Detached "${scriptId}" from "${object.name}"`);
    this.notifyListeners('scriptDetached', { object, scriptId });
  }

  /**
   * Obtém componentes de script de um objeto
   */
  getObjectScripts(object) {
    if (this.isRunning) {
      return this.activeScripts.get(object.uuid) || [];
    }

    // Se não estiver rodando, retornar info básica
    const scriptIds = object.userData.scripts || [];
    return scriptIds.map(id => ({
      scriptId: id,
      properties: object.userData.scriptProperties?.[id] || {},
      propertyDefinitions: {} // Precisaria carregar o script para saber
    }));
  }

  /**
   * Atualiza propriedade de um script em um objeto
   */
  updateScriptProperty(object, scriptId, propertyName, value) {
    // Atualizar no userData
    if (!object.userData.scriptProperties) {
      object.userData.scriptProperties = {};
    }
    if (!object.userData.scriptProperties[scriptId]) {
      object.userData.scriptProperties[scriptId] = {};
    }
    object.userData.scriptProperties[scriptId][propertyName] = value;

    // Atualizar no componente ativo
    if (this.isRunning && this.activeScripts.has(object.uuid)) {
      const components = this.activeScripts.get(object.uuid);
      const component = components.find(c => c.scriptId === scriptId);
      if (component) {
        component.setProperty(propertyName, value);
      }
    }

    this.notifyListeners('propertyChanged', { object, scriptId, propertyName, value });
  }

  // ==================== HOT RELOAD ====================

  /**
   * Recarrega um script (hot reload)
   */
  async reloadScript(scriptId) {
    this.console.info('HotReload', `Reloading script "${scriptId}"...`);

    try {
      // Limpar cache
      this.loader.cache.delete(scriptId);

      // Carregar novo código
      const newCode = await this.loader.load(scriptId);

      // Encontrar todas as instâncias do script
      let reloadCount = 0;
      for (const component of this.allComponents) {
        if (component.scriptId === scriptId) {
          component.recompile(newCode);
          reloadCount++;
        }
      }

      this.console.info('HotReload', `Reloaded ${reloadCount} instances of "${scriptId}"`);
      this.notifyListeners('scriptReloaded', { scriptId, count: reloadCount });

    } catch (error) {
      this.console.error('HotReload', `Failed to reload "${scriptId}": ${error.message}`);
    }
  }

  // ==================== EVENTOS ====================

  /**
   * Adiciona listener para mudanças
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notifica listeners
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (e) {
        console.error('ScriptManager listener error:', e);
      }
    });
  }

  // ==================== SERIALIZAÇÃO ====================

  /**
   * Serializa estado dos scripts de um objeto
   */
  serializeObjectScripts(object) {
    return {
      scripts: object.userData.scripts || [],
      scriptProperties: object.userData.scriptProperties || {}
    };
  }

  /**
   * Restaura scripts em um objeto
   */
  async deserializeObjectScripts(object, data) {
    object.userData.scripts = data.scripts || [];
    object.userData.scriptProperties = data.scriptProperties || {};
  }

  // ==================== UTILITÁRIOS ====================

  /**
   * Lista scripts disponíveis
   */
  getAvailableScripts() {
    return this.loader.getAvailableScripts();
  }

  /**
   * Cria novo script
   */
  createScript(name, template = 'Empty') {
    return this.loader.createScript(name, template);
  }

  /**
   * Registra script customizado
   */
  registerScript(scriptId, code, metadata = {}) {
    this.loader.register(scriptId, code, metadata);
    this.notifyListeners('scriptRegistered', { scriptId, metadata });
  }

  /**
   * Obtém código de um script
   */
  async getScriptCode(scriptId) {
    return await this.loader.load(scriptId);
  }

  /**
   * Atualiza código de um script
   */
  updateScriptCode(scriptId, code) {
    this.loader.updateCode(scriptId, code);

    // Hot reload se estiver rodando
    if (this.isRunning) {
      this.reloadScript(scriptId);
    }
  }

  /**
   * Valida código de script
   */
  validateScript(code) {
    return this.context.validate(code);
  }
}
