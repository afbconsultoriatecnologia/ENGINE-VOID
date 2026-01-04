/**
 * MinimapSystem - Sistema principal do minimap
 * Gerencia posição do player, objetos marcados e integração com fog of war
 */
export default class MinimapSystem {
  constructor(scene, player, settings) {
    this.scene = scene;
    this.player = player;
    this.settings = this.mergeWithDefaults(settings);

    // Posição atual do player no mundo
    this.playerPosition = { x: 0, z: 0 };
    this.playerRotation = 0; // Ângulo em radianos
    this.cameraAngle = 0; // Ângulo da câmera (para rotação do minimap)

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
      waypoint: []
    };

    this.updateTaggedObjects();
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

      // Objetos no mapa
      showEnemies: true,
      showItems: true,
      showWaypoints: true,
      customMarkers: [],

      // Cores dos marcadores
      markerColors: {
        enemy: '#ff0000',
        item: '#ffff00',
        waypoint: '#00ffff'
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
   * Atualiza lista de objetos por tag na cena
   */
  updateTaggedObjects() {
    this.taggedObjects = {
      enemy: [],
      item: [],
      waypoint: []
    };

    this.scene.traverse((child) => {
      const tag = child.userData?.tag;
      if (tag && this.taggedObjects[tag]) {
        this.taggedObjects[tag].push(child);
      }
    });
  }

  /**
   * Converte coordenadas do mundo para coordenadas do minimap (0-1)
   */
  worldToMinimap(worldX, worldZ) {
    const bounds = this.settings.worldBounds;
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxZ - bounds.minZ;

    // Normalizar para 0-1
    const normalizedX = (worldX - bounds.minX) / worldWidth;
    const normalizedZ = (worldZ - bounds.minZ) / worldHeight;

    // Debug log uma vez
    if (!this._debugWorldToMinimap) {
      console.log('[MinimapSystem] worldToMinimap:', {
        input: { worldX, worldZ },
        bounds,
        normalized: { normalizedX, normalizedZ },
        scale: this.settings.scale
      });
      this._debugWorldToMinimap = true;
    }

    // Aplicar escala
    const scale = this.settings.scale;

    // Escalar ao redor do centro do player
    const playerNormX = (this.playerPosition.x - bounds.minX) / worldWidth;
    const playerNormZ = (this.playerPosition.z - bounds.minZ) / worldHeight;

    const scaledX = playerNormX + (normalizedX - playerNormX) / scale;
    const scaledZ = playerNormZ + (normalizedZ - playerNormZ) / scale;

    return {
      x: Math.max(0, Math.min(1, scaledX)),
      y: Math.max(0, Math.min(1, scaledZ))
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

    // Atualizar posição do player
    this.playerPosition.x = this.player.position.x;
    this.playerPosition.z = this.player.position.z;

    // Atualizar rotação do player (Y rotation)
    this.playerRotation = this.player.rotation.y;

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
   * Atualiza lista de marcadores visíveis
   */
  updateMarkers() {
    this.markers = [];

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

    // Adicionar inimigos
    if (this.settings.showEnemies) {
      for (const enemy of this.taggedObjects.enemy) {
        if (this.isVisible(enemy.position.x, enemy.position.z)) {
          this.markers.push({
            type: 'enemy',
            x: enemy.position.x,
            z: enemy.position.z,
            color: this.settings.markerColors.enemy,
            size: 6,
            object: enemy
          });
        }
      }
    }

    // Adicionar itens
    if (this.settings.showItems) {
      for (const item of this.taggedObjects.item) {
        if (this.isVisible(item.position.x, item.position.z)) {
          this.markers.push({
            type: 'item',
            x: item.position.x,
            z: item.position.z,
            color: this.settings.markerColors.item,
            size: 5,
            object: item
          });
        }
      }
    }

    // Adicionar waypoints
    if (this.settings.showWaypoints) {
      for (const wp of this.taggedObjects.waypoint) {
        // Waypoints sempre visíveis se explorados
        if (this.isExplored(wp.position.x, wp.position.z)) {
          this.markers.push({
            type: 'waypoint',
            x: wp.position.x,
            z: wp.position.z,
            color: this.settings.markerColors.waypoint,
            size: 7,
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
      cameraAngle: this.cameraAngle,
      markers: this.markers,
      settings: this.settings
    };
  }

  /**
   * Retorna posição do player formatada para display
   */
  getFormattedCoordinates() {
    return {
      x: Math.round(this.playerPosition.x * 10) / 10,
      z: Math.round(this.playerPosition.z * 10) / 10
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
    this.taggedObjects = { enemy: [], item: [], waypoint: [] };
    this.fogManager = null;
    this.renderer = null;
  }
}
