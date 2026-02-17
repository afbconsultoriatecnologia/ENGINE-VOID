/**
 * MinimapSystem - Sistema principal do minimap
 * Gerencia posição do player, objetos marcados e integração com fog of war
 * Suporta modo 2D (X/Y) e 3D (X/Z)
 */
export default class MinimapSystem {
  constructor(scene, player, settings, is2D = false) {
    this.scene = scene;
    this.player = player;
    this.settings = this.mergeWithDefaults(settings);
    this.is2D = is2D; // Flag para modo 2D

    // Posição atual do player no mundo
    this.playerPosition = { x: 0, z: 0 };
    this.lastPlayerPosition = { x: 0, z: 0 }; // Para calcular direção do movimento
    this.playerRotation = 0; // Ângulo em radianos
    this.movementDirection = 0; // Direção do movimento (para 2D)
    this.cameraAngle = 0; // Ângulo da câmera (para rotação do minimap)

    // Posição da câmera (para modo câmera livre)
    this.cameraPosition = { x: 0, z: 0 };
    // Modo de visualização: 'player' = centralizado no player, 'camera' = centralizado na câmera
    this.viewMode = 'player';

    // Objetos marcados no mapa (enemies, items, waypoints)
    this.markers = [];

    // Referência ao FogOfWarManager (injetado depois)
    this.fogManager = null;

    // Referência ao renderer (injetado depois)
    this.renderer = null;

    // Cache de objetos por tag
    this.taggedObjects = {
      enemy: [],
      item: [],
      waypoint: [],
      platform: [],
      ground: [],
      obstacle: []
    };

    this.updateTaggedObjects();
    console.log('[MinimapSystem] Initialized', { is2D, taggedObjects: this.taggedObjects });
  }

  /**
   * Configurações default do minimap
   */
  static getDefaultSettings() {
    return {
      // Visibilidade
      enabled: true,

      // Posição
      position: 'top-right',
      offsetX: 20,
      offsetY: 20,

      // Tamanho e Formato
      shape: 'circle',
      size: 150,
      height: 100, // só para rectangle

      // Escala e Coordenadas
      scale: 1,
      worldBounds: {
        minX: -100, maxX: 100,
        minZ: -100, maxZ: 100
      },
      showCoordinates: true,
      showGrid: false,
      gridSize: 10,

      // Rotação do minimap
      rotateWithCamera: true, // true = minimap rotaciona com câmera, false = norte fixo

      // Fog of War
      fogOfWar: {
        enabled: true,
        mode: 'hybrid', // 'permanent' | 'limited' | 'hybrid'
        revealRadius: 15,
        exploredOpacity: 0.5,
        unexploredColor: '#000000'
      },

      // Aparência
      backgroundColor: 'rgba(0,0,0,0.7)',
      backgroundImage: null, // Caminho para imagem de fundo (representa o worldBounds)
      backgroundImageLoaded: null, // Referência ao Image object (gerenciado pelo Overlay)
      borderColor: '#3d9df6',
      borderWidth: 2,
      playerColor: '#00ff00',
      playerSize: 8,
      showPlayerDirection: true,

      // Modo de exibição dos objetos
      // 'markers' = pontos/símbolos simples (padrão)
      // 'sprites' = mini versões dos sprites
      // 'static' = apenas imagem de fundo, sem objetos
      displayMode: 'markers',

      // Objetos no mapa
      showEnemies: true,
      showItems: true,
      showWaypoints: true,
      showPlatforms: true, // Mostrar plataformas/obstáculos
      customMarkers: [],

      // Cores dos marcadores (modo 'markers')
      markerColors: {
        enemy: '#ff4444',
        item: '#ffdd00',
        waypoint: '#00ffff',
        platform: '#888888',  // Cinza mais claro para melhor visibilidade
        obstacle: '#aaaaaa'   // Cinza claro para obstacles
      },

      // Tamanhos dos marcadores
      markerSizes: {
        enemy: 6,
        item: 5,
        waypoint: 4,
        platform: 4,   // Aumentado de 3 para 4
        obstacle: 5    // Tamanho para obstacles
      }
    };
  }

