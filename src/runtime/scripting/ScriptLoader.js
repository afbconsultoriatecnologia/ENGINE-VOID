/**
 * ScriptLoader - Carrega e gerencia código de scripts
 * Suporta sistema de arquivos virtual e real (Tauri)
 */
export default class ScriptLoader {
  constructor(scriptManager) {
    this.scriptManager = scriptManager;

    // Cache de scripts carregados
    this.cache = new Map();

    // Registry de scripts disponíveis (nome -> metadata)
    this.registry = new Map();

    // Scripts embutidos (templates)
    this.builtinScripts = this.createBuiltinScripts();
  }

  /**
   * Cria scripts de template embutidos
   */
  createBuiltinScripts() {
    return {
      'Empty': {
        name: 'Empty',
        description: 'Script vazio com lifecycle básico',
        code: `// @property {number} speed = 5

function start() {
  console.log(engine.name + ' started!');
}

function update(deltaTime) {
  // Called every frame
}

function onDestroy() {
  console.log(engine.name + ' destroyed!');
}
`
      },

      'Rotator': {
        name: 'Rotator',
        description: 'Rotaciona o objeto continuamente',
        code: `// @property {number} speedX = 0
// @property {number} speedY = 1 [min: -10, max: 10]
// @property {number} speedZ = 0

function update(deltaTime) {
  engine.transform.rotate(
    this.speedX * deltaTime,
    this.speedY * deltaTime,
    this.speedZ * deltaTime
  );
}
`
      },

      'Mover': {
        name: 'Mover',
        description: 'Move o objeto com WASD',
        code: `// @property {number} speed = 5

function update(deltaTime) {
  const h = engine.input.getAxis('horizontal');
  const v = engine.input.getAxis('vertical');

  if (h !== 0 || v !== 0) {
    engine.transform.translateWorld(
      h * this.speed * deltaTime,
      0,
      -v * this.speed * deltaTime
    );
  }
}
`
      },

      'Follower': {
        name: 'Follower',
        description: 'Segue outro objeto pelo nome',
        code: `// @property {string} targetName = ""
// @property {number} speed = 3
// @property {number} minDistance = 1

function update(deltaTime) {
  if (!this.targetName) return;

  const target = engine.find(this.targetName);
  if (!target) return;

  const distance = engine.distanceTo(target);
  if (distance > this.minDistance) {
    const direction = engine.directionTo(target);
    const step = this.speed * deltaTime;

    engine.transform.translateWorld(
      direction.x * step,
      direction.y * step,
      direction.z * step
    );

    engine.transform.lookAt(target.position);
  }
}
`
      },

      'Oscillator': {
        name: 'Oscillator',
        description: 'Oscila posição em onda senoidal',
        code: `// @property {number} amplitude = 1
// @property {number} frequency = 1
// @property {string} axis = "y"

function start() {
  this.startY = engine.transform.position.y;
  this.time = 0;
}

function update(deltaTime) {
  this.time += deltaTime * this.frequency;
  const offset = Math.sin(this.time * Math.PI * 2) * this.amplitude;

  const pos = engine.transform.position;
  switch (this.axis.toLowerCase()) {
    case 'x': pos.x = this.startY + offset; break;
    case 'y': pos.y = this.startY + offset; break;
    case 'z': pos.z = this.startY + offset; break;
  }
}
`
      },

      'LookAtMouse': {
        name: 'LookAtMouse',
        description: 'Rotaciona para olhar na direção do mouse',
        code: `// @property {number} sensitivity = 0.002

function update(deltaTime) {
  const delta = engine.input.mouseDelta;
  if (delta.x !== 0) {
    engine.transform.rotate(0, -delta.x * this.sensitivity, 0);
  }
}
`
      },

      'Spawner': {
        name: 'Spawner',
        description: 'Spawna objetos periodicamente (placeholder)',
        code: `// @property {number} interval = 2
// @property {string} prefabName = ""

function start() {
  this.timer = 0;
}

function update(deltaTime) {
  this.timer += deltaTime;
  if (this.timer >= this.interval) {
    this.timer = 0;
    console.log('Would spawn: ' + this.prefabName);
    // engine.instantiate(this.prefabName);
  }
}
`
      },

      'ClickHandler': {
        name: 'ClickHandler',
        description: 'Responde a cliques do mouse',
        code: `function update(deltaTime) {
  if (engine.input.getMouseButtonDown(0)) {
    console.log('Left click at', engine.input.mousePosition);
  }
  if (engine.input.getMouseButtonDown(2)) {
    console.log('Right click at', engine.input.mousePosition);
  }
}
`
      }
    };
  }

