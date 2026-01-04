import * as THREE from 'three';

/**
 * Camera2D - Câmera ortográfica para jogos 2D
 *
 * Features:
 * - Projeção ortográfica (sem perspectiva)
 * - Zoom com scroll
 * - Pan com drag
 * - Follow target (seguir objeto)
 * - Bounds (limites do mundo)
 */
export default class Camera2D {
  constructor(options = {}) {
    const {
      width = window.innerWidth,
      height = window.innerHeight,
      zoom = 1,
      near = 0.1,
      far = 1000,
      backgroundColor = 0x1e1e1e
    } = options;

    this.width = width;
    this.height = height;
    this.zoom = zoom;
    this.targetZoom = zoom;
    this.zoomSpeed = 0.1;
    this.minZoom = 0.1;
    this.maxZoom = 10;

    // Calcular aspect ratio
    const aspect = width / height;
    const viewSize = 5; // Unidades visíveis verticalmente

    // Criar câmera ortográfica
    this.camera = new THREE.OrthographicCamera(
      -viewSize * aspect,  // left
      viewSize * aspect,   // right
      viewSize,            // top
      -viewSize,           // bottom
      near,
      far
    );

    // Posição inicial (olhando para baixo no eixo Z)
    this.camera.position.set(0, 0, 100);
    this.camera.lookAt(0, 0, 0);

    // Estado do controle
    this.position = new THREE.Vector2(0, 0);
    this.targetPosition = new THREE.Vector2(0, 0);

    // Follow
    this.followTarget = null;
    this.followSmoothing = 5; // Velocidade do follow
    this.followOffset = new THREE.Vector2(0, 0);

    // Bounds (limites do mundo)
    this.bounds = null; // { minX, maxX, minY, maxY }

    // Pan com drag
    this.isPanning = false;
    this.panStart = new THREE.Vector2();
    this.panDelta = new THREE.Vector2();

    // Background color
    this.backgroundColor = backgroundColor;

    // Bind handlers
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  /**
   * Ativa os controles da câmera
   */
  enable(domElement) {
    this.domElement = domElement;
    domElement.addEventListener('mousedown', this.onMouseDown);
    domElement.addEventListener('mousemove', this.onMouseMove);
    domElement.addEventListener('mouseup', this.onMouseUp);
    domElement.addEventListener('mouseleave', this.onMouseUp);
    domElement.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('resize', this.onResize);
  }

  /**
   * Desativa os controles
   */
  disable() {
    if (this.domElement) {
      this.domElement.removeEventListener('mousedown', this.onMouseDown);
      this.domElement.removeEventListener('mousemove', this.onMouseMove);
      this.domElement.removeEventListener('mouseup', this.onMouseUp);
      this.domElement.removeEventListener('mouseleave', this.onMouseUp);
      this.domElement.removeEventListener('wheel', this.onWheel);
    }
    window.removeEventListener('resize', this.onResize);
  }

  /**
   * Define objeto para seguir
   */
  setFollowTarget(target, offset = { x: 0, y: 0 }) {
    this.followTarget = target;
    this.followOffset.set(offset.x, offset.y);
  }

  /**
   * Remove follow target
   */
  clearFollowTarget() {
    this.followTarget = null;
  }

  /**
   * Define limites do mundo
   */
  setBounds(minX, maxX, minY, maxY) {
    this.bounds = { minX, maxX, minY, maxY };
  }

  /**
   * Remove limites
   */
  clearBounds() {
    this.bounds = null;
  }

  /**
   * Mouse down - início do pan
   */
  onMouseDown(event) {
    if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
      // Middle click ou Shift+Left click para pan
      this.isPanning = true;
      this.panStart.set(event.clientX, event.clientY);
      event.preventDefault();
    }
  }

  /**
   * Mouse move - pan
   */
  onMouseMove(event) {
    if (this.isPanning) {
      this.panDelta.set(
        event.clientX - this.panStart.x,
        event.clientY - this.panStart.y
      );

      // Converter pixels para unidades do mundo
      const worldDelta = this.screenToWorldDelta(this.panDelta.x, this.panDelta.y);

      this.position.x -= worldDelta.x;
      this.position.y += worldDelta.y; // Invertido porque Y da tela é invertido

      this.panStart.set(event.clientX, event.clientY);
    }
  }

