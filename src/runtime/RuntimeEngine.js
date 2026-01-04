import GameLoop from './GameLoop';
import PlayerController from './PlayerController';
import CharacterController from './CharacterController';
import ClickToMoveController from './ClickToMoveController';
import ThirdPersonCamera from './ThirdPersonCamera';
import { ScriptManager } from './scripting';

/**
 * RuntimeEngine - Motor de execução do jogo
 * Detecta automaticamente o tipo de câmera baseado na hierarquia:
 * - Câmera filha do Player = Primeira Pessoa
 * - Câmera separada = Terceira Pessoa
 */
export default class RuntimeEngine {
  constructor(threeEngine) {
    this.threeEngine = threeEngine;
    this.isRunning = false;

    // Componentes
    this.gameLoop = new GameLoop();
    this.playerController = null;      // Primeira pessoa
    this.characterController = null;   // Terceira pessoa WASD (move o personagem)
    this.clickToMoveController = null; // Terceira pessoa Click to Move
    this.cameraController = null;      // Terceira pessoa (câmera que segue)

    // Sistema de Scripts
    this.scriptManager = new ScriptManager(threeEngine.scene);

    // Referências
    this.playerObject = null;
    this.mainCamera = null;
    this.isFirstPerson = false;

    // Câmera original (para restaurar depois)
    this.originalCameraPosition = null;
    this.originalCameraRotation = null;
    this.originalPlayerPosition = null;

    // Callbacks do game loop
    this.gameLoop.onUpdate = this.update.bind(this);
    this.gameLoop.onRender = this.render.bind(this);
    this.gameLoop.onFixedUpdate = this.fixedUpdate.bind(this);

    // Lista de entidades/scripts (legacy - usar scriptManager)
    this.entities = [];
  }

  /**
   * Encontra o objeto marcado como Player na cena
   */
  findPlayer() {
    let player = null;
    this.threeEngine.scene.traverse((child) => {
      // Ignorar objetos locked (como o Floor)
      if (child.userData?.isPlayer && !child.userData?.locked) {
        player = child;
      }
    });
    return player;
  }

  /**
   * Encontra a câmera principal do jogo
   * Prioridade: objeto marcado como MainCamera > câmera filha do player > câmera do editor
   */
  findMainCamera() {
    let mainCamera = null;

    // 1. Procurar por objeto marcado como MainCamera
    this.threeEngine.scene.traverse((child) => {
      if (child.userData?.isMainCamera) {
        mainCamera = child;
      }
    });

    if (mainCamera) return mainCamera;

    // 2. Se tem player, verificar se tem câmera filha
    if (this.playerObject) {
      for (const child of this.playerObject.children) {
        if (child.isCamera || child.userData?.isMainCamera) {
          return child;
        }
      }
    }

    // 3. Usar câmera do editor
    return this.threeEngine.cameraController.getCamera();
  }

  /**
   * Determina se é primeira pessoa baseado nas configurações do player
   */
  detectCameraMode() {
    if (!this.playerObject) return false;

    // Ler modo da configuração do player
    const cameraMode = this.playerObject.userData?.cameraMode || 'isometric';

    // firstPerson = primeira pessoa, qualquer outro = terceira pessoa
    return cameraMode === 'firstPerson';
  }

