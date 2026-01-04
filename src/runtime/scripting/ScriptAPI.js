import * as THREE from 'three';

/**
 * ScriptAPI - API exposta aos scripts via objeto 'engine'
 * Fornece acesso controlado ao objeto, cena, input e tempo
 */
export default class ScriptAPI {
  constructor(threeObject, scene, inputManager, timeManager) {
    this._object = threeObject;
    this._scene = scene;
    this._input = inputManager;
    this._time = timeManager;

    // Cache para performance
    this._tempVector = new THREE.Vector3();
    this._tempQuaternion = new THREE.Quaternion();
    this._tempEuler = new THREE.Euler();
  }

  // ==================== OBJECT INFO ====================

  /**
   * Nome do objeto
   */
  get name() {
    return this._object.name;
  }

  set name(value) {
    this._object.name = value;
  }

  /**
   * Objeto visível?
   */
  get visible() {
    return this._object.visible;
  }

  set visible(value) {
    this._object.visible = value;
  }

  /**
   * Dados customizados do usuário
   */
  get userData() {
    return this._object.userData;
  }

  /**
   * Tag do objeto (para findByTag)
   */
  get tag() {
    return this._object.userData.tag || '';
  }

  set tag(value) {
    this._object.userData.tag = value;
  }

  // ==================== TRANSFORM ====================

  /**
   * Transform API - acesso à posição, rotação e escala
   */
  get transform() {
    const obj = this._object;
    const self = this;

    return {
      // Posição
      get position() {
        return obj.position;
      },
      set position(value) {
        if (value.isVector3) {
          obj.position.copy(value);
        } else if (typeof value === 'object') {
          obj.position.set(value.x || 0, value.y || 0, value.z || 0);
        }
      },

      // Rotação (em radianos como Euler)
      get rotation() {
        return obj.rotation;
      },
      set rotation(value) {
        if (value.isEuler) {
          obj.rotation.copy(value);
        } else if (typeof value === 'object') {
          obj.rotation.set(value.x || 0, value.y || 0, value.z || 0);
        }
      },

      // Rotação em graus (conveniência)
      get eulerAngles() {
        const deg = THREE.MathUtils.radToDeg;
        return new THREE.Vector3(
          deg(obj.rotation.x),
          deg(obj.rotation.y),
          deg(obj.rotation.z)
        );
      },
      set eulerAngles(value) {
        const rad = THREE.MathUtils.degToRad;
        obj.rotation.set(
          rad(value.x || 0),
          rad(value.y || 0),
          rad(value.z || 0)
        );
      },

      // Quaternion
      get quaternion() {
        return obj.quaternion;
      },
      set quaternion(value) {
        if (value.isQuaternion) {
          obj.quaternion.copy(value);
        }
      },

      // Escala
      get scale() {
        return obj.scale;
      },
      set scale(value) {
        if (value.isVector3) {
          obj.scale.copy(value);
        } else if (typeof value === 'number') {
          obj.scale.setScalar(value);
        } else if (typeof value === 'object') {
          obj.scale.set(value.x || 1, value.y || 1, value.z || 1);
        }
      },

      // Forward direction (local Z negativo em Three.js)
      get forward() {
        return obj.getWorldDirection(self._tempVector.set(0, 0, -1)).normalize();
      },

      // Right direction (local X)
      get right() {
        self._tempVector.set(1, 0, 0);
        self._tempVector.applyQuaternion(obj.quaternion);
        return self._tempVector.normalize();
      },

      // Up direction (local Y)
      get up() {
        self._tempVector.set(0, 1, 0);
        self._tempVector.applyQuaternion(obj.quaternion);
        return self._tempVector.normalize();
      },

      // Métodos de transformação
      translate(x, y, z) {
        if (typeof x === 'object') {
          obj.translateX(x.x || 0);
          obj.translateY(x.y || 0);
          obj.translateZ(x.z || 0);
        } else {
          obj.translateX(x || 0);
          obj.translateY(y || 0);
          obj.translateZ(z || 0);
        }
      },

      // Translate no espaço do mundo
      translateWorld(x, y, z) {
        if (typeof x === 'object') {
          obj.position.x += x.x || 0;
          obj.position.y += x.y || 0;
          obj.position.z += x.z || 0;
        } else {
          obj.position.x += x || 0;
          obj.position.y += y || 0;
          obj.position.z += z || 0;
        }
      },

      rotate(x, y, z) {
        obj.rotateX(x || 0);
        obj.rotateY(y || 0);
        obj.rotateZ(z || 0);
      },

      rotateAroundAxis(axis, angle) {
        obj.rotateOnAxis(axis, angle);
      },

      lookAt(target) {
        if (target.isVector3) {
          obj.lookAt(target);
        } else if (typeof target === 'object' && target.x !== undefined) {
          obj.lookAt(target.x, target.y || 0, target.z || 0);
        } else if (target._object) {
          // Se for outro ScriptAPI
          obj.lookAt(target._object.position);
        }
      },

      // Posição no espaço do mundo
      getWorldPosition() {
        return obj.getWorldPosition(new THREE.Vector3());
      },

      // Rotação no espaço do mundo
      getWorldQuaternion() {
        return obj.getWorldQuaternion(new THREE.Quaternion());
      },

      // Escala no espaço do mundo
      getWorldScale() {
        return obj.getWorldScale(new THREE.Vector3());
      }
    };
  }

