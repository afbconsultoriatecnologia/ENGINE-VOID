import * as THREE from 'three';
import { TOUCH } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

/**
 * Controlador de câmeras que suporta diferentes tipos de visualização
 * Perspectiva, Isométrica e Primeira Pessoa
 * Integra com InputManager para controles de teclado
 */
export class CameraController {
  /**
   * Construtor do controlador de câmeras
   * @param {HTMLElement} container - Container do canvas
   * @param {THREE.Scene} scene - Cena Three.js
   * @param {Object} options - Opções de configuração
   */
  constructor(container, scene, options = {}) {
    this.container = container;
    this.scene = scene;
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    this.cameras = new Map();
    this.currentCameraType = 'perspective';
    this.currentCamera = null;
    this.controls = null;
    this.pointerLockControls = null;

    // InputManager (será injetado)
    this.inputManager = null;

    // Configurações de movimento first-person
    this.firstPersonConfig = {
      moveSpeed: options.moveSpeed || 0.1,
      sprintMultiplier: options.sprintMultiplier || 2,
      eyeHeight: options.eyeHeight || 1.6
    };

    // Estado de movimento
    this.movement = {
      forward: 0,
      right: 0,
      up: 0
    };

    // Bound handlers
    this._boundHandlers = {
      onKeyDown: this._onKeyDown.bind(this),
      onKeyUp: this._onKeyUp.bind(this),
      onPointerLockClick: this._onPointerLockClick.bind(this),
      onWheel: this._onWheel.bind(this)
    };

    // Flag para controle de pointer lock click
    this._pointerLockClickEnabled = false;

    this.init();
  }

  /**
   * Inicializa todas as câmeras
   */
  init() {
    // Câmera perspectiva
    const perspectiveCamera = new THREE.PerspectiveCamera(
      75,
      this.width / this.height,
      0.1,
      1000
    );
    perspectiveCamera.position.set(0, 5, 10);
    perspectiveCamera.lookAt(0, 0, 0);
    this.cameras.set('perspective', perspectiveCamera);

    // Câmera isométrica (ortográfica)
    const isometricCamera = new THREE.OrthographicCamera(
      -10, 10, 10, -10, 0.1, 1000
    );
    // Posição correta para isometria verdadeira
    const isoDist = 15;
    isometricCamera.position.set(isoDist, isoDist, isoDist);
    isometricCamera.lookAt(0, 0, 0);
    this.cameras.set('isometric', isometricCamera);

    // Câmera primeira pessoa
    const firstPersonCamera = new THREE.PerspectiveCamera(
      75,
      this.width / this.height,
      0.1,
      1000
    );
    firstPersonCamera.position.set(0, this.firstPersonConfig.eyeHeight, 5);
    this.cameras.set('firstPerson', firstPersonCamera);

    // Definir câmera padrão
    this.setCamera('perspective');
  }

  /**
   * Conecta ao InputManager
   * @param {InputManager} inputManager
   */
  connectInputManager(inputManager) {
    this.inputManager = inputManager;

    // Registrar handlers de teclado para movimento
    inputManager.on('keyDown', this._boundHandlers.onKeyDown);
    inputManager.on('keyUp', this._boundHandlers.onKeyUp);
  }

  /**
   * Desconecta do InputManager
   */
  disconnectInputManager() {
    if (this.inputManager) {
      this.inputManager.off('keyDown', this._boundHandlers.onKeyDown);
      this.inputManager.off('keyUp', this._boundHandlers.onKeyUp);
      this.inputManager = null;
    }
  }

  /**
   * Handler de key down para movimento
   * @param {Object} eventData
   */
  _onKeyDown(eventData) {
    if (this.currentCameraType !== 'firstPerson') return;
    if (!this.pointerLockControls || !this.pointerLockControls.isLocked) return;

    this._updateMovementFromKey(eventData.code, true);
  }

  /**
   * Handler de key up para movimento
   * @param {Object} eventData
   */
  _onKeyUp(eventData) {
    if (this.currentCameraType !== 'firstPerson') return;

    this._updateMovementFromKey(eventData.code, false);
  }

