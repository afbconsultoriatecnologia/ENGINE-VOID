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
 * ClickToMoveController - Controle estilo Diablo/PoE
 * Clique no chão para mover o personagem
 */
export default class ClickToMoveController {
  constructor(character, camera, scene, domElement, controlSettings = null) {
    this.character = character;
    this.camera = camera;
    this.scene = scene;
    this.domElement = domElement;

    // Mesclar settings customizados com defaults
    const defaults = getDefaultControlSettings();
    const custom = controlSettings || character?.userData?.controlSettings || {};
    this.settings = {
      movement: { ...defaults.movement, ...custom.movement },
      keys: { ...defaults.keys, ...custom.keys },
      mouse: { ...defaults.mouse, ...custom.mouse }
    };

    // Configurações (do settings)
    this.moveSpeed = this.settings.movement.speed;
    this.rotationSpeed = this.settings.movement.rotationSpeed;
    this.stoppingDistance = 0.2;

    // Estado
    this.targetPosition = null;
    this.isMoving = false;

    // Raycaster
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Plano virtual do chão para projeção precisa
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Plano Y=0

    // Indicador visual
    this.targetIndicator = this.createIndicator();

    // Bind
    this.onClick = this.onClick.bind(this);
    this.onContextMenu = (e) => e.preventDefault();
  }

  createIndicator() {
    const geometry = new THREE.RingGeometry(0.2, 0.4, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const indicator = new THREE.Mesh(geometry, material);
    indicator.rotation.x = -Math.PI / 2;
    indicator.visible = false;
    indicator.renderOrder = 999;
    this.scene.add(indicator);
    return indicator;
  }

  enable() {
    this.domElement.addEventListener('click', this.onClick);
    this.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  disable() {
    this.domElement.removeEventListener('click', this.onClick);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);

    // Remover indicador
    if (this.targetIndicator) {
      this.scene.remove(this.targetIndicator);
      this.targetIndicator.geometry.dispose();
      this.targetIndicator.material.dispose();
    }
  }

  onClick(e) {
    // Converter mouse para coordenadas normalizadas
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Criar raio da câmera
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Projetar no plano do chão (Y=0) - MÉTODO PRECISO
    const intersectPoint = new THREE.Vector3();
    const ray = this.raycaster.ray;

    if (ray.intersectPlane(this.groundPlane, intersectPoint)) {
      // Definir destino no plano do chão
      this.targetPosition = new THREE.Vector3(
        intersectPoint.x,
        this.character.position.y,
        intersectPoint.z
      );
      this.isMoving = true;

      // Mostrar indicador no chão
      this.targetIndicator.position.set(intersectPoint.x, 0.02, intersectPoint.z);
      this.targetIndicator.visible = true;
    }
  }

  update(deltaTime) {
    if (!this.isMoving || !this.targetPosition) return;

    const pos = this.character.position;
    const target = this.targetPosition;

    // Direção
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    // Chegou?
    if (distance < this.stoppingDistance) {
      this.isMoving = false;
      this.targetIndicator.visible = false;
      return;
    }

    // Normalizar direção
    const dirX = dx / distance;
    const dirZ = dz / distance;

    // Rotacionar personagem
    const targetAngle = Math.atan2(dirX, dirZ);
    let angleDiff = targetAngle - this.character.rotation.y;

    // Normalizar
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    this.character.rotation.y += angleDiff * this.rotationSpeed * deltaTime;

    // Mover
    const step = this.moveSpeed * deltaTime;
    this.character.position.x += dirX * step;
    this.character.position.z += dirZ * step;
  }
}