  // ==================== INPUT ====================

  /**
   * Input API - acesso ao estado de teclado e mouse
   */
  get input() {
    const input = this._input;

    return {
      /**
       * Verifica se uma tecla está pressionada
       * @param {string} keyCode - Código da tecla (ex: 'KeyW', 'Space', 'ShiftLeft')
       */
      getKey(keyCode) {
        return input.isKeyDown(keyCode);
      },

      /**
       * Verifica se uma tecla foi pressionada neste frame
       */
      getKeyDown(keyCode) {
        return input.wasKeyPressed(keyCode);
      },

      /**
       * Verifica se uma tecla foi solta neste frame
       */
      getKeyUp(keyCode) {
        return input.wasKeyReleased(keyCode);
      },

      /**
       * Verifica se um botão do mouse está pressionado
       * @param {number} button - 0: esquerdo, 1: meio, 2: direito
       */
      getMouseButton(button) {
        return input.isMouseButtonDown(button);
      },

      /**
       * Verifica se um botão do mouse foi pressionado neste frame
       */
      getMouseButtonDown(button) {
        return input.wasMouseButtonPressed(button);
      },

      /**
       * Verifica se um botão do mouse foi solto neste frame
       */
      getMouseButtonUp(button) {
        return input.wasMouseButtonReleased(button);
      },

      /**
       * Posição do mouse na tela (pixels)
       */
      get mousePosition() {
        return input.getMousePosition();
      },

      /**
       * Movimento do mouse neste frame
       */
      get mouseDelta() {
        return input.getMouseDelta();
      },

      /**
       * Scroll do mouse neste frame
       */
      get scrollDelta() {
        return input.getScrollDelta();
      },

      /**
       * Eixos de movimento (WASD/Arrows)
       * @param {string} axis - 'Horizontal' ou 'Vertical'
       */
      getAxis(axis) {
        return input.getAxis(axis);
      }
    };
  }

  // ==================== TIME ====================

  /**
   * Time API - acesso ao tempo
   */
  get time() {
    const time = this._time;

    return {
      /**
       * Tempo desde o último frame (segundos)
       */
      get deltaTime() {
        return time.deltaTime;
      },

      /**
       * Tempo fixo para física (sempre 1/60)
       */
      get fixedDeltaTime() {
        return time.fixedDeltaTime;
      },

      /**
       * Tempo total desde o início do jogo (segundos)
       */
      get time() {
        return time.elapsedTime;
      },

      /**
       * Número de frames desde o início
       */
      get frameCount() {
        return time.frameCount;
      },

      /**
       * FPS atual
       */
      get fps() {
        return time.fps;
      },

      /**
       * Escala de tempo (1 = normal, 0.5 = lento, 2 = rápido)
       */
      get timeScale() {
        return time.timeScale;
      },
      set timeScale(value) {
        time.timeScale = Math.max(0, value);
      }
    };
  }

  // ==================== SCENE ====================

  /**
   * Encontra um objeto pelo nome
   */
  find(name) {
    const found = this._scene.getObjectByName(name);
    if (found && !found.userData.isHelper) {
      return this._createProxyForObject(found);
    }
    return null;
  }

