import * as THREE from 'three';

/**
 * Camera2D - Câmera ortográfica para jogos 2D
 *
 * Features:
 * - Projeção ortográfica (sem perspectiva)
 * - Zoom com scroll
 * - Pan com drag
 * - Follow target (seguir objeto)
 * - Bounds (limites do mundo)
 */
export default class Camera2D {
  constructor(options = {}) {
    const {
      width = window.innerWidth,
      height = window.innerHeight,
      zoom = 1,
      near = 0.1,
      far = 1000,
      backgroundColor = 0x1e1e1e
    } = options;

    // Ensure valid dimensions (fallback to window size or default)
    this.width = width > 0 ? width : (window.innerWidth || 800);
    this.height = height > 0 ? height : (window.innerHeight || 600);
    this.zoom = zoom;
    this.targetZoom = zoom;
    this.zoomSpeed = 0.1;
    this.minZoom = 0.1;
    this.maxZoom = 10;

    // Calcular aspect ratio (using validated dimensions)
    const aspect = this.width / this.height;
    const viewSize = 5; // Unidades visíveis verticalmente

    // Criar câmera ortográfica
    this.camera = new THREE.OrthographicCamera(
      -viewSize * aspect,  // left
      viewSize * aspect,   // right
      viewSize,            // top
      -viewSize,           // bottom
      near,
      far
    );

    // Posição inicial (olhando para baixo no eixo Z)
    this.camera.position.set(0, 0, 100);
    this.camera.lookAt(0, 0, 0);

    // Estado do controle
    this.position = new THREE.Vector2(0, 0);
    this.targetPosition = new THREE.Vector2(0, 0);

    // Follow
    this.followTarget = null;
    this.followSmoothing = 5; // Velocidade do follow
    this.followOffset = new THREE.Vector2(0, 0);

    // Camera mode: 'follow' (MU style) ou 'free' (Dota style)
    this.cameraMode = 'follow';

    // Bounds (limites do mundo)
    this.bounds = null; // { minX, maxX, minY, maxY }

    // Pan com drag
    this.isPanning = false;
    this.panStart = new THREE.Vector2();
    this.panDelta = new THREE.Vector2();

    // Background color
    this.backgroundColor = backgroundColor;

    // Referência ao objeto selecionado para atalho de foco
    this.selectedObjectRef = null;

    // Edge scrolling (mover câmera quando mouse na borda) - desabilitado por padrão (só no Game mode)
    this.edgeScrollEnabled = false;
    this.edgeScrollMargin = 30; // pixels da borda para ativar
    this.edgeScrollSpeed = 8; // velocidade do scroll
    this.mousePosition = { x: 0, y: 0 };
    this.edgeScrollDirection = { x: 0, y: 0 };
    this.currentEdgeCursor = 'default';

    // Game mode - confinar cursor ao canvas
    this.isGameMode = false;
    this.virtualMouseX = 0;
    this.virtualMouseY = 0;
    this.customCursorElement = null;
    this.isMouseOutside = false; // Mouse está fora do canvas?

    // Cursor settings
    this.cursorSettings = {
      hideSystemCursor: true,
      cursorStyle: 'circle', // 'circle', 'crosshair', 'arrow', 'custom'
      cursorSize: 20,
      cursorColor: '#ffffff',
      customCursors: {
        default: null,
        up: null,
        down: null,
        left: null,
        right: null,
        upLeft: null,
        upRight: null,
        downLeft: null,
        downRight: null
      }
    };
    this.loadedCursorImages = {}; // Cache de imagens carregadas

    // Bind handlers
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
  }

  /**
   * Ativa os controles da câmera
   */
  enable(domElement) {
    this.domElement = domElement;
    console.log('[Camera2D] Enabling controls on:', domElement);
    domElement.addEventListener('mousedown', this.onMouseDown);
    domElement.addEventListener('mouseup', this.onMouseUp);
    domElement.addEventListener('mouseleave', this.onMouseUp);
    domElement.addEventListener('wheel', this.onWheel, { passive: false });
    // Usar window para mousemove para capturar edge scroll nas bordas da janela
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
  }

