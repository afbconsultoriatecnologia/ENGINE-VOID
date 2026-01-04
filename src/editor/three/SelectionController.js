import * as THREE from 'three';

/**
 * Controlador de seleção e movimento de objetos na cena
 * Usa InputManager para eventos unificados (Pointer Events API)
 * Suporta snapping e preparação para sistema de Commands
 */
export class SelectionController {
  /**
   * Construtor do controlador de seleção
   * @param {THREE.Scene} scene - Cena Three.js
   * @param {THREE.Camera} camera - Câmera Three.js
   * @param {HTMLElement} domElement - Elemento DOM do canvas
   * @param {Object} options - Opções de configuração
   * @param {Function} options.onSelect - Callback quando um objeto é selecionado
   * @param {Function} options.onDragStart - Callback quando inicia arrasto
   * @param {Function} options.onDragEnd - Callback quando termina arrasto
   * @param {Object} options.coordinateSystem - Sistema de coordenadas para snapping
   * @param {Object} options.engine - Referência ao ThreeEngine para acessar luzes
   */
  constructor(scene, camera, domElement, options = {}) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;

    // Callbacks
    this.onSelect = options.onSelect || null;
    this.onDragStart = options.onDragStart || null;
    this.onDragEnd = options.onDragEnd || null;

    // Sistema de coordenadas para snapping
    this.coordinateSystem = options.coordinateSystem || null;

    // Referência ao engine para acessar luzes
    this.engine = options.engine || null;

    // Raycaster para seleção
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Estado de drag
    this.isDragging = false;
    this.dragStart = new THREE.Vector2();
    this.dragThreshold = 0.03; // Aumentado de 0.01 para melhor UX

    // Objetos selecionados (Set para evitar duplicatas)
    this.selectedObjects = new Set();
    // Objeto primário (último selecionado, recebe o gizmo)
    this.primarySelected = null;
    // Manter compatibilidade com código existente
    this.selectedObject = null;

    // Posições iniciais para undo (Map: objeto -> posição)
    this.dragStartPositions = new Map();
    this.dragStartPosition = new THREE.Vector3();

    // InputManager (será injetado pelo ThreeEngine)
    this.inputManager = null;

    // Bound handlers para remoção
    this._boundHandlers = {
      onPointerDown: this._onPointerDown.bind(this),
      onPointerMove: this._onPointerMove.bind(this),
      onPointerUp: this._onPointerUp.bind(this),
      onPointerCancel: this._onPointerCancel.bind(this)
    };

    // Estado do pointer
    this.pointerDown = false;
    this.pointerButton = -1;
    this.currentPointerId = null;

    // Modo de transformação (G=grab, R=rotate, S=scale)
    this.transformMode = null;
    this.transformStartPosition = new THREE.Vector3();
    this.transformStartRotation = new THREE.Euler();
    this.transformStartScale = new THREE.Vector3();
    this.transformStartMouse = new THREE.Vector2();

    // === Blender-style: Restrição de eixo ===
    this.axisConstraint = null; // 'x', 'y', 'z' ou null (livre)
    this.planeConstraint = null; // 'xy', 'xz', 'yz' ou null
    this.numericInput = ''; // Entrada numérica para valores precisos
    this.isShiftPressed = false;

    // Callback para atualizar UI
    this.onTransformUpdate = null;
    // Callback quando modo de transformação muda (para desabilitar/habilitar controles de câmera)
    this.onTransformModeChange = null;

