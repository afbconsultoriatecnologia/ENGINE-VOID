import * as THREE from 'three';

/**
 * ThirdPersonCamera - Câmera terceira pessoa com controles
 *
 * Controles:
 * - Right Mouse Drag = Rotacionar câmera ao redor do player
 * - Scroll = Zoom (pode ir até primeira pessoa)
 * - Home = Reset para configuração default
 */
export default class ThirdPersonCamera {
  constructor(camera, target, domElement) {
    this.camera = camera;
    this.target = target;
    this.domElement = domElement;

    // Ler configurações do player (são os DEFAULTS)
    const settings = target.userData?.cameraSettings || {
      height: 15,
      distance: 20,
      angle: 45,
      fov: 60
    };

    // Guardar defaults para reset
    this.defaults = {
      height: settings.height,
      distance: settings.distance,
      angle: settings.angle,
      fov: settings.fov
    };

    // Valores atuais (podem ser alterados pelo usuário)
    this.height = settings.height;
    this.distance = settings.distance;
    this.angle = settings.angle;
    this.fov = settings.fov;

    // Pitch (ângulo vertical) - calculado baseado em height/distance
    this.pitch = Math.atan2(this.height, this.distance) * (180 / Math.PI);
    this.defaults.pitch = this.pitch;

    // Limites
    this.minDistance = 1;      // Permite chegar perto para transição
    this.maxDistance = 50;
    this.firstPersonThreshold = 10; // Abaixo disso = primeira pessoa
    this.minPitch = 5;         // Não pode olhar de baixo
    this.maxPitch = 89;        // Não pode olhar de cima 90°

    // Altura dos olhos do player para primeira pessoa
    this.eyeHeight = 1.7;

    // Suavização do movimento da câmera
    this.smoothSpeed = 8; // Velocidade de interpolação (menor = mais suave)
    this.targetPosition = new THREE.Vector3();
    this.targetLookAt = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3(); // Para interpolação suave do lookAt

    // Distância alvo para zoom suave
    this.targetDistance = this.distance;

    // Estado do mouse
    this.isRotating = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.rotationSpeed = 0.3;

    // Bind handlers
    this.onWheel = this.onWheel.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);