  /**
   * Merge settings com defaults
   */
  mergeWithDefaults(settings) {
    const defaults = MinimapSystem.getDefaultSettings();

    if (!settings) return defaults;

    return {
      ...defaults,
      ...settings,
      worldBounds: {
        ...defaults.worldBounds,
        ...(settings.worldBounds || {})
      },
      fogOfWar: {
        ...defaults.fogOfWar,
        ...(settings.fogOfWar || {})
      },
      markerColors: {
        ...defaults.markerColors,
        ...(settings.markerColors || {})
      }
    };
  }

  /**
   * Atualiza configurações
   */
  updateSettings(newSettings) {
    this.settings = this.mergeWithDefaults(newSettings);
  }

  /**
   * Conecta o FogOfWarManager
   */
  setFogManager(fogManager) {
    this.fogManager = fogManager;
  }

  /**
   * Conecta o MinimapRenderer
   */
  setRenderer(renderer) {
    this.renderer = renderer;
  }

  /**
   * Define o ângulo da câmera (para rotação do minimap)
   * @param {number} angle - Ângulo em graus (0-360)
   */
  setCameraAngle(angle) {
    this.cameraAngle = (angle * Math.PI) / 180; // Converter para radianos
  }

  /**
   * Define a posição da câmera (para modo câmera livre)
   * @param {number} x - Posição X da câmera
   * @param {number} z - Posição Z (ou Y em 2D) da câmera
   */
  setCameraPosition(x, z) {
    this.cameraPosition.x = x;
    this.cameraPosition.z = z;
  }

  /**
   * Define o modo de visualização do minimap
   * @param {'player'|'camera'} mode - 'player' = centralizado no player, 'camera' = centralizado na câmera
   */
  setViewMode(mode) {
    this.viewMode = mode;
  }

  /**
   * Retorna a posição central atual baseado no modo de visualização
   */
  getCenterPosition() {
    return this.viewMode === 'camera' ? this.cameraPosition : this.playerPosition;
  }

  /**
   * Atualiza lista de objetos por tag na cena
   */
  updateTaggedObjects() {
    this.taggedObjects = {
      enemy: [],
      item: [],
      waypoint: [],
      platform: [],
      ground: [],
      obstacle: []
    };

    let objectCount = 0;
    const allObjects = [];

    this.scene.traverse((child) => {
      // Ignorar objetos internos do Three.js
      if (!child.name || child.type === 'Scene' || child.type === 'AmbientLight' ||
          child.type === 'DirectionalLight' || child.type === 'PointLight') {
        return;
      }

      // Coletar info para debug
      allObjects.push({
        name: child.name,
        type: child.type,
        isPlayer: child === this.player,
        tag: child.userData?.tag,
        isStatic: child.userData?.isStatic,
        is2D: child.userData?.is2D,
        position: child.position ? { x: child.position.x.toFixed(2), y: child.position.y.toFixed(2) } : null
      });

      // Ignorar o player
      if (child === this.player) return;

      const tag = child.userData?.tag;
      if (tag && this.taggedObjects[tag] !== undefined) {
        this.taggedObjects[tag].push(child);
        objectCount++;
      }

      // Também adicionar objetos estáticos como plataformas
      if (child.userData?.isStatic && !tag) {
        this.taggedObjects.platform.push(child);
        objectCount++;
      }
    });

    // Log apenas contagens (sem lista completa)
    if (objectCount > 0) {
      console.log('[MinimapSystem] Tagged objects:', {
        enemy: this.taggedObjects.enemy.length,
        item: this.taggedObjects.item.length,
        platform: this.taggedObjects.platform.length,
        obstacle: this.taggedObjects.obstacle.length
      });
    }
  }