  /**
   * Encontra todos os objetos com uma tag
   */
  findByTag(tag) {
    const results = [];
    this._scene.traverse((child) => {
      if (child.userData.tag === tag && !child.userData.isHelper) {
        results.push(this._createProxyForObject(child));
      }
    });
    return results;
  }

  /**
   * Encontra todos os objetos que satisfazem uma condição
   */
  findAll(predicate) {
    const results = [];
    this._scene.traverse((child) => {
      if (!child.userData.isHelper && predicate(this._createProxyForObject(child))) {
        results.push(this._createProxyForObject(child));
      }
    });
    return results;
  }

  /**
   * Obtém filhos diretos do objeto
   */
  getChildren() {
    return this._object.children
      .filter(c => !c.userData.isHelper)
      .map(c => this._createProxyForObject(c));
  }

  /**
   * Obtém objeto pai
   */
  getParent() {
    if (this._object.parent && this._object.parent !== this._scene) {
      return this._createProxyForObject(this._object.parent);
    }
    return null;
  }

  /**
   * Cria um proxy simplificado para outro objeto
   */
  _createProxyForObject(obj) {
    return {
      name: obj.name,
      position: obj.position,
      rotation: obj.rotation,
      scale: obj.scale,
      visible: obj.visible,
      userData: obj.userData,
      tag: obj.userData.tag || '',
      _object: obj
    };
  }

  // ==================== DEBUG ====================

  /**
   * Debug API - desenhar linhas, raios, etc.
   */
  get debug() {
    const scene = this._scene;

    return {
      /**
       * Desenha uma linha de debug (visível por 1 frame)
       */
      drawLine(from, to, color = 0xff0000) {
        // TODO: Implementar com LineHelper que é removido no próximo frame
        console.log(`[Debug] Line from ${JSON.stringify(from)} to ${JSON.stringify(to)}`);
      },

      /**
       * Desenha um raio de debug
       */
      drawRay(origin, direction, length = 1, color = 0x00ff00) {
        // TODO: Implementar com ArrowHelper
        console.log(`[Debug] Ray from ${JSON.stringify(origin)} dir ${JSON.stringify(direction)}`);
      },

      /**
       * Desenha uma esfera de debug
       */
      drawSphere(center, radius = 0.5, color = 0x0000ff) {
        // TODO: Implementar com SphereHelper
        console.log(`[Debug] Sphere at ${JSON.stringify(center)} radius ${radius}`);
      },

      /**
       * Desenha uma box de debug
       */
      drawBox(center, size, color = 0xffff00) {
        // TODO: Implementar com Box3Helper
        console.log(`[Debug] Box at ${JSON.stringify(center)} size ${JSON.stringify(size)}`);
      }
    };
  }

  // ==================== UTILITY ====================

  /**
   * Distância até outro objeto
   */
  distanceTo(other) {
    if (other._object) {
      return this._object.position.distanceTo(other._object.position);
    } else if (other.isVector3) {
      return this._object.position.distanceTo(other);
    } else if (typeof other === 'object') {
      this._tempVector.set(other.x || 0, other.y || 0, other.z || 0);
      return this._object.position.distanceTo(this._tempVector);
    }
    return 0;
  }

  /**
   * Direção até outro objeto (normalizada)
   */
  directionTo(other) {
    let targetPos;
    if (other._object) {
      targetPos = other._object.position;
    } else if (other.isVector3) {
      targetPos = other;
    } else if (typeof other === 'object') {
      targetPos = this._tempVector.set(other.x || 0, other.y || 0, other.z || 0);
    }

    if (targetPos) {
      return new THREE.Vector3()
        .subVectors(targetPos, this._object.position)
        .normalize();
    }
    return new THREE.Vector3();
  }

  /**
   * Acesso direto ao objeto Three.js (para casos avançados)
   */
  get gameObject() {
    return this._object;
  }
}

/**
 * InputManager - Gerencia estado de input para scripts
 */
export class ScriptInputManager {
  constructor() {
    this.keys = new Set();
    this.keysPressed = new Set();
    this.keysReleased = new Set();

    this.mouseButtons = new Set();
    this.mouseButtonsPressed = new Set();
    this.mouseButtonsReleased = new Set();

    this.mousePosition = { x: 0, y: 0 };
    this.mouseDelta = { x: 0, y: 0 };
    this.scrollDelta = 0;

    this._lastMouseX = 0;
    this._lastMouseY = 0;

    // Bind handlers
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onWheel = this.onWheel.bind(this);
  }

