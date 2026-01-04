/**
 * FogOfWarManager - Gerenciador de Fog of War
 * Mantém grid de exploração e visibilidade
 *
 * Modos:
 * - permanent: Áreas visitadas ficam reveladas para sempre
 * - limited: Só mostra área ao redor do player
 * - hybrid: Área atual clara, visitadas em cinza, não visitadas escuras
 */
export default class FogOfWarManager {
  constructor(worldBounds, gridResolution = 1) {
    this.worldBounds = worldBounds;
    this.gridResolution = gridResolution; // Unidades do mundo por célula

    // Calcular dimensões do grid
    const worldWidth = worldBounds.maxX - worldBounds.minX;
    const worldHeight = worldBounds.maxZ - worldBounds.minZ;

    this.gridWidth = Math.ceil(worldWidth / gridResolution);
    this.gridHeight = Math.ceil(worldHeight / gridResolution);

    // Grid de exploração
    // 0 = não explorado, 1 = explorado, 2 = visível agora
    this.exploredGrid = new Uint8Array(this.gridWidth * this.gridHeight);

    // Grid de visibilidade atual (atualizado todo frame no modo limited/hybrid)
    this.visibleGrid = new Uint8Array(this.gridWidth * this.gridHeight);

    // Modo atual
    this.mode = 'hybrid';

    // Última posição do player (para otimização)
    this.lastPlayerX = null;
    this.lastPlayerZ = null;
    this.lastRevealRadius = null;

    // Cache de células reveladas para otimização
    this.revealedCellsCache = new Set();
  }

  /**
   * Define o modo de fog of war
   */
  setMode(mode) {
    if (['permanent', 'limited', 'hybrid'].includes(mode)) {
      this.mode = mode;
    }
  }

  /**
   * Converte coordenadas do mundo para índice do grid
   */
  worldToGrid(worldX, worldZ) {
    const gridX = Math.floor((worldX - this.worldBounds.minX) / this.gridResolution);
    const gridZ = Math.floor((worldZ - this.worldBounds.minZ) / this.gridResolution);

    return {
      x: Math.max(0, Math.min(this.gridWidth - 1, gridX)),
      z: Math.max(0, Math.min(this.gridHeight - 1, gridZ))
    };
  }

  /**
   * Converte índice do grid para coordenadas do mundo (centro da célula)
   */
  gridToWorld(gridX, gridZ) {
    return {
      x: this.worldBounds.minX + (gridX + 0.5) * this.gridResolution,
      z: this.worldBounds.minZ + (gridZ + 0.5) * this.gridResolution
    };
  }

  /**
   * Obtém índice linear do grid
   */
  getIndex(gridX, gridZ) {
    return gridZ * this.gridWidth + gridX;
  }