  /**
   * Converte coordenadas do mundo para coordenadas do minimap (0-1)
   * O centro do minimap depende do viewMode:
   * - 'player': centralizado no player (0.5, 0.5)
   * - 'camera': centralizado na câmera (0.5, 0.5)
   */
  worldToMinimap(worldX, worldZ) {
    // Calcular raio de visão baseado no worldBounds e scale
    const bounds = this.settings.worldBounds;
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxZ - bounds.minZ;
    const scale = this.settings.scale || 1;

    // Raio de visão = metade do mundo dividido pela escala
    // Com scale=1, vemos metade do mundo em cada direção do centro
    // Com scale=2, vemos 1/4 do mundo em cada direção (mais zoom)
    const viewRadiusX = (worldWidth / 2) / scale;
    const viewRadiusZ = (worldHeight / 2) / scale;

    // Obter posição central baseado no modo de visualização
    const centerPos = this.getCenterPosition();

    // Offset do objeto em relação ao centro (player ou câmera)
    const offsetX = worldX - centerPos.x;
    const offsetZ = worldZ - centerPos.z;

    // Converter para coordenadas do minimap (0-1)
    // Centro está em (0.5, 0.5)
    // Objetos são posicionados pelo offset dividido pelo raio de visão
    // NOTA: Y do canvas é invertido (0 = topo), então usamos MENOS para o eixo vertical
    const mapX = 0.5 + (offsetX / viewRadiusX) * 0.5;
    const mapY = 0.5 - (offsetZ / viewRadiusZ) * 0.5;  // INVERTIDO: objeto acima = mapY menor


    return {
      x: mapX,
      y: mapY
    };
  }

  /**
   * Converte coordenadas do minimap (0-1) para coordenadas do mundo
   */
  minimapToWorld(mapX, mapY) {
    const bounds = this.settings.worldBounds;
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxZ - bounds.minZ;

    return {
      x: bounds.minX + mapX * worldWidth,
      z: bounds.minZ + mapY * worldHeight
    };
  }

  /**
   * Atualiza o sistema (chamado todo frame)
   */
  update(deltaTime) {
    if (!this.player || !this.settings.enabled) return;

    // Salvar posição anterior para calcular direção do movimento
    this.lastPlayerPosition.x = this.playerPosition.x;
    this.lastPlayerPosition.z = this.playerPosition.z;

    // Atualizar posição do player
    // Em 2D: usa X e Y, em 3D: usa X e Z
    this.playerPosition.x = this.player.position.x;
    this.playerPosition.z = this.is2D ? this.player.position.y : this.player.position.z;

    // Calcular direção do movimento (para 2D)
    if (this.is2D) {
      const dx = this.playerPosition.x - this.lastPlayerPosition.x;
      const dy = this.playerPosition.z - this.lastPlayerPosition.z; // z armazena Y em 2D

      // Só atualizar direção se estiver se movendo
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        // atan2(y, x) retorna ângulo onde:
        // 0 = direita (X+), PI/2 = cima (Y+), PI/-PI = esquerda, -PI/2 = baixo
        this.movementDirection = Math.atan2(dy, dx);
      }
      // Usar direção do movimento em vez da rotação do sprite
      this.playerRotation = this.movementDirection;
    } else {
      // Em 3D: usa rotation.y (rotação no plano XZ)
      this.playerRotation = this.player.rotation.y;
    }

    // Atualizar fog of war se existir
    if (this.fogManager && this.settings.fogOfWar.enabled) {
      this.fogManager.update(
        this.playerPosition.x,
        this.playerPosition.z,
        this.settings.fogOfWar.revealRadius
      );
    }

