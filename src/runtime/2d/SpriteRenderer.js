import * as THREE from 'three';

/**
 * SpriteRenderer - Renderizador de sprites 2D
 *
 * Features:
 * - Sprites com texturas
 * - Sprites coloridos (placeholder)
 * - Flip horizontal/vertical
 * - Sorting layers e order
 * - Animações frame-by-frame
 * - Sprite atlas/spritesheet
 */
export default class SpriteRenderer {
  /**
   * Sorting layers padrão
   * IMPORTANTE: Valores devem estar dentro do range visível da câmera (Z=100, near=0.1, far=1000)
   * Range visível: Z=-900 até Z=99.9
   * Usando valores pequenos para garantir visibilidade
   */
  static SORTING_LAYERS = {
    'Background': -10,
    'Default': 0,
    'Foreground': 10,
    'UI': 20
  };

  /**
   * Cria um sprite 2D
   */
  static createSprite(options = {}) {
    const {
      name = 'Sprite',
      width = 1,
      height = 1,
      color = 0xffffff,
      texture = null,
      position = { x: 0, y: 0 },
      rotation = 0,
      scale = { x: 1, y: 1 },
      flipX = false,
      flipY = false,
      sortingLayer = 'Default',
      sortingOrder = 0,
      opacity = 1,
      pixelsPerUnit = 16,
      userData = {} // Preservar userData adicional (tag, isStatic, isPlayer, etc.)
    } = options;

    // Criar geometria do sprite (plano)
    const geometry = new THREE.PlaneGeometry(width, height);

    // Criar material
    let material;
    if (texture) {
      // Sprite com textura
      const textureLoader = new THREE.TextureLoader();
      const tex = typeof texture === 'string' ? textureLoader.load(texture) : texture;

      // Configurar textura para pixel art
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;

      material = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: opacity,
        side: THREE.DoubleSide
      });
    } else {
      // Sprite colorido (placeholder)
      material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: opacity < 1,
        opacity: opacity,
        side: THREE.DoubleSide
      });
    }

    // Criar mesh
    const sprite = new THREE.Mesh(geometry, material);
    sprite.name = name;

    // Posição (Z baseado no sorting)
    const sortingZ = SpriteRenderer.calculateSortingZ(sortingLayer, sortingOrder);
    sprite.position.set(position.x, position.y, sortingZ);

    // Rotação (apenas no eixo Z para 2D)
    sprite.rotation.z = rotation * Math.PI / 180;

    // Escala com flip
    sprite.scale.set(
      scale.x * (flipX ? -1 : 1),
      scale.y * (flipY ? -1 : 1),
      1
    );

    // Metadados - preservar userData adicional (tag, isStatic, isPlayer, etc.)
    sprite.userData = {
      ...userData, // Primeiro, adicionar userData extra passado nas opções
      type: 'sprite',
      is2D: true,
      sortingLayer: sortingLayer,
      sortingOrder: sortingOrder,
      flipX: flipX,
      flipY: flipY,
      pixelsPerUnit: pixelsPerUnit,
      originalWidth: width,
      originalHeight: height,
      color: color,
      opacity: opacity
    };

    return sprite;
  }

  /**
   * Calcula o Z baseado no sorting layer e order
   */
  static calculateSortingZ(layer, order) {
    const layerZ = SpriteRenderer.SORTING_LAYERS[layer] || 0;
    // Order adiciona pequeno offset para manter ordem dentro da layer
    return (layerZ + order * 0.001);
  }

  /**
   * Atualiza o sorting de um sprite
   */
  static updateSorting(sprite, sortingLayer, sortingOrder) {
    sprite.userData.sortingLayer = sortingLayer;
    sprite.userData.sortingOrder = sortingOrder;
    sprite.position.z = SpriteRenderer.calculateSortingZ(sortingLayer, sortingOrder);
  }

  /**
   * Define flip horizontal
   */
  static setFlipX(sprite, flip) {
    const currentFlip = sprite.userData.flipX;
    if (currentFlip !== flip) {
      sprite.scale.x *= -1;
      sprite.userData.flipX = flip;
    }
  }

  /**
   * Define flip vertical
   */
  static setFlipY(sprite, flip) {
    const currentFlip = sprite.userData.flipY;
    if (currentFlip !== flip) {
      sprite.scale.y *= -1;
      sprite.userData.flipY = flip;
    }
  }

  /**
   * Atualiza cor do sprite
   */
  static setColor(sprite, color) {
    if (sprite.material && !sprite.material.map) {
      sprite.material.color.set(color);
      sprite.userData.color = color;
    }
  }

  /**
   * Atualiza opacidade
   */
  static setOpacity(sprite, opacity) {
    if (sprite.material) {
      sprite.material.opacity = opacity;
      sprite.material.transparent = opacity < 1;
      sprite.userData.opacity = opacity;
    }
  }

  /**
   * Carrega textura e aplica ao sprite
   */
  static async loadTexture(sprite, texturePath) {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        texturePath,
        (texture) => {
          // Configurar para pixel art
          texture.magFilter = THREE.NearestFilter;
          texture.minFilter = THREE.NearestFilter;

          // Atualizar material
          sprite.material.map = texture;
          sprite.material.needsUpdate = true;

          resolve(texture);
        },
        undefined,
        reject
      );
    });
  }

  /**
   * Cria um sprite a partir de spritesheet
   */
  static createFromSpritesheet(options = {}) {
    const {
      name = 'AnimatedSprite',
      texture,
      frameWidth,
      frameHeight,
      frameIndex = 0,
      columns,
      rows,
      position = { x: 0, y: 0 },
      sortingLayer = 'Default',
      sortingOrder = 0
    } = options;

    // Calcular UV para o frame
    const col = frameIndex % columns;
    const row = Math.floor(frameIndex / columns);

    const uOffset = col / columns;
    const vOffset = 1 - (row + 1) / rows;
    const uScale = 1 / columns;
    const vScale = 1 / rows;

    // Criar geometria
    const geometry = new THREE.PlaneGeometry(1, 1);

    // Ajustar UVs para o frame específico
    const uvs = geometry.attributes.uv;
    for (let i = 0; i < uvs.count; i++) {
      uvs.setXY(
        i,
        uOffset + uvs.getX(i) * uScale,
        vOffset + uvs.getY(i) * vScale
      );
    }

    // Material com textura
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide
    });

    const sprite = new THREE.Mesh(geometry, material);
    sprite.name = name;

    const sortingZ = SpriteRenderer.calculateSortingZ(sortingLayer, sortingOrder);
    sprite.position.set(position.x, position.y, sortingZ);

    // Metadados para animação
    sprite.userData = {
      type: 'animated-sprite',
      is2D: true,
      sortingLayer,
      sortingOrder,
      spritesheet: {
        columns,
        rows,
        frameWidth,
        frameHeight,
        currentFrame: frameIndex,
        totalFrames: columns * rows
      }
    };

    return sprite;
  }

  /**
   * Atualiza frame de um sprite animado
   */
  static setFrame(sprite, frameIndex) {
    const { columns, rows } = sprite.userData.spritesheet;

    const col = frameIndex % columns;
    const row = Math.floor(frameIndex / columns);

    const uOffset = col / columns;
    const vOffset = 1 - (row + 1) / rows;
    const uScale = 1 / columns;
    const vScale = 1 / rows;

    // Atualizar UVs
    const uvs = sprite.geometry.attributes.uv;
    const baseUVs = [
      [0, 1], [1, 1], [0, 0], [1, 0]
    ];

    for (let i = 0; i < uvs.count; i++) {
      uvs.setXY(
        i,
        uOffset + baseUVs[i][0] * uScale,
        vOffset + baseUVs[i][1] * vScale
      );
    }
    uvs.needsUpdate = true;

    sprite.userData.spritesheet.currentFrame = frameIndex;
  }

  /**
   * Serializa um sprite para JSON
   */
  static serialize(sprite) {
    return {
      name: sprite.name,
      type: 'sprite',
      position: {
        x: sprite.position.x,
        y: sprite.position.y
      },
      rotation: sprite.rotation.z * 180 / Math.PI,
      scale: {
        x: Math.abs(sprite.scale.x),
        y: Math.abs(sprite.scale.y)
      },
      userData: { ...sprite.userData }
    };
  }

  /**
   * Deserializa um sprite de JSON
   */
  static deserialize(data) {
    return SpriteRenderer.createSprite({
      name: data.name,
      position: data.position,
      rotation: data.rotation,
      scale: data.scale,
      ...data.userData
    });
  }
}

