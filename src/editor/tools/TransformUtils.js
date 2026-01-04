import * as THREE from 'three';

/**
 * Utilitários para transformações de objetos
 * Funções para bounds, centros, alinhamento, distribuição, etc.
 */

/**
 * Calcula o bounding box de um objeto no espaço mundial
 * @param {THREE.Object3D} object
 * @returns {THREE.Box3}
 */
export function getWorldBounds(object) {
  const box = new THREE.Box3();
  box.setFromObject(object);
  return box;
}

/**
 * Calcula o bounding box de múltiplos objetos
 * @param {THREE.Object3D[]} objects
 * @returns {THREE.Box3}
 */
export function getCombinedBounds(objects) {
  const box = new THREE.Box3();
  objects.forEach(obj => {
    box.expandByObject(obj);
  });
  return box;
}

/**
 * Obtém o centro de um objeto no espaço mundial
 * @param {THREE.Object3D} object
 * @returns {THREE.Vector3}
 */
export function getWorldCenter(object) {
  const box = getWorldBounds(object);
  return box.getCenter(new THREE.Vector3());
}

/**
 * Obtém o centro de múltiplos objetos
 * @param {THREE.Object3D[]} objects
 * @returns {THREE.Vector3}
 */
export function getCombinedCenter(objects) {
  const box = getCombinedBounds(objects);
  return box.getCenter(new THREE.Vector3());
}

/**
 * Obtém o tamanho de um objeto
 * @param {THREE.Object3D} object
 * @returns {THREE.Vector3}
 */
export function getSize(object) {
  const box = getWorldBounds(object);
  return box.getSize(new THREE.Vector3());
}

/**
 * Alinha objetos em um eixo
 * @param {THREE.Object3D[]} objects - Objetos a alinhar
 * @param {'x'|'y'|'z'} axis - Eixo de alinhamento
 * @param {'min'|'center'|'max'} type - Tipo de alinhamento
 * @param {THREE.Object3D} reference - Objeto de referência (opcional, usa primeiro se não fornecido)
 * @returns {Map<THREE.Object3D, THREE.Vector3>} Posições originais para undo
 */
export function alignObjects(objects, axis, type, reference = null) {
  if (objects.length < 2) return new Map();

  const originalPositions = new Map();
  objects.forEach(obj => {
    originalPositions.set(obj, obj.position.clone());
  });

  // Usar primeiro objeto ou referência como base
  const refObject = reference || objects[0];
  const refBounds = getWorldBounds(refObject);

  let targetValue;
  switch (type) {
    case 'min':
      targetValue = refBounds.min[axis];
      break;
    case 'max':
      targetValue = refBounds.max[axis];
      break;
    case 'center':
    default:
      targetValue = (refBounds.min[axis] + refBounds.max[axis]) / 2;
      break;
  }

  // Alinhar cada objeto
  objects.forEach(obj => {
    if (obj === refObject) return;

    const objBounds = getWorldBounds(obj);
    let objValue;

    switch (type) {
      case 'min':
        objValue = objBounds.min[axis];
        break;
      case 'max':
        objValue = objBounds.max[axis];
        break;
      case 'center':
      default:
        objValue = (objBounds.min[axis] + objBounds.max[axis]) / 2;
        break;
    }

    const offset = targetValue - objValue;
    obj.position[axis] += offset;
  });

  return originalPositions;
}

/**
 * Distribui objetos uniformemente em um eixo
 * @param {THREE.Object3D[]} objects - Objetos a distribuir
 * @param {'x'|'y'|'z'} axis - Eixo de distribuição
 * @param {number} spacing - Espaçamento (0 = automático baseado em bounds)
 * @returns {Map<THREE.Object3D, THREE.Vector3>} Posições originais para undo
 */
export function distributeObjects(objects, axis, spacing = 0) {
  if (objects.length < 3) return new Map();

  const originalPositions = new Map();
  objects.forEach(obj => {
    originalPositions.set(obj, obj.position.clone());
  });

  // Ordenar objetos pela posição no eixo
  const sorted = [...objects].sort((a, b) => {
    const aCenter = getWorldCenter(a);
    const bCenter = getWorldCenter(b);
    return aCenter[axis] - bCenter[axis];
  });

  // Primeiro e último ficam fixos
  const firstCenter = getWorldCenter(sorted[0]);
  const lastCenter = getWorldCenter(sorted[sorted.length - 1]);

  if (spacing === 0) {
    // Distribuição automática (espaçamento igual)
    const totalDistance = lastCenter[axis] - firstCenter[axis];
    const step = totalDistance / (sorted.length - 1);

    sorted.forEach((obj, index) => {
      if (index === 0 || index === sorted.length - 1) return;

      const currentCenter = getWorldCenter(obj);
      const targetValue = firstCenter[axis] + step * index;
      const offset = targetValue - currentCenter[axis];
      obj.position[axis] += offset;
    });
  } else {
    // Espaçamento fixo
    sorted.forEach((obj, index) => {
      if (index === 0) return;

      const prevObj = sorted[index - 1];
      const prevBounds = getWorldBounds(prevObj);
      const objBounds = getWorldBounds(obj);

      const targetMin = prevBounds.max[axis] + spacing;
      const currentMin = objBounds.min[axis];
      const offset = targetMin - currentMin;
      obj.position[axis] += offset;
    });
  }

  return originalPositions;
}

