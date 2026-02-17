/**
 * InputManager - Sistema de input unificado cross-platform
 * Suporta mouse, teclado e trackpad em Windows e Mac
 * Usa Pointer Events API para unificar mouse e touch
 */
export class InputManager {
  /**
   * @param {HTMLElement} domElement - Elemento DOM para capturar eventos
   */
  constructor(domElement) {
    this.domElement = domElement;

    // Detecção de plataforma
    this.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    this.isWindows = navigator.platform.toUpperCase().indexOf('WIN') >= 0;

    // Estado do input
    this.keysPressed = new Set();
    this.pointerDown = false;
    this.pointerButton = -1;
    this.pointerPosition = { x: 0, y: 0 };
    this.normalizedPosition = { x: 0, y: 0 };
    this.pointerType = 'mouse'; // 'mouse' | 'touch' | 'pen'

    // Atalhos registrados
    this.shortcuts = new Map();
    this.gameMode = false; // Desabilita shortcuts simples durante game mode

    // Callbacks de eventos
    this.callbacks = {
      pointerDown: [],
      pointerMove: [],
      pointerUp: [],
      pointerCancel: [],
      keyDown: [],
      keyUp: [],
      wheel: []
    };

    // Bound handlers para remoção posterior
    this._boundHandlers = {
      onPointerDown: this._onPointerDown.bind(this),
      onPointerMove: this._onPointerMove.bind(this),
      onPointerUp: this._onPointerUp.bind(this),
      onPointerCancel: this._onPointerCancel.bind(this),
      onKeyDown: this._onKeyDown.bind(this),
      onKeyUp: this._onKeyUp.bind(this),
      onWheel: this._onWheel.bind(this),
      onContextMenu: this._onContextMenu.bind(this),
      onBlur: this._onBlur.bind(this)
    };

    this._setupEventListeners();
  }

  /**
   * Configura todos os event listeners
   */
  _setupEventListeners() {
    // Pointer events no elemento DOM
    this.domElement.addEventListener('pointerdown', this._boundHandlers.onPointerDown);
    this.domElement.addEventListener('pointermove', this._boundHandlers.onPointerMove);
    // pointerup no window para garantir que seja capturado mesmo se sair do elemento
    window.addEventListener('pointerup', this._boundHandlers.onPointerUp);
    this.domElement.addEventListener('pointercancel', this._boundHandlers.onPointerCancel);
    // NÃO tratar pointerleave como cancel - isso quebra o trackpad do Mac

    // Wheel events para zoom/scroll
    this.domElement.addEventListener('wheel', this._boundHandlers.onWheel, { passive: false });

    // Context menu (para prevenir em certas situações)
    this.domElement.addEventListener('contextmenu', this._boundHandlers.onContextMenu);

    // Keyboard events no window (para capturar mesmo quando foco não está no canvas)
    window.addEventListener('keydown', this._boundHandlers.onKeyDown);
    window.addEventListener('keyup', this._boundHandlers.onKeyUp);

    // Limpar estado quando janela perde foco
    window.addEventListener('blur', this._boundHandlers.onBlur);
  }

