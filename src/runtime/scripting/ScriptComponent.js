import ScriptAPI from './ScriptAPI.js';

/**
 * ScriptComponent - Instância de um script anexado a um objeto
 * Gerencia lifecycle e execução
 */
export default class ScriptComponent {
  constructor(scriptId, scriptCode, threeObject, scriptManager) {
    this.scriptId = scriptId;
    this.threeObject = threeObject;
    this.scriptManager = scriptManager;

    // Estado do script
    this.isEnabled = true;
    this.isStarted = false;
    this.isDestroyed = false;

    // Funções compiladas
    this.startFn = null;
    this.updateFn = null;
    this.fixedUpdateFn = null;
    this.onDestroyFn = null;
    this.onEnableFn = null;
    this.onDisableFn = null;
    this.onCollisionEnterFn = null;
    this.onCollisionExitFn = null;

    // Propriedades do script (valores atuais)
    this.properties = {};

    // Definições de propriedades (tipos, defaults, etc)
    this.propertyDefinitions = {};

    // Estado interno do script (this)
    this.state = {};

    // API exposta ao script
    this.api = null;

    // Contagem de erros para disable automático
    this.errorCount = 0;
    this.maxErrors = 10;

    // Compilar
    this.compile(scriptCode);
  }

  /**
   * Compila o código do script
   */
  compile(code) {
    const context = this.scriptManager.context;
    const result = context.compile(code, this.getDisplayName());

    if (result.error) {
      this.scriptManager.console.error(
        this.getDisplayName(),
        `Compilation failed: ${result.error.message}`
      );
      return false;
    }

    // Armazenar funções
    this.startFn = result.start;
    this.updateFn = result.update;
    this.fixedUpdateFn = result.fixedUpdate;
    this.onDestroyFn = result.onDestroy;
    this.onEnableFn = result.onEnable;
    this.onDisableFn = result.onDisable;
    this.onCollisionEnterFn = result.onCollisionEnter;
    this.onCollisionExitFn = result.onCollisionExit;

    // Armazenar definições de propriedades
    this.propertyDefinitions = result.properties;

    // Inicializar propriedades com valores default
    for (const [name, def] of Object.entries(this.propertyDefinitions)) {
      if (!(name in this.properties)) {
        this.properties[name] = def.default;
      }
    }

    return true;
  }

  /**
   * Inicializa a API após compilação
   */
  initializeAPI(scene, inputManager, timeManager) {
    this.api = new ScriptAPI(
      this.threeObject,
      scene,
      inputManager,
      timeManager
    );

    // Adicionar referência ao script na API
    this.api.script = this;

    // Criar contexto 'this' para o script
    // Inclui propriedades e a API
    this.state = {
      ...this.properties,
      engine: this.api
    };
  }

  /**
   * Chama start() - apenas uma vez
   */
  start() {
    if (this.isStarted || !this.isEnabled || this.isDestroyed) return;

    // Atualizar estado com propriedades atuais
    this.syncPropertiesToState();

    if (this.startFn) {
      try {
        this.startFn.call(this.state);
        // Sincronizar de volta após start (caso start modifique this.*)
        this.syncStateToProperties();
      } catch (error) {
        this.handleError('start', error);
      }
    }

    this.isStarted = true;
  }

  /**
   * Chama update(deltaTime) - todo frame
   */
  update(deltaTime) {
    if (!this.isStarted || !this.isEnabled || this.isDestroyed) return;

    if (this.updateFn) {
      try {
        this.updateFn.call(this.state, deltaTime);
      } catch (error) {
        this.handleError('update', error);
      }
    }
  }

  /**
   * Chama fixedUpdate(fixedDeltaTime) - timestep fixo
   */
  fixedUpdate(fixedDeltaTime) {
    if (!this.isStarted || !this.isEnabled || this.isDestroyed) return;

    if (this.fixedUpdateFn) {
      try {
        this.fixedUpdateFn.call(this.state, fixedDeltaTime);
      } catch (error) {
        this.handleError('fixedUpdate', error);
      }
    }
  }

  /**
   * Chama onDestroy() - ao destruir
   */
  destroy() {
    if (this.isDestroyed) return;

    if (this.onDestroyFn && this.isStarted) {
      try {
        this.onDestroyFn.call(this.state);
      } catch (error) {
        this.handleError('onDestroy', error);
      }
    }

    this.isDestroyed = true;
    this.isEnabled = false;
  }

  /**
   * Habilita o script
   */
  enable() {
    if (this.isEnabled || this.isDestroyed) return;

    this.isEnabled = true;

    if (this.onEnableFn && this.isStarted) {
      try {
        this.onEnableFn.call(this.state);
      } catch (error) {
        this.handleError('onEnable', error);
      }
    }
  }