/**
 * Reseta transform de um objeto para valores padrão
 * @param {THREE.Object3D} object
 * @param {Object} options - { position: true, rotation: true, scale: true }
 * @returns {{ position: THREE.Vector3, rotation: THREE.Euler, scale: THREE.Vector3 }} Valores originais
 */
export function resetTransform(object, options = {}) {
  const {
    position = true,
    rotation = true,
    scale = true,
    targetPosition = new THREE.Vector3(0, 0, 0),
    targetRotation = new THREE.Euler(0, 0, 0),
    targetScale = new THREE.Vector3(1, 1, 1)
  } = options;

  const original = {
    position: object.position.clone(),
    rotation: object.rotation.clone(),
    scale: object.scale.clone()
  };

  if (position) object.position.copy(targetPosition);
  if (rotation) object.rotation.copy(targetRotation);
  if (scale) object.scale.copy(targetScale);

  return original;
}

/**
 * Reseta apenas um eixo específico
 * @param {THREE.Object3D} object
 * @param {'position'|'rotation'|'scale'} property
 * @param {'x'|'y'|'z'} axis
 * @returns {number} Valor original
 */
export function resetAxis(object, property, axis) {
  const original = object[property][axis];

  switch (property) {
    case 'position':
      object.position[axis] = 0;
      break;
    case 'rotation':
      object.rotation[axis] = 0;
      break;
    case 'scale':
      object.scale[axis] = 1;
      break;
  }

  return original;
}

/**
 * Copia transform de um objeto
 * @param {THREE.Object3D} source
 * @returns {{ position: THREE.Vector3, rotation: THREE.Euler, scale: THREE.Vector3 }}
 */
export function copyTransform(source) {
  return {
    position: source.position.clone(),
    rotation: source.rotation.clone(),
    scale: source.scale.clone()
  };
}

/**
 * Cola transform em um objeto
 * @param {THREE.Object3D} target
 * @param {{ position?: THREE.Vector3, rotation?: THREE.Euler, scale?: THREE.Vector3 }} transform
 * @param {Object} options - { position: true, rotation: true, scale: true }
 * @returns {{ position: THREE.Vector3, rotation: THREE.Euler, scale: THREE.Vector3 }} Valores originais
 */
export function pasteTransform(target, transform, options = {}) {
  const {
    position = true,
    rotation = true,
    scale = true
  } = options;

  const original = copyTransform(target);

  if (position && transform.position) target.position.copy(transform.position);
  if (rotation && transform.rotation) target.rotation.copy(transform.rotation);
  if (scale && transform.scale) target.scale.copy(transform.scale);

  return original;
}

/**
 * Converte posição de espaço local para mundial
 * @param {THREE.Object3D} object
 * @param {THREE.Vector3} localPosition
 * @returns {THREE.Vector3}
 */
export function localToWorld(object, localPosition) {
  return object.localToWorld(localPosition.clone());
}

/**
 * Converte posição de espaço mundial para local
 * @param {THREE.Object3D} object
 * @param {THREE.Vector3} worldPosition
 * @returns {THREE.Vector3}
 */
export function worldToLocal(object, worldPosition) {
  return object.worldToLocal(worldPosition.clone());
}

/**
 * Snapa posição para grid
 * @param {THREE.Vector3} position
 * @param {number} gridSize
 * @returns {THREE.Vector3}
 */
export function snapToGrid(position, gridSize = 1) {
  return new THREE.Vector3(
    Math.round(position.x / gridSize) * gridSize,
    Math.round(position.y / gridSize) * gridSize,
    Math.round(position.z / gridSize) * gridSize
  );
}

/**
 * Snapa rotação para ângulos específicos
 * @param {THREE.Euler} rotation
 * @param {number} snapAngle - Em graus
 * @returns {THREE.Euler}
 */
export function snapRotation(rotation, snapAngle = 15) {
  const snapRad = THREE.MathUtils.degToRad(snapAngle);
  return new THREE.Euler(
    Math.round(rotation.x / snapRad) * snapRad,
    Math.round(rotation.y / snapRad) * snapRad,
    Math.round(rotation.z / snapRad) * snapRad
  );
}

/**
 * Move objeto para o centro do grid (0,0,0) mantendo Y
 * @param {THREE.Object3D} object
 * @returns {THREE.Vector3} Posição original
 */
export function centerToOrigin(object) {
  const original = object.position.clone();
  object.position.x = 0;
  object.position.z = 0;
  return original;
}

/**
 * Move objeto para apoiar no chão (Y = 0)
 * @param {THREE.Object3D} object
 * @returns {number} Y original
 */
export function snapToFloor(object) {
  const original = object.position.y;
  const bounds = getWorldBounds(object);
  const offset = bounds.min.y;
  object.position.y -= offset;
  return original;
}