    // Flag para desabilitar seleção (Game mode)
    this.disabled = false;
  }

  /**
   * Desabilita a seleção (para Game mode)
   */
  disable() {
    this.disabled = true;
    this.clearSelection();
    this.cancelTransform();
    console.log('[SelectionController] Disabled');
  }

  /**
   * Habilita a seleção (para Dev mode)
   */
  enable() {
    this.disabled = false;
    console.log('[SelectionController] Enabled');
  }

  /**
   * Conecta ao InputManager
   * @param {InputManager} inputManager
   */
  connectInputManager(inputManager) {
    this.inputManager = inputManager;

    // Registrar callbacks
    inputManager.on('pointerDown', this._boundHandlers.onPointerDown);
    inputManager.on('pointerMove', this._boundHandlers.onPointerMove);
    inputManager.on('pointerUp', this._boundHandlers.onPointerUp);
    inputManager.on('pointerCancel', this._boundHandlers.onPointerCancel);
  }

  /**
   * Desconecta do InputManager
   */
  disconnectInputManager() {
    if (this.inputManager) {
      this.inputManager.off('pointerDown', this._boundHandlers.onPointerDown);
      this.inputManager.off('pointerMove', this._boundHandlers.onPointerMove);
      this.inputManager.off('pointerUp', this._boundHandlers.onPointerUp);
      this.inputManager.off('pointerCancel', this._boundHandlers.onPointerCancel);
      this.inputManager = null;
    }
  }

  /**
   * Atualiza a câmera (deve ser chamado quando a câmera muda)
   * @param {THREE.Camera} camera - Nova câmera
   */
  updateCamera(camera) {
    this.camera = camera;
  }

  /**
   * Define o sistema de coordenadas para snapping
   * @param {CoordinateSystem} coordinateSystem
   */
  setCoordinateSystem(coordinateSystem) {
    this.coordinateSystem = coordinateSystem;
  }

  /**
   * Handler de pointer down
   * @param {Object} eventData - Dados normalizados do evento
   */
  _onPointerDown(eventData) {
    // Ignorar se desabilitado (Game mode)
    if (this.disabled) return;

    // Apenas botão esquerdo
    if (eventData.button !== 0) return;

    // Guardar estado de shift para multi-seleção
    this._shiftKeyOnDown = eventData.shiftKey;

    // Ignorar modifier key (para orbit controls) EXCETO shift (usado para multi-select)
    if (eventData.modifierKey) return;

    // Se está em modo de transformação, o clique serve apenas para confirmar
    // Não iniciar um novo drag
    if (this.transformMode) {
      return;
    }

    this.pointerDown = true;
    this.pointerButton = eventData.button;
    this.currentPointerId = eventData.pointerId;

    this.mouse.set(eventData.normalizedX, eventData.normalizedY);
    this.dragStart.set(eventData.normalizedX, eventData.normalizedY);
    this.isDragging = false;

    // Salvar posições de todos os objetos selecionados para undo
    this.dragStartPositions.clear();
    for (const obj of this.selectedObjects) {
      this.dragStartPositions.set(obj, obj.position.clone());
    }
    // Compatibilidade
    if (this.selectedObject) {
      this.dragStartPosition.copy(this.selectedObject.position);
    }
  }

  /**
   * Handler de pointer move
   * @param {Object} eventData - Dados normalizados do evento
   */
  _onPointerMove(eventData) {
    this.mouse.set(eventData.normalizedX, eventData.normalizedY);

    // Modo de transformação ativo (G, R, S)
    if (this.transformMode && this.selectedObject) {
      this._applyTransformMode();
      return;
    }

    // Drag com mouse (comportamento antigo)
    if (!this.pointerDown) return;
    if (!this.selectedObject) return;

    // Verificar se passou do threshold para considerar drag
    const dragDelta = Math.sqrt(
      Math.pow(this.mouse.x - this.dragStart.x, 2) +
      Math.pow(this.mouse.y - this.dragStart.y, 2)
    );

    if (dragDelta > this.dragThreshold) {
      if (!this.isDragging) {
        // Início do drag
        this.isDragging = true;

        if (this.onDragStart) {
          this.onDragStart(this.selectedObject, this.dragStartPosition.clone());
        }
      }

      // Mover objeto
      this._moveObject();
    }
  }

  /**
   * Handler de pointer up
   * @param {Object} eventData - Dados normalizados do evento
   */
  _onPointerUp(eventData) {
    // Se está em modo de transformação, confirmar com clique
    if (this.transformMode) {
      this.confirmTransform();
      // Resetar estado do pointer para evitar drag acidental após confirmar
      this.pointerDown = false;
      this.isDragging = false;
      this.pointerButton = -1;
      this.currentPointerId = null;
      return;
    }

    if (!this.pointerDown) return;

    this.mouse.set(eventData.normalizedX, eventData.normalizedY);

    if (this.isDragging) {
      // Fim do drag
      if (this.onDragEnd && this.selectedObject) {
        this.onDragEnd(
          this.selectedObject,
          this.dragStartPosition.clone(),
          this.selectedObject.position.clone()
        );
      }
    } else {
      // Click (não arrastou) - fazer seleção
      // Ignorar modifier key (Ctrl/Cmd), mas permitir Shift para multi-select
      if (!eventData.modifierKey) {
        this._performSelection(this._shiftKeyOnDown);
      }
    }

    this.isDragging = false;
    this.pointerDown = false;
    this.pointerButton = -1;
    this.currentPointerId = null;
  }

  /**
   * Handler de pointer cancel (quando o pointer é interrompido)
   * @param {Object} eventData - Dados normalizados do evento
   */
  _onPointerCancel(eventData) {
    // Limpar estado sem executar ações
    this.isDragging = false;
    this.pointerDown = false;
    this.pointerButton = -1;
    this.currentPointerId = null;
  }

  /**
   * Move o objeto selecionado baseado na posição do mouse
   * Aplica snapping se configurado
   */
  _moveObject() {
    if (!this.selectedObject) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Criar um plano no nível Y do objeto
    const objectY = this.selectedObject.position.y;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -objectY);

    // Encontrar interseção do raio com o plano
    const intersection = new THREE.Vector3();
    const result = this.raycaster.ray.intersectPlane(plane, intersection);

    if (result !== null && intersection) {
      // Aplicar snapping se disponível
      if (this.coordinateSystem && this.coordinateSystem.config.enableSnap) {
        const snapped = this.coordinateSystem.snapPosition(
          intersection.x,
          intersection.y,
          intersection.z
        );
        this.selectedObject.position.set(snapped.x, snapped.y, snapped.z);
      } else {
        this.selectedObject.position.copy(intersection);
      }
    }
  }

  // ==================== Modos de Transformação (Blender-style) ====================

  /**
   * Inicia modo de transformação
   * @param {'grab'|'rotate'|'scale'} mode - Tipo de transformação
   */
  startTransformMode(mode) {
    if (!this.selectedObject) return false;

    // Não permitir transformação de objetos travados
    if (this.selectedObject.userData?.locked) return false;

    this.transformMode = mode;
    this.axisConstraint = null;
    this.planeConstraint = null;
    this.numericInput = '';
    this.transformStartMouse.copy(this.mouse);
    this.transformStartPosition.copy(this.selectedObject.position);
    this.transformStartRotation.copy(this.selectedObject.rotation);
    this.transformStartScale.copy(this.selectedObject.scale);

    if (this.onDragStart) {
      this.onDragStart(this.selectedObject, this.transformStartPosition.clone());
    }

    // Notificar que o modo de transformação foi ativado
    if (this.onTransformModeChange) {
      this.onTransformModeChange(mode, true);
    }

    this._notifyTransformUpdate();
    return true;
  }

  /**
   * Define restrição de eixo (X, Y, Z)
   * @param {'x'|'y'|'z'} axis
   */
  setAxisConstraint(axis) {
    if (!this.transformMode) return;

    // Toggle: se já está no mesmo eixo, remove a restrição
    if (this.axisConstraint === axis) {
      this.axisConstraint = null;
    } else {
      this.axisConstraint = axis;
      this.planeConstraint = null;
    }

    this._notifyTransformUpdate();
  }

  /**
   * Define restrição de plano (Shift+X = YZ, Shift+Y = XZ, Shift+Z = XY)
   * @param {'x'|'y'|'z'} excludeAxis - Eixo a excluir (movimento no plano dos outros dois)
   */
  setPlaneConstraint(excludeAxis) {
    if (!this.transformMode) return;

    const planes = { x: 'yz', y: 'xz', z: 'xy' };

    if (this.planeConstraint === planes[excludeAxis]) {
      this.planeConstraint = null;
    } else {
      this.planeConstraint = planes[excludeAxis];
      this.axisConstraint = null;
    }

    this._notifyTransformUpdate();
  }

  /**
   * Adiciona dígito à entrada numérica
   * @param {string} digit
   */
  addNumericInput(digit) {
    if (!this.transformMode) return;

    // Permitir números, ponto decimal e sinal negativo
    if (/^[0-9.\-]$/.test(digit)) {
      // Evitar múltiplos pontos ou sinais
      if (digit === '.' && this.numericInput.includes('.')) return;
      if (digit === '-' && this.numericInput.length > 0) return;

      this.numericInput += digit;
      this._applyNumericInput();
      this._notifyTransformUpdate();
    }
  }

  /**
   * Remove último caractere da entrada numérica (Backspace)
   */
  removeNumericInput() {
    if (!this.transformMode || this.numericInput.length === 0) return;

    this.numericInput = this.numericInput.slice(0, -1);
    this._applyNumericInput();
    this._notifyTransformUpdate();
  }

  /**
   * Aplica valor numérico à transformação
   */
  _applyNumericInput() {
    if (!this.selectedObject || !this.numericInput) return;

    const value = parseFloat(this.numericInput);
    if (isNaN(value)) return;

    switch (this.transformMode) {
      case 'grab':
        this._applyNumericGrab(value);
        break;
      case 'rotate':
        this._applyNumericRotate(value);
        break;
      case 'scale':
        this._applyNumericScale(value);
        break;
    }
  }

  _applyNumericGrab(value) {
    const pos = this.transformStartPosition.clone();

    if (this.axisConstraint === 'x') {
      pos.x += value;
    } else if (this.axisConstraint === 'y') {
      pos.y += value;
    } else if (this.axisConstraint === 'z') {
      pos.z += value;
    } else {
      // Sem restrição: move em todos os eixos igualmente
      pos.x += value;
      pos.z += value;
    }

    this.selectedObject.position.copy(pos);
  }

  _applyNumericRotate(value) {
    const rot = this.transformStartRotation.clone();
    const radians = THREE.MathUtils.degToRad(value);

    if (this.axisConstraint === 'x') {
      rot.x += radians;
    } else if (this.axisConstraint === 'y' || !this.axisConstraint) {
      rot.y += radians;
    } else if (this.axisConstraint === 'z') {
      rot.z += radians;
    }

    this.selectedObject.rotation.copy(rot);
  }

  _applyNumericScale(value) {
    const scale = this.transformStartScale.clone();
    const factor = value;

    if (this.axisConstraint === 'x') {
      scale.x = this.transformStartScale.x * factor;
    } else if (this.axisConstraint === 'y') {
      scale.y = this.transformStartScale.y * factor;
    } else if (this.axisConstraint === 'z') {
      scale.z = this.transformStartScale.z * factor;
    } else {
      // Escala uniforme
      scale.set(
        this.transformStartScale.x * factor,
        this.transformStartScale.y * factor,
        this.transformStartScale.z * factor
      );
    }

    // Mínimo de 0.01
    scale.x = Math.max(0.01, scale.x);
    scale.y = Math.max(0.01, scale.y);
    scale.z = Math.max(0.01, scale.z);

    this.selectedObject.scale.copy(scale);
  }

  /**
   * Aplica transformação baseado no movimento do mouse
   */
  _applyTransformMode() {
    if (!this.selectedObject || !this.transformMode) return;
    if (this.numericInput.length > 0) return; // Se tem input numérico, não usa mouse

    const deltaX = this.mouse.x - this.transformStartMouse.x;
    const deltaY = this.mouse.y - this.transformStartMouse.y;

    switch (this.transformMode) {
      case 'grab':
        this._applyMouseGrab(deltaX, deltaY);
        break;
      case 'rotate':
        this._applyMouseRotate(deltaX, deltaY);
        break;
      case 'scale':
        this._applyMouseScale(deltaX, deltaY);
        break;
    }
  }

  _applyMouseGrab(deltaX, deltaY) {
    const speed = 5;

    if (this.axisConstraint) {
      // Movimento restrito a um eixo
      // Cada eixo usa o movimento do mouse mais intuitivo
      const pos = this.transformStartPosition.clone();

      if (this.axisConstraint === 'x') {
        // X: movimento horizontal do mouse (direita = +X)
        pos.x += deltaX * speed;
      } else if (this.axisConstraint === 'y') {
        // Y: movimento vertical do mouse (cima = +Y)
        pos.y += deltaY * speed;
      } else if (this.axisConstraint === 'z') {
        // Z: movimento vertical (cima = +Z) ou horizontal (direita = +Z)
        const delta = Math.abs(deltaY) > Math.abs(deltaX) ? -deltaY : deltaX;
        pos.z += delta * speed;
      }

      this.selectedObject.position.copy(pos);
    } else if (this.planeConstraint) {
      // Movimento em um plano
      const pos = this.transformStartPosition.clone();

      if (this.planeConstraint === 'xy') {
        pos.x += deltaX * speed;
        pos.y -= deltaY * speed;
      } else if (this.planeConstraint === 'xz') {
        pos.x += deltaX * speed;
        pos.z -= deltaY * speed;
      } else if (this.planeConstraint === 'yz') {
        pos.y -= deltaY * speed;
        pos.z += deltaX * speed;
      }

      this.selectedObject.position.copy(pos);
    } else {
      // Movimento livre no plano XZ (padrão)
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.transformStartPosition.y);
      const intersection = new THREE.Vector3();

      if (this.raycaster.ray.intersectPlane(plane, intersection)) {
        if (this.coordinateSystem && this.coordinateSystem.config.enableSnap) {
          const snapped = this.coordinateSystem.snapPosition(intersection.x, intersection.y, intersection.z);
          this.selectedObject.position.set(snapped.x, snapped.y, snapped.z);
        } else {
          this.selectedObject.position.copy(intersection);
        }
      }
    }
  }

  _applyMouseRotate(deltaX, deltaY) {
    const speed = 3;
    const rot = this.transformStartRotation.clone();

    if (this.axisConstraint === 'x') {
      // Rotação em X: mouse vertical (cima = rotação positiva)
      rot.x -= deltaY * speed;
    } else if (this.axisConstraint === 'y') {
      // Rotação em Y: mouse horizontal (direita = rotação positiva)
      rot.y += deltaX * speed;
    } else if (this.axisConstraint === 'z') {
      // Rotação em Z: mouse horizontal (direita = rotação horária)
      rot.z -= deltaX * speed;
    } else {
      // Sem restrição: Y com horizontal, X com vertical
      rot.y += deltaX * speed;
      rot.x -= deltaY * speed;
    }

    this.selectedObject.rotation.copy(rot);
  }

  _applyMouseScale(deltaX, deltaY) {
    const speed = 2;
    const factor = 1 + (deltaX + deltaY) * speed;
    const scale = this.transformStartScale.clone();

    if (this.axisConstraint === 'x') {
      scale.x = Math.max(0.01, this.transformStartScale.x * factor);
    } else if (this.axisConstraint === 'y') {
      scale.y = Math.max(0.01, this.transformStartScale.y * factor);
    } else if (this.axisConstraint === 'z') {
      scale.z = Math.max(0.01, this.transformStartScale.z * factor);
    } else {
      // Escala uniforme
      const f = Math.max(0.01, factor);
      scale.set(
        this.transformStartScale.x * f,
        this.transformStartScale.y * f,
        this.transformStartScale.z * f
      );
    }

    this.selectedObject.scale.copy(scale);
  }

  /**
   * Notifica UI sobre mudança no modo de transformação
   */
  _notifyTransformUpdate() {
    if (this.onTransformUpdate) {
      this.onTransformUpdate({
        mode: this.transformMode,
        axis: this.axisConstraint,
        plane: this.planeConstraint,
        numericInput: this.numericInput,
        objectName: this.selectedObject?.name || 'Object'
      });
    }
  }

  /**
   * Confirma a transformação (clique ou Enter)
   */
  confirmTransform() {
    if (!this.transformMode || !this.selectedObject) return;

    if (this.onDragEnd) {
      this.onDragEnd(
        this.selectedObject,
        this.transformStartPosition.clone(),
        this.selectedObject.position.clone()
      );
    }

    const prevMode = this.transformMode;
    this.transformMode = null;
    this.axisConstraint = null;
    this.planeConstraint = null;
    this.numericInput = '';

    // Notificar que o modo de transformação foi desativado
    if (this.onTransformModeChange) {
      this.onTransformModeChange(prevMode, false);
    }

    this._notifyTransformUpdate();
  }

  /**
   * Cancela a transformação (Escape)
   */
  cancelTransform() {
    if (!this.transformMode || !this.selectedObject) return;

    // Restaurar valores originais
    this.selectedObject.position.copy(this.transformStartPosition);
    this.selectedObject.rotation.copy(this.transformStartRotation);
    this.selectedObject.scale.copy(this.transformStartScale);

    const prevMode = this.transformMode;
    this.transformMode = null;
    this.axisConstraint = null;
    this.planeConstraint = null;
    this.numericInput = '';

    // Notificar que o modo de transformação foi desativado
    if (this.onTransformModeChange) {
      this.onTransformModeChange(prevMode, false);
    }

    this._notifyTransformUpdate();
  }

  /**
   * Verifica se está em modo de transformação
   * @returns {string|null}
   */
  getTransformMode() {
    return this.transformMode;
  }

  /**
   * Obtém estado atual da transformação
   */
  getTransformState() {
    return {
      mode: this.transformMode,
      axis: this.axisConstraint,
      plane: this.planeConstraint,
      numericInput: this.numericInput
    };
  }

  /**
   * Realiza a seleção baseada na posição atual do mouse
   * @param {boolean} addToSelection - Se true, adiciona/remove da seleção (Shift+Click)
   */
  _performSelection(addToSelection = false) {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Obter todos os objetos intersectados
    const intersects = this.raycaster.intersectObjects(
      this.scene.children,
      true // Verificar filhos também
    );

    // Verificar se clicou em um helper de luz
    for (const item of intersects) {
      let obj = item.object;
      while (obj) {
        if (obj.userData?.isLightHelper && obj.userData?.lightName && this.engine) {
          const light = this.engine.getLight(obj.userData.lightName);
          if (light && !light.userData?.locked) {
            if (addToSelection) {
              if (this.selectedObjects.has(light)) {
                this.removeFromSelection(light);
              } else {
                this.addToSelection(light);
              }
            } else {
              this.clearSelection();
              this.addToSelection(light);
            }
            return; // Importante: sair após selecionar luz
          }
        }
        obj = obj.parent;
      }
    }

    // Filtrar apenas meshes (não helpers, gizmos, travados, etc)
    const meshIntersects = intersects.filter(item => {
      // Deve ser mesh
      if (!item.object.isMesh) return false;

      // Não deve ser helper
      if (item.object.userData.isHelper) return false;

      // Não deve ser parte do TransformControls (gizmo)
      // Verificar se algum parent é TransformControls ou travado
      let parent = item.object;
      while (parent) {
        if (parent.isTransformControls) return false;
        if (parent.type === 'TransformControlsGizmo') return false;
        if (parent.type === 'TransformControlsPlane') return false;
        // Verificar se o objeto ou algum pai está travado
        if (parent.userData?.locked) return false;
        parent = parent.parent;
      }

      return true;
    });

    if (meshIntersects.length > 0) {
      const selectedMesh = meshIntersects[0].object;

      // Encontrar o objeto raiz (pode estar em um grupo)
      let rootObject = selectedMesh;
      while (rootObject.parent && rootObject.parent !== this.scene) {
        rootObject = rootObject.parent;
      }

      if (addToSelection) {
        // Shift+Click: toggle na seleção
        if (this.selectedObjects.has(rootObject)) {
          this.removeFromSelection(rootObject);
        } else {
          this.addToSelection(rootObject);
        }
      } else {
        // Click normal: selecionar apenas este objeto
        this.clearSelection();
        this.addToSelection(rootObject);
      }
    } else {
      // Clique no vazio - desselecionar todos (apenas se não for shift+click)
      if (!addToSelection) {
        this.clearSelection();
      }
    }
  }

  /**
   * Adiciona um objeto à seleção
   * @param {THREE.Object3D} object
   */
  addToSelection(object) {
    if (!object) return;

    this.selectedObjects.add(object);
    this.primarySelected = object;
    this.selectedObject = object; // Compatibilidade

    if (this.onSelect) {
      this.onSelect(object, Array.from(this.selectedObjects));
    }
  }

  /**
   * Remove um objeto da seleção
   * @param {THREE.Object3D} object
   */
  removeFromSelection(object) {
    if (!object) return;

    this.selectedObjects.delete(object);

    // Atualizar primary selected
    if (this.primarySelected === object) {
      // Pegar o último objeto restante ou null
      const remaining = Array.from(this.selectedObjects);
      this.primarySelected = remaining.length > 0 ? remaining[remaining.length - 1] : null;
      this.selectedObject = this.primarySelected;
    }

    if (this.onSelect) {
      this.onSelect(this.primarySelected, Array.from(this.selectedObjects));
    }
  }

  /**
   * Limpa toda a seleção
   */
  clearSelection() {
    this.selectedObjects.clear();
    this.primarySelected = null;
    this.selectedObject = null;

    if (this.onSelect) {
      this.onSelect(null, []);
    }
  }

  /**
   * Seleciona todos os objetos da cena (exceto helpers)
   * @param {Map} objectsMap - Map de objetos do ThreeEngine
   */
  selectAll(objectsMap) {
    this.selectedObjects.clear();

    for (const [name, obj] of objectsMap) {
      if (!obj.userData.isHelper) {
        this.selectedObjects.add(obj);
        this.primarySelected = obj;
      }
    }

    this.selectedObject = this.primarySelected;

    if (this.onSelect) {
      this.onSelect(this.primarySelected, Array.from(this.selectedObjects));
    }
  }

  /**
   * Obtém todos os objetos selecionados
   * @returns {THREE.Object3D[]}
   */
  getSelectedObjects() {
    return Array.from(this.selectedObjects);
  }

  /**
   * Verifica se um objeto está selecionado
   * @param {THREE.Object3D} object
   * @returns {boolean}
   */
  isSelected(object) {
    return this.selectedObjects.has(object);
  }

  /**
   * Obtém a quantidade de objetos selecionados
   * @returns {number}
   */
  getSelectionCount() {
    return this.selectedObjects.size;
  }

  /**
   * Obtém o objeto selecionado
   * @returns {THREE.Object3D|null} Objeto selecionado
   */
  getSelectedObject() {
    return this.selectedObject;
  }

  /**
   * Define o objeto selecionado (limpa seleção anterior)
   * @param {THREE.Object3D|null} object - Objeto a selecionar
   */
  setSelectedObject(object) {
    this.clearSelection();
    if (object) {
      this.addToSelection(object);
    }
  }

  /**
   * Define múltiplos objetos selecionados
   * @param {THREE.Object3D[]} objects - Array de objetos
   */
  setSelectedObjects(objects) {
    // Limpar sem disparar callback (evita loop)
    this.selectedObjects.clear();
    this.primarySelected = null;
    this.selectedObject = null;

    for (const obj of objects) {
      if (obj) {
        this.selectedObjects.add(obj);
        this.primarySelected = obj;
      }
    }
    this.selectedObject = this.primarySelected;
  }

  /**
   * Verifica se está arrastando
   * @returns {boolean}
   */
  getIsDragging() {
    return this.isDragging;
  }

  /**
   * Define o threshold de drag
   * @param {number} threshold - Valor entre 0 e 1
   */
  setDragThreshold(threshold) {
    this.dragThreshold = threshold;
  }

  /**
   * Destrói o controlador e remove listeners
   */
  dispose() {
    this.disconnectInputManager();
    this.selectedObjects.clear();
    this.primarySelected = null;
    this.selectedObject = null;
    this.dragStartPositions.clear();
  }
}