  /**
   * Atualiza estado de movimento baseado em tecla
   * @param {string} code - Código da tecla
   * @param {boolean} pressed - Se está pressionada
   */
  _updateMovementFromKey(code, pressed) {
    const value = pressed ? 1 : 0;
    const negValue = pressed ? -1 : 0;

    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.movement.forward = pressed ? 1 : (this.inputManager?.isKeyPressed('KeyS') || this.inputManager?.isKeyPressed('ArrowDown') ? -1 : 0);
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.movement.forward = pressed ? -1 : (this.inputManager?.isKeyPressed('KeyW') || this.inputManager?.isKeyPressed('ArrowUp') ? 1 : 0);
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.movement.right = pressed ? -1 : (this.inputManager?.isKeyPressed('KeyD') || this.inputManager?.isKeyPressed('ArrowRight') ? 1 : 0);
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.movement.right = pressed ? 1 : (this.inputManager?.isKeyPressed('KeyA') || this.inputManager?.isKeyPressed('ArrowLeft') ? -1 : 0);
        break;
      case 'Space':
        this.movement.up = pressed ? 1 : (this.inputManager?.isKeyPressed('ShiftLeft') || this.inputManager?.isKeyPressed('ShiftRight') ? -1 : 0);
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.movement.up = pressed ? -1 : (this.inputManager?.isKeyPressed('Space') ? 1 : 0);
        break;
    }
  }

  /**
   * Handler de click para ativar pointer lock
   */
  _onPointerLockClick() {
    if (this.pointerLockControls && !this.pointerLockControls.isLocked) {
      this.pointerLockControls.lock();
    }
  }

  /**
   * Handler de wheel para mouse e trackpad
   * - Mouse scroll wheel: Zoom (Blender style)
   * - Trackpad 2 dedos: Pan
   * - Trackpad pinça (ctrlKey): Zoom
   * @param {WheelEvent} event
   */
  _onWheel(event) {
    // Ignorar se controles desabilitados (Game mode) ou não existem
    if (!this.controls || !this.controls.enabled || !this.currentCamera) return;

    event.preventDefault();
    event.stopPropagation();

    // Detectar se é mouse ou trackpad
    // Mouse: deltaX sempre 0, deltaY é o scroll
    // Trackpad: deltaX pode ter valor (scroll horizontal)
    const isMouse = event.deltaX === 0 && !event.ctrlKey;
    const isTrackpadPinch = event.ctrlKey;

    // Mouse scroll OU trackpad pinça → Zoom
    if (isMouse || isTrackpadPinch) {
      const zoomSpeed = isMouse ? 0.002 : 0.01;
      const zoomDelta = event.deltaY * zoomSpeed;

      // Calcular direção da câmera para o target
      const direction = new THREE.Vector3();
      direction.subVectors(this.currentCamera.position, this.controls.target);

      // Aplicar zoom (mover câmera na direção do target)
      const factor = 1 + zoomDelta;
      direction.multiplyScalar(factor);

      // Limitar distância mínima e máxima
      const distance = direction.length();
      if (distance > 2 && distance < 100) {
        this.currentCamera.position.copy(this.controls.target).add(direction);
      }
    } else {
      // Trackpad: Scroll de 2 dedos → Pan
      const panSpeed = 0.005;

      // Obter vetores right e up da câmera
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      this.currentCamera.matrix.extractBasis(right, up, new THREE.Vector3());

      // Calcular deslocamento
      const deltaX = event.deltaX * panSpeed;
      const deltaY = event.deltaY * panSpeed;

      // Aplicar pan
      const offset = new THREE.Vector3();
      offset.addScaledVector(right, deltaX);
      offset.addScaledVector(up, -deltaY);

      this.controls.target.add(offset);
      this.currentCamera.position.add(offset);
    }

    this.controls.update();
  }

  /**
   * Define a câmera ativa
   * @param {string} type - Tipo de câmera ('perspective', 'isometric', 'firstPerson')
   * @param {Object} options - Opções específicas da câmera
   */
  setCamera(type, options = {}) {
    if (!this.cameras.has(type)) {
      console.warn(`Tipo de câmera "${type}" não existe`);
      return;
    }

    // Remover controles anteriores
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }
    if (this.pointerLockControls) {
      this.pointerLockControls.dispose();
      this.pointerLockControls = null;
    }

    // Remover listener de click para pointer lock
    if (this._pointerLockClickEnabled) {
      this.container.removeEventListener('click', this._boundHandlers.onPointerLockClick);
      this._pointerLockClickEnabled = false;
    }

    // Resetar movimento
    this.movement = { forward: 0, right: 0, up: 0 };

    this.currentCameraType = type;
    this.currentCamera = this.cameras.get(type);

    // Configurar controles baseado no tipo
    if (type === 'firstPerson') {
      this.setupFirstPersonControls(options);
    } else {
      this.setupOrbitControls(options);
    }

    // Aplicar opções de posição se fornecidas
    if (options.position) {
      this.currentCamera.position.set(...options.position);
    }
    if (options.lookAt && type !== 'firstPerson') {
      this.currentCamera.lookAt(...options.lookAt);
    }
  }

  /**
   * Configura controles de órbita para câmeras normais
   * Estilo BLENDER:
   * - Left Click: Selecionar (handled by SelectionController)
   * - Middle Click + Drag: Orbitar/Rotacionar
   * - Shift + Middle Click + Drag: Pan
   * - Scroll Wheel: Zoom
   * - Right Click: Reservado para context menu
   * @param {Object} options - Opções dos controles
   */
  setupOrbitControls(options = {}) {
    this.controls = new OrbitControls(
      this.currentCamera,
      this.container
    );
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = options.minDistance || 2;
    this.controls.maxDistance = options.maxDistance || 100;
    this.controls.enablePan = options.enablePan !== false;
    this.controls.enableZoom = options.enableZoom !== false;
    this.controls.enableRotate = options.enableRotate !== false;

    // Limites de ângulo vertical
    this.controls.minPolarAngle = options.minPolarAngle || 0;
    this.controls.maxPolarAngle = options.maxPolarAngle || Math.PI;

    // ========== MOUSE CONTROLS ==========
    // Left Click + Drag = Orbit (para Mac trackpad 3 dedos)
    // Middle Click + Drag = Orbit (Blender style para mouse)
    // Shift + Middle = Pan
    // Scroll Wheel = Zoom
    // Right Click = Reservado para context menu
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,      // Left drag = orbitar (Mac trackpad 3 dedos)
      MIDDLE: THREE.MOUSE.ROTATE,    // Middle drag = orbitar (mouse Blender)
      RIGHT: null                    // Reservado para context menu
    };

    // Desabilitar zoom do OrbitControls (controlamos manualmente no _onWheel)
    this.controls.enableZoom = false;

    // Pan com Shift + Middle (configuração padrão do OrbitControls)
    this.controls.screenSpacePanning = true;
    this.controls.panSpeed = 1.0;

    // ========== TOUCH CONTROLS (NÃO MEXER) ==========
    // 1 dedo = rotação
    // 2 dedos = pan + zoom (pinça)
    this.controls.touches = {
      ONE: TOUCH.ROTATE,
      TWO: TOUCH.DOLLY_PAN
    };

    // Handler customizado de wheel para mouse e trackpad
    this.container.addEventListener('wheel', this._boundHandlers.onWheel, { passive: false });
  }

  /**
   * Configura controles de primeira pessoa
   * @param {Object} options - Opções dos controles
   */
  setupFirstPersonControls(options = {}) {
    this.pointerLockControls = new PointerLockControls(
      this.currentCamera,
      this.container
    );

    // Adicionar listener para ativar pointer lock no click
    this.container.addEventListener('click', this._boundHandlers.onPointerLockClick);
    this._pointerLockClickEnabled = true;

    // Listener para quando sai do pointer lock
    this.pointerLockControls.addEventListener('unlock', () => {
      // Resetar movimento quando sai do pointer lock
      this.movement = { forward: 0, right: 0, up: 0 };
    });
  }

  /**
   * Obtém a câmera atual
   * @returns {THREE.Camera} Câmera ativa
   */
  getCamera() {
    return this.currentCamera;
  }

  /**
   * Obtém o tipo de câmera atual
   * @returns {string} Tipo da câmera
   */
  getCameraType() {
    return this.currentCameraType;
  }

  /**
   * Verifica se o pointer lock está ativo
   * @returns {boolean}
   */
  isPointerLocked() {
    return this.pointerLockControls?.isLocked || false;
  }

  /**
   * Atualiza os controles (deve ser chamado no loop de animação)
   * @param {number} delta - Delta time (opcional, para movimento suave)
   */
  update(delta = 1) {
    if (this.controls) {
      this.controls.update();
    }

    // Atualizar movimento first-person
    if (this.currentCameraType === 'firstPerson' && this.pointerLockControls?.isLocked) {
      this._updateFirstPersonMovement(delta);
    }
  }

  /**
   * Atualiza movimento da câmera first-person
   * @param {number} delta - Delta time
   */
  _updateFirstPersonMovement(delta) {
    const camera = this.currentCamera;
    const speed = this.firstPersonConfig.moveSpeed * delta;

    // Vetor de direção
    const direction = new THREE.Vector3();

    // Forward/Backward (na direção que a câmera está olhando)
    if (this.movement.forward !== 0) {
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0; // Manter no plano horizontal
      forward.normalize();
      direction.add(forward.multiplyScalar(this.movement.forward * speed));
    }

    // Left/Right (perpendicular à direção da câmera)
    if (this.movement.right !== 0) {
      const right = new THREE.Vector3();
      camera.getWorldDirection(right);
      right.y = 0;
      right.normalize();
      right.cross(camera.up);
      direction.add(right.multiplyScalar(this.movement.right * speed));
    }

    // Up/Down (vertical)
    if (this.movement.up !== 0) {
      direction.y += this.movement.up * speed;
    }

    // Aplicar movimento
    camera.position.add(direction);
  }

  /**
   * Lida com redimensionamento
   * @param {number} width - Nova largura
   * @param {number} height - Nova altura
   */
  handleResize(width, height) {
    this.width = width;
    this.height = height;

    // Atualizar câmera perspectiva
    const perspective = this.cameras.get('perspective');
    if (perspective instanceof THREE.PerspectiveCamera) {
      perspective.aspect = width / height;
      perspective.updateProjectionMatrix();
    }

    // Atualizar câmera primeira pessoa
    const firstPerson = this.cameras.get('firstPerson');
    if (firstPerson instanceof THREE.PerspectiveCamera) {
      firstPerson.aspect = width / height;
      firstPerson.updateProjectionMatrix();
    }

    // Atualizar câmera isométrica
    const isometric = this.cameras.get('isometric');
    if (isometric instanceof THREE.OrthographicCamera) {
      const aspect = width / height;
      const viewSize = 10;
      isometric.left = -viewSize * aspect;
      isometric.right = viewSize * aspect;
      isometric.top = viewSize;
      isometric.bottom = -viewSize;
      isometric.updateProjectionMatrix();
    }
  }

  /**
   * Define velocidade de movimento first-person
   * @param {number} speed
   */
  setMoveSpeed(speed) {
    this.firstPersonConfig.moveSpeed = speed;
  }

  /**
   * Foca a câmera em um objeto
   * @param {THREE.Object3D} object - Objeto para focar
   * @param {number} distance - Distância do objeto (opcional)
   */
  focusOnObject(object, distance = 5) {
    if (!object) return;

    const boundingBox = new THREE.Box3().setFromObject(object);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (this.currentCameraType === 'firstPerson') {
      // Para first-person, mover para perto do objeto
      this.currentCamera.position.set(
        center.x,
        center.y + this.firstPersonConfig.eyeHeight,
        center.z + maxDim + distance
      );
    } else {
      // Para outras câmeras, ajustar posição e lookAt
      const camera = this.currentCamera;
      const direction = camera.position.clone().sub(center).normalize();
      camera.position.copy(center.clone().add(direction.multiplyScalar(maxDim + distance)));

      if (this.controls) {
        this.controls.target.copy(center);
        this.controls.update();
      }
    }
  }

  /**
   * Reseta a câmera para posição padrão
   */
  resetCamera() {
    switch (this.currentCameraType) {
      case 'perspective':
        this.currentCamera.position.set(0, 5, 10);
        if (this.controls) {
          this.controls.target.set(0, 0, 0);
          this.controls.update();
        }
        break;
      case 'isometric':
        const isoDist = 15;
        this.currentCamera.position.set(isoDist, isoDist, isoDist);
        if (this.controls) {
          this.controls.target.set(0, 0, 0);
          this.controls.update();
        }
        break;
      case 'firstPerson':
        this.currentCamera.position.set(0, this.firstPersonConfig.eyeHeight, 5);
        this.currentCamera.lookAt(0, this.firstPersonConfig.eyeHeight, 0);
        break;
    }
  }

  /**
   * Desativa os controles da câmera (OrbitControls)
   * Usado quando entra em Game mode
   */
  disable() {
    if (this.controls) {
      this.controls.enabled = false;
    }
    console.log('[CameraController] Disabled');
  }

  /**
   * Ativa os controles da câmera (OrbitControls)
   * Usado quando volta para Dev mode
   */
  enable() {
    if (this.controls) {
      this.controls.enabled = true;
    }
    console.log('[CameraController] Enabled');
  }

  /**
   * Destrói o controlador e limpa recursos
   */
  dispose() {
    this.disconnectInputManager();

    // Remover wheel listener
    this.container.removeEventListener('wheel', this._boundHandlers.onWheel);

    if (this.controls) {
      this.controls.dispose();
    }
    if (this.pointerLockControls) {
      this.pointerLockControls.dispose();
    }

    if (this._pointerLockClickEnabled) {
      this.container.removeEventListener('click', this._boundHandlers.onPointerLockClick);
    }
  }
}
