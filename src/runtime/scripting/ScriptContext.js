import * as THREE from 'three';

/**
 * ScriptContext - Ambiente de execução sandboxed para scripts
 * Fornece acesso controlado às APIs permitidas
 */
export default class ScriptContext {
  constructor(scriptConsole) {
    this.console = scriptConsole;
  }

  /**
   * Cria o objeto global disponível para scripts
   */
  createGlobals(scriptSource) {
    return {
      // Utilitários matemáticos
      Math: Math,
      Number: Number,
      String: String,
      Boolean: Boolean,
      Array: Array,
      Object: Object,
      Date: Date,
      JSON: JSON,
      parseInt: parseInt,
      parseFloat: parseFloat,
      isNaN: isNaN,
      isFinite: isFinite,

      // Three.js types (read-only construtores)
      Vector2: THREE.Vector2,
      Vector3: THREE.Vector3,
      Vector4: THREE.Vector4,
      Quaternion: THREE.Quaternion,
      Euler: THREE.Euler,
      Matrix3: THREE.Matrix3,
      Matrix4: THREE.Matrix4,
      Color: THREE.Color,
      Box3: THREE.Box3,
      Sphere: THREE.Sphere,
      Ray: THREE.Ray,
      Plane: THREE.Plane,
      MathUtils: THREE.MathUtils,

      // Console redirecionado
      console: this.console.createConsoleProxy(scriptSource),

      // Bloqueados (undefined)
      window: undefined,
      document: undefined,
      fetch: undefined,
      XMLHttpRequest: undefined,
      WebSocket: undefined,
      Worker: undefined,
      eval: undefined,
      Function: undefined,
      require: undefined,
      import: undefined,
      process: undefined,
      global: undefined,
      globalThis: undefined,
      localStorage: undefined,
      sessionStorage: undefined,
      indexedDB: undefined,
      alert: undefined,
      confirm: undefined,
      prompt: undefined,
      open: undefined,
      close: undefined,
      location: undefined,
      navigator: undefined,
      history: undefined,
      screen: undefined,
      performance: undefined,
      crypto: undefined,
      setTimeout: undefined,
      setInterval: undefined,
      clearTimeout: undefined,
      clearInterval: undefined,
      requestAnimationFrame: undefined,
      cancelAnimationFrame: undefined
    };
  }