  /**
   * Normaliza a posição do pointer para coordenadas -1 a 1
   * @param {PointerEvent} event
   */
  _normalizePointerPosition(event) {
    const rect = this.domElement.getBoundingClientRect();
    this.pointerPosition.x = event.clientX;
    this.pointerPosition.y = event.clientY;
    this.normalizedPosition.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.normalizedPosition.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Handler de pointer down
   * @param {PointerEvent} event
   */
  _onPointerDown(event) {
    this.pointerDown = true;
    this.pointerButton = event.button;
    this.pointerType = event.pointerType;
    this._normalizePointerPosition(event);

    const eventData = this._createEventData(event);
    this._emitCallbacks('pointerDown', eventData);
  }

  /**
   * Handler de pointer move
   * @param {PointerEvent} event
   */
  _onPointerMove(event) {
    this._normalizePointerPosition(event);

    const eventData = this._createEventData(event);
    this._emitCallbacks('pointerMove', eventData);
  }

  /**
   * Handler de pointer up
   * @param {PointerEvent} event
   */
  _onPointerUp(event) {
    this.pointerDown = false;
    this.pointerButton = -1;
    this._normalizePointerPosition(event);

    const eventData = this._createEventData(event);
    this._emitCallbacks('pointerUp', eventData);
  }

  /**
   * Handler de pointer cancel
   * @param {PointerEvent} event
   */
  _onPointerCancel(event) {
    this.pointerDown = false;
    this.pointerButton = -1;

    const eventData = this._createEventData(event);
    this._emitCallbacks('pointerCancel', eventData);
  }

  /**
   * Handler de key down
   * @param {KeyboardEvent} event
   */
  _onKeyDown(event) {
    // Ignorar se estiver digitando em um input
    if (this._isTypingInInput(event)) return;

    this.keysPressed.add(event.code);

    // Verificar atalhos registrados
    const shortcutKey = this._getShortcutKey(event);
    if (this.shortcuts.has(shortcutKey)) {
      // Em game mode, só processar atalhos com modificador (Cmd/Ctrl) ou Escape
      if (this.gameMode && !event.metaKey && !event.ctrlKey && event.code !== 'Escape') {
        return; // Deixar o evento passar para o runtime (Character2DController)
      }
      event.preventDefault();
      const callback = this.shortcuts.get(shortcutKey);
      callback(event);
      return;
    }

    const eventData = this._createKeyEventData(event);
    this._emitCallbacks('keyDown', eventData);
  }

  /**
   * Handler de key up
   * @param {KeyboardEvent} event
   */
  _onKeyUp(event) {
    this.keysPressed.delete(event.code);

    const eventData = this._createKeyEventData(event);
    this._emitCallbacks('keyUp', eventData);
  }

  /**
   * Handler de wheel (scroll/pinch)
   * @param {WheelEvent} event
   */
  _onWheel(event) {
    // ctrlKey em wheel event indica pinch gesture no trackpad
    const isPinch = event.ctrlKey;

    const eventData = {
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
      deltaMode: event.deltaMode,
      isPinch,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      originalEvent: event
    };

    this._emitCallbacks('wheel', eventData);
  }

  /**
   * Handler de context menu
   * @param {MouseEvent} event
   */
  _onContextMenu(event) {
    // Prevenir menu de contexto padrão no canvas
    event.preventDefault();
  }

  /**
   * Handler de blur (janela perde foco)
   */
  _onBlur() {
    // Limpar estado quando janela perde foco
    this.keysPressed.clear();
    this.pointerDown = false;
    this.pointerButton = -1;
  }

  /**
   * Verifica se o usuário está digitando em um campo de input
   * @param {KeyboardEvent} event
   * @returns {boolean}
   */
  _isTypingInInput(event) {
    const target = event.target;
    const tagName = target.tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
  }

  /**
   * Gera a chave única para um atalho
   * @param {KeyboardEvent} event
   * @returns {string}
   */
  _getShortcutKey(event) {
    const parts = [];

    // Usar meta para Mac, ctrl para Windows
    if (this.isMac && event.metaKey) parts.push('mod');
    if (!this.isMac && event.ctrlKey) parts.push('mod');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');

    // Adicionar a tecla principal
    parts.push(event.code.toLowerCase());

    return parts.join('+');
  }

  /**
   * Cria objeto de dados normalizado para eventos de pointer
   * @param {PointerEvent} event
   * @returns {Object}
   */
  _createEventData(event) {
    return {
      x: this.pointerPosition.x,
      y: this.pointerPosition.y,
      normalizedX: this.normalizedPosition.x,
      normalizedY: this.normalizedPosition.y,
      button: event.button,
      buttons: event.buttons,
      pointerType: event.pointerType,
      pointerId: event.pointerId,
      pressure: event.pressure,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      modifierKey: this.isModifierPressed(event),
      originalEvent: event
    };
  }

  /**
   * Cria objeto de dados normalizado para eventos de teclado
   * @param {KeyboardEvent} event
   * @returns {Object}
   */
  _createKeyEventData(event) {
    return {
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      modifierKey: this.isModifierPressed(event),
      repeat: event.repeat,
      originalEvent: event
    };
  }

  /**
   * Emite callbacks para um tipo de evento
   * @param {string} eventType
   * @param {Object} eventData
   */
  _emitCallbacks(eventType, eventData) {
    const callbacks = this.callbacks[eventType];
    for (const callback of callbacks) {
      callback(eventData);
    }
  }

  // ==================== API Pública ====================

  /**
   * Verifica se a tecla modificadora principal está pressionada
   * (Cmd no Mac, Ctrl no Windows)
   * @param {KeyboardEvent|Object} event
   * @returns {boolean}
   */
  isModifierPressed(event) {
    return this.isMac ? event.metaKey : event.ctrlKey;
  }

  /**
   * Verifica se uma tecla está pressionada
   * @param {string} code - Código da tecla (ex: 'KeyA', 'Space')
   * @returns {boolean}
   */
  isKeyPressed(code) {
    return this.keysPressed.has(code);
  }

  /**
   * Registra um atalho de teclado
   * @param {string} shortcut - Descrição do atalho (ex: 'mod+z', 'mod+shift+z', 'delete')
   * @param {Function} callback - Função a executar
   */
  registerShortcut(shortcut, callback) {
    // Normalizar o shortcut para lowercase
    const normalizedShortcut = shortcut.toLowerCase();
    this.shortcuts.set(normalizedShortcut, callback);
  }

  /**
   * Remove um atalho registrado
   * @param {string} shortcut
   */
  unregisterShortcut(shortcut) {
    const normalizedShortcut = shortcut.toLowerCase();
    this.shortcuts.delete(normalizedShortcut);
  }

  /**
   * Registra um callback para eventos de pointer
   * @param {'pointerDown'|'pointerMove'|'pointerUp'|'pointerCancel'} eventType
   * @param {Function} callback
   */
  on(eventType, callback) {
    if (this.callbacks[eventType]) {
      this.callbacks[eventType].push(callback);
    }
  }

  /**
   * Remove um callback
   * @param {'pointerDown'|'pointerMove'|'pointerUp'|'pointerCancel'} eventType
   * @param {Function} callback
   */
  off(eventType, callback) {
    if (this.callbacks[eventType]) {
      const index = this.callbacks[eventType].indexOf(callback);
      if (index !== -1) {
        this.callbacks[eventType].splice(index, 1);
      }
    }
  }

  /**
   * Obtém a posição normalizada do pointer (-1 a 1)
   * @returns {{x: number, y: number}}
   */
  getNormalizedPosition() {
    return { ...this.normalizedPosition };
  }

  /**
   * Obtém a posição absoluta do pointer em pixels
   * @returns {{x: number, y: number}}
   */
  getPointerPosition() {
    return { ...this.pointerPosition };
  }

  /**
   * Verifica se o pointer está pressionado
   * @returns {boolean}
   */
  isPointerDown() {
    return this.pointerDown;
  }

  /**
   * Obtém o botão do pointer pressionado
   * @returns {number} -1 se nenhum, 0=esquerdo, 1=meio, 2=direito
   */
  getPointerButton() {
    return this.pointerButton;
  }

  /**
   * Obtém o símbolo da tecla modificadora para exibição
   * @returns {string} '⌘' para Mac, 'Ctrl' para Windows
   */
  getModifierSymbol() {
    return this.isMac ? '⌘' : 'Ctrl';
  }

  /**
   * Formata um atalho para exibição
   * @param {string} shortcut - Atalho no formato interno (ex: 'mod+z')
   * @returns {string} Atalho formatado para exibição (ex: '⌘Z' ou 'Ctrl+Z')
   */
  formatShortcut(shortcut) {
    const parts = shortcut.toLowerCase().split('+');
    const formatted = parts.map(part => {
      switch (part) {
        case 'mod':
          return this.isMac ? '⌘' : 'Ctrl';
        case 'shift':
          return this.isMac ? '⇧' : 'Shift';
        case 'alt':
          return this.isMac ? '⌥' : 'Alt';
        case 'delete':
        case 'backspace':
          return this.isMac ? '⌫' : 'Del';
        case 'escape':
          return 'Esc';
        default:
          // Remover prefixo 'key' se existir
          if (part.startsWith('key')) {
            return part.substring(3).toUpperCase();
          }
          return part.toUpperCase();
      }
    });

    return this.isMac ? formatted.join('') : formatted.join('+');
  }

  /**
   * Destrói o InputManager e remove todos os listeners
   */
  dispose() {
    // Remover pointer events
    this.domElement.removeEventListener('pointerdown', this._boundHandlers.onPointerDown);
    this.domElement.removeEventListener('pointermove', this._boundHandlers.onPointerMove);
    window.removeEventListener('pointerup', this._boundHandlers.onPointerUp);
    this.domElement.removeEventListener('pointercancel', this._boundHandlers.onPointerCancel);

    // Remover wheel e context menu
    this.domElement.removeEventListener('wheel', this._boundHandlers.onWheel);
    this.domElement.removeEventListener('contextmenu', this._boundHandlers.onContextMenu);

    // Remover keyboard events
    window.removeEventListener('keydown', this._boundHandlers.onKeyDown);
    window.removeEventListener('keyup', this._boundHandlers.onKeyUp);
    window.removeEventListener('blur', this._boundHandlers.onBlur);

    // Limpar callbacks e shortcuts
    for (const key in this.callbacks) {
      this.callbacks[key] = [];
    }
    this.shortcuts.clear();
    this.keysPressed.clear();
  }
}
