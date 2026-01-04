import * as THREE from 'three';

/**
 * Configurações padrão de controles
 */
function getDefaultControlSettings() {
  return {
    movement: {
      speed: 5,
      sprintMultiplier: 2,
      jumpForce: 5,
      gravity: 20,
      rotationSpeed: 10
    },
    keys: {
      forward: 'KeyW',
      forwardAlt: 'ArrowUp',
      backward: 'KeyS',
      backwardAlt: 'ArrowDown',
      left: 'KeyA',
      leftAlt: 'ArrowLeft',
      right: 'KeyD',
      rightAlt: 'ArrowRight',
      jump: 'Space',
      sprint: 'ShiftLeft'
    },
    mouse: {
      sensitivity: 0.002,
      invertY: false,
      zoomSpeed: 1
    }
  };
}

/**
 * PlayerController - Controle de jogador em primeira pessoa
 * WASD para movimento, mouse para olhar
 */
export default class PlayerController {
  constructor(camera, domElement, controlSettings = null) {
    this.camera = camera;
    this.domElement = domElement;

    // Mesclar settings customizados com defaults
    const defaults = getDefaultControlSettings();
    const custom = controlSettings || {};
    this.settings = {
      movement: { ...defaults.movement, ...custom.movement },
      keys: { ...defaults.keys, ...custom.keys },
      mouse: { ...defaults.mouse, ...custom.mouse }
    };

    // Configurações de movimento (do settings)
    this.moveSpeed = this.settings.movement.speed;
    this.sprintMultiplier = this.settings.movement.sprintMultiplier;
    this.jumpForce = this.settings.movement.jumpForce;
    this.gravity = this.settings.movement.gravity;

    // Estado do jogador
    this.position = new THREE.Vector3(0, 1.7, 5); // Altura do olho
    this.velocity = new THREE.Vector3();
    this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');

    // Sensibilidade do mouse (do settings)
    this.mouseSensitivity = this.settings.mouse.sensitivity;
    this.invertY = this.settings.mouse.invertY;
    this.maxPitch = Math.PI / 2 - 0.1; // Limite para não virar de cabeça pra baixo

    // Estado das teclas
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false
    };

    // Estado do mouse
    this.isPointerLocked = false;

    // Bind dos handlers
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onPointerLockChange = this.onPointerLockChange.bind(this);
    this.onClick = this.onClick.bind(this);

    // Chão (para colisão básica)
    this.groundLevel = 1.7; // Altura dos olhos
    this.isGrounded = true;
  }

  /**
   * Ativa os controles
   */
  enable() {
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.domElement.addEventListener('click', this.onClick);

    // Posicionar câmera inicial
    this.camera.position.copy(this.position);
    this.rotation.y = this.camera.rotation.y;

    console.log('[PlayerController] Enabled - Click to lock pointer');
  }

  /**
   * Desativa os controles
   */
  disable() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.domElement.removeEventListener('click', this.onClick);

    // Liberar pointer lock
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    // Reset keys
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false
    };

    console.log('[PlayerController] Disabled');
  }

  /**
   * Clique para travar o mouse
   */
  onClick() {
    if (!this.isPointerLocked) {
      this.domElement.requestPointerLock();
    }
  }

  /**
   * Mudança no pointer lock
   */
  onPointerLockChange() {
    this.isPointerLocked = document.pointerLockElement === this.domElement;
    console.log('[PlayerController] Pointer lock:', this.isPointerLocked);
  }

  /**
   * Tecla pressionada
   */
  onKeyDown(event) {
    const code = event.code;
    const k = this.settings.keys;

    // Forward
    if (code === k.forward || code === k.forwardAlt) {
      this.keys.forward = true;
    }
    // Backward
    else if (code === k.backward || code === k.backwardAlt) {
      this.keys.backward = true;
    }
    // Left
    else if (code === k.left || code === k.leftAlt) {
      this.keys.left = true;
    }
    // Right
    else if (code === k.right || code === k.rightAlt) {
      this.keys.right = true;
    }
    // Jump
    else if (code === k.jump) {
      if (this.isGrounded) {
        this.keys.jump = true;
      }
    }
    // Sprint (aceita ambos os Shifts)
    else if (code === k.sprint || code === 'ShiftLeft' || code === 'ShiftRight') {
      this.keys.sprint = true;
    }
  }

  /**
   * Tecla solta
   */
  onKeyUp(event) {
    const code = event.code;
    const k = this.settings.keys;

    // Forward
    if (code === k.forward || code === k.forwardAlt) {
      this.keys.forward = false;
    }
    // Backward
    else if (code === k.backward || code === k.backwardAlt) {
      this.keys.backward = false;
    }
    // Left
    else if (code === k.left || code === k.leftAlt) {
      this.keys.left = false;
    }
    // Right
    else if (code === k.right || code === k.rightAlt) {
      this.keys.right = false;
    }
    // Jump
    else if (code === k.jump) {
      this.keys.jump = false;
    }
    // Sprint
    else if (code === k.sprint || code === 'ShiftLeft' || code === 'ShiftRight') {
      this.keys.sprint = false;
    }
  }

  /**
   * Movimento do mouse
   */
  onMouseMove(event) {
    if (!this.isPointerLocked) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    // Rotação horizontal (yaw)
    this.rotation.y -= movementX * this.mouseSensitivity;

    // Rotação vertical (pitch) com limites - com suporte a invertY
    const yMultiplier = this.invertY ? 1 : -1;
    this.rotation.x += movementY * this.mouseSensitivity * yMultiplier;
    this.rotation.x = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.rotation.x));
  }

  /**
   * Update chamado todo frame
   * @param {number} deltaTime - Tempo desde último frame em segundos
   */
  update(deltaTime) {
    // Direção do movimento baseado na rotação
    const direction = new THREE.Vector3();

    // Forward/Backward
    if (this.keys.forward) direction.z -= 1;
    if (this.keys.backward) direction.z += 1;

    // Left/Right (strafe)
    if (this.keys.left) direction.x -= 1;
    if (this.keys.right) direction.x += 1;

    // Normalizar para não andar mais rápido na diagonal
    if (direction.length() > 0) {
      direction.normalize();
    }

    // Aplicar rotação (apenas yaw, não pitch)
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation.y);

    // Calcular velocidade
    let speed = this.moveSpeed;
    if (this.keys.sprint) {
      speed *= this.sprintMultiplier;
    }

    // Movimento horizontal
    this.velocity.x = direction.x * speed;
    this.velocity.z = direction.z * speed;

    // Pulo
    if (this.keys.jump && this.isGrounded) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
      this.keys.jump = false; // Consumir o pulo
    }

    // Gravidade
    if (!this.isGrounded) {
      this.velocity.y -= this.gravity * deltaTime;
    }

    // Aplicar movimento
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
    this.position.z += this.velocity.z * deltaTime;

    // Colisão com o chão
    if (this.position.y <= this.groundLevel) {
      this.position.y = this.groundLevel;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Atualizar câmera
    this.camera.position.copy(this.position);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.x = this.rotation.x;
    this.camera.rotation.y = this.rotation.y;
  }

  /**
   * Define a posição do jogador
   */
  setPosition(x, y, z) {
    this.position.set(x, y, z);
    this.camera.position.copy(this.position);
  }

  /**
   * Retorna a posição atual
   */
  getPosition() {
    return this.position.clone();
  }
}
