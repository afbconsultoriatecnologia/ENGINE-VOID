/**
 * MinimapRenderer - Renderizador Canvas 2D do Minimap
 * Desenha o mapa, fog of war, player e marcadores
 */
export default class MinimapRenderer {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.settings = settings;

    // Configurar tamanho do canvas
    this.updateCanvasSize();

    // Posição do player (para imagem de fundo com zoom)
    this.playerPosX = 0;
    this.playerPosZ = 0;

    // Cache para otimização
    this.fogImageData = null;
    this.lastFogUpdate = 0;
    this.fogUpdateInterval = 100; // ms entre updates do fog
  }

  /**
   * Atualiza tamanho do canvas baseado nas configurações
   */
  updateCanvasSize() {
    const { shape, size, height } = this.settings;

    if (shape === 'rectangle') {
      this.canvas.width = size;
      this.canvas.height = height || size * 0.66;
    } else {
      this.canvas.width = size;
      this.canvas.height = size;
    }

    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height / 2;
    this.radius = Math.min(this.canvas.width, this.canvas.height) / 2;
  }

  /**
   * Atualiza configurações
   */
  updateSettings(settings) {
    this.settings = settings;
    this.updateCanvasSize();
  }

  /**
   * Renderiza o minimap completo
   */
  render(minimapSystem, fogManager) {
    const ctx = this.ctx;
    const data = minimapSystem.getRenderData();
    const { settings, playerPosition, playerRotation, cameraAngle, markers } = data;


    // Limpar canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Atualizar posição do player para renderização de imagem de fundo
    this.updatePlayerPosition(playerPosition.x, playerPosition.z);

    // Aplicar máscara circular se necessário
    ctx.save();
    if (settings.shape === 'circle') {
      this.applyCircularMask();
    }

    // 1. Desenhar background (cor sólida ou imagem)
    this.drawBackground(settings);

    // Se rotateWithCamera está habilitado, rotacionar o conteúdo do minimap
    if (settings.rotateWithCamera && cameraAngle !== undefined) {
      ctx.save();
      ctx.translate(this.centerX, this.centerY);
      ctx.rotate(cameraAngle); // Rotacionar baseado no ângulo da câmera
      ctx.translate(-this.centerX, -this.centerY);
    }

    // 2. Desenhar grid se habilitado
    if (settings.showGrid) {
      this.drawGrid(minimapSystem, settings);
    }

    // 3. Desenhar fog of war
    if (settings.fogOfWar.enabled && fogManager) {
      this.drawFogOfWar(minimapSystem, fogManager, settings);
    }

    // 4. Desenhar marcadores
    this.drawMarkers(minimapSystem, markers, settings);

    // 5. Desenhar player (passando cameraAngle para ajuste de rotação)
    this.drawPlayer(minimapSystem, playerPosition, playerRotation, cameraAngle, settings);

    // Restaurar rotação do minimap
    if (settings.rotateWithCamera && cameraAngle !== undefined) {
      ctx.restore();
    }

    ctx.restore();

    // 6. Desenhar borda (fora da máscara)
    this.drawBorder(settings);

    // 7. Desenhar orientação (N, S, L, O) - também rotaciona se rotateWithCamera
    this.drawCompass(settings, cameraAngle);
  }

  /**
   * Aplica máscara circular
   */
  applyCircularMask() {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.radius - 1, 0, Math.PI * 2);
    ctx.clip();
  }

  /**
   * Desenha background do minimap
   */
  drawBackground(settings) {
    const ctx = this.ctx;

    // Primeiro, desenhar cor de fundo (sempre, como fallback)
    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Se tiver imagem de fundo carregada, desenhar por cima
    if (settings.backgroundImageLoaded && settings.backgroundImageLoaded.complete) {
      this.drawBackgroundImage(settings);
    }
  }

  /**
   * Desenha imagem de fundo do minimap
   * A imagem representa o worldBounds completo
   * IMPORTANTE: A imagem se move com o player (player sempre no centro)
   */
  drawBackgroundImage(settings) {
    const ctx = this.ctx;
    const img = settings.backgroundImageLoaded;
    const bounds = settings.worldBounds;

    // Dimensões do mundo
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxZ - bounds.minZ;
    const scale = settings.scale || 1;

    // Calcular posição do player normalizada (0-1) na imagem
    // NOTA: Y é invertido - playerNormZ=0 significa player no topo do mundo (maxZ)
    const playerNormX = (this.playerPosX - bounds.minX) / worldWidth;
    const playerNormZ = 1 - (this.playerPosZ - bounds.minZ) / worldHeight;  // INVERTIDO

    // Tamanho visível do mundo (em unidades normalizadas 0-1)
    // Com scale=1, vemos 100% do mundo
    // Com scale=2, vemos 50% do mundo
    const visibleWidth = 1 / scale;
    const visibleHeight = 1 / scale;

    // Calcular região da imagem a mostrar (centrada no player)
    // srcX/srcY são os cantos superiores esquerdos
    let srcX = (playerNormX - visibleWidth / 2) * img.width;
    let srcY = (playerNormZ - visibleHeight / 2) * img.height;
    let srcW = visibleWidth * img.width;
    let srcH = visibleHeight * img.height;

    // Destino no canvas (normalmente o canvas inteiro)
    let dstX = 0;
    let dstY = 0;
    let dstW = this.canvas.width;
    let dstH = this.canvas.height;

    // Ajustar quando a região visível sai dos limites da imagem
    if (srcX < 0) {
      // Player muito à esquerda - parte da imagem fica vazia à esquerda
      dstX = (-srcX / srcW) * this.canvas.width;
      dstW = this.canvas.width - dstX;
      srcW = srcW + srcX; // Reduzir largura da fonte
      srcX = 0;
    }
    if (srcY < 0) {
      // Player muito acima
      dstY = (-srcY / srcH) * this.canvas.height;
      dstH = this.canvas.height - dstY;
      srcH = srcH + srcY;
      srcY = 0;
    }
    if (srcX + srcW > img.width) {
      // Player muito à direita
      const overflow = (srcX + srcW - img.width);
      srcW = img.width - srcX;
      dstW = (srcW / (visibleWidth * img.width)) * this.canvas.width;
    }
    if (srcY + srcH > img.height) {
      // Player muito abaixo
      const overflow = (srcY + srcH - img.height);
      srcH = img.height - srcY;
      dstH = (srcH / (visibleHeight * img.height)) * this.canvas.height;
    }

    // Desenhar região da imagem no canvas (player sempre no centro)
    if (srcW > 0 && srcH > 0) {
      ctx.drawImage(
        img,
        srcX, srcY, srcW, srcH,  // Região da imagem fonte
        dstX, dstY, dstW, dstH   // Destino no canvas
      );
    }
  }

  /**
   * Atualiza posição do player para renderização da imagem de fundo
   */
  updatePlayerPosition(x, z) {
    this.playerPosX = x;
    this.playerPosZ = z;
  }

  /**
   * Desenha grid (relativo ao player - linhas se movem com o mapa)
   */
  drawGrid(minimapSystem, settings) {
    const ctx = this.ctx;
    const gridSize = settings.gridSize;
    const playerPos = minimapSystem.playerPosition;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 0.5;

    // Calcular quantas linhas de grid são visíveis
    const bounds = settings.worldBounds;
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxZ - bounds.minZ;
    const scale = settings.scale || 1;
    const viewRadiusX = (worldWidth / 2) / scale;
    const viewRadiusZ = (worldHeight / 2) / scale;

    // Encontrar a primeira linha de grid à esquerda/acima do player
    const startX = Math.floor((playerPos.x - viewRadiusX) / gridSize) * gridSize;
    const startZ = Math.floor((playerPos.z - viewRadiusZ) / gridSize) * gridSize;
    const endX = Math.ceil((playerPos.x + viewRadiusX) / gridSize) * gridSize;
    const endZ = Math.ceil((playerPos.z + viewRadiusZ) / gridSize) * gridSize;

    // Linhas verticais
    for (let x = startX; x <= endX; x += gridSize) {
      const mapPos = minimapSystem.worldToMinimap(x, playerPos.z - viewRadiusZ);
      const mapPosEnd = minimapSystem.worldToMinimap(x, playerPos.z + viewRadiusZ);

      const screenX = mapPos.x * this.canvas.width;
      const screenY1 = 0;
      const screenY2 = this.canvas.height;

      ctx.beginPath();
      ctx.moveTo(screenX, screenY1);
      ctx.lineTo(screenX, screenY2);
      ctx.stroke();
    }

    // Linhas horizontais
    for (let z = startZ; z <= endZ; z += gridSize) {
      const mapPos = minimapSystem.worldToMinimap(playerPos.x - viewRadiusX, z);

      const screenX1 = 0;
      const screenX2 = this.canvas.width;
      const screenY = mapPos.y * this.canvas.height;

      ctx.beginPath();
      ctx.moveTo(screenX1, screenY);
      ctx.lineTo(screenX2, screenY);
      ctx.stroke();
    }
  }

  /**
   * Desenha fog of war (relativo ao player - fog se move com o mapa)
   */
  drawFogOfWar(minimapSystem, fogManager, settings) {
    const ctx = this.ctx;
    const fogData = fogManager.getRenderData();
    const { exploredGrid, visibleGrid, gridWidth, gridHeight, mode, worldBounds } = fogData;
    const fogSettings = settings.fogOfWar;
    const playerPos = minimapSystem.playerPosition;

    // Calcular área visível do mundo
    const bounds = settings.worldBounds;
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxZ - bounds.minZ;
    const scale = settings.scale || 1;
    const viewRadiusX = (worldWidth / 2) / scale;
    const viewRadiusZ = (worldHeight / 2) / scale;

    // Tamanho de cada célula de fog no mundo
    const cellWorldWidth = worldWidth / gridWidth;
    const cellWorldHeight = worldHeight / gridHeight;

    // Converter cor de fog para RGB
    const fogColor = this.hexToRgb(fogSettings.unexploredColor);

    // Calcular quais células de fog são visíveis
    const visibleMinX = playerPos.x - viewRadiusX;
    const visibleMaxX = playerPos.x + viewRadiusX;
    const visibleMinZ = playerPos.z - viewRadiusZ;
    const visibleMaxZ = playerPos.z + viewRadiusZ;

    // Converter para índices de grid
    const startGX = Math.max(0, Math.floor((visibleMinX - bounds.minX) / cellWorldWidth));
    const endGX = Math.min(gridWidth - 1, Math.ceil((visibleMaxX - bounds.minX) / cellWorldWidth));
    const startGZ = Math.max(0, Math.floor((visibleMinZ - bounds.minZ) / cellWorldHeight));
    const endGZ = Math.min(gridHeight - 1, Math.ceil((visibleMaxZ - bounds.minZ) / cellWorldHeight));

    // Renderizar apenas células visíveis
    for (let gz = startGZ; gz <= endGZ; gz++) {
      for (let gx = startGX; gx <= endGX; gx++) {
        const index = gz * gridWidth + gx;
        const explored = exploredGrid[index] >= 1;
        const visible = visibleGrid[index] === 1;

        // Calcular opacidade baseada no modo e estado
        let alpha = 0;

        if (mode === 'permanent') {
          alpha = explored ? 0 : 1;
        } else if (mode === 'limited') {
          alpha = visible ? 0 : 1;
        } else {
          // Hybrid
          if (visible) {
            alpha = 0;
          } else if (explored) {
            alpha = fogSettings.exploredOpacity;
          } else {
            alpha = 1;
          }
        }

        // Desenhar célula de fog se tiver opacidade
        if (alpha > 0) {
          // Converter posição da célula para coordenadas do mundo
          const worldX = bounds.minX + (gx + 0.5) * cellWorldWidth;
          const worldZ = bounds.minZ + (gz + 0.5) * cellWorldHeight;

          // Converter para coordenadas do minimap
          const mapPos = minimapSystem.worldToMinimap(worldX, worldZ);
          const screenX = mapPos.x * this.canvas.width;
          const screenY = mapPos.y * this.canvas.height;

          // Tamanho da célula no canvas
          const cellCanvasWidth = (cellWorldWidth / viewRadiusX) * (this.canvas.width / 2);
          const cellCanvasHeight = (cellWorldHeight / viewRadiusZ) * (this.canvas.height / 2);

          ctx.fillStyle = `rgba(${fogColor.r}, ${fogColor.g}, ${fogColor.b}, ${alpha})`;
          ctx.fillRect(
            screenX - cellCanvasWidth / 2,
            screenY - cellCanvasHeight / 2,
            cellCanvasWidth + 1,
            cellCanvasHeight + 1
          );
        }
      }
    }
  }

  /**
   * Desenha marcadores (enemies, items, waypoints, platforms)
   */
  drawMarkers(minimapSystem, markers, settings) {
    const ctx = this.ctx;
    const displayMode = settings.displayMode || 'markers';


    // Modo static não desenha marcadores
    if (displayMode === 'static') {
      return;
    }

    for (const marker of markers) {
      const mapPos = minimapSystem.worldToMinimap(marker.x, marker.z);
      const screenX = mapPos.x * this.canvas.width;
      const screenY = mapPos.y * this.canvas.height;

      // Verificar se está dentro dos limites
      if (screenX < 0 || screenX > this.canvas.width ||
          screenY < 0 || screenY > this.canvas.height) {
        continue;
      }

      if (displayMode === 'sprites') {
        // Modo sprites: desenhar mini versão do sprite
        this.drawSpriteMarker(ctx, minimapSystem, marker, screenX, screenY, settings);
      } else {
        // Modo markers: símbolos simples
        this.drawSimpleMarker(ctx, marker, screenX, screenY);
      }
    }
  }

  /**
   * Desenha marcador simples (modo markers)
   */
  drawSimpleMarker(ctx, marker, screenX, screenY) {
    ctx.fillStyle = marker.color;

    // Desenhar baseado no tipo
    if (marker.type === 'enemy') {
      // Triângulo para inimigo
      this.drawTriangle(ctx, screenX, screenY, marker.size);
    } else if (marker.type === 'item') {
      // Quadrado para item
      this.drawSquare(ctx, screenX, screenY, marker.size);
    } else if (marker.type === 'waypoint') {
      // Losango para waypoint
      this.drawDiamond(ctx, screenX, screenY, marker.size);
    } else if (marker.type === 'platform' || marker.type === 'obstacle') {
      // Retângulo para plataforma/obstacle
      this.drawPlatformMarker(ctx, marker, screenX, screenY);
    } else {
      // Círculo para outros
      ctx.beginPath();
      ctx.arc(screenX, screenY, marker.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Desenha marcador de plataforma (retângulo proporcional)
   */
  drawPlatformMarker(ctx, marker, screenX, screenY) {
    const scale = marker.scale || { x: 1, y: 1 };
    // Escala proporcional ao tamanho do objeto (mínimo maior para melhor visibilidade)
    const width = Math.max(marker.size || 5, Math.abs(scale.x) * 3);
    const height = Math.max(marker.size || 5, Math.abs(scale.y) * 3);

    ctx.fillRect(
      screenX - width / 2,
      screenY - height / 2,
      width,
      height
    );
  }

  /**
   * Desenha mini sprite (modo sprites)
   */
  drawSpriteMarker(ctx, minimapSystem, marker, screenX, screenY, settings) {
    const scale = marker.scale || { x: 1, y: 1 };

    // Calcular tamanho do sprite no minimap
    const bounds = settings.worldBounds;
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxZ - bounds.minZ;

    // Converter escala do mundo para pixels do minimap
    const pixelWidth = Math.max(2, (Math.abs(scale.x) / worldWidth) * this.canvas.width);
    const pixelHeight = Math.max(2, (Math.abs(scale.y) / worldHeight) * this.canvas.height);

    // Obter cor do sprite
    let color = marker.color;
    if (marker.spriteColor) {
      if (typeof marker.spriteColor === 'object' && marker.spriteColor.getHexString) {
        color = '#' + marker.spriteColor.getHexString();
      } else if (typeof marker.spriteColor === 'number') {
        color = '#' + marker.spriteColor.toString(16).padStart(6, '0');
      }
    }

    ctx.fillStyle = color;
    ctx.fillRect(
      screenX - pixelWidth / 2,
      screenY - pixelHeight / 2,
      pixelWidth,
      pixelHeight
    );

    // Adicionar borda para melhor visualização
    if (marker.type !== 'platform') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(
        screenX - pixelWidth / 2,
        screenY - pixelHeight / 2,
        pixelWidth,
        pixelHeight
      );
    }
  }

  /**
   * Desenha o marcador do player
   */
  drawPlayer(minimapSystem, position, rotation, cameraAngle, settings) {
    const ctx = this.ctx;
    const is2D = minimapSystem.is2D;


    // O player está sempre no centro do minimap
    const screenX = this.canvas.width / 2;
    const screenY = this.canvas.height / 2;

    ctx.save();
    ctx.translate(screenX, screenY);

    // Rotacionar se mostrar direção
    if (settings.showPlayerDirection) {
      if (is2D) {
        // Modo 2D - direção baseada no movimento:
        // rotation vem de atan2(dy, dx):
        //   0 = direita (X+), PI/2 = cima (Y+), PI = esquerda, -PI/2 = baixo
        // No canvas, a seta padrão aponta para cima (rotate=0)
        //   rotate(PI/2) = direita, rotate(PI) = baixo, rotate(-PI/2) = esquerda
        // Conversão: rotate = PI/2 - rotation
        ctx.rotate(Math.PI / 2 - rotation);
      } else if (settings.rotateWithCamera && cameraAngle !== undefined) {
        // Modo 3D com câmera rotacionando:
        // A seta do player deve mostrar a direção relativa à câmera
        const relativeRotation = rotation - cameraAngle;
        ctx.rotate(Math.PI - relativeRotation);
      } else {
        // Modo 3D com minimap fixo (norte sempre em cima):
        // rotation.y = 0 significa olhando para Z+ (Sul no minimap)
        // A seta deve apontar para baixo quando rotation = 0
        ctx.rotate(Math.PI - rotation);
      }
    }

    // Desenhar player
    ctx.fillStyle = settings.playerColor;

    if (settings.showPlayerDirection) {
      // Seta apontando para cima (forward no sistema de coordenadas do canvas)
      const size = settings.playerSize;
      ctx.beginPath();
      ctx.moveTo(0, -size); // Ponta
      ctx.lineTo(-size * 0.6, size * 0.6); // Esquerda
      ctx.lineTo(0, size * 0.3); // Centro
      ctx.lineTo(size * 0.6, size * 0.6); // Direita
      ctx.closePath();
      ctx.fill();
    } else {
      // Círculo simples
      ctx.beginPath();
      ctx.arc(0, 0, settings.playerSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Desenha borda do minimap
   */
  drawBorder(settings) {
    const ctx = this.ctx;
    ctx.strokeStyle = settings.borderColor;
    ctx.lineWidth = settings.borderWidth;

    if (settings.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(this.centerX, this.centerY, this.radius - settings.borderWidth / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(
        settings.borderWidth / 2,
        settings.borderWidth / 2,
        this.canvas.width - settings.borderWidth,
        this.canvas.height - settings.borderWidth
      );
    }
  }

  /**
   * Desenha indicadores de orientação (N, S, L, O)
   */
  drawCompass(settings, cameraAngle) {
    const ctx = this.ctx;
    const padding = 8;
    const fontSize = 10;

    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Cor do texto (usar cor da borda ou branco)
    ctx.fillStyle = settings.borderColor || '#ffffff';

    // Sombra para melhor legibilidade
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    if (settings.shape === 'circle') {
      const r = this.radius - padding;

      if (settings.rotateWithCamera && cameraAngle !== undefined) {
        // Quando o minimap rotaciona, os indicadores também rotacionam
        // Cada indicador é posicionado em um ângulo específico + o ângulo da câmera
        const positions = [
          { label: 'N', angle: 0 },           // Norte = topo (0°)
          { label: 'L', angle: Math.PI / 2 }, // Leste = direita (90°)
          { label: 'S', angle: Math.PI },     // Sul = baixo (180°)
          { label: 'O', angle: -Math.PI / 2 } // Oeste = esquerda (-90°)
        ];

        for (const pos of positions) {
          const totalAngle = pos.angle + cameraAngle;
          const x = this.centerX + Math.sin(totalAngle) * r;
          const y = this.centerY - Math.cos(totalAngle) * r;
          ctx.fillText(pos.label, x, y);
        }
      } else {
        // Minimap fixo - posições estáticas
        // N (Norte) - topo
        ctx.fillText('N', this.centerX, this.centerY - r);

        // S (Sul) - baixo
        ctx.fillText('S', this.centerX, this.centerY + r);

        // L (Leste) - direita
        ctx.fillText('L', this.centerX + r, this.centerY);

        // O (Oeste) - esquerda
        ctx.fillText('O', this.centerX - r, this.centerY);
      }
    } else {
      // Para quadrado/retângulo - não rotaciona (ficaria estranho)
      // N (Norte) - topo centro
      ctx.fillText('N', this.canvas.width / 2, padding + fontSize / 2);

      // S (Sul) - baixo centro
      ctx.fillText('S', this.canvas.width / 2, this.canvas.height - padding - fontSize / 2);

      // L (Leste) - direita centro
      ctx.fillText('L', this.canvas.width - padding - fontSize / 2, this.canvas.height / 2);

      // O (Oeste) - esquerda centro
      ctx.fillText('O', padding + fontSize / 2, this.canvas.height / 2);
    }

    // Limpar sombra
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // ========== HELPERS ==========

  /**
   * Desenha triângulo (inimigo)
   */
  drawTriangle(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y - size / 2);
    ctx.lineTo(x - size / 2, y + size / 2);
    ctx.lineTo(x + size / 2, y + size / 2);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Desenha quadrado (item)
   */
  drawSquare(ctx, x, y, size) {
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }

  /**
   * Desenha losango (waypoint)
   */
  drawDiamond(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y - size / 2);
    ctx.lineTo(x + size / 2, y);
    ctx.lineTo(x, y + size / 2);
    ctx.lineTo(x - size / 2, y);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Converte cor hex para RGB
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  /**
   * Limpa recursos
   */
  dispose() {
    this.ctx = null;
    this.canvas = null;
    this.fogImageData = null;
  }
}