  /**
   * Inicia o runtime (chamado quando entra em Game mode)
   */
  start() {
    if (this.isRunning) return;

    console.log('[RuntimeEngine] Starting...');

    const editorCamera = this.threeEngine.cameraController.getCamera();
    const container = this.threeEngine.container;

    // Desabilitar seleção do editor (limpa seleção e esconde gizmos)
    if (this.threeEngine.selectionController) {
      this.threeEngine.selectionController.disable();
    }

    // Salvar estado original
    this.originalCameraPosition = editorCamera.position.clone();
    this.originalCameraRotation = editorCamera.rotation.clone();

    // Encontrar Player e Camera
    this.playerObject = this.findPlayer();
    this.mainCamera = this.findMainCamera();
    this.isFirstPerson = this.detectCameraMode();

    console.log('[RuntimeEngine] Player found:', !!this.playerObject);
    console.log('[RuntimeEngine] Mode:', this.isFirstPerson ? 'First Person' : 'Third Person');

    // Desativar OrbitControls do editor
    this.threeEngine.cameraController.disable();

    if (this.playerObject) {
      // Salvar posição original do player
      this.originalPlayerPosition = this.playerObject.position.clone();

      const cameraMode = this.playerObject.userData?.cameraMode || 'isometric';
      console.log('[RuntimeEngine] Camera Mode:', cameraMode, 'isFirstPerson:', this.isFirstPerson);

      if (cameraMode === 'firstPerson') {
        // === PRIMEIRA PESSOA ===
        console.log('[RuntimeEngine] Setting up First Person');
        this.setupFirstPerson(editorCamera, container);
      } else if (cameraMode === 'clickToMove') {
        // === CLICK TO MOVE ===
        console.log('[RuntimeEngine] Setting up Click to Move');
        this.setupClickToMove(editorCamera, container);
      } else {
        // === TERCEIRA PESSOA WASD (isometric ou custom) ===
        console.log('[RuntimeEngine] Setting up Third Person WASD');
        this.setupThirdPerson(editorCamera, container);
      }
    } else {
      // Sem player definido - usar primeira pessoa livre (modo antigo)
      console.log('[RuntimeEngine] No player found, using free camera mode');
      this.setupFreeCameraMode(editorCamera, container);
    }

    // Iniciar sistema de scripts
    this.scriptManager.start(container);

    // Iniciar game loop
    this.gameLoop.start();
    this.isRunning = true;

    // Mostrar instruções
    this.showInstructions();
  }

  /**
   * Configura modo primeira pessoa
   */
  setupFirstPerson(camera, container) {
    // Ler configurações do player
    const settings = this.playerObject.userData?.cameraSettings || { height: 1.7, fov: 75 };

    // Aplicar FOV
    camera.fov = settings.fov;
    camera.updateProjectionMatrix();

    // Usar a câmera do editor posicionada no player
    this.playerController = new PlayerController(camera, container);

    // Posicionar na posição do player + altura dos olhos
    this.playerController.setPosition(
      this.playerObject.position.x,
      this.playerObject.position.y + settings.height,
      this.playerObject.position.z
    );

    this.playerController.enable();
  }

  /**
   * Configura modo terceira pessoa (WASD)
   */
  setupThirdPerson(camera, container) {
    // Câmera segue o player
    this.cameraController = new ThirdPersonCamera(camera, this.playerObject, container);
    this.cameraController.enable();

    // Controle do personagem com WASD
    this.characterController = new CharacterController(this.playerObject, this.cameraController);
    this.characterController.enable();
  }

  /**
   * Configura modo Click to Move (estilo Diablo)
   */
  setupClickToMove(camera, container) {
    // Câmera segue o player
    this.cameraController = new ThirdPersonCamera(camera, this.playerObject, container);
    this.cameraController.enable();

    // Controle do personagem com clique
    this.clickToMoveController = new ClickToMoveController(
      this.playerObject,
      camera,
      this.threeEngine.scene,
      container
    );
    this.clickToMoveController.enable();
  }

  /**
   * Configura modo câmera livre (sem player)
   */
  setupFreeCameraMode(camera, container) {
    this.playerController = new PlayerController(camera, container);
    this.playerController.setPosition(
      camera.position.x,
      Math.max(camera.position.y, 1.7),
      camera.position.z
    );
    this.playerController.enable();
  }