  /**
   * Revela área circular ao redor de uma posição
   */
  reveal(worldX, worldZ, radius) {
    const center = this.worldToGrid(worldX, worldZ);
    const gridRadius = Math.ceil(radius / this.gridResolution);

    // Otimização: só processar se mudou significativamente
    const moved = this.lastPlayerX === null ||
      Math.abs(worldX - this.lastPlayerX) > this.gridResolution * 0.5 ||
      Math.abs(worldZ - this.lastPlayerZ) > this.gridResolution * 0.5;

    if (!moved && this.lastRevealRadius === radius) {
      return;
    }

    this.lastPlayerX = worldX;
    this.lastPlayerZ = worldZ;
    this.lastRevealRadius = radius;

    // Limpar visibilidade atual
    this.visibleGrid.fill(0);

    // Revelar área circular
    for (let dz = -gridRadius; dz <= gridRadius; dz++) {
      for (let dx = -gridRadius; dx <= gridRadius; dx++) {
        const gx = center.x + dx;
        const gz = center.z + dz;

        // Verificar limites
        if (gx < 0 || gx >= this.gridWidth || gz < 0 || gz >= this.gridHeight) {
          continue;
        }

        // Verificar se está dentro do raio (circular)
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance <= gridRadius) {
          const index = this.getIndex(gx, gz);

          // Marcar como visível
          this.visibleGrid[index] = 1;

          // Marcar como explorado (permanente)
          if (this.exploredGrid[index] < 1) {
            this.exploredGrid[index] = 1;
          }
        }
      }
    }
  }

  /**
   * Atualiza fog of war (chamado todo frame)
   */
  update(playerX, playerZ, revealRadius) {
    this.reveal(playerX, playerZ, revealRadius);
  }

  /**
   * Verifica se uma célula está atualmente visível
   */
  isVisible(worldX, worldZ) {
    if (this.mode === 'permanent') {
      // No modo permanent, se explorado = visível
      return this.isExplored(worldX, worldZ);
    }

    const grid = this.worldToGrid(worldX, worldZ);
    const index = this.getIndex(grid.x, grid.z);
    return this.visibleGrid[index] === 1;
  }

  /**
   * Verifica se uma célula foi explorada
   */
  isExplored(worldX, worldZ) {
    const grid = this.worldToGrid(worldX, worldZ);
    const index = this.getIndex(grid.x, grid.z);
    return this.exploredGrid[index] >= 1;
  }

  /**
   * Retorna o estado de uma célula
   * @returns {number} 0 = não explorado, 1 = explorado, 2 = visível
   */
  getCellState(worldX, worldZ) {
    const grid = this.worldToGrid(worldX, worldZ);
    const index = this.getIndex(grid.x, grid.z);

    if (this.visibleGrid[index] === 1) {
      return 2; // Visível agora
    }
    if (this.exploredGrid[index] >= 1) {
      return 1; // Explorado mas não visível
    }
    return 0; // Não explorado
  }

  /**
   * Retorna estado de visibilidade para renderização
   * @returns {Object} Objeto com grids e metadados
   */
  getRenderData() {
    return {
      exploredGrid: this.exploredGrid,
      visibleGrid: this.visibleGrid,
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      worldBounds: this.worldBounds,
      gridResolution: this.gridResolution,
      mode: this.mode
    };
  }

  /**
   * Revela todo o mapa (para debug ou mapa completo)
   */
  revealAll() {
    this.exploredGrid.fill(1);
    this.visibleGrid.fill(1);
  }

  /**
   * Esconde todo o mapa (reset)
   */
  hideAll() {
    this.exploredGrid.fill(0);
    this.visibleGrid.fill(0);
    this.lastPlayerX = null;
    this.lastPlayerZ = null;
  }

  /**
   * Revela área específica permanentemente (para eventos, triggers, etc)
   */
  revealArea(centerX, centerZ, radius) {
    const center = this.worldToGrid(centerX, centerZ);
    const gridRadius = Math.ceil(radius / this.gridResolution);

    for (let dz = -gridRadius; dz <= gridRadius; dz++) {
      for (let dx = -gridRadius; dx <= gridRadius; dx++) {
        const gx = center.x + dx;
        const gz = center.z + dz;

        if (gx < 0 || gx >= this.gridWidth || gz < 0 || gz >= this.gridHeight) {
          continue;
        }

        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance <= gridRadius) {
          const index = this.getIndex(gx, gz);
          this.exploredGrid[index] = 1;
        }
      }
    }
  }

  /**
   * Serializa estado para save game
   */
  serialize() {
    // Comprimir grid usando RLE (Run-Length Encoding) para economizar espaço
    const compressed = this.compressGrid(this.exploredGrid);

    return {
      worldBounds: this.worldBounds,
      gridResolution: this.gridResolution,
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      exploredData: compressed,
      mode: this.mode
    };
  }

  /**
   * Restaura estado de save game
   */
  deserialize(data) {
    if (!data) return;

    // Verificar se as dimensões batem
    if (data.gridWidth === this.gridWidth && data.gridHeight === this.gridHeight) {
      // Descomprimir e restaurar
      const decompressed = this.decompressGrid(data.exploredData, this.exploredGrid.length);
      this.exploredGrid.set(decompressed);
    } else {
      // Dimensões diferentes - tentar mapear
      console.warn('[FogOfWarManager] Grid dimensions changed, fog state may be incorrect');
    }

    if (data.mode) {
      this.mode = data.mode;
    }
  }

  /**
   * Comprime grid usando RLE simples
   */
  compressGrid(grid) {
    const result = [];
    let currentValue = grid[0];
    let count = 1;

    for (let i = 1; i < grid.length; i++) {
      if (grid[i] === currentValue && count < 255) {
        count++;
      } else {
        result.push(currentValue, count);
        currentValue = grid[i];
        count = 1;
      }
    }
    result.push(currentValue, count);

    return result;
  }

  /**
   * Descomprime grid RLE
   */
  decompressGrid(compressed, expectedLength) {
    const result = new Uint8Array(expectedLength);
    let index = 0;

    for (let i = 0; i < compressed.length; i += 2) {
      const value = compressed[i];
      const count = compressed[i + 1];

      for (let j = 0; j < count && index < expectedLength; j++) {
        result[index++] = value;
      }
    }

    return result;
  }

  /**
   * Retorna estatísticas de exploração
   */
  getStats() {
    let explored = 0;
    let visible = 0;
    const total = this.exploredGrid.length;

    for (let i = 0; i < total; i++) {
      if (this.exploredGrid[i] >= 1) explored++;
      if (this.visibleGrid[i] === 1) visible++;
    }

    return {
      total,
      explored,
      visible,
      exploredPercent: Math.round((explored / total) * 100),
      visiblePercent: Math.round((visible / total) * 100)
    };
  }

  /**
   * Limpa recursos
   */
  dispose() {
    this.exploredGrid = null;
    this.visibleGrid = null;
    this.revealedCellsCache.clear();
  }
}