    // Atualizar marcadores
    this.updateMarkers();
  }

  /**
   * Obtém a coordenada Z/Y dependendo do modo 2D/3D
   */
  getObjectZ(obj) {
    return this.is2D ? obj.position.y : obj.position.z;
  }

  /**
   * Atualiza lista de marcadores visíveis
   */
  updateMarkers() {
    this.markers = [];

    // Se modo static, não adicionar marcadores de objetos
    if (this.settings.displayMode === 'static') {
      return;
    }

    const sizes = this.settings.markerSizes || {};
    const colors = this.settings.markerColors || {};


    // Adicionar marcadores customizados
    if (this.settings.customMarkers) {
      for (const marker of this.settings.customMarkers) {
        this.markers.push({
          type: 'custom',
          x: marker.x,
          z: marker.z,
          color: marker.color || '#ffffff',
          size: marker.size || 4,
          label: marker.label
        });
      }
    }

    // Adicionar plataformas/ground/obstacle primeiro (ficam atrás)
    if (this.settings.showPlatforms) {
      const platforms = [
        ...this.taggedObjects.platform,
        ...this.taggedObjects.ground,
        ...this.taggedObjects.obstacle
      ];


      for (const platform of platforms) {
        const posZ = this.getObjectZ(platform);
        const tag = platform.userData?.tag || 'platform';
        // Usar cor/tamanho específico para obstacles
        const markerColor = tag === 'obstacle'
          ? (colors.obstacle || '#aaaaaa')
          : (colors.platform || '#888888');
        const markerSize = tag === 'obstacle'
          ? (sizes.obstacle || 5)
          : (sizes.platform || 4);

        this.markers.push({
          type: tag === 'obstacle' ? 'obstacle' : 'platform',
          x: platform.position.x,
          z: posZ,
          color: markerColor,
          size: markerSize,
          object: platform,
          // Informações extras para modo sprites
          scale: platform.scale ? { x: platform.scale.x, y: platform.scale.y } : { x: 1, y: 1 },
          spriteColor: platform.userData?.color || platform.material?.color
        });
      }
    }

    // Adicionar inimigos
    if (this.settings.showEnemies) {
      for (const enemy of this.taggedObjects.enemy) {
        const posZ = this.getObjectZ(enemy);
        if (this.isVisible(enemy.position.x, posZ)) {
          this.markers.push({
            type: 'enemy',
            x: enemy.position.x,
            z: posZ,
            color: colors.enemy || '#ff4444',
            size: sizes.enemy || 6,
            object: enemy,
            spriteColor: enemy.userData?.color || enemy.material?.color
          });
        }
      }
    }

    // Adicionar itens
    if (this.settings.showItems) {
      for (const item of this.taggedObjects.item) {
        const posZ = this.getObjectZ(item);
        if (this.isVisible(item.position.x, posZ)) {
          this.markers.push({
            type: 'item',
            x: item.position.x,
            z: posZ,
            color: colors.item || '#ffdd00',
            size: sizes.item || 5,
            object: item,
            spriteColor: item.userData?.color || item.material?.color
          });
        }
      }
    }

    // Adicionar waypoints
    if (this.settings.showWaypoints) {
      for (const wp of this.taggedObjects.waypoint) {
        const posZ = this.getObjectZ(wp);
        // Waypoints sempre visíveis se explorados
        if (this.isExplored(wp.position.x, posZ)) {
          this.markers.push({
            type: 'waypoint',
            x: wp.position.x,
            z: posZ,
            color: colors.waypoint || '#00ffff',
            size: sizes.waypoint || 4,
            object: wp
          });
        }
      }
    }
  }

  /**
   * Verifica se uma posição está visível (não coberta por fog)
   */
  isVisible(worldX, worldZ) {
    if (!this.settings.fogOfWar.enabled || !this.fogManager) {
      return true;
    }
    return this.fogManager.isVisible(worldX, worldZ);
  }

  /**
   * Verifica se uma posição foi explorada
   */
  isExplored(worldX, worldZ) {
    if (!this.settings.fogOfWar.enabled || !this.fogManager) {
      return true;
    }
    return this.fogManager.isExplored(worldX, worldZ);
  }

  /**
   * Retorna dados para renderização
   */
  getRenderData() {
    return {
      playerPosition: this.playerPosition,
      playerRotation: this.playerRotation,
      cameraPosition: this.cameraPosition,
      cameraAngle: this.cameraAngle,
      viewMode: this.viewMode,
      centerPosition: this.getCenterPosition(),
      markers: this.markers,
      settings: this.settings
    };
  }

  /**
   * Retorna posição central formatada para display (player ou câmera dependendo do viewMode)
   */
  getFormattedCoordinates() {
    const pos = this.getCenterPosition();
    return {
      x: Math.round(pos.x * 10) / 10,
      z: Math.round(pos.z * 10) / 10
    };
  }

  /**
   * Serializa estado para save
   */
  serialize() {
    return {
      settings: this.settings,
      fogState: this.fogManager?.serialize() || null
    };
  }

  /**
   * Restaura estado de save
   */
  deserialize(data) {
    if (data.settings) {
      this.updateSettings(data.settings);
    }
    if (data.fogState && this.fogManager) {
      this.fogManager.deserialize(data.fogState);
    }
  }

  /**
   * Limpa recursos
   */
  dispose() {
    this.markers = [];
    this.taggedObjects = { enemy: [], item: [], waypoint: [], platform: [], ground: [], obstacle: [] };
    this.fogManager = null;
    this.renderer = null;
  }
}
