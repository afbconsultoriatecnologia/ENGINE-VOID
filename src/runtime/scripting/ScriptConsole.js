/**
 * ScriptConsole - Sistema de captura de logs para scripts
 * Redireciona console.log/warn/error para o painel do editor
 */
export default class ScriptConsole {
  constructor() {
    this.messages = [];
    this.maxMessages = 1000;
    this.listeners = new Set();

    // Contadores por tipo
    this.counts = {
      log: 0,
      warn: 0,
      error: 0,
      info: 0
    };
  }

  /**
   * Adiciona uma mensagem ao console
   */
  addMessage(type, source, ...args) {
    const message = {
      id: Date.now() + Math.random(),
      type,
      source,
      content: args.map(arg => this.stringify(arg)).join(' '),
      timestamp: new Date().toLocaleTimeString(),
      rawArgs: args
    };

    this.messages.push(message);
    this.counts[type] = (this.counts[type] || 0) + 1;

    // Limitar tamanho do histórico
    if (this.messages.length > this.maxMessages) {
      const removed = this.messages.shift();
      this.counts[removed.type]--;
    }

    // Notificar listeners
    this.notifyListeners(message);

    // Também logar no console real para debug
    const consoleMethod = console[type] || console.log;
    consoleMethod.call(console, `[${source}]`, ...args);

    return message;
  }

  /**
   * Converte qualquer valor para string legível
   */
  stringify(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value instanceof Error) {
      return `${value.name}: ${value.message}\n${value.stack || ''}`;
    }
    if (typeof value === 'object') {
      try {
        // Para Vector3, Quaternion, etc
        if (value.isVector3) {
          return `Vector3(${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)})`;
        }
        if (value.isQuaternion) {
          return `Quaternion(${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)}, ${value.w.toFixed(2)})`;
        }
        if (value.isColor) {
          return `Color(#${value.getHexString()})`;
        }
        return JSON.stringify(value, null, 2);
      } catch (e) {
        return String(value);
      }
    }
    return String(value);
  }

  // Métodos de conveniência
  log(source, ...args) {
    return this.addMessage('log', source, ...args);
  }

  warn(source, ...args) {
    return this.addMessage('warn', source, ...args);
  }

  error(source, ...args) {
    return this.addMessage('error', source, ...args);
  }

  info(source, ...args) {
    return this.addMessage('info', source, ...args);
  }

  /**
   * Limpa todas as mensagens
   */
  clear() {
    this.messages = [];
    this.counts = { log: 0, warn: 0, error: 0, info: 0 };
    this.notifyListeners({ type: 'clear' });
  }

  /**
   * Retorna mensagens filtradas por tipo
   */
  getMessages(filter = 'all') {
    if (filter === 'all') return [...this.messages];
    return this.messages.filter(m => m.type === filter);
  }

  /**
   * Adiciona listener para novas mensagens
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notifica todos os listeners
   */
  notifyListeners(message) {
    this.listeners.forEach(callback => {
      try {
        callback(message, this.messages, this.counts);
      } catch (e) {
        console.error('[ScriptConsole] Error in listener:', e);
      }
    });
  }

  /**
   * Cria um objeto console para uso em scripts
   */
  createConsoleProxy(source) {
    return {
      log: (...args) => this.log(source, ...args),
      warn: (...args) => this.warn(source, ...args),
      error: (...args) => this.error(source, ...args),
      info: (...args) => this.info(source, ...args),
      debug: (...args) => this.log(source, ...args),
      clear: () => this.clear()
    };
  }
}
