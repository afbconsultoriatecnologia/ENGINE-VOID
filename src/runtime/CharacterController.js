import * as THREE from 'three';

/**
 * Configurações padrão de controles
 */
function getDefaultControlSettings() {
  return {
    movement: {
      speed: 5,
      sprintMultiplier: 2,
      jumpForce: 8,
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
 * CharacterController - Controle de personagem em terceira pessoa
 * Move o objeto do player com WASD relativo à câmera
 */
export default class CharacterController {
  constructor(character, cameraController, controlSettings = null) {
    this.character = character; // O objeto 3D do player
    this.cameraController = cameraController; // ThirdPersonCamera

    // Mesclar settings customizados com defaults
    const defaults = getDefaultControlSettings();
    const custom = controlSettings || character?.userData?.controlSettings || {};
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
    this.rotationSpeed = this.settings.movement.rotationSpeed;

    // Estado
    this.velocity = new THREE.Vector3();
    this.isGrounded = true;
    this.groundLevel = 0; // Altura do chão

    // Calcular altura do personagem para ground check
    if (this.character.geometry) {
      this.character.geometry.computeBoundingBox();
      const box = this.character.geometry.boundingBox;
      this.characterHeight = box.max.y - box.min.y;
    } else {
      this.characterHeight = 1;
    }

    // Estado das teclas
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false
    };

    // Bind handlers
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
  }

  /**
   * Ativa os controles
   */
  enable() {
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);

    // Calcular ground level baseado na posição inicial
    this.groundLevel = this.character.position.y;

    console.log('[CharacterController] Enabled');
  }

  /**
   * Desativa os controles
   */
  disable() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);

    // Reset keys
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false
    };

    console.log('[CharacterController] Disabled');
  }

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
   * Update chamado todo frame
   */
  update(deltaTime) {
    if (!this.character) return;

    // Obter direção da câmera
    const forward = this.cameraController.getForwardDirection();
    const right = this.cameraController.getRightDirection();

    // Calcular direção do movimento
    const moveDirection = new THREE.Vector3();

    if (this.keys.forward) moveDirection.add(forward);
    if (this.keys.backward) moveDirection.sub(forward);
    if (this.keys.right) moveDirection.add(right);
    if (this.keys.left) moveDirection.sub(right);

    // Normalizar
    if (moveDirection.length() > 0) {
      moveDirection.normalize();

      // Rotacionar personagem na direção do movimento
      const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
      const currentRotation = this.character.rotation.y;

      // Interpolação suave da rotação
      let rotationDiff = targetRotation - currentRotation;

      // Normalizar para -PI a PI
      while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
      while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

      this.character.rotation.y += rotationDiff * this.rotationSpeed * deltaTime;
    }

    // Calcular velocidade
    let speed = this.moveSpeed;
    if (this.keys.sprint) {
      speed *= this.sprintMultiplier;
    }

    // Movimento horizontal
    this.velocity.x = moveDirection.x * speed;
    this.velocity.z = moveDirection.z * speed;

    // Pulo
    if (this.keys.jump && this.isGrounded) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
      this.keys.jump = false;
    }

    // Gravidade
    if (!this.isGrounded) {
      this.velocity.y -= this.gravity * deltaTime;
    }

    // Aplicar movimento
    this.character.position.x += this.velocity.x * deltaTime;
    this.character.position.y += this.velocity.y * deltaTime;
    this.character.position.z += this.velocity.z * deltaTime;

    // Colisão com o chão
    if (this.character.position.y <= this.groundLevel) {
      this.character.position.y = this.groundLevel;
      this.velocity.y = 0;
      this.isGrounded = true;
    }
  }

  /**
   * Define a posição do personagem
   */
  setPosition(x, y, z) {
    this.character.position.set(x, y, z);
    this.groundLevel = y;
  }

  /**
   * Retorna a posição atual
   */
  getPosition() {
    return this.character.position.clone();
  }
}
