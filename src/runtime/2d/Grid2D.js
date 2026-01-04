import * as THREE from 'three';

/**
 * Grid2D - Grid helper para editor 2D
 *
 * Features:
 * - Grid infinito para editor
 * - Linhas principais e secundárias
 * - Snap to grid
 * - Zoom adaptativo (mais subdivisões ao aproximar)
 */
export default class Grid2D {
  constructor(options = {}) {
    const {
      size = 100,
      divisions = 100,
      primaryColor = 0x444444,
      secondaryColor = 0x2a2a2a,
      primaryInterval = 10, // A cada 10 linhas, linha primária
      axisColorX = 0xff5555,
      axisColorY = 0x55ff55
    } = options;

    this.size = size;
    this.divisions = divisions;
    this.primaryColor = primaryColor;
    this.secondaryColor = secondaryColor;
    this.primaryInterval = primaryInterval;
    this.axisColorX = axisColorX;
    this.axisColorY = axisColorY;

    // Criar grupo para o grid
    this.group = new THREE.Group();
    this.group.name = '__grid2d__';

    this.createGrid();
    this.createAxes();
  }

  /**
   * Cria as linhas do grid
   */
  createGrid() {
    const halfSize = this.size / 2;
    const step = this.size / this.divisions;

    // Material para linhas secundárias
    const secondaryMaterial = new THREE.LineBasicMaterial({
      color: this.secondaryColor,
      transparent: true,
      opacity: 0.5
    });

    // Material para linhas primárias
    const primaryMaterial = new THREE.LineBasicMaterial({
      color: this.primaryColor,
      transparent: true,
      opacity: 0.8
    });

    // Criar linhas verticais e horizontais
    for (let i = 0; i <= this.divisions; i++) {
      const position = -halfSize + i * step;
      const isPrimary = i % this.primaryInterval === 0;
      const material = isPrimary ? primaryMaterial : secondaryMaterial;

      // Linha vertical
      const vGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(position, -halfSize, -1),
        new THREE.Vector3(position, halfSize, -1)
      ]);
      const vLine = new THREE.Line(vGeometry, material);
      this.group.add(vLine);

      // Linha horizontal
      const hGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-halfSize, position, -1),
        new THREE.Vector3(halfSize, position, -1)
      ]);
      const hLine = new THREE.Line(hGeometry, material);
      this.group.add(hLine);
    }
  }

  /**
   * Cria os eixos X e Y coloridos
   */
  createAxes() {
    const halfSize = this.size / 2;

    // Eixo X (vermelho)
    const xMaterial = new THREE.LineBasicMaterial({ color: this.axisColorX });
    const xGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfSize, 0, 0),
      new THREE.Vector3(halfSize, 0, 0)
    ]);
    const xAxis = new THREE.Line(xGeometry, xMaterial);
    this.group.add(xAxis);

    // Eixo Y (verde)
    const yMaterial = new THREE.LineBasicMaterial({ color: this.axisColorY });
    const yGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -halfSize, 0),
      new THREE.Vector3(0, halfSize, 0)
    ]);
    const yAxis = new THREE.Line(yGeometry, yMaterial);
    this.group.add(yAxis);

    // Origem (círculo pequeno)
    const originGeometry = new THREE.CircleGeometry(0.1, 16);
    const originMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const origin = new THREE.Mesh(originGeometry, originMaterial);
    origin.position.z = 0.1;
    this.group.add(origin);
  }

  /**
   * Retorna o grupo Three.js
   */
  getObject() {
    return this.group;
  }

  /**
   * Define visibilidade
   */
  setVisible(visible) {
    this.group.visible = visible;
  }

  /**
   * Snap de posição para o grid
   */
  static snapToGrid(position, gridSize = 1) {
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: Math.round(position.y / gridSize) * gridSize
    };
  }

  /**
   * Snap de posição para meio grid (para posicionar no centro de células)
   */
  static snapToHalfGrid(position, gridSize = 1) {
    const halfGrid = gridSize / 2;
    return {
      x: Math.round((position.x - halfGrid) / gridSize) * gridSize + halfGrid,
      y: Math.round((position.y - halfGrid) / gridSize) * gridSize + halfGrid
    };
  }
}