  /**
   * Registra um script no loader
   */
  register(scriptId, code, metadata = {}) {
    this.registry.set(scriptId, {
      id: scriptId,
      name: metadata.name || scriptId,
      description: metadata.description || '',
      code: code,
      source: metadata.source || 'custom', // 'builtin', 'file', 'custom'
      filePath: metadata.filePath || null,
      lastModified: Date.now()
    });

    this.cache.set(scriptId, code);
  }

  /**
   * Carrega um script pelo ID
   */
  async load(scriptId) {
    // Verificar cache primeiro
    if (this.cache.has(scriptId)) {
      return this.cache.get(scriptId);
    }

    // Verificar builtins
    if (this.builtinScripts[scriptId]) {
      const code = this.builtinScripts[scriptId].code;
      this.cache.set(scriptId, code);
      return code;
    }

    // Verificar registry
    if (this.registry.has(scriptId)) {
      const entry = this.registry.get(scriptId);

      // Se tem filePath, carregar do arquivo
      if (entry.filePath) {
        return await this.loadFromFile(entry.filePath);
      }

      return entry.code;
    }

    throw new Error(`Script not found: ${scriptId}`);
  }

  /**
   * Carrega script de arquivo (Tauri)
   */
  async loadFromFile(filePath) {
    try {
      // Verificar se estamos no Tauri
      if (window.__TAURI__) {
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        const code = await readTextFile(filePath);
        return code;
      }

      // Fallback: tentar fetch (para desenvolvimento web)
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to load ${filePath}`);
      }
      return await response.text();

    } catch (error) {
      this.scriptManager.console.error(
        'ScriptLoader',
        `Failed to load script from ${filePath}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Salva script em arquivo (Tauri)
   */
  async saveToFile(filePath, code) {
    try {
      if (window.__TAURI__) {
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        await writeTextFile(filePath, code);
        return true;
      }

      // Sem Tauri, não pode salvar
      console.warn('Cannot save file without Tauri');
      return false;

    } catch (error) {
      this.scriptManager.console.error(
        'ScriptLoader',
        `Failed to save script to ${filePath}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Retorna lista de scripts disponíveis
   */
  getAvailableScripts() {
    const scripts = [];

    // Adicionar builtins
    for (const [id, data] of Object.entries(this.builtinScripts)) {
      scripts.push({
        id,
        name: data.name,
        description: data.description,
        source: 'builtin'
      });
    }

    // Adicionar do registry
    for (const [id, data] of this.registry.entries()) {
      if (!this.builtinScripts[id]) {
        scripts.push({
          id,
          name: data.name,
          description: data.description,
          source: data.source
        });
      }
    }

    return scripts;
  }

  /**
   * Cria novo script customizado
   */
  createScript(name, baseTemplate = 'Empty') {
    const template = this.builtinScripts[baseTemplate] || this.builtinScripts['Empty'];
    const code = template.code;

    const scriptId = this.generateScriptId(name);
    this.register(scriptId, code, {
      name,
      description: `Custom script: ${name}`,
      source: 'custom'
    });

    return { scriptId, code };
  }

  /**
   * Gera ID único para script
   */
  generateScriptId(name) {
    const baseName = name.replace(/[^a-zA-Z0-9]/g, '');
    const suffix = Math.random().toString(36).substring(2, 6);
    return `${baseName}_${suffix}`;
  }

  /**
   * Remove script do registry
   */
  unregister(scriptId) {
    this.registry.delete(scriptId);
    this.cache.delete(scriptId);
  }

  /**
   * Atualiza código de um script
   */
  updateCode(scriptId, newCode) {
    if (this.registry.has(scriptId)) {
      const entry = this.registry.get(scriptId);
      entry.code = newCode;
      entry.lastModified = Date.now();
    }
    this.cache.set(scriptId, newCode);
  }

  /**
   * Limpa cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Valida código de script
   */
  validate(code) {
    return this.scriptManager.context.validate(code);
  }
}