  /**
   * Desabilita o script
   */
  disable() {
    if (!this.isEnabled || this.isDestroyed) return;

    if (this.onDisableFn && this.isStarted) {
      try {
        this.onDisableFn.call(this.state);
      } catch (error) {
        this.handleError('onDisable', error);
      }
    }

    this.isEnabled = false;
  }

  /**
   * Chama onCollisionEnter quando há colisão
   */
  onCollisionEnter(other) {
    if (!this.isEnabled || this.isDestroyed || !this.onCollisionEnterFn) return;

    try {
      this.onCollisionEnterFn.call(this.state, other);
    } catch (error) {
      this.handleError('onCollisionEnter', error);
    }
  }

  /**
   * Chama onCollisionExit quando sai de colisão
   */
  onCollisionExit(other) {
    if (!this.isEnabled || this.isDestroyed || !this.onCollisionExitFn) return;

    try {
      this.onCollisionExitFn.call(this.state, other);
    } catch (error) {
      this.handleError('onCollisionExit', error);
    }
  }

  /**
   * Trata erros de execução
   */
  handleError(methodName, error) {
    this.errorCount++;

    this.scriptManager.console.error(
      this.getDisplayName(),
      `Error in ${methodName}(): ${error.message}`
    );

    // Desabilitar após muitos erros
    if (this.errorCount >= this.maxErrors) {
      this.scriptManager.console.warn(
        'ScriptManager',
        `Script "${this.getDisplayName()}" disabled after ${this.maxErrors} errors`
      );
      this.disable();
    }
  }

  /**
   * Nome para display (objeto/script)
   */
  getDisplayName() {
    return `${this.threeObject.name}/${this.scriptId}`;
  }

  /**
   * Sincroniza propriedades para o estado do script
   */
  syncPropertiesToState() {
    for (const [name, value] of Object.entries(this.properties)) {
      this.state[name] = value;
    }
  }

  /**
   * Sincroniza estado do script para propriedades
   */
  syncStateToProperties() {
    for (const name of Object.keys(this.propertyDefinitions)) {
      if (name in this.state) {
        this.properties[name] = this.state[name];
      }
    }
  }

  /**
   * Define valor de uma propriedade
   */
  setProperty(name, value) {
    this.properties[name] = value;
    if (this.state) {
      this.state[name] = value;
    }
  }

  /**
   * Obtém valor de uma propriedade
   */
  getProperty(name) {
    return this.properties[name];
  }

  /**
   * Recompila o script com novo código
   * Preserva estado quando possível
   */
  recompile(newCode) {
    // Salvar estado atual
    const preservedState = { ...this.state };
    const preservedProperties = { ...this.properties };
    const wasStarted = this.isStarted;

    // Chamar onDestroy se estava rodando
    if (wasStarted && this.onDestroyFn) {
      try {
        this.onDestroyFn.call(this.state);
      } catch (e) {
        // Ignorar erros em onDestroy durante hot reload
      }
    }

    // Resetar estado
    this.isStarted = false;
    this.errorCount = 0;

    // Recompilar
    const success = this.compile(newCode);
    if (!success) {
      return false;
    }

    // Mesclar estado preservado com novos defaults
    this.state = {
      ...this.state,
      ...preservedProperties,
      engine: this.api
    };

    // Restaurar valores preservados que não são engine
    for (const [key, value] of Object.entries(preservedState)) {
      if (key !== 'engine' && !(key in this.propertyDefinitions)) {
        this.state[key] = value;
      }
    }

    // Restaurar propriedades
    for (const [key, value] of Object.entries(preservedProperties)) {
      if (key in this.propertyDefinitions) {
        this.properties[key] = value;
        this.state[key] = value;
      }
    }

    // Re-executar start se estava rodando
    if (wasStarted) {
      this.start();
    }

    this.scriptManager.console.info(
      'HotReload',
      `Reloaded ${this.getDisplayName()}`
    );

    return true;
  }

  /**
   * Serializa para JSON
   */
  serialize() {
    return {
      scriptId: this.scriptId,
      enabled: this.isEnabled,
      properties: { ...this.properties }
    };
  }

  /**
   * Deserializa de JSON
   */
  static deserialize(data, threeObject, scriptManager, scriptCode) {
    const component = new ScriptComponent(
      data.scriptId,
      scriptCode,
      threeObject,
      scriptManager
    );

    component.isEnabled = data.enabled !== false;

    // Restaurar propriedades salvas
    if (data.properties) {
      for (const [name, value] of Object.entries(data.properties)) {
        component.setProperty(name, value);
      }
    }

    return component;
  }
}