    // Touch handlers
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);

    // Touch state
    this.touchStartDistance = 0;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.isTouchRotating = false;
    this.isTouchZooming = false;
  }

  enable() {
    this.domElement.addEventListener('contextmenu', this.onContextMenu);
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });
    this.domElement.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('keydown', this.onKeyDown);

    // Touch events
    this.domElement.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.domElement.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.domElement.addEventListener('touchend', this.onTouchEnd);

    // Aplicar FOV
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();

    // Calcular e aplicar posição inicial diretamente (sem interpolação)
    this.calculateTargetPosition();
    this.camera.position.copy(this.targetPosition);
    this.currentLookAt.copy(this.targetLookAt); // Inicializar lookAt interpolado
    this.camera.lookAt(this.targetLookAt);

    console.log('[ThirdPersonCamera] Enabled - Middle/Right drag to rotate, Scroll to zoom, Touch: 1 finger rotate, 2 fingers zoom, Home to reset');
  }

  disable() {
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
    this.domElement.removeEventListener('wheel', this.onWheel);
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('keydown', this.onKeyDown);

    // Touch events
    this.domElement.removeEventListener('touchstart', this.onTouchStart);
    this.domElement.removeEventListener('touchmove', this.onTouchMove);
    this.domElement.removeEventListener('touchend', this.onTouchEnd);

    this.isRotating = false;
    this.isTouchRotating = false;
    this.isTouchZooming = false;
  }

  onContextMenu(e) {
    e.preventDefault();
  }

  onMouseDown(e) {
    // Right click (2) ou Middle click (1) = rotacionar (Blender style)
    if (e.button === 2 || e.button === 1) {
      this.isRotating = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      e.preventDefault();
    }
  }

  onMouseMove(e) {
    if (!this.isRotating) return;

    const deltaX = e.clientX - this.lastMouseX;
    const deltaY = e.clientY - this.lastMouseY;

    // Rotação horizontal (angle)
    this.angle -= deltaX * this.rotationSpeed;
    // Normalizar para 0-360
    while (this.angle < 0) this.angle += 360;
    while (this.angle >= 360) this.angle -= 360;

    // Rotação vertical (pitch)
    this.pitch += deltaY * this.rotationSpeed;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));

    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }

  onMouseUp(e) {
    // Right click (2) ou Middle click (1)
    if (e.button === 2 || e.button === 1) {
      this.isRotating = false;
    }
  }

  onKeyDown(e) {
    // Home = Reset para defaults
    if (e.code === 'Home') {
      this.resetToDefaults();
      e.preventDefault();
    }
  }

  onWheel(e) {
    e.preventDefault();
    e.stopPropagation(); // Impede que outros handlers capturem o evento

    // Zoom = alterar distância alvo (será interpolado no update)
    const zoomSpeed = 0.08;
    const zoomDelta = e.deltaY * zoomSpeed;

    this.targetDistance += zoomDelta;
    this.targetDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.targetDistance));
  }

  // ========== TOUCH HANDLERS ==========

  /**
   * Calcula distância entre dois toques
   */
  getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  onTouchStart(e) {
    e.preventDefault();

    if (e.touches.length === 1) {
      // 1 dedo = rotacionar
      this.isTouchRotating = true;
      this.isTouchZooming = false;
      this.lastTouchX = e.touches[0].clientX;
      this.lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      // 2 dedos = zoom (pinça)
      this.isTouchRotating = false;
      this.isTouchZooming = true;
      this.touchStartDistance = this.getTouchDistance(e.touches);
    }
  }

  onTouchMove(e) {
    e.preventDefault();

    if (this.isTouchRotating && e.touches.length === 1) {
      // Rotação com 1 dedo
      const deltaX = e.touches[0].clientX - this.lastTouchX;
      const deltaY = e.touches[0].clientY - this.lastTouchY;

      // Rotação horizontal (angle)
      this.angle -= deltaX * this.rotationSpeed;
      while (this.angle < 0) this.angle += 360;
      while (this.angle >= 360) this.angle -= 360;

      // Rotação vertical (pitch)
      this.pitch += deltaY * this.rotationSpeed;
      this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));

      this.lastTouchX = e.touches[0].clientX;
      this.lastTouchY = e.touches[0].clientY;
    } else if (this.isTouchZooming && e.touches.length === 2) {
      // Zoom com pinça
      const currentDistance = this.getTouchDistance(e.touches);
      const delta = this.touchStartDistance - currentDistance;

      // Aplicar zoom
      const zoomSpeed = 0.05;
      this.targetDistance += delta * zoomSpeed;
      this.targetDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.targetDistance));

      this.touchStartDistance = currentDistance;
    }
  }

  onTouchEnd(e) {
    if (e.touches.length === 0) {
      this.isTouchRotating = false;
      this.isTouchZooming = false;
    } else if (e.touches.length === 1) {
      // Voltou para 1 dedo, mudar para rotação
      this.isTouchRotating = true;
      this.isTouchZooming = false;
      this.lastTouchX = e.touches[0].clientX;
      this.lastTouchY = e.touches[0].clientY;
    }
  }

  /**
   * Reset para configurações default
   */
  resetToDefaults() {
    this.height = this.defaults.height;
    this.distance = this.defaults.distance;
    this.targetDistance = this.defaults.distance; // Reset zoom alvo também
    this.angle = this.defaults.angle;
    this.pitch = this.defaults.pitch;
    this.fov = this.defaults.fov;

    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();

    console.log('[ThirdPersonCamera] Reset to defaults');
  }

  /**
   * Calcula a posição alvo da câmera (sem aplicar diretamente)
   */
  calculateTargetPosition() {
    if (!this.target) return;

    const playerPos = this.target.position;
    const angleRad = (this.angle * Math.PI) / 180;

    // Calcular fator de transição (0 = primeira pessoa, 1 = isométrico completo)
    const transitionFactor = Math.min(1, Math.max(0, (this.distance - this.minDistance) / (this.firstPersonThreshold - this.minDistance)));

    if (this.distance <= this.minDistance + 0.5) {
      // === PRIMEIRA PESSOA ===
      this.targetPosition.set(
        playerPos.x,
        playerPos.y + this.eyeHeight,
        playerPos.z
      );

      const lookDistance = 10;
      this.targetLookAt.set(
        playerPos.x - Math.sin(angleRad) * lookDistance,
        playerPos.y + this.eyeHeight,
        playerPos.z - Math.cos(angleRad) * lookDistance
      );
    } else if (transitionFactor < 1) {
      // === TRANSIÇÃO ===
      const pitchRad = (this.pitch * Math.PI) / 180;
      const horizontalDistance = this.distance * Math.cos(pitchRad);
      const verticalDistance = this.distance * Math.sin(pitchRad);

      const isoOffsetY = verticalDistance + 1;
      const offsetY = this.eyeHeight + (isoOffsetY - this.eyeHeight) * transitionFactor;
      const offsetX = horizontalDistance * Math.sin(angleRad) * transitionFactor;
      const offsetZ = horizontalDistance * Math.cos(angleRad) * transitionFactor;

      this.targetPosition.set(
        playerPos.x + offsetX,
        playerPos.y + offsetY,
        playerPos.z + offsetZ
      );

      const lookY = (playerPos.y + 1) * transitionFactor + (playerPos.y + this.eyeHeight) * (1 - transitionFactor);
      this.targetLookAt.set(playerPos.x, lookY, playerPos.z);
    } else {
      // === ISOMÉTRICO COMPLETO ===
      const pitchRad = (this.pitch * Math.PI) / 180;
      const horizontalDistance = this.distance * Math.cos(pitchRad);
      const verticalDistance = this.distance * Math.sin(pitchRad);

      const offsetX = horizontalDistance * Math.sin(angleRad);
      const offsetY = verticalDistance + 1;
      const offsetZ = horizontalDistance * Math.cos(angleRad);

      this.targetPosition.set(
        playerPos.x + offsetX,
        playerPos.y + offsetY,
        playerPos.z + offsetZ
      );

      this.targetLookAt.set(playerPos.x, playerPos.y + 1, playerPos.z);
    }
  }

  update(deltaTime) {
    if (!this.target) return;

    // Fator de interpolação suave (exponential smoothing)
    const lerpFactor = 1 - Math.exp(-this.smoothSpeed * deltaTime);

    // Interpolar distância suavemente (zoom suave)
    const distanceDiff = this.targetDistance - this.distance;
    if (Math.abs(distanceDiff) > 0.001) {
      this.distance += distanceDiff * lerpFactor;
    } else {
      this.distance = this.targetDistance;
    }

    // Calcular posição alvo com distância interpolada
    this.calculateTargetPosition();

    // Verificar se precisa interpolar posição (evita micro-tremores)
    const posDiff = this.camera.position.distanceTo(this.targetPosition);
    if (posDiff > 0.001) {
      this.camera.position.lerp(this.targetPosition, lerpFactor);
    } else {
      this.camera.position.copy(this.targetPosition);
    }

    // Verificar se precisa interpolar lookAt
    const lookDiff = this.currentLookAt.distanceTo(this.targetLookAt);
    if (lookDiff > 0.001) {
      this.currentLookAt.lerp(this.targetLookAt, lerpFactor);
    } else {
      this.currentLookAt.copy(this.targetLookAt);
    }

    // Aplicar lookAt com valor interpolado
    this.camera.lookAt(this.currentLookAt);
  }

  // Direção "para frente" baseada no ângulo atual da câmera
  getForwardDirection() {
    const angleRad = (this.angle * Math.PI) / 180;
    return new THREE.Vector3(-Math.sin(angleRad), 0, -Math.cos(angleRad)).normalize();
  }

  // Direção "para direita" baseada no ângulo atual da câmera
  getRightDirection() {
    const angleRad = (this.angle * Math.PI) / 180;
    return new THREE.Vector3(Math.cos(angleRad), 0, -Math.sin(angleRad)).normalize();
  }

  /**
   * Verifica se está em modo primeira pessoa
   */
  isFirstPerson() {
    return this.distance < this.firstPersonThreshold;
  }

  /**
   * Retorna a distância atual
   */
  getDistance() {
    return this.distance;
  }
}