  /**
   * Compila código de script em funções executáveis
   * @param {string} code - Código do script
   * @param {string} scriptName - Nome do script para erros
   * @returns {Object} Objeto com funções compiladas
   */
  compile(code, scriptName) {
    const result = {
      start: null,
      update: null,
      fixedUpdate: null,
      onDestroy: null,
      onEnable: null,
      onDisable: null,
      onCollisionEnter: null,
      onCollisionExit: null,
      properties: {},
      error: null
    };

    try {
      // Criar wrapper que extrai as funções
      const wrappedCode = `
        'use strict';
        ${code}

        return {
          start: typeof start === 'function' ? start : null,
          update: typeof update === 'function' ? update : null,
          fixedUpdate: typeof fixedUpdate === 'function' ? fixedUpdate : null,
          onDestroy: typeof onDestroy === 'function' ? onDestroy : null,
          onEnable: typeof onEnable === 'function' ? onEnable : null,
          onDisable: typeof onDisable === 'function' ? onDisable : null,
          onCollisionEnter: typeof onCollisionEnter === 'function' ? onCollisionEnter : null,
          onCollisionExit: typeof onCollisionExit === 'function' ? onCollisionExit : null
        };
      `;

      // Criar função com escopo controlado
      // eslint-disable-next-line no-new-func
      const factory = new Function(
        'globals',
        `with (globals) { ${wrappedCode} }`
      );

      // Executar para extrair funções
      const globals = this.createGlobals(scriptName);
      const extracted = factory(globals);

      result.start = extracted.start;
      result.update = extracted.update;
      result.fixedUpdate = extracted.fixedUpdate;
      result.onDestroy = extracted.onDestroy;
      result.onEnable = extracted.onEnable;
      result.onDisable = extracted.onDisable;
      result.onCollisionEnter = extracted.onCollisionEnter;
      result.onCollisionExit = extracted.onCollisionExit;

      // Extrair propriedades de comentários @property
      result.properties = this.parseProperties(code);

    } catch (error) {
      result.error = {
        message: error.message,
        line: this.extractLineNumber(error),
        stack: error.stack
      };
      this.console.error(scriptName, `Compilation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Executa uma função do script com contexto controlado
   */
  execute(fn, thisContext, args, scriptName, methodName) {
    if (!fn) return undefined;

    try {
      return fn.apply(thisContext, args);
    } catch (error) {
      this.console.error(
        scriptName,
        `Error in ${methodName}(): ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Extrai número da linha do erro
   */
  extractLineNumber(error) {
    if (!error.stack) return null;

    // Tentar extrair linha do stack trace
    const match = error.stack.match(/:(\d+):\d+/);
    if (match) {
      // Ajustar para offset do wrapper
      return parseInt(match[1], 10) - 3;
    }
    return null;
  }

  /**
   * Parseia propriedades de comentários @property
   * Formato: // @property {type} name = defaultValue [options]
   */
  parseProperties(code) {
    const properties = {};
    const regex = /\/\/\s*@property\s+\{(\w+)\}\s+(\w+)\s*(?:=\s*([^\[\n]+))?\s*(?:\[(.*?)\])?/g;

    let match;
    while ((match = regex.exec(code)) !== null) {
      const [, type, name, defaultValue, options] = match;

      properties[name] = {
        type: type.toLowerCase(),
        name,
        default: this.parseDefaultValue(type, defaultValue?.trim()),
        options: this.parseOptions(options)
      };
    }

    return properties;
  }

  /**
   * Parseia valor default baseado no tipo
   */
  parseDefaultValue(type, value) {
    if (value === undefined || value === null || value === '') {
      // Valores default por tipo
      switch (type.toLowerCase()) {
        case 'number': return 0;
        case 'string': return '';
        case 'boolean': return false;
        case 'vector3': return { x: 0, y: 0, z: 0 };
        case 'color': return { r: 1, g: 1, b: 1 };
        case 'object': return null;
        default: return null;
      }
    }

    // Parsear valor
    try {
      switch (type.toLowerCase()) {
        case 'number':
          return parseFloat(value);
        case 'boolean':
          return value === 'true';
        case 'string':
          // Remover aspas se presentes
          return value.replace(/^["']|["']$/g, '');
        case 'vector3':
        case 'color':
        case 'object':
          return JSON.parse(value);
        default:
          return value;
      }
    } catch (e) {
      return value;
    }
  }

  /**
   * Parseia opções de propriedade [min: 0, max: 100]
   */
  parseOptions(optionsStr) {
    if (!optionsStr) return {};

    const options = {};
    const pairs = optionsStr.split(',');

    for (const pair of pairs) {
      const [key, val] = pair.split(':').map(s => s.trim());
      if (key && val !== undefined) {
        options[key] = isNaN(val) ? val : parseFloat(val);
      }
    }

    return options;
  }

  /**
   * Valida código antes de compilar
   */
  validate(code) {
    const errors = [];
    const warnings = [];

    // Verificar por APIs perigosas
    const dangerousPatterns = [
      { pattern: /\bwindow\b/, message: 'Access to "window" is not allowed' },
      { pattern: /\bdocument\b/, message: 'Access to "document" is not allowed' },
      { pattern: /\bfetch\b/, message: 'Access to "fetch" is not allowed' },
      { pattern: /\beval\b/, message: 'Use of "eval" is not allowed' },
      { pattern: /\bFunction\s*\(/, message: 'Use of "Function" constructor is not allowed' },
      { pattern: /\brequire\b/, message: 'Use of "require" is not allowed' },
      { pattern: /\bimport\s+/, message: 'Use of "import" is not allowed' },
      { pattern: /\bprocess\b/, message: 'Access to "process" is not allowed' },
      { pattern: /\b__proto__\b/, message: 'Access to "__proto__" is not allowed' },
      { pattern: /\bconstructor\s*\[/, message: 'Constructor access is not allowed' }
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(code)) {
        warnings.push({ message, type: 'security' });
      }
    }

    // Verificar sintaxe básica com try/catch no Function
    try {
      // eslint-disable-next-line no-new-func
      new Function(code);
    } catch (error) {
      errors.push({
        message: error.message,
        line: this.extractLineNumber(error),
        type: 'syntax'
      });
    }

    return { errors, warnings, valid: errors.length === 0 };
  }
}
