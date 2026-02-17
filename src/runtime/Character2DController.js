import * as THREE from 'three';

/**
 * Configurações padrão de controles 2D
 */
function getDefaultControlSettings() {
  return {
    movement: {
      speed: 5,
      sprintMultiplier: 2,
      jumpForce: 8,
      gravity: 20,
      rotationSpeed: 10,
      // Grid movement settings
      gridMovement: false, // Se true, move de tile em tile
      tileSize: 1, // Tamanho do tile em unidades do mundo
      // Click-to-move settings
      clickToMove: false, // Se true, clique no chão move o player
      clickStopDistance: 0.1 // Distância para parar ao chegar no destino
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
    camera: {
      mode: 'follow', // 'follow' (MU style) ou 'free' (Dota style)
      followSmoothing: 5
    }
  };
}

/**
 * Character2DController - Controle de personagem em 2D
 * Move o objeto do player com WASD/Arrows nos eixos X e Y
 * Suporta: movimento contínuo, grid, e click-to-move
 */
export default class Character2DController {
  constructor(character, camera2D, controlSettings = null) {
    this.character = character; // O objeto 2D do player
    this.camera2D = camera2D; // Camera2D (pode ser null)
    this.domElement = null; // Elemento DOM para eventos de mouse

    // Mesclar settings customizados com defaults
    const defaults = getDefaultControlSettings();
    const custom = controlSettings || character?.userData?.controlSettings || {};
    this.settings = {
      movement: { ...defaults.movement, ...custom.movement },
      keys: { ...defaults.keys, ...custom.keys },
      camera: { ...defaults.camera, ...custom.camera }
    };

    // Configurações de movimento
    this.moveSpeed = this.settings.movement.speed;
    this.sprintMultiplier = this.settings.movement.sprintMultiplier;
    this.gravity = this.settings.movement.gravity;
    this.jumpForce = this.settings.movement.jumpForce;

    // Grid movement settings
    this.gridMovement = this.settings.movement.gridMovement || false;
    this.tileSize = this.settings.movement.tileSize || 1;

    // Click-to-move settings
    this.clickToMove = this.settings.movement.clickToMove || false;
    this.clickStopDistance = this.settings.movement.clickStopDistance || 0.1;

    // Camera settings
    this.cameraMode = this.settings.camera.mode || 'follow';

    // Estado
    this.velocity = new THREE.Vector2(0, 0);
    this.isGrounded = true;
    this.groundLevel = null; // Y do chão (para platformer)
    this.hasGravity = this.settings.movement.gravity > 0;

    // Estado do grid movement
    this.isMoving = false; // Está em transição entre tiles?
    this.targetPosition = new THREE.Vector2(0, 0); // Posição alvo do tile
    this.startPosition = new THREE.Vector2(0, 0); // Posição inicial da transição
    this.moveProgress = 0; // Progresso da transição (0-1)
    this.lastInputDirection = { x: 0, y: 0 }; // Última direção pressionada

    // Estado do click-to-move
    this.clickTarget = null; // Posição alvo do click (THREE.Vector2 ou null)
    this.isMovingToClick = false; // Está movendo para posição clicada?

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
    this.onMouseDown = this.onMouseDown.bind(this);
  }

  /**
   * Ativa os controles
   * @param {HTMLElement} domElement - Elemento DOM para eventos de mouse (opcional)
   */
  enable(domElement = null) {
    this.domElement = domElement;

    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);

    // Adicionar listener de mouse se click-to-move estiver ativo
    if (this.clickToMove && this.domElement) {
      this.domElement.addEventListener('mousedown', this.onMouseDown);
      console.log('[Character2DController] Click-to-move enabled');
    }

    // Detectar se tem gravidade (platformer)
    // Apenas tem gravidade se gravity > 0 explicitamente
    this.hasGravity = this.gravity > 0;

    // Só definir groundLevel se realmente tiver gravidade
    if (this.hasGravity) {
      this.groundLevel = this.character.position.y;
    } else {
      // Para top-down, não usar groundLevel
      this.groundLevel = null;
    }

    // Configurar modo da câmera
    if (this.camera2D) {
      this.updateCameraMode();
    }

    console.log('[Character2DController] Enabled');
    console.log('[Character2DController] Settings:', {
      speed: this.moveSpeed,
      gravity: this.gravity,
      hasGravity: this.hasGravity,
      groundLevel: this.groundLevel,
      clickToMove: this.clickToMove,
      cameraMode: this.cameraMode
    });
  }

  /**
   * Desativa os controles
   */
  disable() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);

    if (this.domElement) {
      this.domElement.removeEventListener('mousedown', this.onMouseDown);
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

    // Reset click-to-move state
    this.clickTarget = null;
    this.isMovingToClick = false;

    console.log('[Character2DController] Disabled');
  }

  /**
   * Atualiza o modo da câmera (follow/free)
   */
  updateCameraMode() {
    if (!this.camera2D) return;

    // Definir modo na Camera2D
    this.camera2D.setCameraMode(this.cameraMode);

    if (this.cameraMode === 'follow') {
      // MU style: câmera segue o player
      this.camera2D.setFollowTarget(this.character);
      console.log('[Character2DController] Camera mode: FOLLOW (MU style)');
    } else {
      // Dota style: câmera livre
      this.camera2D.clearFollowTarget();
      console.log('[Character2DController] Camera mode: FREE (Dota style)');
    }
  }

  /**
   * Alterna modo da câmera
   */
  toggleCameraMode() {
    this.cameraMode = this.cameraMode === 'follow' ? 'free' : 'follow';
    this.updateCameraMode();
    return this.cameraMode;
  }

  /**
   * Define o modo da câmera
   */
  setCameraMode(mode) {
    this.cameraMode = mode;
    this.updateCameraMode();
  }

  /**
   * Handler de click do mouse para click-to-move
   */
  onMouseDown(event) {
    // Só processar click esquerdo
    if (event.button !== 0) return;

    // Ignorar se Shift estiver pressionado (pan da câmera)
    if (event.shiftKey) return;

    // Converter posição do mouse para posição do mundo
    if (!this.camera2D || !this.domElement) {
      console.warn('[Character2DController] No camera2D or domElement for click-to-move');
      return;
    }

    // Converter coordenadas da janela para coordenadas do canvas
    const rect = this.domElement.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    const worldPos = this.camera2D.screenToWorld(canvasX, canvasY);

    // Definir alvo do click
    this.clickTarget = new THREE.Vector2(worldPos.x, worldPos.y);
    this.isMovingToClick = true;

    console.log('[Character2DController] Click-to-move target:', worldPos.x.toFixed(2), worldPos.y.toFixed(2));
  }

  onKeyDown(event) {
    const code = event.code;
    const k = this.settings.keys;

    // Forward (Up/W)
    if (code === k.forward || code === k.forwardAlt) {
      this.keys.forward = true;
    }
    // Backward (Down/S)
    else if (code === k.backward || code === k.backwardAlt) {
      this.keys.backward = true;
    }
    // Left (A/ArrowLeft)
    else if (code === k.left || code === k.leftAlt) {
      this.keys.left = true;
    }
    // Right (D/ArrowRight)
    else if (code === k.right || code === k.rightAlt) {
      this.keys.right = true;
    }
    // Jump
    else if (code === k.jump) {
      if (this.isGrounded) {
        this.keys.jump = true;
      }
    }
    // Sprint
    else if (code === k.sprint || code === 'ShiftLeft' || code === 'ShiftRight') {
      this.keys.sprint = true;
    }
  }

  onKeyUp(event) {
    const code = event.code;
    const k = this.settings.keys;

    if (code === k.forward || code === k.forwardAlt) {
      this.keys.forward = false;
    }
    else if (code === k.backward || code === k.backwardAlt) {
      this.keys.backward = false;
    }
    else if (code === k.left || code === k.leftAlt) {
      this.keys.left = false;
    }
    else if (code === k.right || code === k.rightAlt) {
      this.keys.right = false;
    }
    else if (code === k.jump) {
      this.keys.jump = false;
    }
    else if (code === k.sprint || code === 'ShiftLeft' || code === 'ShiftRight') {
      this.keys.sprint = false;
    }
  }

  /**
   * Update chamado todo frame
   */
  update(deltaTime) {
    if (!this.character) return;

    // Click-to-move tem prioridade se ativo
    if (this.clickToMove && this.isMovingToClick) {
      this.updateClickToMove(deltaTime);
      return;
    }

    // Grid movement mode
    if (this.gridMovement) {
      this.updateGridMovement(deltaTime);
      return;
    }

    // Movimento contínuo (padrão)
    this.updateContinuousMovement(deltaTime);
  }

  /**
   * Movimento click-to-move (estilo Dota)
   */
  updateClickToMove(deltaTime) {
    if (!this.clickTarget) {
      this.isMovingToClick = false;
      return;
    }

    // Calcular direção para o alvo
    const dx = this.clickTarget.x - this.character.position.x;
    const dy = this.clickTarget.y - this.character.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Chegou no destino?
    if (distance <= this.clickStopDistance) {
      this.character.position.x = this.clickTarget.x;
      this.character.position.y = this.clickTarget.y;
      this.clickTarget = null;
      this.isMovingToClick = false;
      console.log('[Character2DController] Arrived at click target');
      return;
    }

    // Normalizar direção
    const dirX = dx / distance;
    const dirY = dy / distance;

    // Calcular velocidade
    let speed = this.moveSpeed;
    if (this.keys.sprint) {
      speed *= this.sprintMultiplier;
    }

    // Mover em direção ao alvo
    const moveDistance = speed * deltaTime;

    // Não ultrapassar o destino
    if (moveDistance >= distance) {
      this.character.position.x = this.clickTarget.x;
      this.character.position.y = this.clickTarget.y;
      this.clickTarget = null;
      this.isMovingToClick = false;
    } else {
      this.character.position.x += dirX * moveDistance;
      this.character.position.y += dirY * moveDistance;
    }
  }

  /**
   * Movimento em grid (tile a tile)
   */
  updateGridMovement(deltaTime) {
    // Se está em transição, continuar o movimento
    if (this.isMoving) {
      // Calcular velocidade da transição
      let speed = this.moveSpeed;
      if (this.keys.sprint) {
        speed *= this.sprintMultiplier;
      }

      // Progredir a transição
      this.moveProgress += (speed / this.tileSize) * deltaTime;

      if (this.moveProgress >= 1) {
        // Movimento completo - snap para posição final
        this.character.position.x = this.targetPosition.x;
        this.character.position.y = this.targetPosition.y;
        this.isMoving = false;
        this.moveProgress = 0;
      } else {
        // Interpolação suave
        const t = this.easeInOut(this.moveProgress);
        this.character.position.x = this.startPosition.x + (this.targetPosition.x - this.startPosition.x) * t;
        this.character.position.y = this.startPosition.y + (this.targetPosition.y - this.startPosition.y) * t;
      }
      return;
    }

    // Não está movendo - verificar input para novo movimento
    let moveX = 0;
    let moveY = 0;

    // Prioridade: último input pressionado (para não travar em diagonais)
    if (this.keys.right) moveX = 1;
    else if (this.keys.left) moveX = -1;

    if (this.keys.forward) moveY = 1;
    else if (this.keys.backward) moveY = -1;

    // Em grid mode, não permitir diagonal (ou permitir se quiser)
    // Por padrão, priorizar horizontal
    if (moveX !== 0 && moveY !== 0) {
      // Usar a última direção pressionada
      if (Math.abs(this.lastInputDirection.x) > 0) {
        moveY = 0;
      } else {
        moveX = 0;
      }
    }

    // Guardar última direção
    if (moveX !== 0) this.lastInputDirection = { x: moveX, y: 0 };
    if (moveY !== 0) this.lastInputDirection = { x: 0, y: moveY };

    // Iniciar novo movimento se tiver input
    if (moveX !== 0 || moveY !== 0) {
      this.startPosition.set(this.character.position.x, this.character.position.y);
      this.targetPosition.set(
        this.character.position.x + moveX * this.tileSize,
        this.character.position.y + moveY * this.tileSize
      );
      this.isMoving = true;
      this.moveProgress = 0;
    }
  }

  /**
   * Ease in-out para movimento suave
   */
  easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  /**
   * Movimento contínuo (padrão)
   */
  updateContinuousMovement(deltaTime) {
    // Calcular direção do movimento
    let moveX = 0;
    let moveY = 0;

    // Movimento horizontal (X)
    if (this.keys.right) moveX += 1;
    if (this.keys.left) moveX -= 1;

    // Movimento vertical (Y) - apenas se não tiver gravidade (top-down)
    if (!this.hasGravity) {
      if (this.keys.forward) moveY += 1;
      if (this.keys.backward) moveY -= 1;
    }

    // Normalizar diagonal
    if (moveX !== 0 && moveY !== 0) {
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= len;
      moveY /= len;
    }

    // Calcular velocidade
    let speed = this.moveSpeed;
    if (this.keys.sprint) {
      speed *= this.sprintMultiplier;
    }

    // Aplicar velocidade horizontal
    this.velocity.x = moveX * speed;

    // Movimento vertical depende do modo
    if (this.hasGravity) {
      // Platformer: pulo e gravidade
      if (this.keys.jump && this.isGrounded) {
        this.velocity.y = this.jumpForce;
        this.isGrounded = false;
        this.keys.jump = false;
      }

      // Gravidade
      if (!this.isGrounded) {
        this.velocity.y -= this.gravity * deltaTime;
      }
    } else {
      // Top-down: movimento livre em Y
      this.velocity.y = moveY * speed;
    }

    // Aplicar movimento apenas se houver velocidade
    if (this.velocity.x !== 0 || this.velocity.y !== 0) {
      this.character.position.x += this.velocity.x * deltaTime;
      this.character.position.y += this.velocity.y * deltaTime;
    }

    // Colisão com o chão (apenas platformer com gravidade)
    if (this.hasGravity && this.groundLevel !== null) {
      if (this.character.position.y <= this.groundLevel) {
        this.character.position.y = this.groundLevel;
        this.velocity.y = 0;
        this.isGrounded = true;
      }
    }
  }

  /**
   * Define a posição do personagem
   */
  setPosition(x, y) {
    this.character.position.x = x;
    this.character.position.y = y;
    if (this.hasGravity) {
      this.groundLevel = y;
    }
  }

  /**
   * Retorna a posição atual
   */
  getPosition() {
    return { x: this.character.position.x, y: this.character.position.y };
  }
}