  enable(domElement) {
    this.domElement = domElement;
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    domElement.addEventListener('mousedown', this.onMouseDown);
    domElement.addEventListener('mouseup', this.onMouseUp);
    domElement.addEventListener('mousemove', this.onMouseMove);
    domElement.addEventListener('wheel', this.onWheel);
  }

  disable() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    if (this.domElement) {
      this.domElement.removeEventListener('mousedown', this.onMouseDown);
      this.domElement.removeEventListener('mouseup', this.onMouseUp);
      this.domElement.removeEventListener('mousemove', this.onMouseMove);
      this.domElement.removeEventListener('wheel', this.onWheel);
    }
    this.clear();
  }

  clear() {
    this.keys.clear();
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.mouseButtons.clear();
    this.mouseButtonsPressed.clear();
    this.mouseButtonsReleased.clear();
  }

  // Chamado no final de cada frame
  endFrame() {
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.mouseButtonsPressed.clear();
    this.mouseButtonsReleased.clear();
    this.mouseDelta = { x: 0, y: 0 };
    this.scrollDelta = 0;
  }

  // Event handlers
  onKeyDown(e) {
    if (!this.keys.has(e.code)) {
      this.keysPressed.add(e.code);
    }
    this.keys.add(e.code);
  }

  onKeyUp(e) {
    this.keys.delete(e.code);
    this.keysReleased.add(e.code);
  }

  onMouseDown(e) {
    if (!this.mouseButtons.has(e.button)) {
      this.mouseButtonsPressed.add(e.button);
    }
    this.mouseButtons.add(e.button);
  }

  onMouseUp(e) {
    this.mouseButtons.delete(e.button);
    this.mouseButtonsReleased.add(e.button);
  }

  onMouseMove(e) {
    this.mousePosition = { x: e.clientX, y: e.clientY };
    this.mouseDelta = {
      x: e.clientX - this._lastMouseX,
      y: e.clientY - this._lastMouseY
    };
    this._lastMouseX = e.clientX;
    this._lastMouseY = e.clientY;
  }

  onWheel(e) {
    this.scrollDelta = e.deltaY;
  }

  // Query methods
  isKeyDown(keyCode) {
    return this.keys.has(keyCode);
  }

  wasKeyPressed(keyCode) {
    return this.keysPressed.has(keyCode);
  }

  wasKeyReleased(keyCode) {
    return this.keysReleased.has(keyCode);
  }

  isMouseButtonDown(button) {
    return this.mouseButtons.has(button);
  }

  wasMouseButtonPressed(button) {
    return this.mouseButtonsPressed.has(button);
  }

  wasMouseButtonReleased(button) {
    return this.mouseButtonsReleased.has(button);
  }

  getMousePosition() {
    return { ...this.mousePosition };
  }

  getMouseDelta() {
    return { ...this.mouseDelta };
  }

  getScrollDelta() {
    return this.scrollDelta;
  }

  getAxis(axis) {
    switch (axis.toLowerCase()) {
      case 'horizontal':
        let h = 0;
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) h += 1;
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) h -= 1;
        return h;
      case 'vertical':
        let v = 0;
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) v += 1;
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) v -= 1;
        return v;
      default:
        return 0;
    }
  }
}

/**
 * TimeManager - Gerencia tempo para scripts
 */
export class ScriptTimeManager {
  constructor() {
    this.deltaTime = 0;
    this.fixedDeltaTime = 1 / 60;
    this.elapsedTime = 0;
    this.frameCount = 0;
    this.fps = 0;
    this.timeScale = 1;

    this._fpsFrames = 0;
    this._fpsTime = 0;
  }

  update(deltaTime) {
    this.deltaTime = deltaTime * this.timeScale;
    this.elapsedTime += this.deltaTime;
    this.frameCount++;

    // Calcular FPS
    this._fpsFrames++;
    this._fpsTime += deltaTime;
    if (this._fpsTime >= 1) {
      this.fps = this._fpsFrames;
      this._fpsFrames = 0;
      this._fpsTime = 0;
    }
  }

  reset() {
    this.deltaTime = 0;
    this.elapsedTime = 0;
    this.frameCount = 0;
    this.fps = 0;
    this._fpsFrames = 0;
    this._fpsTime = 0;
  }
}