  /**
   * Mouse up - fim do pan
   */
  onMouseUp() {
    this.isPanning = false;
  }

  /**
   * Wheel - zoom
   */
  onWheel(event) {
    event.preventDefault();

    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoom * zoomFactor));
  }

  /**
   * Resize handler
   */
  onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.updateProjection();
  }

  /**
   * Atualiza a projeção da câmera
   */
  updateProjection() {
    const aspect = this.width / this.height;
    const viewSize = 5 / this.zoom;

    this.camera.left = -viewSize * aspect;
    this.camera.right = viewSize * aspect;
    this.camera.top = viewSize;
    this.camera.bottom = -viewSize;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Converte delta de pixels para delta do mundo
   */
  screenToWorldDelta(dx, dy) {
    const aspect = this.width / this.height;
    const viewSize = 5 / this.zoom;

    return {
      x: (dx / this.width) * viewSize * 2 * aspect,
      y: (dy / this.height) * viewSize * 2
    };
  }

  /**
   * Converte posição da tela para posição do mundo
   */
  screenToWorld(screenX, screenY) {
    const aspect = this.width / this.height;
    const viewSize = 5 / this.zoom;

    // Normalizar coordenadas (-1 a 1)
    const nx = (screenX / this.width) * 2 - 1;
    const ny = -(screenY / this.height) * 2 + 1;

    return {
      x: this.position.x + nx * viewSize * aspect,
      y: this.position.y + ny * viewSize
    };
  }

  /**
   * Converte posição do mundo para posição da tela
   */
  worldToScreen(worldX, worldY) {
    const aspect = this.width / this.height;
    const viewSize = 5 / this.zoom;

    const nx = (worldX - this.position.x) / (viewSize * aspect);
    const ny = (worldY - this.position.y) / viewSize;

    return {
      x: (nx + 1) * 0.5 * this.width,
      y: (1 - ny) * 0.5 * this.height
    };
  }

  /**
   * Move para posição específica
   */
  moveTo(x, y, instant = false) {
    this.targetPosition.set(x, y);
    if (instant) {
      this.position.copy(this.targetPosition);
    }
  }

  /**
   * Define zoom
   */
  setZoom(zoom, instant = false) {
    this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    if (instant) {
      this.zoom = this.targetZoom;
      this.updateProjection();
    }
  }

  /**
   * Update chamado todo frame
   */
  update(deltaTime) {
    // Suavizar zoom
    if (Math.abs(this.zoom - this.targetZoom) > 0.001) {
      this.zoom += (this.targetZoom - this.zoom) * this.zoomSpeed;
      this.updateProjection();
    }

    // Follow target
    if (this.followTarget) {
      const targetPos = this.followTarget.position || this.followTarget;
      this.targetPosition.set(
        targetPos.x + this.followOffset.x,
        targetPos.y + this.followOffset.y
      );
    }

    // Suavizar movimento
    if (!this.isPanning) {
      this.position.x += (this.targetPosition.x - this.position.x) * deltaTime * this.followSmoothing;
      this.position.y += (this.targetPosition.y - this.position.y) * deltaTime * this.followSmoothing;
    }

    // Aplicar bounds
    if (this.bounds) {
      const aspect = this.width / this.height;
      const viewSize = 5 / this.zoom;
      const halfWidth = viewSize * aspect;
      const halfHeight = viewSize;

      this.position.x = Math.max(this.bounds.minX + halfWidth,
                        Math.min(this.bounds.maxX - halfWidth, this.position.x));
      this.position.y = Math.max(this.bounds.minY + halfHeight,
                        Math.min(this.bounds.maxY - halfHeight, this.position.y));
    }

    // Atualizar posição da câmera
    this.camera.position.x = this.position.x;
    this.camera.position.y = this.position.y;
  }

  /**
   * Retorna a câmera Three.js
   */
  getCamera() {
    return this.camera;
  }

  /**
   * Retorna zoom atual
   */
  getZoom() {
    return this.zoom;
  }

  /**
   * Retorna posição atual
   */
  getPosition() {
    return { x: this.position.x, y: this.position.y };
  }
}