  /**
   * Para o runtime (chamado quando volta para Dev mode)
   */
  stop() {
    if (!this.isRunning) return;

    console.log('[RuntimeEngine] Stopping...');

    // Parar sistema de scripts
    this.scriptManager.stop();

    // Parar game loop
    this.gameLoop.stop();

    // Desativar controllers
    if (this.playerController) {
      this.playerController.disable();
      this.playerController = null;
    }
    if (this.characterController) {
      this.characterController.disable();
      this.characterController = null;
    }
    if (this.clickToMoveController) {
      this.clickToMoveController.disable();
      this.clickToMoveController = null;
    }
    if (this.cameraController) {
      this.cameraController.disable();
      this.cameraController = null;
    }

    // Restaurar câmera
    const camera = this.threeEngine.cameraController.getCamera();
    if (this.originalCameraPosition) {
      camera.position.copy(this.originalCameraPosition);
    }
    if (this.originalCameraRotation) {
      camera.rotation.copy(this.originalCameraRotation);
    }

    // Restaurar posição do player
    if (this.playerObject && this.originalPlayerPosition) {
      this.playerObject.position.copy(this.originalPlayerPosition);
    }

    // Reativar OrbitControls
    this.threeEngine.cameraController.enable();

    // Reativar seleção do editor
    if (this.threeEngine.selectionController) {
      this.threeEngine.selectionController.enable();
    }

    this.isRunning = false;
    this.playerObject = null;
    this.mainCamera = null;

    // Esconder instruções
    this.hideInstructions();
  }

  /**
   * Update principal (todo frame)
   */
  update(deltaTime) {
    // Atualizar controllers ativos
    if (this.playerController) {
      this.playerController.update(deltaTime);
    }
    if (this.characterController) {
      this.characterController.update(deltaTime);
    }
    if (this.clickToMoveController) {
      this.clickToMoveController.update(deltaTime);
    }
    if (this.cameraController) {
      this.cameraController.update(deltaTime);
    }

    // Atualizar scripts
    this.scriptManager.update(deltaTime);

    // Atualizar entidades legacy
    for (const entity of this.entities) {
      if (entity.onUpdate) {
        entity.onUpdate(deltaTime);
      }
    }
  }

  /**
   * Fixed update para física (60fps fixo)
   */
  fixedUpdate(fixedDeltaTime) {
    // Atualizar scripts em timestep fixo
    this.scriptManager.fixedUpdate(fixedDeltaTime);

    // Física será implementada aqui (Rapier.js)
  }

  /**
   * Render
   */
  render() {
    // O ThreeEngine já tem seu próprio render loop
  }

  /**
   * Mostra instruções na tela
   */
  showInstructions() {
    let overlay = document.getElementById('game-instructions');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'game-instructions';

      const cameraMode = this.playerObject?.userData?.cameraMode || 'isometric';
      let modeText = 'Câmera Livre';
      let controls = 'Mouse = Olhar';

      if (this.playerObject) {
        if (cameraMode === 'firstPerson') {
          modeText = 'First Person';
          controls = 'Mouse = Olhar | WASD = Mover';
        } else if (cameraMode === 'clickToMove') {
          modeText = 'Click to Move';
          controls = 'Clique no chão para mover | Scroll = Zoom';
        } else {
          modeText = 'Isometric (WASD)';
          controls = 'WASD = Mover | Scroll = Zoom';
        }
      }

      overlay.innerHTML = `
        <div style="
          position: fixed;
          top: 60px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          font-family: sans-serif;
          font-size: 14px;
          z-index: 1000;
          text-align: center;
          pointer-events: none;
        ">
          <strong>Game Mode - ${modeText}</strong><br>
          ${controls}
        </div>
      `;
      document.body.appendChild(overlay);
    }

    // Auto-hide após 5 segundos
    setTimeout(() => {
      if (overlay && overlay.parentNode) {
        overlay.style.transition = 'opacity 0.5s';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 500);
      }
    }, 5000);
  }

  /**
   * Esconde instruções
   */
  hideInstructions() {
    const overlay = document.getElementById('game-instructions');
    if (overlay) {
      overlay.remove();
    }
  }

  /**
   * Retorna FPS atual
   */
  getFPS() {
    return this.gameLoop.getFPS();
  }

  /**
   * Adiciona uma entidade com scripts
   */
  addEntity(entity) {
    this.entities.push(entity);
  }

  /**
   * Remove uma entidade
   */
  removeEntity(entity) {
    const index = this.entities.indexOf(entity);
    if (index !== -1) {
      this.entities.splice(index, 1);
    }
  }

  /**
   * Retorna o ScriptManager para acesso externo
   */
  getScriptManager() {
    return this.scriptManager;
  }

  /**
   * Retorna o console de scripts
   */
  getScriptConsole() {
    return this.scriptManager.console;
  }
}