/**
 * TileGrid - Grid para tilemaps
 */
export class TileGrid {
  constructor(options = {}) {
    const {
      width = 10,        // Largura em tiles
      height = 10,       // Altura em tiles
      tileSize = 1,      // Tamanho de cada tile em unidades do mundo
      position = { x: 0, y: 0 }
    } = options;

    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    this.position = position;

    // Grid de tiles (null = vazio)
    this.tiles = new Array(width * height).fill(null);

    // Grupo Three.js para os tiles
    this.group = new THREE.Group();
    this.group.name = 'TileGrid';
    this.group.position.set(position.x, position.y, 0);

    // Cache de meshes para cada tile
    this.meshes = new Map();
  }

  /**
   * Converte posição do mundo para índice do tile
   */
  worldToTile(worldX, worldY) {
    const localX = worldX - this.position.x;
    const localY = worldY - this.position.y;

    const tileX = Math.floor(localX / this.tileSize);
    const tileY = Math.floor(localY / this.tileSize);

    if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
      return null;
    }

    return { x: tileX, y: tileY };
  }

  /**
   * Converte índice do tile para posição do mundo (centro do tile)
   */
  tileToWorld(tileX, tileY) {
    return {
      x: this.position.x + tileX * this.tileSize + this.tileSize / 2,
      y: this.position.y + tileY * this.tileSize + this.tileSize / 2
    };
  }

  /**
   * Define um tile
   */
  setTile(tileX, tileY, tileData) {
    if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
      return;
    }

    const index = tileY * this.width + tileX;
    this.tiles[index] = tileData;

    // Atualizar visual
    this.updateTileMesh(tileX, tileY);
  }

  /**
   * Obtém um tile
   */
  getTile(tileX, tileY) {
    if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
      return null;
    }
    return this.tiles[tileY * this.width + tileX];
  }

  /**
   * Remove um tile
   */
  removeTile(tileX, tileY) {
    this.setTile(tileX, tileY, null);
  }

  /**
   * Atualiza o mesh de um tile específico
   */
  updateTileMesh(tileX, tileY) {
    const key = `${tileX},${tileY}`;
    const tileData = this.getTile(tileX, tileY);

    // Remover mesh existente
    if (this.meshes.has(key)) {
      this.group.remove(this.meshes.get(key));
      this.meshes.delete(key);
    }

    // Criar novo mesh se tiver dados
    if (tileData) {
      const geometry = new THREE.PlaneGeometry(this.tileSize, this.tileSize);
      let material;

      if (tileData.texture) {
        material = new THREE.MeshBasicMaterial({
          map: tileData.texture,
          transparent: true
        });
      } else {
        material = new THREE.MeshBasicMaterial({
          color: tileData.color || 0x808080
        });
      }

      const mesh = new THREE.Mesh(geometry, material);
      const worldPos = this.tileToWorld(tileX, tileY);
      mesh.position.set(
        worldPos.x - this.position.x,
        worldPos.y - this.position.y,
        tileData.layer || 0
      );

      this.group.add(mesh);
      this.meshes.set(key, mesh);
    }
  }

  /**
   * Limpa todos os tiles
   */
  clear() {
    this.tiles.fill(null);
    this.meshes.forEach(mesh => this.group.remove(mesh));
    this.meshes.clear();
  }

  /**
   * Retorna o grupo Three.js
   */
  getObject() {
    return this.group;
  }

  /**
   * Serializa para JSON
   */
  serialize() {
    return {
      width: this.width,
      height: this.height,
      tileSize: this.tileSize,
      position: this.position,
      tiles: this.tiles.map(tile => tile ? { ...tile, texture: undefined } : null)
    };
  }

  /**
   * Deserializa de JSON
   */
  static deserialize(data) {
    const grid = new TileGrid({
      width: data.width,
      height: data.height,
      tileSize: data.tileSize,
      position: data.position
    });

    data.tiles.forEach((tile, index) => {
      if (tile) {
        const x = index % data.width;
        const y = Math.floor(index / data.width);
        grid.setTile(x, y, tile);
      }
    });

    return grid;
  }
}