/**
 * AnimatedSprite - Componente de animação para sprites
 */
export class AnimatedSprite {
  constructor(sprite, animations = {}) {
    this.sprite = sprite;
    this.animations = animations; // { 'idle': { frames: [0,1,2], fps: 10, loop: true } }
    this.currentAnimation = null;
    this.currentFrame = 0;
    this.frameTime = 0;
    this.isPlaying = false;
  }

  /**
   * Adiciona uma animação
   */
  addAnimation(name, frames, fps = 10, loop = true) {
    this.animations[name] = { frames, fps, loop };
  }

  /**
   * Toca uma animação
   */
  play(animationName) {
    if (!this.animations[animationName]) {
      console.warn(`Animation "${animationName}" not found`);
      return;
    }

    if (this.currentAnimation !== animationName) {
      this.currentAnimation = animationName;
      this.currentFrame = 0;
      this.frameTime = 0;
    }

    this.isPlaying = true;
  }

  /**
   * Para a animação
   */
  stop() {
    this.isPlaying = false;
  }

  /**
   * Pausa a animação
   */
  pause() {
    this.isPlaying = false;
  }

  /**
   * Update chamado todo frame
   */
  update(deltaTime) {
    if (!this.isPlaying || !this.currentAnimation) return;

    const anim = this.animations[this.currentAnimation];
    if (!anim) return;

    this.frameTime += deltaTime;
    const frameInterval = 1 / anim.fps;

    if (this.frameTime >= frameInterval) {
      this.frameTime -= frameInterval;
      this.currentFrame++;

      if (this.currentFrame >= anim.frames.length) {
        if (anim.loop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = anim.frames.length - 1;
          this.isPlaying = false;
        }
      }

      // Atualizar frame do sprite
      SpriteRenderer.setFrame(this.sprite, anim.frames[this.currentFrame]);
    }
  }
}
