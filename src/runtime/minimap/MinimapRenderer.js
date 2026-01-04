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
   */
  drawBackgroundImage(settings) {
    const ctx = this.ctx;
    const img = settings.backgroundImageLoaded;
    const bounds = settings.worldBounds;

    // Dimensões do mundo
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxZ - bounds.minZ;

    // A imagem inteira representa o worldBounds
    // Desenhar a imagem escalada para caber no canvas
    // Considerando o scale (zoom) do minimap

    const scale = settings.scale || 1;

    if (scale === 1) {
      // Escala 1:1 - imagem inteira no canvas
      ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
    } else {
      // Com zoom - mostrar apenas parte da imagem centrada no player
      // Calcular posição do player normalizada (0-1)
      const playerNormX = (this.playerPosX - bounds.minX) / worldWidth;
      const playerNormZ = (this.playerPosZ - bounds.minZ) / worldHeight;

      // Tamanho visível do mundo (em unidades normalizadas 0-1)
      const visibleWidth = 1 / scale;
      const visibleHeight = 1 / scale;

      // Calcular região da imagem a mostrar (em pixels da imagem)
      const srcX = Math.max(0, (playerNormX - visibleWidth / 2) * img.width);
      const srcY = Math.max(0, (playerNormZ - visibleHeight / 2) * img.height);
      const srcW = Math.min(img.width - srcX, visibleWidth * img.width);
      const srcH = Math.min(img.height - srcY, visibleHeight * img.height);

      // Desenhar região da imagem no canvas
      ctx.drawImage(
        img,
        srcX, srcY, srcW, srcH,  // Região da imagem fonte
        0, 0, this.canvas.width, this.canvas.height  // Destino (canvas inteiro)
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
   * Desenha grid
   */
  drawGrid(minimapSystem, settings) {
    const ctx = this.ctx;
    const bounds = settings.worldBounds;
    const gridSize = settings.gridSize;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;

    // Linhas verticais
    for (let x = bounds.minX; x <= bounds.maxX; x += gridSize) {
      const mapPos = minimapSystem.worldToMinimap(x, bounds.minZ);
      const mapPosEnd = minimapSystem.worldToMinimap(x, bounds.maxZ);

      const screenX = mapPos.x * this.canvas.width;
      const screenY1 = mapPos.y * this.canvas.height;
      const screenY2 = mapPosEnd.y * this.canvas.height;

      ctx.beginPath();
      ctx.moveTo(screenX, screenY1);
      ctx.lineTo(screenX, screenY2);
      ctx.stroke();
    }

    // Linhas horizontais
    for (let z = bounds.minZ; z <= bounds.maxZ; z += gridSize) {
      const mapPos = minimapSystem.worldToMinimap(bounds.minX, z);
      const mapPosEnd = minimapSystem.worldToMinimap(bounds.maxX, z);

      const screenX1 = mapPos.x * this.canvas.width;
      const screenX2 = mapPosEnd.x * this.canvas.width;
      const screenY = mapPos.y * this.canvas.height;

      ctx.beginPath();
      ctx.moveTo(screenX1, screenY);
      ctx.lineTo(screenX2, screenY);
      ctx.stroke();
    }
  }

  /**
   * Desenha fog of war usando canvas API (não putImageData para preservar composição)
   */
  drawFogOfWar(minimapSystem, fogManager, settings) {
    const ctx = this.ctx;
    const fogData = fogManager.getRenderData();
    const { exploredGrid, visibleGrid, gridWidth, gridHeight, mode } = fogData;
    const fogSettings = settings.fogOfWar;

    // Calcular tamanho de cada célula no canvas
    const cellWidth = this.canvas.width / gridWidth;
    const cellHeight = this.canvas.height / gridHeight;

    // Converter cor de fog para RGB
    const fogColor = this.hexToRgb(fogSettings.unexploredColor);

    for (let gz = 0; gz < gridHeight; gz++) {
      for (let gx = 0; gx < gridWidth; gx++) {
        const index = gz * gridWidth + gx;
        const explored = exploredGrid[index] >= 1;
        const visible = visibleGrid[index] === 1;

        // Calcular opacidade baseada no modo e estado
        let alpha = 0;

        if (mode === 'permanent') {
          // Permanent: explorado = sem fog
          alpha = explored ? 0 : 1;
        } else if (mode === 'limited') {
          // Limited: só visível agora = sem fog
          alpha = visible ? 0 : 1;
        } else {
          // Hybrid: visível = sem fog, explorado = semi-transparente, não explorado = opaco
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
          const x = gx * cellWidth;
          const y = gz * cellHeight;

          ctx.fillStyle = `rgba(${fogColor.r}, ${fogColor.g}, ${fogColor.b}, ${alpha})`;
          ctx.fillRect(x, y, cellWidth + 0.5, cellHeight + 0.5); // +0.5 para evitar gaps
        }
      }
    }
  }

  /**
   * Desenha marcadores (enemies, items, waypoints)
   */
  drawMarkers(minimapSystem, markers, settings) {
    const ctx = this.ctx;

    for (const marker of markers) {
      const mapPos = minimapSystem.worldToMinimap(marker.x, marker.z);
      const screenX = mapPos.x * this.canvas.width;
      const screenY = mapPos.y * this.canvas.height;

      // Verificar se está dentro dos limites
      if (screenX < 0 || screenX > this.canvas.width ||
          screenY < 0 || screenY > this.canvas.height) {
        continue;
      }

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
      } else {
        // Círculo para outros
        ctx.beginPath();
        ctx.arc(screenX, screenY, marker.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Desenha o marcador do player
   */
  drawPlayer(minimapSystem, position, rotation, cameraAngle, settings) {
    const ctx = this.ctx;

    // Debug: verificar posição e rotação
    if (!this._debugLogged) {
      console.log('[MinimapRenderer] drawPlayer:', {
        position,
        rotation: rotation * (180 / Math.PI), // Em graus para debug
        cameraAngle: cameraAngle ? (cameraAngle * 180 / Math.PI).toFixed(1) : 'N/A',
        rotateWithCamera: settings.rotateWithCamera,
        canvasSize: { w: this.canvas.width, h: this.canvas.height }
      });
      this._debugLogged = true;
    }

    const mapPos = minimapSystem.worldToMinimap(position.x, position.z);
    const screenX = mapPos.x * this.canvas.width;
    const screenY = mapPos.y * this.canvas.height;

    ctx.save();
    ctx.translate(screenX, screenY);

    // Rotacionar se mostrar direção
    if (settings.showPlayerDirection) {
      if (settings.rotateWithCamera && cameraAngle !== undefined) {
        // Quando o minimap rotaciona com a câmera:
        // A seta do player deve mostrar a direção relativa à câmera
        // playerRotation é absoluto, cameraAngle é o ângulo da câmera
        // A diferença entre eles dá a direção relativa
        const relativeRotation = rotation - cameraAngle;
        ctx.rotate(Math.PI - relativeRotation);
      } else {
        // Minimap fixo (norte sempre em cima):
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