  /**
   * Define referência ao objeto selecionado para atalho de foco (F key)
   */
  setSelectedObject(object) {
    this.selectedObjectRef = object;
  }

  /**
   * Desativa os controles
   */
  disable() {
    if (this.domElement) {
      this.domElement.removeEventListener('mousedown', this.onMouseDown);
      this.domElement.removeEventListener('mouseup', this.onMouseUp);
      this.domElement.removeEventListener('mouseleave', this.onMouseUp);
      this.domElement.removeEventListener('wheel', this.onWheel);
      // Restaurar cursor
      this.domElement.style.cursor = 'default';
    }
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);

    // Reset edge scroll state
    this.edgeScrollDirection.x = 0;
    this.edgeScrollDirection.y = 0;
    this.currentEdgeCursor = 'default';
  }

  /**
   * Habilita/desabilita edge scrolling
   */
  setEdgeScrollEnabled(enabled) {
    this.edgeScrollEnabled = enabled;
    if (!enabled) {
      this.edgeScrollDirection.x = 0;
      this.edgeScrollDirection.y = 0;
      this.setCursor('default');
    }
  }

  /**
   * Configura edge scrolling
   */
  setEdgeScrollSettings(margin, speed) {
    if (margin !== undefined) this.edgeScrollMargin = margin;
    if (speed !== undefined) this.edgeScrollSpeed = speed;
  }

  /**
   * Ativa Game Mode com cursor confinado
   * @param {Object} settings - Configurações do cursor
   */
  enableGameMode(settings = {}) {
    if (!this.domElement) return;

    this.isGameMode = true;

    // Aplicar configurações de cursor
    this.cursorSettings = {
      ...this.cursorSettings,
      ...settings
    };

    // Só criar cursor customizado se hideSystemCursor estiver ativo
    if (this.cursorSettings.hideSystemCursor) {
      // Carregar imagens de cursor customizado se fornecidas
      this.loadCustomCursorImages();

      // Criar cursor customizado
      this.createCustomCursor();

      // Inicializar posição virtual do mouse no centro
      const rect = this.domElement.getBoundingClientRect();
      this.virtualMouseX = rect.width / 2;
      this.virtualMouseY = rect.height / 2;

      // Esconder cursor real em todo o canvas
      this.domElement.style.cursor = 'none';

      // Adicionar classe CSS para garantir que cursor fique escondido
      this.domElement.classList.add('hide-cursor');

      // Ativar Pointer Lock quando clicar
      this.pointerLockHandler = this.requestPointerLock.bind(this);
      this.domElement.addEventListener('click', this.pointerLockHandler);
    }

    console.log('[Camera2D] Game mode enabled with cursor settings:', this.cursorSettings);
  }

  /**
   * Carrega imagens de cursor customizado
   */
  loadCustomCursorImages() {
    const customCursors = this.cursorSettings.customCursors || {};

    Object.entries(customCursors).forEach(([key, imagePath]) => {
      if (imagePath && typeof imagePath === 'string') {
        const img = new Image();
        img.onload = () => {
          this.loadedCursorImages[key] = img;
          console.log(`[Camera2D] Loaded custom cursor: ${key}`);
        };
        img.onerror = () => {
          console.warn(`[Camera2D] Failed to load cursor image: ${key} - ${imagePath}`);
        };
        img.src = imagePath;
      }
    });
  }

  /**
   * Desativa Game Mode
   */
  disableGameMode() {
    this.isGameMode = false;

    // Remover cursor customizado
    if (this.customCursorElement) {
      try {
        this.customCursorElement.remove();
      } catch (e) {
        // Fallback para browsers antigos
        if (this.customCursorElement.parentNode) {
          this.customCursorElement.parentNode.removeChild(this.customCursorElement);
        }
      }
      this.customCursorElement = null;
    }

    // Remover qualquer cursor .game-cursor órfão que possa ter ficado
    document.querySelectorAll('.game-cursor').forEach(el => el.remove());

    // Remover listener de pointer lock
    if (this.domElement && this.pointerLockHandler) {
      this.domElement.removeEventListener('click', this.pointerLockHandler);
      this.pointerLockHandler = null;
    }

    // Restaurar cursor
    if (this.domElement) {
      this.domElement.style.cursor = 'default';
      this.domElement.classList.remove('hide-cursor');
    }

    // Sair do Pointer Lock
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    // Reset edge scroll state
    this.edgeScrollDirection.x = 0;
    this.edgeScrollDirection.y = 0;

    console.log('[Camera2D] Game mode disabled');
  }

  /**
   * Solicita Pointer Lock
   */
  requestPointerLock() {
    if (this.isGameMode && this.domElement && !document.pointerLockElement) {
      this.domElement.requestPointerLock();
    }
  }

  /**
   * Cria elemento de cursor customizado
   */
  createCustomCursor() {
    // Remover qualquer cursor existente primeiro
    if (this.customCursorElement) {
      this.customCursorElement.remove();
      this.customCursorElement = null;
    }

    // Limpar cursores órfãos
    document.querySelectorAll('.game-cursor').forEach(el => el.remove());

    const size = this.cursorSettings.cursorSize || 20;

    this.customCursorElement = document.createElement('div');
    this.customCursorElement.className = 'game-cursor';
    this.customCursorElement.style.cssText = `
      position: fixed;
      width: ${size}px;
      height: ${size}px;
      pointer-events: none;
      z-index: 99999;
      transform: translate(-50%, -50%);
      transition: none;
    `;

    // Renderizar cursor inicial baseado no estilo
    this.renderCursor('default');

    document.body.appendChild(this.customCursorElement);
  }

  /**
   * Renderiza o cursor baseado no tipo e direção
   * @param {string} direction - 'default', 'up', 'down', 'left', 'right', 'upLeft', 'upRight', 'downLeft', 'downRight'
   */
  renderCursor(direction = 'default') {
    if (!this.customCursorElement) return;

    const size = this.cursorSettings.cursorSize || 20;
    const color = this.cursorSettings.cursorColor || '#ffffff';
    const style = this.cursorSettings.cursorStyle || 'circle';

    // Verificar se tem imagem customizada para esta direção
    const customImage = this.loadedCursorImages[direction] || this.loadedCursorImages['default'];
    if (customImage && this.cursorSettings.cursorStyle === 'custom') {
      this.customCursorElement.innerHTML = '';
      const img = customImage.cloneNode();
      img.style.width = size + 'px';
      img.style.height = size + 'px';
      this.customCursorElement.appendChild(img);
      return;
    }

    // SVG baseado no estilo
    let svg = '';
    const half = size / 2;
    const strokeWidth = Math.max(1, size / 10);
    const innerRadius = Math.max(1, size / 10);
    const outerRadius = half - strokeWidth;

    switch (style) {
      case 'crosshair':
        svg = `
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <line x1="${half}" y1="0" x2="${half}" y2="${half - innerRadius * 2}" stroke="${color}" stroke-width="${strokeWidth}"/>
            <line x1="${half}" y1="${half + innerRadius * 2}" x2="${half}" y2="${size}" stroke="${color}" stroke-width="${strokeWidth}"/>
            <line x1="0" y1="${half}" x2="${half - innerRadius * 2}" y2="${half}" stroke="${color}" stroke-width="${strokeWidth}"/>
            <line x1="${half + innerRadius * 2}" y1="${half}" x2="${size}" y2="${half}" stroke="${color}" stroke-width="${strokeWidth}"/>
            <circle cx="${half}" cy="${half}" r="${innerRadius}" fill="${color}"/>
          </svg>
        `;
        break;

      case 'arrow':
        svg = `
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <polygon points="${half},${strokeWidth} ${size - strokeWidth},${size - strokeWidth} ${strokeWidth},${size - strokeWidth}"
                     fill="${color}" stroke="black" stroke-width="1"/>
          </svg>
        `;
        break;

      case 'dot':
        // Apenas um ponto no centro
        const dotRadius = Math.max(3, size / 4);
        svg = `
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <circle cx="${half}" cy="${half}" r="${dotRadius}" fill="black"/>
            <circle cx="${half}" cy="${half}" r="${dotRadius - 1}" fill="${color}"/>
          </svg>
        `;
        break;

      case 'circle':
      default:
        svg = `
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <circle cx="${half}" cy="${half}" r="${outerRadius}" fill="none" stroke="black" stroke-width="${strokeWidth + 1}"/>
            <circle cx="${half}" cy="${half}" r="${outerRadius}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"/>
            <circle cx="${half}" cy="${half}" r="${innerRadius}" fill="${color}"/>
          </svg>
        `;
        break;
    }

    this.customCursorElement.innerHTML = svg;
  }

  /**
   * Atualiza posição do cursor customizado
   */
  updateCustomCursor() {
    if (!this.customCursorElement || !this.domElement) return;

    const rect = this.domElement.getBoundingClientRect();

    // Posição absoluta na tela
    const screenX = rect.left + this.virtualMouseX;
    const screenY = rect.top + this.virtualMouseY;

    this.customCursorElement.style.left = screenX + 'px';
    this.customCursorElement.style.top = screenY + 'px';

    // Mudar aparência baseado na direção do edge scroll
    this.updateCursorAppearance();
  }

  /**
   * Atualiza aparência do cursor baseado na direção
   */
  updateCursorAppearance() {
    if (!this.customCursorElement) return;

    const dirX = this.edgeScrollDirection.x;
    const dirY = this.edgeScrollDirection.y;

    // Determinar direção para cursor customizado
    let direction = 'default';
    if (dirX !== 0 || dirY !== 0) {
      if (dirX < 0 && dirY > 0) direction = 'upLeft';
      else if (dirX > 0 && dirY > 0) direction = 'upRight';
      else if (dirX < 0 && dirY < 0) direction = 'downLeft';
      else if (dirX > 0 && dirY < 0) direction = 'downRight';
      else if (dirX < 0) direction = 'left';
      else if (dirX > 0) direction = 'right';
      else if (dirY > 0) direction = 'up';
      else if (dirY < 0) direction = 'down';
    }

    // Verificar se tem cursor customizado para esta direção
    const customImage = this.loadedCursorImages[direction] || this.loadedCursorImages['default'];
    if (customImage && this.cursorSettings.cursorStyle === 'custom') {
      this.renderCursor(direction);
      return;
    }

    const size = this.cursorSettings.cursorSize || 20;
    const color = this.cursorSettings.cursorColor || '#ffffff';

    let svg = '';

    if (dirX !== 0 || dirY !== 0) {
      // Cursor de seta na direção do movimento
      const angle = Math.atan2(-dirY, dirX) * (180 / Math.PI);
      svg = `
        <svg width="${size + 4}" height="${size + 4}" viewBox="0 0 24 24" style="transform: rotate(${angle}deg)">
          <path d="M4 12 L20 12 M14 6 L20 12 L14 18" fill="none" stroke="black" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4 12 L20 12 M14 6 L20 12 L14 18" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    } else {
      // Cursor padrão - usar renderCursor para consistência
      this.renderCursor('default');
      return;
    }

    this.customCursorElement.innerHTML = svg;
  }

  /**
   * Keyboard handler - atalhos
   * F ou Home = Focar no objeto selecionado (ou origem se nada selecionado)
   */
  onKeyDown(event) {
    // F ou Home = Focar no objeto selecionado ou origem
    if (event.code === 'KeyF' || event.code === 'Home') {
      console.log('[Camera2D] F key pressed, focusing on selected or origin');
      this.focusOnSelected();
      event.preventDefault();
    }
  }

  /**
   * Define a cena para buscar player
   */
  setScene(scene) {
    this.scene = scene;
  }

  /**
   * Centraliza câmera no objeto selecionado ou origem (0,0)
   */
  focusOnSelected() {
    // Se tem objeto selecionado, focar nele
    if (this.selectedObjectRef) {
      const objPos = this.selectedObjectRef.position;
      this.position.set(objPos.x, objPos.y);
      this.targetPosition.set(objPos.x, objPos.y);
      console.log('[Camera2D] Focused on selected object at:', objPos.x, objPos.y);
      return;
    }

    // Se não tem objeto selecionado, focar na origem (0, 0)
    this.position.set(0, 0);
    this.targetPosition.set(0, 0);
    console.log('[Camera2D] No object selected, centering on origin (0, 0)');
  }

  /**
   * Centraliza câmera no player (usado pelo Game mode)
   */
  focusOnPlayer() {
    // Se tem playerRef direto, usar
    if (this.playerRef) {
      const playerPos = this.playerRef.position;
      this.position.set(playerPos.x, playerPos.y);
      this.targetPosition.set(playerPos.x, playerPos.y);
      console.log('[Camera2D] Focused on player at:', playerPos.x, playerPos.y);
      return;
    }

    // Senão, procurar na cena
    if (this.scene) {
      let player = null;
      this.scene.traverse((child) => {
        if (child.userData?.isPlayer) {
          player = child;
        }
      });

      if (player) {
        const playerPos = player.position;
        this.position.set(playerPos.x, playerPos.y);
        this.targetPosition.set(playerPos.x, playerPos.y);
        console.log('[Camera2D] Found and focused on player at:', playerPos.x, playerPos.y);
      } else {
        // Não encontrou player, centralizar na origem
        this.position.set(0, 0);
        this.targetPosition.set(0, 0);
        console.log('[Camera2D] No player found, centering on origin');
      }
    }
  }

  /**
   * Define objeto para seguir
   */
  setFollowTarget(target, offset = { x: 0, y: 0 }) {
    this.followTarget = target;
    this.followOffset.set(offset.x, offset.y);
  }

  /**
   * Remove follow target
   */
  clearFollowTarget() {
    this.followTarget = null;
  }

  /**
   * Define o modo da câmera
   * @param {'follow'|'free'} mode - 'follow' (MU) ou 'free' (Dota)
   */
  setCameraMode(mode) {
    this.cameraMode = mode;
    console.log('[Camera2D] Camera mode set to:', mode);
  }

  /**
   * Retorna o modo da câmera
   */
  getCameraMode() {
    return this.cameraMode;
  }

  /**
   * Define limites do mundo
   */
  setBounds(minX, maxX, minY, maxY) {
    this.bounds = { minX, maxX, minY, maxY };
  }

  /**
   * Remove limites
   */
  clearBounds() {
    this.bounds = null;
  }

  /**
   * Mouse down - início do pan
   */
  onMouseDown(event) {
    console.log('[Camera2D] MouseDown:', event.button, 'shiftKey:', event.shiftKey);
    if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
      // Middle click ou Shift+Left click para pan
      console.log('[Camera2D] Starting pan');
      this.isPanning = true;
      this.panStart.set(event.clientX, event.clientY);
      event.preventDefault();
    }
  }

  /**
   * Mouse move - pan e edge scrolling
   */
  onMouseMove(event) {
    // Game mode com Pointer Lock - usar movimento relativo
    if (this.isGameMode && document.pointerLockElement) {
      this.handlePointerLockMove(event);
      return;
    }

    // Salvar posição do mouse para edge scrolling
    this.mousePosition.x = event.clientX;
    this.mousePosition.y = event.clientY;

    // Detectar edge scrolling (só se não estiver fazendo pan)
    if (!this.isPanning && this.edgeScrollEnabled) {
      this.updateEdgeScroll();
    } else if (this.isGameMode && this.customCursorElement) {
      // Game mode sem edge scroll - ainda atualizar cursor customizado
      const rect = this.domElement.getBoundingClientRect();
      this.virtualMouseX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
      this.virtualMouseY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
      this.updateCustomCursor();
    }

    if (this.isPanning) {
      this.panDelta.set(
        event.clientX - this.panStart.x,
        event.clientY - this.panStart.y
      );

      // Converter pixels para unidades do mundo
      const worldDelta = this.screenToWorldDelta(this.panDelta.x, this.panDelta.y);

      this.position.x -= worldDelta.x;
      this.position.y += worldDelta.y; // Invertido porque Y da tela é invertido

      // IMPORTANTE: Atualizar targetPosition também para a câmera ficar onde deixou
      this.targetPosition.x = this.position.x;
      this.targetPosition.y = this.position.y;

      // No modo 'free', limpar followTarget durante pan manual
      // No modo 'follow', manter o followTarget (câmera volta a seguir após pan)
      if (this.cameraMode === 'free' && this.followTarget) {
        this.followTarget = null;
      }

      this.panStart.set(event.clientX, event.clientY);
    }
  }

  /**
   * Processa movimento com Pointer Lock (cursor confinado)
   */
  handlePointerLockMove(event) {
    if (!this.domElement) return;

    const rect = this.domElement.getBoundingClientRect();
    const margin = this.edgeScrollMargin;

    // Atualizar posição virtual com movimento relativo
    this.virtualMouseX += event.movementX;
    this.virtualMouseY += event.movementY;

    // Confinar cursor virtual dentro do canvas
    this.virtualMouseX = Math.max(0, Math.min(rect.width, this.virtualMouseX));
    this.virtualMouseY = Math.max(0, Math.min(rect.height, this.virtualMouseY));

    // Calcular direção do edge scroll baseado na posição virtual
    let dirX = 0;
    let dirY = 0;

    // Borda esquerda
    if (this.virtualMouseX <= margin) {
      dirX = -1;
      this.virtualMouseX = 0; // Travar na borda
    }
    // Borda direita
    else if (this.virtualMouseX >= rect.width - margin) {
      dirX = 1;
      this.virtualMouseX = rect.width; // Travar na borda
    }

    // Borda superior
    if (this.virtualMouseY <= margin) {
      dirY = 1;
      this.virtualMouseY = 0; // Travar na borda
    }
    // Borda inferior
    else if (this.virtualMouseY >= rect.height - margin) {
      dirY = -1;
      this.virtualMouseY = rect.height; // Travar na borda
    }

    this.edgeScrollDirection.x = dirX;
    this.edgeScrollDirection.y = dirY;

    // Atualizar mousePosition para outras funções
    this.mousePosition.x = rect.left + this.virtualMouseX;
    this.mousePosition.y = rect.top + this.virtualMouseY;

    // Atualizar cursor customizado
    this.updateCustomCursor();
  }

  /**
   * Atualiza edge scrolling baseado na posição do mouse
   * Continua scrollando mesmo se mouse sair do canvas na direção do scroll
   * Mantém cursor customizado travado na borda
   */
  updateEdgeScroll() {
    if (!this.domElement) return;

    const margin = this.edgeScrollMargin;
    const rect = this.domElement.getBoundingClientRect();

    // Posição do mouse real
    const mouseX = this.mousePosition.x;
    const mouseY = this.mousePosition.y;

    // Posição relativa ao canvas
    const relX = mouseX - rect.left;
    const relY = mouseY - rect.top;

    // Verificar se mouse está completamente dentro (fora das margens)
    const isInsideCenter = relX > margin && relX < rect.width - margin &&
                           relY > margin && relY < rect.height - margin;

    // Se mouse está no centro do canvas, resetar estado e sincronizar
    if (isInsideCenter) {
      this.isMouseOutside = false;
      this.virtualMouseX = relX;
      this.virtualMouseY = relY;
      this.edgeScrollDirection.x = 0;
      this.edgeScrollDirection.y = 0;
      this.setCursor('default');

      if (this.isGameMode && this.customCursorElement) {
        this.updateCustomCursor();
      }
      return;
    }

    // Calcular direção do scroll e posição do cursor virtual
    let dirX = 0;
    let dirY = 0;
    let cursorX = relX;
    let cursorY = relY;

    // Borda esquerda
    if (relX <= margin) {
      dirX = -1;
      cursorX = margin / 2;
      if (relX < 0) this.isMouseOutside = true;
    }
    // Borda direita
    if (relX >= rect.width - margin) {
      dirX = 1;
      cursorX = rect.width - margin / 2;
      if (relX > rect.width) this.isMouseOutside = true;
    }

    // Borda superior
    if (relY <= margin) {
      dirY = 1;
      cursorY = margin / 2;
      if (relY < 0) this.isMouseOutside = true;
    }
    // Borda inferior
    if (relY >= rect.height - margin) {
      dirY = -1;
      cursorY = rect.height - margin / 2;
      if (relY > rect.height) this.isMouseOutside = true;
    }

    // Definir cursor baseado na direção
    let cursor = 'default';
    if (dirX !== 0 || dirY !== 0) {
      cursor = this.getEdgeCursor(dirX, dirY);
    }

    this.edgeScrollDirection.x = dirX;
    this.edgeScrollDirection.y = dirY;
    this.setCursor(cursor);

    // Atualizar cursor customizado (Game mode)
    if (this.isGameMode && this.customCursorElement) {
      // Cursor trava na borda quando está na margem ou fora
      this.virtualMouseX = cursorX;
      this.virtualMouseY = cursorY;
      this.updateCustomCursor();
    }
  }

  /**
   * Retorna o cursor apropriado para a direção
   */
  getEdgeCursor(dirX, dirY) {
    // Diagonal cima-esquerda
    if (dirX < 0 && dirY > 0) return 'nw-resize';
    // Diagonal cima-direita
    if (dirX > 0 && dirY > 0) return 'ne-resize';
    // Diagonal baixo-esquerda
    if (dirX < 0 && dirY < 0) return 'sw-resize';
    // Diagonal baixo-direita
    if (dirX > 0 && dirY < 0) return 'se-resize';
    // Esquerda
    if (dirX < 0) return 'w-resize';
    // Direita
    if (dirX > 0) return 'e-resize';
    // Cima
    if (dirY > 0) return 'n-resize';
    // Baixo
    if (dirY < 0) return 's-resize';

    return 'default';
  }

  /**
   * Define o cursor do elemento
   */
  setCursor(cursor) {
    if (this.currentEdgeCursor === cursor) return;
    this.currentEdgeCursor = cursor;

    if (this.domElement) {
      // Se está no Game mode com cursor customizado, manter escondido
      if (this.isGameMode && this.cursorSettings.hideSystemCursor) {
        this.domElement.style.cursor = 'none';
      } else {
        this.domElement.style.cursor = cursor;
      }
    }
  }

  /**
   * Mouse up - fim do pan
   */
  onMouseUp() {
    this.isPanning = false;
  }

  /**
   * Wheel - zoom
   */
  onWheel(event) {
    console.log('[Camera2D] Wheel:', event.deltaY);
    event.preventDefault();

    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoom * zoomFactor));
  }

  /**
   * Resize handler
   */
  onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.updateProjection();
  }

  /**
   * Atualiza a projeção da câmera
   */
  updateProjection() {
    // Guard against zero dimensions
    if (this.width <= 0 || this.height <= 0) {
      console.warn('[Camera2D] Invalid dimensions:', this.width, this.height);
      return;
    }

    const aspect = this.width / this.height;
    const viewSize = 5 / this.zoom;

    this.camera.left = -viewSize * aspect;
    this.camera.right = viewSize * aspect;
    this.camera.top = viewSize;
    this.camera.bottom = -viewSize;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Converte delta de pixels para delta do mundo
   */
  screenToWorldDelta(dx, dy) {
    const aspect = this.width / this.height;
    const viewSize = 5 / this.zoom;

    return {
      x: (dx / this.width) * viewSize * 2 * aspect,
      y: (dy / this.height) * viewSize * 2
    };
  }

  /**
   * Converte posição da tela para posição do mundo
   */
  screenToWorld(screenX, screenY) {
    const aspect = this.width / this.height;
    const viewSize = 5 / this.zoom;

    // Normalizar coordenadas (-1 a 1)
    const nx = (screenX / this.width) * 2 - 1;
    const ny = -(screenY / this.height) * 2 + 1;

    return {
      x: this.position.x + nx * viewSize * aspect,
      y: this.position.y + ny * viewSize
    };
  }

  /**
   * Converte posição do mundo para posição da tela
   */
  worldToScreen(worldX, worldY) {
    const aspect = this.width / this.height;
    const viewSize = 5 / this.zoom;

    const nx = (worldX - this.position.x) / (viewSize * aspect);
    const ny = (worldY - this.position.y) / viewSize;

    return {
      x: (nx + 1) * 0.5 * this.width,
      y: (1 - ny) * 0.5 * this.height
    };
  }

  /**
   * Move para posição específica
   */
  moveTo(x, y, instant = false) {
    this.targetPosition.set(x, y);
    if (instant) {
      this.position.copy(this.targetPosition);
    }
  }

  /**
   * Define zoom
   */
  setZoom(zoom, instant = false) {
    this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    if (instant) {
      this.zoom = this.targetZoom;
      this.updateProjection();
    }
  }

  /**
   * Update chamado todo frame
   */
  update(deltaTime) {
    // Suavizar zoom
    if (Math.abs(this.zoom - this.targetZoom) > 0.001) {
      this.zoom += (this.targetZoom - this.zoom) * this.zoomSpeed;
      this.updateProjection();
    }

    // Edge scrolling - mover câmera quando mouse na borda
    // Só funciona no modo 'free' (Dota style). No modo 'follow' (MU style), a câmera segue o player
    if (this.edgeScrollEnabled && this.cameraMode === 'free' && (this.edgeScrollDirection.x !== 0 || this.edgeScrollDirection.y !== 0)) {
      // Calcular velocidade baseada no zoom (mais zoom = movimento mais lento)
      const scrollSpeed = this.edgeScrollSpeed / this.zoom;

      // Aplicar movimento
      this.position.x += this.edgeScrollDirection.x * scrollSpeed * deltaTime;
      this.position.y += this.edgeScrollDirection.y * scrollSpeed * deltaTime;

      // Atualizar target para manter a posição
      this.targetPosition.x = this.position.x;
      this.targetPosition.y = this.position.y;
    }

    // Follow target
    if (this.followTarget) {
      const targetPos = this.followTarget.position || this.followTarget;
      this.targetPosition.set(
        targetPos.x + this.followOffset.x,
        targetPos.y + this.followOffset.y
      );
    }

    // Suavizar movimento
    if (!this.isPanning) {
      this.position.x += (this.targetPosition.x - this.position.x) * deltaTime * this.followSmoothing;
      this.position.y += (this.targetPosition.y - this.position.y) * deltaTime * this.followSmoothing;
    }

    // Aplicar bounds
    if (this.bounds) {
      const aspect = this.width / this.height;
      const viewSize = 5 / this.zoom;
      const halfWidth = viewSize * aspect;
      const halfHeight = viewSize;

      this.position.x = Math.max(this.bounds.minX + halfWidth,
                        Math.min(this.bounds.maxX - halfWidth, this.position.x));
      this.position.y = Math.max(this.bounds.minY + halfHeight,
                        Math.min(this.bounds.maxY - halfHeight, this.position.y));
    }

    // Atualizar posição da câmera
    this.camera.position.x = this.position.x;
    this.camera.position.y = this.position.y;
  }

  /**
   * Retorna a câmera Three.js
   */
  getCamera() {
    return this.camera;
  }

  /**
   * Retorna zoom atual
   */
  getZoom() {
    return this.zoom;
  }

  /**
   * Retorna posição atual
   */
  getPosition() {
    return { x: this.position.x, y: this.position.y };
  }
}
