import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { CameraController } from './CameraController.js';
import { AssetLoader } from './AssetLoader.js';
import { CoordinateSystem } from './CoordinateSystem.js';
import { SelectionController } from './SelectionController.js';
import { InputManager } from '../tools/InputManager.js';
import {
  CommandHistory,
  TransformCommand,
  CreateObjectCommand,
  DeleteObjectCommand,
  DuplicateCommand,
  MultiTransformCommand,
  ResetTransformCommand,
  PasteTransformCommand
} from '../tools/CommandHistory.js';
import * as TransformUtils from '../tools/TransformUtils.js';
import RuntimeEngine from '../../runtime/RuntimeEngine.js';
import Camera2D from '../../runtime/2d/Camera2D.js';
import SpriteRenderer from '../../runtime/2d/SpriteRenderer.js';
import Grid2D from '../../runtime/2d/Grid2D.js';

/**
 * Gera um UID curto (4 caracteres hexadecimais)
 * @returns {string}
 */
function generateShortUID() {
  return Math.random().toString(16).substring(2, 6);
}

/**
 * Engine Three.js customizada que encapsula todas as funcionalidades
 * Fornece uma interface limpa para gerenciar cena, câmera, renderizador e objetos
 * Suporta modos dev/game, múltiplas câmeras e importação de assets
 */
export class ThreeEngine {
  /**
   * Construtor da engine Three.js
   * @param {HTMLElement} container - Elemento DOM onde o canvas será renderizado
   * @param {Object} options - Opções de configuração da engine
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      backgroundColor: options.backgroundColor || 0x1a1a1a,
      enableShadows: options.enableShadows !== false,
      antialias: options.antialias !== false,
      mode: options.mode || 'dev', // 'dev' ou 'game'
      ...options
    };

    this.scene = null;
    this.renderer = null;
    this.cameraController = null;
    this.assetLoader = new AssetLoader();
    this.coordinateSystem = new CoordinateSystem(options.coordinateConfig || {});
    this.selectionController = null;
    this.inputManager = null;
    this.commandHistory = new CommandHistory(options.historySize || 50);
    this.animationId = null;
    this.objects = new Map();
    this.lights = new Map();
    this.helpers = new Map();
    this.selectedObject = null;
    this.selectedObjects = []; // Array de nomes dos objetos selecionados
    this.isAnimating = false;
    this.mode = this.options.mode;
    this.projectType = options.projectType || '3d'; // '2d' ou '3d'
    this.is2D = this.projectType === '2d';
    this.camera2D = null; // Câmera 2D (se projeto 2D)
    this.grid2D = null; // Grid 2D (se projeto 2D)
    this.onObjectSelected = options.onObjectSelected || null;
    this.onObjectsChanged = options.onObjectsChanged || null;
    this.onTransformChanged = options.onTransformChanged || null;
    this.transformControls = null;
    this.transformMode = 'translate'; // 'translate', 'rotate', 'scale'
    this.transformSpace = 'world'; // 'world' ou 'local'

    // Runtime Engine (para Game mode)
    this.runtimeEngine = null;

    // Configurações de Snap
    this.snapSettings = {
      gridSnap: false,
      gridSize: 1,
      rotationSnap: false,
      rotationSnapAngle: 15, // graus
      scaleSnap: false,
      scaleSnapIncrement: 0.1
    };

    // Clipboard para copiar/colar transform
    this.transformClipboard = null;

    // Callbacks para mudanças no histórico (para UI)
    this.onHistoryChange = options.onHistoryChange || null;
    // Callback para mudanças nas configurações de transform
    this.onTransformSettingsChange = options.onTransformSettingsChange || null;

    // Sky (céu dinâmico)
    this.sky = null;
    this.skyEnabled = false;
    this.sun = new THREE.Vector3();

    // Clouds (nuvens)
    this.clouds = null;
    this.cloudsEnabled = false;
    this.cloudSpeed = 0.01;

    this.init();
  }

  /**
   * Inicializa a engine criando cena, câmera, renderizador e controles
   */
  init() {
    // Criar cena
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.options.backgroundColor);

    // Criar renderizador
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.options.antialias
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    if (this.options.enableShadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.container.appendChild(this.renderer.domElement);

    // Criar controlador de câmeras
    this.cameraController = new CameraController(this.container, this.scene);

    // Criar InputManager
    this.inputManager = new InputManager(this.renderer.domElement);

    // Conectar InputManager ao CameraController
    this.cameraController.connectInputManager(this.inputManager);

    // Configurar sistema de seleção
    this.setupSelection();

    // Configurar gizmos de transformação
    this.setupTransformControls();

    // Registrar atalhos de teclado
    this.setupKeyboardShortcuts();

    // Configurar callback de histórico
    if (this.onHistoryChange) {
      this.commandHistory.onChange(this.onHistoryChange);
    }

    // Adicionar listener de resize
    window.addEventListener('resize', () => this.handleResize());

    // Usar ResizeObserver para detectar mudanças no container
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(this.container);

    // Inicializar modo 2D se projeto for 2D
    if (this.is2D) {
      this.init2DMode({
        width: this.container.clientWidth,
        height: this.container.clientHeight
      });
    }
  }

  /**
   * Configura o sistema de seleção de objetos
   */
  setupSelection() {
    const camera = this.cameraController.getCamera();

    this.selectionController = new SelectionController(
      this.scene,
      camera,
      this.renderer.domElement,
      {
        onSelect: (object, allSelectedObjects = []) => {
          // Encontrar o nome do objeto primário selecionado
          const selectedName = this._findObjectName(object);

          // Encontrar nomes de todos os objetos selecionados
          const selectedNames = allSelectedObjects.map(obj => this._findObjectName(obj)).filter(Boolean);

          this.selectObjects(selectedNames);

          if (this.onObjectSelected) {
            this.onObjectSelected(selectedName, selectedNames);
          }
        },
        onDragStart: (object, startPosition) => {
          // Salvar posição inicial para comando de undo
          object.userData._dragStartPosition = startPosition.clone();
        },
        onDragEnd: (object, startPosition, endPosition) => {
          // Criar comando de transformação para undo/redo
          if (!startPosition.equals(endPosition)) {
            const objectName = this._findObjectName(object);
            const command = new TransformCommand(
              object,
              'position',
              startPosition,
              endPosition,
              objectName
            );
            // Não executar pois já foi movido, apenas adicionar ao histórico
            this.commandHistory.undoStack.push(command);
            this.commandHistory.redoStack = [];
            this.commandHistory._notifyChange();
          }
        },
        coordinateSystem: this.coordinateSystem,
        engine: this
      }
    );

    // Callback para habilitar/desabilitar controles de câmera durante transformação
    this.selectionController.onTransformModeChange = (mode, isActive) => {
      if (this.cameraController?.controls) {
        this.cameraController.controls.enabled = !isActive;
      }
    };

    // Conectar ao InputManager
    this.selectionController.connectInputManager(this.inputManager);
  }

  /**
   * Configura os controles de transformação (gizmos)
   */
  setupTransformControls() {
    const camera = this.cameraController.getCamera();

    this.transformControls = new TransformControls(camera, this.renderer.domElement);
    this.transformControls.setSize(0.75);
    this.scene.add(this.transformControls);

    // Raycaster para detectar hover sobre o gizmo
    this._gizmoRaycaster = new THREE.Raycaster();
    this._gizmoPointer = new THREE.Vector2();

    // Flag para controlar interação com gizmo
    this._isInteractingWithGizmo = false;

    // Variáveis para undo/redo
    let startPosition = null;
    let startRotation = null;
    let startScale = null;

    // Evento dragging-changed é mais confiável para controlar orbit controls
    this.transformControls.addEventListener('dragging-changed', (event) => {
      // Desabilitar/habilitar orbit controls baseado no estado de arraste
      if (this.cameraController.controls) {
        this.cameraController.controls.enabled = !event.value;
      }

      if (event.value) {
        // Começou a arrastar - salvar estado inicial
        const object = this.transformControls.object;
        if (object) {
          startPosition = object.position.clone();
          startRotation = object.rotation.clone();
          startScale = object.scale.clone();
        }
      } else {
        // Parou de arrastar - criar comando de undo
        const object = this.transformControls.object;
        if (object && startPosition) {
          const mode = this.transformControls.mode;
          const objectName = this._findObjectName(object);

          if (mode === 'translate' && !startPosition.equals(object.position)) {
            const command = new TransformCommand(
              object, 'position', startPosition.clone(), object.position.clone(), objectName
            );
            this.commandHistory.undoStack.push(command);
            this.commandHistory.redoStack = [];
            this.commandHistory._notifyChange();
          } else if (mode === 'rotate' && !this._rotationEquals(startRotation, object.rotation)) {
            const command = new TransformCommand(
              object, 'rotation', startRotation.clone(), object.rotation.clone(), objectName
            );
            this.commandHistory.undoStack.push(command);
            this.commandHistory.redoStack = [];
            this.commandHistory._notifyChange();
          } else if (mode === 'scale' && !startScale.equals(object.scale)) {
            const command = new TransformCommand(
              object, 'scale', startScale.clone(), object.scale.clone(), objectName
            );
            this.commandHistory.undoStack.push(command);
            this.commandHistory.redoStack = [];
            this.commandHistory._notifyChange();
          }
        }

        startPosition = null;
        startRotation = null;
        startScale = null;
      }
    });

    // Atualizar UI quando o objeto é transformado
    this.transformControls.addEventListener('objectChange', () => {
      const object = this.transformControls.object;

      // Notificar mudança para atualizar Inspector em tempo real
      if (this.onObjectSelected && this.selectedObject) {
        this.onObjectSelected(this.selectedObject);
      }

      // Notificar EditorState para sincronização
      if (this.onTransformChanged && object) {
        this.onTransformChanged(object);
      }
    });

    // Criar RuntimeEngine para gerenciar scripts (disponível em Dev e Game mode)
    this.runtimeEngine = new RuntimeEngine(this);
  }

  /**
   * Compara duas rotações Euler
   */
  _rotationEquals(r1, r2) {
    return r1.x === r2.x && r1.y === r2.y && r1.z === r2.z;
  }

  /**
   * Define o modo do TransformControls
   * @param {'translate'|'rotate'|'scale'} mode
   */
  setTransformMode(mode) {
    this.transformMode = mode;
    if (this.transformControls) {
      this.transformControls.setMode(mode);
    }
  }

  /**
   * Anexa o TransformControls a um objeto
   * @param {THREE.Object3D} object
   */
  attachTransformControls(object) {
    if (this.transformControls && object) {
      // Não anexar gizmo a objetos travados
      if (object.userData?.locked) {
        this.transformControls.detach();
        return;
      }
      this.transformControls.attach(object);
    }
  }

  /**
   * Remove o TransformControls do objeto
   */
  detachTransformControls() {
    if (this.transformControls) {
      this.transformControls.detach();
    }
  }

  /**
   * Encontra o nome de um objeto no mapa
   * @param {THREE.Object3D} object
   * @returns {string|null}
   */
  _findObjectName(object) {
    if (!object) return null;

    for (const [name, obj] of this.objects.entries()) {
      if (obj === object) {
        return name;
      }
      // Verificar se o objeto está na hierarquia
      let found = false;
      obj.traverse((child) => {
        if (child === object) {
          found = true;
        }
      });
      if (found) {
        return name;
      }
    }
    return null;
  }

  /**
   * Configura atalhos de teclado
   */
  setupKeyboardShortcuts() {
    // Undo: Ctrl/Cmd + Z
    this.inputManager.registerShortcut('mod+keyz', () => {
      this.undo();
    });

    // Redo: Ctrl/Cmd + Y (Windows) ou Ctrl/Cmd + Shift + Z (Mac)
    this.inputManager.registerShortcut('mod+keyy', () => {
      this.redo();
    });
    this.inputManager.registerShortcut('mod+shift+keyz', () => {
      this.redo();
    });

    // Delete: Delete key
    this.inputManager.registerShortcut('delete', () => {
      this.deleteSelectedObject();
    });

    // Duplicate: Ctrl/Cmd + D
    this.inputManager.registerShortcut('mod+keyd', () => {
      this.duplicateSelectedObject();
    });

    // Select All: Ctrl/Cmd + A
    this.inputManager.registerShortcut('mod+keya', () => {
      this.selectAll();
    });

    // Deselect ou Cancel: Escape
    this.inputManager.registerShortcut('escape', () => {
      // Se está em modo de transformação, cancelar
      if (this.selectionController?.getTransformMode()) {
        this.selectionController.cancelTransform();
        return;
      }
      // Senão, desselecionar
      this.selectObject(null);
      if (this.onObjectSelected) {
        this.onObjectSelected(null);
      }
    });

    // Focus on selection: F
    this.inputManager.registerShortcut('keyf', () => {
      if (this.selectedObject) {
        const obj = this.objects.get(this.selectedObject);
        if (obj) {
          this.cameraController.focusOnObject(obj);
        }
      }
    });

    // ==================== Atalhos tipo Blender ====================

    // G = Grab (Mover)
    this.inputManager.registerShortcut('keyg', () => {
      this.selectionController?.startTransformMode('grab');
    });

    // R = Rotate (Rotacionar)
    this.inputManager.registerShortcut('keyr', () => {
      this.selectionController?.startTransformMode('rotate');
    });

    // S = Scale (Escalar)
    this.inputManager.registerShortcut('keys', () => {
      this.selectionController?.startTransformMode('scale');
    });

    // Q = Voltar ao modo de seleção (cancelar transformação)
    this.inputManager.registerShortcut('keyq', () => {
      if (this.selectionController?.getTransformMode()) {
        this.selectionController.cancelTransform();
      }
    });

    // === Restrição de Eixo (durante transformação) ===

    // X = Restringir ao eixo X
    this.inputManager.registerShortcut('keyx', () => {
      if (this.selectionController?.getTransformMode()) {
        this.selectionController.setAxisConstraint('x');
        console.log('Eixo X');
      }
    });

    // Y = Restringir ao eixo Y
    this.inputManager.registerShortcut('keyy', () => {
      if (this.selectionController?.getTransformMode()) {
        this.selectionController.setAxisConstraint('y');
        console.log('Eixo Y');
      }
    });

    // Z = Restringir ao eixo Z
    this.inputManager.registerShortcut('keyz', () => {
      if (this.selectionController?.getTransformMode()) {
        this.selectionController.setAxisConstraint('z');
        console.log('Eixo Z');
      }
    });

    // === Restrição de Plano (Shift + Eixo) ===

    // Shift+X = Plano YZ (exclui X)
    this.inputManager.registerShortcut('shift+keyx', () => {
      if (this.selectionController?.getTransformMode()) {
        this.selectionController.setPlaneConstraint('x');
        console.log('Plano YZ');
      }
    });

    // Shift+Y = Plano XZ (exclui Y)
    this.inputManager.registerShortcut('shift+keyy', () => {
      if (this.selectionController?.getTransformMode()) {
        this.selectionController.setPlaneConstraint('y');
        console.log('Plano XZ');
      }
    });

    // Shift+Z = Plano XY (exclui Z)
    this.inputManager.registerShortcut('shift+keyz', () => {
      if (this.selectionController?.getTransformMode()) {
        this.selectionController.setPlaneConstraint('z');
        console.log('Plano XY');
      }
    });

    // === Entrada Numérica ===
    const numericKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    numericKeys.forEach(num => {
      this.inputManager.registerShortcut(`digit${num}`, () => {
        if (this.selectionController?.getTransformMode()) {
          this.selectionController.addNumericInput(num);
        }
      });
    });

    // Ponto decimal
    this.inputManager.registerShortcut('period', () => {
      if (this.selectionController?.getTransformMode()) {
        this.selectionController.addNumericInput('.');
      }
    });

    // Sinal negativo (menos)
    this.inputManager.registerShortcut('minus', () => {
      if (this.selectionController?.getTransformMode()) {
        this.selectionController.addNumericInput('-');
      }
    });

    // Enter = Confirmar transformação
    this.inputManager.registerShortcut('enter', () => {
      if (this.selectionController?.getTransformMode()) {
        this.selectionController.confirmTransform();
      }
    });

    // Backspace = Remover último dígito da entrada numérica (durante transformação)
    this.inputManager.registerShortcut('backspace', () => {
      if (this.selectionController?.getTransformMode()) {
        this.selectionController.removeNumericInput();
        return; // Não deletar objeto enquanto em modo de transformação
      }
      this.deleteSelectedObject();
    });

    // ==================== Atalhos de Transform Features ====================

    // Alt+R = Reset Transform
    this.inputManager.registerShortcut('alt+keyr', () => {
      this.resetSelectedTransform();
    });

    // Alt+G = Reset Position
    this.inputManager.registerShortcut('alt+keyg', () => {
      this.resetSelectedTransform({ position: true, rotation: false, scale: false });
    });

    // Alt+S = Reset Scale
    this.inputManager.registerShortcut('alt+keys', () => {
      this.resetSelectedTransform({ position: false, rotation: false, scale: true });
    });

    // Ctrl/Cmd + C = Copy Transform
    this.inputManager.registerShortcut('mod+keyc', () => {
      this.copySelectedTransform();
    });

    // Ctrl/Cmd + V = Paste Transform
    this.inputManager.registerShortcut('mod+keyv', () => {
      this.pasteTransform();
    });

    // Ctrl/Cmd + Shift + V = Paste Position Only
    this.inputManager.registerShortcut('mod+shift+keyv', () => {
      this.pasteTransform({ position: true, rotation: false, scale: false });
    });

    // Toggle Local/World Space
    this.inputManager.registerShortcut('keyp', () => {
      this.toggleTransformSpace();
    });

    // Toggle Snap
    this.inputManager.registerShortcut('shift+tabs', () => {
      this.toggleGridSnap();
    });
  }

  /**
   * Lida com o redimensionamento da janela
   */
  handleResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // Redimensionar câmera apropriada
    if (this.is2D && this.camera2D) {
      this.camera2D.width = width;
      this.camera2D.height = height;
      this.camera2D.updateProjection();
    } else {
      this.cameraController.handleResize(width, height);
    }

    this.renderer.setSize(width, height);
  }

  /**
   * Inicia o loop de animação
   */
  start() {
    if (this.isAnimating) return;

    this.isAnimating = true;
    let lastTime = performance.now();

    const animate = () => {
      if (!this.isAnimating) return;

      this.animationId = requestAnimationFrame(animate);

      // Calcular delta time
      const now = performance.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      // Atualizar controles de câmera APENAS no modo Dev (não no Game mode)
      if (this.mode === 'dev') {
        if (this.is2D) {
          // Modo 2D: atualizar Camera2D
          this.update2D(deltaTime);
        } else {
          // Modo 3D: atualizar CameraController
          this.cameraController.update();
        }
      }

      // Atualizar câmera do selection controller e transform controls APENAS no modo Dev
      if (this.mode === 'dev') {
        if (this.selectionController) {
          const camera = this.getActiveCamera();
          this.selectionController.updateCamera(camera);

          // Atualizar câmera do TransformControls
          if (this.transformControls && this.transformControls.camera !== camera) {
            this.transformControls.camera = camera;
          }
        }

        // Atualizar helpers de luz (para acompanhar movimento) - apenas em 3D
        if (!this.is2D) {
          this.updateAllLightHelpers();
        }
      }

      // Animar nuvens se habilitadas (apenas 3D)
      if (!this.is2D) {
        this.animateClouds();
      }

      // Renderizar com câmera ativa (2D ou 3D)
      const camera = this.getActiveCamera();
      this.renderer.render(this.scene, camera);
    };

    animate();
  }

  /**
   * Para o loop de animação
   */
  stop() {
    this.isAnimating = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  // ==================== Undo/Redo ====================

  /**
   * Desfaz a última ação
   * @returns {boolean} true se conseguiu desfazer
   */
  undo() {
    const result = this.commandHistory.undo();
    if (result && this.onObjectSelected) {
      // Atualizar seleção se necessário
      this.onObjectSelected(this.selectedObject);
    }
    return result;
  }

  /**
   * Refaz a última ação desfeita
   * @returns {boolean} true se conseguiu refazer
   */
  redo() {
    const result = this.commandHistory.redo();
    if (result && this.onObjectSelected) {
      this.onObjectSelected(this.selectedObject);
    }
    return result;
  }

  /**
   * Verifica se pode desfazer
   * @returns {boolean}
   */
  canUndo() {
    return this.commandHistory.canUndo();
  }

  /**
   * Verifica se pode refazer
   * @returns {boolean}
   */
  canRedo() {
    return this.commandHistory.canRedo();
  }

  /**
   * Obtém informações do histórico
   * @returns {Object}
   */
  getHistoryInfo() {
    return {
      canUndo: this.commandHistory.canUndo(),
      canRedo: this.commandHistory.canRedo(),
      undoDescription: this.commandHistory.getUndoDescription(),
      redoDescription: this.commandHistory.getRedoDescription()
    };
  }

  // ==================== Transform Space ====================

  /**
   * Alterna entre espaço local e mundial
   */
  toggleTransformSpace() {
    this.transformSpace = this.transformSpace === 'world' ? 'local' : 'world';
    if (this.transformControls) {
      this.transformControls.setSpace(this.transformSpace);
    }
    this._notifyTransformSettingsChange();
    console.log(`Transform space: ${this.transformSpace}`);
  }

  /**
   * Define o espaço de transformação
   * @param {'world'|'local'} space
   */
  setTransformSpace(space) {
    if (space !== 'world' && space !== 'local') {
      console.warn(`Invalid transform space: ${space}`);
      return;
    }
    this.transformSpace = space;
    if (this.transformControls) {
      this.transformControls.setSpace(space);
    }
    this._notifyTransformSettingsChange();
  }

  /**
   * Obtém o espaço de transformação atual
   * @returns {'world'|'local'}
   */
  getTransformSpace() {
    return this.transformSpace;
  }

  // ==================== Snap Settings ====================

  /**
   * Alterna snap de grid
   */
  toggleGridSnap() {
    this.snapSettings.gridSnap = !this.snapSettings.gridSnap;
    this._updateTransformControlsSnap();
    this._notifyTransformSettingsChange();
    console.log(`Grid snap: ${this.snapSettings.gridSnap ? 'ON' : 'OFF'}`);
  }

  /**
   * Alterna snap de rotação
   */
  toggleRotationSnap() {
    this.snapSettings.rotationSnap = !this.snapSettings.rotationSnap;
    this._updateTransformControlsSnap();
    this._notifyTransformSettingsChange();
    console.log(`Rotation snap: ${this.snapSettings.rotationSnap ? 'ON' : 'OFF'}`);
  }

  /**
   * Define configurações de snap
   * @param {Object} settings
   */
  setSnapSettings(settings) {
    this.snapSettings = { ...this.snapSettings, ...settings };
    this._updateTransformControlsSnap();
    this._notifyTransformSettingsChange();
  }

  /**
   * Obtém configurações de snap
   * @returns {Object}
   */
  getSnapSettings() {
    return { ...this.snapSettings };
  }

  /**
   * Atualiza snap no TransformControls
   */
  _updateTransformControlsSnap() {
    if (!this.transformControls) return;

    if (this.snapSettings.gridSnap) {
      this.transformControls.setTranslationSnap(this.snapSettings.gridSize);
    } else {
      this.transformControls.setTranslationSnap(null);
    }

    if (this.snapSettings.rotationSnap) {
      this.transformControls.setRotationSnap(
        THREE.MathUtils.degToRad(this.snapSettings.rotationSnapAngle)
      );
    } else {
      this.transformControls.setRotationSnap(null);
    }

    if (this.snapSettings.scaleSnap) {
      this.transformControls.setScaleSnap(this.snapSettings.scaleSnapIncrement);
    } else {
      this.transformControls.setScaleSnap(null);
    }
  }

  /**
   * Notifica mudanças nas configurações de transform
   */
  _notifyTransformSettingsChange() {
    if (this.onTransformSettingsChange) {
      this.onTransformSettingsChange({
        transformSpace: this.transformSpace,
        snapSettings: this.getSnapSettings()
      });
    }
  }

  // ==================== Reset Transform ====================

  /**
   * Reseta o transform dos objetos selecionados
   * @param {Object} options - { position: true, rotation: true, scale: true }
   */
  resetSelectedTransform(options = {}) {
    if (!this.selectedObject) return;

    const object = this.objects.get(this.selectedObject);
    if (!object) return;

    const command = new ResetTransformCommand(object, options, this.selectedObject);
    this.commandHistory.execute(command);

    if (this.onObjectSelected) {
      this.onObjectSelected(this.selectedObject, this.selectedObjects);
    }
  }

  /**
   * Reseta position para origem (0, 0, 0)
   */
  resetSelectedPosition() {
    this.resetSelectedTransform({ position: true, rotation: false, scale: false });
  }

  /**
   * Reseta rotation para (0, 0, 0)
   */
  resetSelectedRotation() {
    this.resetSelectedTransform({ position: false, rotation: true, scale: false });
  }

  /**
   * Reseta scale para (1, 1, 1)
   */
  resetSelectedScale() {
    this.resetSelectedTransform({ position: false, rotation: false, scale: true });
  }

  // ==================== Copy/Paste Transform ====================

  /**
   * Copia o transform do objeto selecionado para o clipboard
   */
  copySelectedTransform() {
    if (!this.selectedObject) return;

    const object = this.objects.get(this.selectedObject);
    if (!object) return;

    this.transformClipboard = TransformUtils.copyTransform(object);
    console.log('Transform copied');
  }

  /**
   * Cola o transform do clipboard no(s) objeto(s) selecionado(s)
   * @param {Object} options - { position: true, rotation: true, scale: true }
   */
  pasteTransform(options = {}) {
    if (!this.transformClipboard) {
      console.log('No transform in clipboard');
      return;
    }

    if (this.selectedObjects.length === 0) return;

    // Colar em todos os objetos selecionados
    for (const name of this.selectedObjects) {
      const object = this.objects.get(name);
      if (!object) continue;

      const command = new PasteTransformCommand(
        object,
        this.transformClipboard,
        options,
        name
      );
      this.commandHistory.execute(command);
    }

    if (this.onObjectSelected) {
      this.onObjectSelected(this.selectedObject, this.selectedObjects);
    }
  }

  /**
   * Verifica se há transform no clipboard
   * @returns {boolean}
   */
  hasTransformClipboard() {
    return this.transformClipboard !== null;
  }

  // ==================== Align Objects ====================

  /**
   * Alinha objetos selecionados em um eixo
   * @param {'x'|'y'|'z'} axis - Eixo de alinhamento
   * @param {'min'|'center'|'max'} type - Tipo de alinhamento
   */
  alignSelectedObjects(axis, type) {
    if (this.selectedObjects.length < 2) {
      console.log('Need at least 2 objects to align');
      return;
    }

    const objects = this.selectedObjects.map(name => this.objects.get(name)).filter(Boolean);
    const originalPositions = TransformUtils.alignObjects(objects, axis, type);

    if (originalPositions.size === 0) return;

    const descriptions = {
      x: { min: 'Alinhar à esquerda', center: 'Alinhar centro X', max: 'Alinhar à direita' },
      y: { min: 'Alinhar embaixo', center: 'Alinhar centro Y', max: 'Alinhar em cima' },
      z: { min: 'Alinhar frente', center: 'Alinhar centro Z', max: 'Alinhar atrás' }
    };

    const command = new MultiTransformCommand(
      originalPositions,
      descriptions[axis]?.[type] || `Alinhar ${type} ${axis.toUpperCase()}`
    );

    // Não executar pois alignObjects já moveu os objetos
    this.commandHistory.undoStack.push(command);
    this.commandHistory.redoStack = [];
    this.commandHistory._notifyChange();

    if (this.onObjectSelected) {
      this.onObjectSelected(this.selectedObject, this.selectedObjects);
    }
  }

  // ==================== Distribute Objects ====================

  /**
   * Distribui objetos selecionados uniformemente em um eixo
   * @param {'x'|'y'|'z'} axis - Eixo de distribuição
   * @param {number} spacing - Espaçamento (0 = automático)
   */
  distributeSelectedObjects(axis, spacing = 0) {
    if (this.selectedObjects.length < 3) {
      console.log('Need at least 3 objects to distribute');
      return;
    }

    const objects = this.selectedObjects.map(name => this.objects.get(name)).filter(Boolean);
    const originalPositions = TransformUtils.distributeObjects(objects, axis, spacing);

    if (originalPositions.size === 0) return;

    const axisNames = { x: 'Horizontal', y: 'Vertical', z: 'Profundidade' };
    const command = new MultiTransformCommand(
      originalPositions,
      `Distribuir ${axisNames[axis] || axis.toUpperCase()}`
    );

    // Não executar pois distributeObjects já moveu os objetos
    this.commandHistory.undoStack.push(command);
    this.commandHistory.redoStack = [];
    this.commandHistory._notifyChange();

    if (this.onObjectSelected) {
      this.onObjectSelected(this.selectedObject, this.selectedObjects);
    }
  }

  // ==================== Snap to Floor/Center ====================

  /**
   * Move o objeto selecionado para apoiar no chão (Y=0)
   */
  snapSelectedToFloor() {
    if (!this.selectedObject) return;

    const object = this.objects.get(this.selectedObject);
    if (!object) return;

    const originalY = object.position.y;
    const newY = object.position.y - TransformUtils.getWorldBounds(object).min.y;

    if (originalY === newY) return;

    const command = new TransformCommand(
      object,
      'position',
      object.position.clone(),
      new THREE.Vector3(object.position.x, newY, object.position.z),
      this.selectedObject
    );

    object.position.y = newY;

    this.commandHistory.undoStack.push(command);
    this.commandHistory.redoStack = [];
    this.commandHistory._notifyChange();

    if (this.onObjectSelected) {
      this.onObjectSelected(this.selectedObject, this.selectedObjects);
    }
  }

  /**
   * Centraliza o objeto selecionado na origem (X=0, Z=0)
   */
  centerSelectedToOrigin() {
    if (!this.selectedObject) return;

    const object = this.objects.get(this.selectedObject);
    if (!object) return;

    const oldPosition = object.position.clone();
    const newPosition = new THREE.Vector3(0, object.position.y, 0);

    if (oldPosition.equals(newPosition)) return;

    const command = new TransformCommand(
      object,
      'position',
      oldPosition,
      newPosition,
      this.selectedObject
    );

    object.position.x = 0;
    object.position.z = 0;

    this.commandHistory.undoStack.push(command);
    this.commandHistory.redoStack = [];
    this.commandHistory._notifyChange();

    if (this.onObjectSelected) {
      this.onObjectSelected(this.selectedObject, this.selectedObjects);
    }
  }

  /**
   * Deleta o objeto selecionado com undo
   */
  deleteSelectedObject() {
    if (!this.selectedObject) return;

    const name = this.selectedObject;
    const object = this.objects.get(name);
    if (!object) return;

    // Se for uma luz, usar removeLight diretamente (não suporta undo por enquanto)
    if (object.userData?.isLight || object.isLight) {
      this.removeLight(name);
    } else {
      // Criar comando de delete para objetos normais
      const command = new DeleteObjectCommand(
        this.scene,
        object,
        name,
        this.objects
      );

      // Executar através do histórico
      this.commandHistory.execute(command);

      // Notificar que a lista de objetos mudou
      if (this.onObjectsChanged) {
        this.onObjectsChanged();
      }
    }

    // Limpar seleção
    this.selectedObject = null;
    this.selectedObjects = [];
    if (this.selectionController) {
      this.selectionController.clearSelection();
    }
    if (this.onObjectSelected) {
      this.onObjectSelected(null, []);
    }
  }

  /**
   * Duplica o objeto selecionado com undo
   */
  duplicateSelectedObject() {
    if (!this.selectedObject) return;

    const originalName = this.selectedObject;
    const originalObject = this.objects.get(originalName);
    if (!originalObject) return;

    // Gerar nome único para o clone
    let cloneName = `${originalName}_copy`;
    let counter = 1;
    while (this.objects.has(cloneName)) {
      cloneName = `${originalName}_copy_${counter}`;
      counter++;
    }

    // Clonar objeto
    const clonedObject = originalObject.clone();

    // Clonar materiais para evitar compartilhamento
    clonedObject.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
      }
    });

    // Deslocar levemente
    clonedObject.position.x += 1;
    clonedObject.position.z += 1;

    // Criar comando de duplicação
    const command = new DuplicateCommand(
      this.scene,
      originalObject,
      clonedObject,
      originalName,
      cloneName,
      this.objects
    );

    // Executar através do histórico
    this.commandHistory.execute(command);

    // Selecionar o novo objeto
    this.selectObject(cloneName);
    if (this.onObjectSelected) {
      this.onObjectSelected(cloneName);
    }
  }

  /**
   * Obtém o InputManager
   * @returns {InputManager}
   */
  getInputManager() {
    return this.inputManager;
  }

  /**
   * Obtém o CommandHistory
   * @returns {CommandHistory}
   */
  getCommandHistory() {
    return this.commandHistory;
  }

  /**
   * Gera um nome único para um objeto
   * @param {string} baseName - Nome base (ex: "Cylinder", "Box")
   * @returns {string} Nome único (ex: "Cylinder_a3f2")
   */
  generateUniqueName(baseName) {
    let name = `${baseName}_${generateShortUID()}`;
    // Garantir que o nome seja único
    while (this.objects.has(name) || this.lights.has(name)) {
      name = `${baseName}_${generateShortUID()}`;
    }
    return name;
  }

  /**
   * Adiciona um objeto à cena
   * @param {string} name - Nome único do objeto
   * @param {THREE.Object3D} object - Objeto Three.js a ser adicionado
   * @returns {THREE.Object3D} O objeto adicionado
   */
  addObject(name, object) {
    if (this.objects.has(name)) {
      console.warn(`Objeto "${name}" já existe. Removendo o anterior.`);
      this.removeObject(name);
    }

    // Definir o nome no objeto Three.js
    object.name = name;

    this.scene.add(object);
    this.objects.set(name, object);
    return object;
  }

  /**
   * Remove um objeto da cena
   * @param {string} name - Nome do objeto a ser removido
   */
  removeObject(name) {
    const object = this.objects.get(name);

    if (object) {
      // Se for uma luz, usar removeLight para limpar helper também
      if (object.userData?.isLight || object.isLight) {
        this.removeLight(name);
        return;
      }

      this.scene.remove(object);
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else {
          object.material.dispose();
        }
      }
      this.objects.delete(name);

      // Notificar que a lista de objetos mudou
      if (this.onObjectsChanged) {
        this.onObjectsChanged();
      }
    }
  }

  /**
   * Obtém um objeto da cena
   * @param {string} name - Nome do objeto
   * @returns {THREE.Object3D|null} O objeto ou null se não encontrado
   */
  getObject(name) {
    return this.objects.get(name) || null;
  }

  /**
   * Lista todos os objetos na cena
   * @returns {Array<string>} Array com os nomes dos objetos
   */
  listObjects() {
    // Retornar os objetos Three.js, não apenas os nomes
    return Array.from(this.objects.values());
  }

  /**
   * Adiciona uma luz à cena
   * @param {string} name - Nome único da luz
   * @param {THREE.Light} light - Luz Three.js a ser adicionada
   * @returns {THREE.Light} A luz adicionada
   */
  addLight(name, light) {
    if (this.lights.has(name)) {
      console.warn(`Luz "${name}" já existe. Removendo a anterior.`);
      this.removeLight(name);
    }

    // Marcar como luz para identificação na UI
    light.name = name;
    light.userData.isLight = true;
    light.userData.lightType = light.type; // 'AmbientLight', 'DirectionalLight', etc.

    this.scene.add(light);
    this.lights.set(name, light);

    // Também adicionar ao objects para aparecer na Hierarchy
    this.objects.set(name, light);

    // Criar helper visual para a luz
    this._createLightHelper(name, light);

    return light;
  }

  /**
   * Cria um helper visual para uma luz
   * @param {string} name - Nome da luz
   * @param {THREE.Light} light - A luz
   */
  _createLightHelper(name, light) {
    const helperName = `${name}_helper`;
    let helper = null;
    const lightColor = light.color ? light.color.getHex() : 0xffff00;

    switch (light.type) {
      case 'PointLight':
        // Criar esfera sólida clicável ao invés do helper padrão
        helper = this._createClickableLightIcon(light, lightColor, 'sphere');
        break;

      case 'DirectionalLight':
        // Criar ícone clicável + helper visual
        helper = this._createClickableLightIcon(light, lightColor, 'directional');
        break;

      case 'SpotLight':
        helper = this._createClickableLightIcon(light, lightColor, 'cone');
        break;

      case 'HemisphereLight':
        helper = this._createClickableLightIcon(light, lightColor, 'hemisphere');
        break;

      case 'AmbientLight':
        // Ambient light não tem posição, criar um ícone no canto
        helper = this._createClickableLightIcon(light, lightColor, 'ambient');
        break;

      case 'RectAreaLight':
        helper = this._createClickableLightIcon(light, lightColor, 'rectarea');
        break;

      default:
        return; // Tipo de luz desconhecido
    }

    if (helper) {
      // Marcar como helper para seleção de luz
      helper.traverse((child) => {
        child.userData.isHelper = true;
        child.userData.isLightHelper = true;
        child.userData.lightName = name;
      });

      // Guardar referência no userData da luz
      light.userData.helperName = helperName;

      this.scene.add(helper);
      this.helpers.set(helperName, helper);
    }
  }

  /**
   * Cria um ícone clicável para representar uma luz
   */
  _createClickableLightIcon(light, color, type) {
    const group = new THREE.Group();
    let iconMesh;

    switch (type) {
      case 'sphere': {
        // Esfera para PointLight
        const geo = new THREE.SphereGeometry(0.3, 16, 16);
        const mat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.8
        });
        iconMesh = new THREE.Mesh(geo, mat);

        // Adicionar linhas de raios
        const rayGeo = new THREE.BufferGeometry();
        const rayPoints = [];
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          rayPoints.push(new THREE.Vector3(Math.cos(angle) * 0.35, 0, Math.sin(angle) * 0.35));
          rayPoints.push(new THREE.Vector3(Math.cos(angle) * 0.6, 0, Math.sin(angle) * 0.6));
        }
        rayGeo.setFromPoints(rayPoints);
        const rayMat = new THREE.LineBasicMaterial({ color: color });
        const rays = new THREE.LineSegments(rayGeo, rayMat);
        group.add(rays);
        break;
      }

      case 'directional': {
        // Disco para DirectionalLight
        const geo = new THREE.CircleGeometry(0.4, 16);
        const mat = new THREE.MeshBasicMaterial({
          color: color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8
        });
        iconMesh = new THREE.Mesh(geo, mat);

        // Linha indicando direção para o target (eixo +Z para funcionar com lookAt)
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, 1.5)
        ]);
        const lineMat = new THREE.LineBasicMaterial({ color: color });
        const line = new THREE.Line(lineGeo, lineMat);
        line.userData.isDirectionLine = true;
        group.add(line);

        // Orientar o grupo para apontar para o target
        if (light.target?.position) {
          group.lookAt(light.target.position);
        }
        break;
      }

      case 'cone': {
        // Cone para SpotLight
        const geo = new THREE.ConeGeometry(0.3, 0.5, 16);
        const mat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.8
        });
        iconMesh = new THREE.Mesh(geo, mat);
        // Rotacionar cone para apontar na direção +Z (para funcionar com lookAt)
        iconMesh.rotation.x = Math.PI / 2;

        // Orientar o grupo para apontar para o target
        if (light.target?.position) {
          group.lookAt(light.target.position);
        }
        break;
      }

      case 'hemisphere': {
        // Meia esfera para HemisphereLight (duas cores: céu e terra)
        const geoTop = new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const matTop = new THREE.MeshBasicMaterial({
          color: light.userData?.skyColor || 0x87ceeb,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8
        });
        const meshTop = new THREE.Mesh(geoTop, matTop);

        const geoBottom = new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
        const matBottom = new THREE.MeshBasicMaterial({
          color: light.userData?.groundColor || 0x362d1f,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8
        });
        const meshBottom = new THREE.Mesh(geoBottom, matBottom);

        group.add(meshTop);
        group.add(meshBottom);
        break;
      }

      case 'rectarea': {
        // Retângulo para RectAreaLight
        const w = Math.min((light.width || 4) * 0.1, 0.8);
        const h = Math.min((light.height || 4) * 0.1, 0.8);
        const geo = new THREE.PlaneGeometry(w, h);
        const mat = new THREE.MeshBasicMaterial({
          color: color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8
        });
        iconMesh = new THREE.Mesh(geo, mat);

        // Borda para visualizar melhor
        const edges = new THREE.EdgesGeometry(geo);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
        const wireframe = new THREE.LineSegments(edges, lineMat);
        group.add(wireframe);
        break;
      }

      case 'ambient': {
        // Ícone pequeno para AmbientLight
        const geo = new THREE.OctahedronGeometry(0.25);
        const mat = new THREE.MeshBasicMaterial({
          color: color,
          wireframe: true,
          transparent: true,
          opacity: 0.6
        });
        iconMesh = new THREE.Mesh(geo, mat);
        // Usar a posição da luz (definida em addAmbientLight)
        if (light.position) {
          group.position.copy(light.position);
        }
        break;
      }
    }

    if (iconMesh) {
      group.add(iconMesh);
    }

    // Sincronizar posição com a luz (exceto ambient)
    if (type !== 'ambient' && light.position) {
      group.position.copy(light.position);
    }

    // Guardar referência da luz no grupo
    group.userData.targetLight = light;

    return group;
  }

  /**
   * Atualiza o helper de uma luz (chamar após mover a luz)
   * @param {string} name - Nome da luz
   */
  updateLightHelper(name) {
    const light = this.lights.get(name);
    if (!light || !light.userData.helperName) return;

    const helper = this.helpers.get(light.userData.helperName);
    if (!helper) return;

    // Sincronizar posição do helper com a posição MUNDIAL da luz
    // (importante para quando a luz é filha de outro objeto)
    if (light.position) {
      const worldPos = new THREE.Vector3();
      light.getWorldPosition(worldPos);
      helper.position.copy(worldPos);
    }

    // Para luzes direcionais e spot, atualizar a orientação para apontar para o target
    if ((light.type === 'DirectionalLight' || light.type === 'SpotLight') && light.target?.position) {
      const worldPos = new THREE.Vector3();
      light.getWorldPosition(worldPos);
      const targetWorldPos = new THREE.Vector3();
      light.target.getWorldPosition(targetWorldPos);
      helper.lookAt(targetWorldPos);
    }

    // Se for helper do Three.js, chamar update
    if (helper.update) {
      helper.update();
    }
  }

  /**
   * Atualiza todos os helpers de luz
   */
  updateAllLightHelpers() {
    if (this.lights.size === 0) return;
    this.lights.forEach((light, name) => {
      this.updateLightHelper(name);
    });
  }

  /**
   * Remove uma luz da cena
   * @param {string} name - Nome da luz a ser removida
   */
  removeLight(name) {
    const light = this.lights.get(name);
    if (light) {
      // Remover helper visual primeiro
      const helperName = light.userData.helperName;

      if (helperName) {
        const helper = this.helpers.get(helperName);
        if (helper) {
          this.scene.remove(helper);
          // Dispose de geometrias e materiais do helper
          helper.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
          this.helpers.delete(helperName);
        }
      }

      this.scene.remove(light);
      // Remover target de SpotLight/DirectionalLight se existir
      if (light.target && light.target.parent) {
        this.scene.remove(light.target);
      }
      if (light.dispose) light.dispose();
      this.lights.delete(name);
      // Também remover de objects
      this.objects.delete(name);

      // Notificar que a lista de objetos mudou
      if (this.onObjectsChanged) {
        this.onObjectsChanged();
      }
    }
  }

  /**
   * Obtém uma luz da cena
   * @param {string} name - Nome da luz
   * @returns {THREE.Light|null} A luz ou null se não encontrada
   */
  getLight(name) {
    return this.lights.get(name) || null;
  }

  /**
   * Adiciona um helper à cena
   * @param {string} name - Nome único do helper
   * @param {THREE.Object3D} helper - Helper Three.js a ser adicionado
   * @returns {THREE.Object3D} O helper adicionado
   */
  addHelper(name, helper) {
    if (this.helpers.has(name)) {
      this.removeHelper(name);
    }
    
    // Marcar como helper para não ser selecionável
    helper.traverse((child) => {
      child.userData.isHelper = true;
    });
    
    this.scene.add(helper);
    this.helpers.set(name, helper);
    return helper;
  }

  /**
   * Remove um helper da cena
   * @param {string} name - Nome do helper a ser removido
   */
  removeHelper(name) {
    const helper = this.helpers.get(name);
    if (helper) {
      this.scene.remove(helper);
      if (helper.dispose) helper.dispose();
      this.helpers.delete(name);
    }
  }

  /**
   * Cria e adiciona um grupo vazio à cena (para organização)
   * @param {string} name - Nome do grupo
   * @param {Object} options - Opções do grupo (position)
   * @returns {THREE.Group} O grupo criado
   */
  createGroup(name, options = {}) {
    const { position = [0, 0, 0] } = options;

    const group = new THREE.Group();
    group.position.set(...position);
    group.userData.type = 'group';
    group.userData.isGroup = true;

    return this.addObject(name, group);
  }

  /**
   * Cria e adiciona um cubo à cena
   * @param {string} name - Nome do cubo
   * @param {Object} options - Opções do cubo (width, height, depth, color, position, etc)
   * @returns {THREE.Mesh} O cubo criado
   */
  createBox(name, options = {}) {
    const {
      width = 1,
      height = 1,
      depth = 1,
      color = 0x00ff00,
      position = [0, 0, 0],
      metalness = 0.5,
      roughness = 0.5,
      castShadow = true,
      receiveShadow = true
    } = options;

    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;

    return this.addObject(name, mesh);
  }

  /**
   * Cria e adiciona uma esfera à cena
   * @param {string} name - Nome da esfera
   * @param {Object} options - Opções da esfera (radius, color, position, etc)
   * @returns {THREE.Mesh} A esfera criada
   */
  createSphere(name, options = {}) {
    const {
      radius = 1,
      widthSegments = 32,
      heightSegments = 32,
      color = 0xff0000,
      position = [0, 0, 0],
      metalness = 0.7,
      roughness = 0.3,
      castShadow = true,
      receiveShadow = true
    } = options;

    const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;

    return this.addObject(name, mesh);
  }

  /**
   * Cria e adiciona um plano à cena
   * @param {string} name - Nome do plano
   * @param {Object} options - Opções do plano (width, height, color, position, etc)
   * @returns {THREE.Mesh} O plano criado
   */
  createPlane(name, options = {}) {
    const {
      width = 10,
      height = 10,
      color = 0x808080,
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      metalness = 0.2,
      roughness = 0.8,
      receiveShadow = true,
      locked = false
    } = options;

    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.receiveShadow = receiveShadow;
    mesh.userData.locked = locked;

    return this.addObject(name, mesh);
  }

  /**
   * Cria e adiciona um torus à cena
   * @param {string} name - Nome do torus
   * @param {Object} options - Opções do torus (radius, tube, color, position, etc)
   * @returns {THREE.Mesh} O torus criado
   */
  createTorus(name, options = {}) {
    const {
      radius = 1,
      tube = 0.4,
      radialSegments = 16,
      tubularSegments = 100,
      color = 0x0000ff,
      position = [0, 0, 0],
      metalness = 0.6,
      roughness = 0.4,
      castShadow = true,
      receiveShadow = true
    } = options;

    const geometry = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;

    return this.addObject(name, mesh);
  }

  /**
   * Cria e adiciona um cilindro à cena
   * @param {string} name - Nome do cilindro
   * @param {Object} options - Opções do cilindro
   * @returns {THREE.Mesh} O cilindro criado
   */
  createCylinder(name, options = {}) {
    const {
      radiusTop = 1,
      radiusBottom = 1,
      height = 2,
      radialSegments = 32,
      color = 0xffff00,
      position = [0, 0, 0],
      metalness = 0.5,
      roughness = 0.5,
      castShadow = true,
      receiveShadow = true
    } = options;

    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;

    return this.addObject(name, mesh);
  }

  /**
   * Cria e adiciona um cone à cena
   * @param {string} name - Nome do cone
   * @param {Object} options - Opções do cone
   * @returns {THREE.Mesh} O cone criado
   */
  createCone(name, options = {}) {
    const {
      radius = 1,
      height = 2,
      radialSegments = 32,
      color = 0xff8800,
      position = [0, 0, 0],
      metalness = 0.5,
      roughness = 0.5,
      castShadow = true,
      receiveShadow = true
    } = options;

    const geometry = new THREE.ConeGeometry(radius, height, radialSegments);
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;

    return this.addObject(name, mesh);
  }

  /**
   * Cria e adiciona um anel à cena
   * @param {string} name - Nome do anel
   * @param {Object} options - Opções do anel
   * @returns {THREE.Mesh} O anel criado
   */
  createRing(name, options = {}) {
    const {
      innerRadius = 0.5,
      outerRadius = 1,
      thetaSegments = 32,
      phiSegments = 1,
      color = 0xff00ff,
      position = [0, 0, 0],
      metalness = 0.6,
      roughness = 0.4,
      castShadow = true,
      receiveShadow = true
    } = options;

    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, thetaSegments, phiSegments);
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;

    return this.addObject(name, mesh);
  }

  /**
   * Cria e adiciona um tetraedro à cena
   * @param {string} name - Nome do tetraedro
   * @param {Object} options - Opções do tetraedro
   * @returns {THREE.Mesh} O tetraedro criado
   */
  createTetrahedron(name, options = {}) {
    const {
      radius = 1,
      detail = 0,
      color = 0x00ffff,
      position = [0, 0, 0],
      metalness = 0.7,
      roughness = 0.3,
      castShadow = true,
      receiveShadow = true
    } = options;

    const geometry = new THREE.TetrahedronGeometry(radius, detail);
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;

    return this.addObject(name, mesh);
  }

  /**
   * Cria e adiciona um octaedro à cena
   * @param {string} name - Nome do octaedro
   * @param {Object} options - Opções do octaedro
   * @returns {THREE.Mesh} O octaedro criado
   */
  createOctahedron(name, options = {}) {
    const {
      radius = 1,
      detail = 0,
      color = 0x00ff88,
      position = [0, 0, 0],
      metalness = 0.7,
      roughness = 0.3,
      castShadow = true,
      receiveShadow = true
    } = options;

    const geometry = new THREE.OctahedronGeometry(radius, detail);
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;

    return this.addObject(name, mesh);
  }

  /**
   * Cria e adiciona um dodecaedro à cena
   * @param {string} name - Nome do dodecaedro
   * @param {Object} options - Opções do dodecaedro
   * @returns {THREE.Mesh} O dodecaedro criado
   */
  createDodecahedron(name, options = {}) {
    const {
      radius = 1,
      detail = 0,
      color = 0xff0088,
      position = [0, 0, 0],
      metalness = 0.7,
      roughness = 0.3,
      castShadow = true,
      receiveShadow = true
    } = options;

    const geometry = new THREE.DodecahedronGeometry(radius, detail);
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;

    return this.addObject(name, mesh);
  }

  /**
   * Cria e adiciona um icosaedro à cena
   * @param {string} name - Nome do icosaedro
   * @param {Object} options - Opções do icosaedro
   * @returns {THREE.Mesh} O icosaedro criado
   */
  createIcosahedron(name, options = {}) {
    const {
      radius = 1,
      detail = 0,
      color = 0x88ff00,
      position = [0, 0, 0],
      metalness = 0.7,
      roughness = 0.3,
      castShadow = true,
      receiveShadow = true
    } = options;

    const geometry = new THREE.IcosahedronGeometry(radius, detail);
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;

    return this.addObject(name, mesh);
  }

  /**
   * Cria e adiciona um torus knot à cena
   * @param {string} name - Nome do torus knot
   * @param {Object} options - Opções do torus knot
   * @returns {THREE.Mesh} O torus knot criado
   */
  createTorusKnot(name, options = {}) {
    const {
      radius = 1,
      tube = 0.4,
      tubularSegments = 64,
      radialSegments = 8,
      p = 2,
      q = 3,
      color = 0x8800ff,
      position = [0, 0, 0],
      metalness = 0.6,
      roughness = 0.4,
      castShadow = true,
      receiveShadow = true
    } = options;

    const geometry = new THREE.TorusKnotGeometry(radius, tube, tubularSegments, radialSegments, p, q);
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;

    return this.addObject(name, mesh);
  }

  /**
   * Cria e adiciona uma cápsula à cena
   * @param {string} name - Nome da cápsula
   * @param {Object} options - Opções da cápsula
   * @returns {THREE.Mesh} A cápsula criada
   */
  createCapsule(name, options = {}) {
    const {
      radius = 1,
      length = 2,
      capSubdivisions = 4,
      radialSegments = 8,
      color = 0x00ffaa,
      position = [0, 0, 0],
      metalness = 0.5,
      roughness = 0.5,
      castShadow = true,
      receiveShadow = true
    } = options;

    const geometry = new THREE.CapsuleGeometry(radius, length, capSubdivisions, radialSegments);
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;

    return this.addObject(name, mesh);
  }

  /**
   * Adiciona uma luz ambiente
   * @param {string} name - Nome da luz
   * @param {Object} options - Opções (color, intensity, position)
   * @returns {THREE.AmbientLight} A luz criada
   */
  addAmbientLight(name, options = {}) {
    const { color = 0xffffff, intensity = 0.5, position = [0, 4, 0] } = options;
    const light = new THREE.AmbientLight(color, intensity);
    // Definir posição para o ícone visual (luz ambiente não tem posição real, mas usamos para o helper)
    light.position.set(...position);
    return this.addLight(name, light);
  }

  /**
   * Adiciona uma luz direcional
   * @param {string} name - Nome da luz
   * @param {Object} options - Opções (color, intensity, position, castShadow)
   * @returns {THREE.DirectionalLight} A luz criada
   */
  addDirectionalLight(name, options = {}) {
    const {
      color = 0xffffff,
      intensity = 0.8,
      position = [10, 10, 5],
      target = [0, 0, 0],
      castShadow = true
    } = options;

    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(...position);

    // Configurar target (para onde a luz aponta)
    light.target.position.set(...target);
    this.scene.add(light.target);

    if (castShadow) {
      light.castShadow = true;
      light.shadow.mapSize.width = 2048;
      light.shadow.mapSize.height = 2048;
      light.shadow.camera.near = 0.5;
      light.shadow.camera.far = 50;
      light.shadow.camera.left = -10;
      light.shadow.camera.right = 10;
      light.shadow.camera.top = 10;
      light.shadow.camera.bottom = -10;
    }

    return this.addLight(name, light);
  }

  /**
   * Adiciona uma luz pontual
   * @param {string} name - Nome da luz
   * @param {Object} options - Opções (color, intensity, position, distance, decay)
   * @returns {THREE.PointLight} A luz criada
   */
  addPointLight(name, options = {}) {
    const {
      color = 0xffffff,
      intensity = 1,
      position = [0, 0, 0],
      distance = 100,
      decay = 2,
      castShadow = false
    } = options;

    const light = new THREE.PointLight(color, intensity, distance, decay);
    light.position.set(...position);
    light.castShadow = castShadow;
    return this.addLight(name, light);
  }

  /**
   * Adiciona uma luz spot
   * @param {string} name - Nome da luz
   * @param {Object} options - Opções (color, intensity, position, target, angle, penumbra, etc)
   * @returns {THREE.SpotLight} A luz criada
   */
  addSpotLight(name, options = {}) {
    const {
      color = 0xffffff,
      intensity = 1,
      position = [0, 5, 0],
      target = [0, 0, 0],
      distance = 100,
      angle = Math.PI / 6,
      penumbra = 0.1,
      decay = 2,
      castShadow = true
    } = options;

    const light = new THREE.SpotLight(color, intensity, distance, angle, penumbra, decay);
    light.position.set(...position);
    light.castShadow = castShadow;

    // Configurar target
    light.target.position.set(...target);
    this.scene.add(light.target);

    if (castShadow) {
      light.shadow.mapSize.width = 1024;
      light.shadow.mapSize.height = 1024;
      light.shadow.camera.near = 0.5;
      light.shadow.camera.far = 50;
    }

    return this.addLight(name, light);
  }

  /**
   * Adiciona uma luz hemisférica (céu/chão)
   * @param {string} name - Nome da luz
   * @param {Object} options - Opções (skyColor, groundColor, intensity, position)
   * @returns {THREE.HemisphereLight} A luz criada
   */
  addHemisphereLight(name, options = {}) {
    const {
      skyColor = 0x87ceeb,      // Azul céu
      groundColor = 0x362d1f,   // Marrom terra
      intensity = 0.6,
      position = [0, 10, 0]
    } = options;

    const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
    light.position.set(...position);
    light.userData.skyColor = skyColor;
    light.userData.groundColor = groundColor;

    return this.addLight(name, light);
  }

  /**
   * Adiciona uma luz de área retangular (janela, painel LED)
   * @param {string} name - Nome da luz
   * @param {Object} options - Opções (color, intensity, width, height, position, lookAt)
   * @returns {THREE.RectAreaLight} A luz criada
   */
  addRectAreaLight(name, options = {}) {
    const {
      color = 0xffffff,
      intensity = 5,
      width = 4,
      height = 4,
      position = [0, 5, -5],
      lookAt = [0, 0, 0]
    } = options;

    const light = new THREE.RectAreaLight(color, intensity, width, height);
    light.position.set(...position);
    light.lookAt(...lookAt);
    light.userData.width = width;
    light.userData.height = height;

    return this.addLight(name, light);
  }

  /**
   * Adiciona um grid helper
   * @param {string} name - Nome do helper
   * @param {Object} options - Opções (size, divisions, colorCenterLine, colorGrid)
   * @returns {THREE.GridHelper} O helper criado
   */
  addGridHelper(name, options = {}) {
    const {
      size = 20,
      divisions = 20,
      colorCenterLine = 0x888888,  // Cor padrão mais clara para visibilidade
      colorGrid = 0x555555          // Cor padrão mais clara para visibilidade
    } = options;

    const helper = new THREE.GridHelper(size, divisions, colorCenterLine, colorGrid);
    return this.addHelper(name, helper);
  }

  /**
   * Adiciona um helper de eixos
   * @param {string} name - Nome do helper
   * @param {Object} options - Opções (size)
   * @returns {THREE.AxesHelper} O helper criado
   */
  addAxesHelper(name, options = {}) {
    const { size = 5 } = options;
    const helper = new THREE.AxesHelper(size);
    return this.addHelper(name, helper);
  }

  /**
   * Atualiza a cor de fundo da cena
   * @param {number|string} color - Cor em hexadecimal ou string
   */
  setBackgroundColor(color) {
    this.scene.background = new THREE.Color(color);
    this.options.backgroundColor = color;
  }

  /**
   * Habilita o céu dinâmico (Sky)
   * @param {Object} options - Opções do céu (turbidity, rayleigh, etc.)
   */
  enableSky(options = {}) {
    const {
      turbidity = 10,
      rayleigh = 2,
      mieCoefficient = 0.005,
      mieDirectionalG = 0.8
    } = options;

    // Criar Sky se não existir
    if (!this.sky) {
      this.sky = new Sky();
      this.sky.scale.setScalar(10000);
    }

    // Adicionar à cena
    this.scene.add(this.sky);
    this.skyEnabled = true;

    // Configurar uniforms do shader
    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity'].value = turbidity;
    uniforms['rayleigh'].value = rayleigh;
    uniforms['mieCoefficient'].value = mieCoefficient;
    uniforms['mieDirectionalG'].value = mieDirectionalG;

    // Atualizar posição do sol baseado na luz direcional
    this.updateSkyFromDirectionalLight();
  }

  /**
   * Desabilita o céu dinâmico
   */
  disableSky() {
    if (this.sky) {
      this.scene.remove(this.sky);
    }
    this.skyEnabled = false;
    // Restaurar cor de fundo
    this.scene.background = new THREE.Color(this.options.backgroundColor);
  }

  /**
   * Atualiza parâmetros do céu
   * @param {Object} options - Parâmetros a atualizar
   */
  updateSky(options = {}) {
    if (!this.sky || !this.skyEnabled) return;

    const uniforms = this.sky.material.uniforms;
    if (options.turbidity !== undefined) uniforms['turbidity'].value = options.turbidity;
    if (options.rayleigh !== undefined) uniforms['rayleigh'].value = options.rayleigh;
    if (options.mieCoefficient !== undefined) uniforms['mieCoefficient'].value = options.mieCoefficient;
    if (options.mieDirectionalG !== undefined) uniforms['mieDirectionalG'].value = options.mieDirectionalG;
  }

  /**
   * Atualiza o céu baseado na posição da luz direcional
   */
  updateSkyFromDirectionalLight() {
    if (!this.sky || !this.skyEnabled) return;

    const directionalLight = this.lights.get('Directional Light');
    if (!directionalLight) return;

    // Calcular posição do sol baseado na posição da luz
    const pos = directionalLight.position;
    const phi = Math.PI / 2 - Math.atan2(pos.y, Math.sqrt(pos.x * pos.x + pos.z * pos.z));
    const theta = Math.atan2(pos.x, pos.z);

    this.sun.setFromSphericalCoords(1, phi, theta);
    this.sky.material.uniforms['sunPosition'].value.copy(this.sun);

    // Ajustar renderizador para HDR se necessário
    if (this.renderer) {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 0.5;
    }
  }

  /**
   * Cria textura procedural de nuvens
   * @param {number} size - Tamanho da textura
   * @returns {THREE.CanvasTexture}
   */
  createCloudTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Fundo transparente
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, size, size);

    // Desenhar várias "nuvens" com gradientes circulares
    const numClouds = 15;
    for (let i = 0; i < numClouds; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const radius = 50 + Math.random() * 100;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);

      const alpha = 0.3 + Math.random() * 0.4;
      gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      gradient.addColorStop(0.4, `rgba(255, 255, 255, ${alpha * 0.6})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Adicionar mais detalhes menores
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const radius = 20 + Math.random() * 40;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);

      const alpha = 0.2 + Math.random() * 0.3;
      gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  /**
   * Habilita as nuvens
   * @param {Object} options - Opções das nuvens
   */
  enableClouds(options = {}) {
    const {
      height = 500,
      size = 2000,
      opacity = 0.6,
      speed = 0.01
    } = options;

    // Remover nuvens existentes
    if (this.clouds) {
      this.scene.remove(this.clouds);
      this.clouds.geometry.dispose();
      this.clouds.material.dispose();
    }

    // Criar textura de nuvens
    const cloudTexture = this.createCloudTexture(512);
    cloudTexture.repeat.set(3, 3);

    // Criar plano de nuvens
    const cloudGeometry = new THREE.PlaneGeometry(size, size);
    const cloudMaterial = new THREE.MeshBasicMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: opacity,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
    this.clouds.rotation.x = -Math.PI / 2; // Horizontal
    this.clouds.position.y = height;
    this.clouds.name = 'Clouds';

    this.scene.add(this.clouds);
    this.cloudsEnabled = true;
    this.cloudSpeed = speed;
  }

  /**
   * Desabilita as nuvens
   */
  disableClouds() {
    if (this.clouds) {
      this.scene.remove(this.clouds);
      this.clouds.geometry.dispose();
      this.clouds.material.dispose();
      this.clouds = null;
    }
    this.cloudsEnabled = false;
  }

  /**
   * Atualiza parâmetros das nuvens
   * @param {Object} options - Parâmetros a atualizar
   */
  updateClouds(options = {}) {
    if (!this.clouds || !this.cloudsEnabled) return;

    if (options.height !== undefined) {
      this.clouds.position.y = options.height;
    }
    if (options.opacity !== undefined) {
      this.clouds.material.opacity = options.opacity;
    }
    if (options.speed !== undefined) {
      this.cloudSpeed = options.speed;
    }
  }

  /**
   * Anima as nuvens (deve ser chamado no loop de render)
   * @param {number} deltaTime - Tempo desde o último frame
   */
  animateClouds(deltaTime = 0.016) {
    if (!this.clouds || !this.cloudsEnabled) return;

    // Mover a textura das nuvens
    if (this.clouds.material.map) {
      this.clouds.material.map.offset.x += this.cloudSpeed * deltaTime;
      this.clouds.material.map.offset.y += this.cloudSpeed * deltaTime * 0.3;
    }
  }

  /**
   * Atualiza o grid helper
   * @param {string} name - Nome do grid helper
   * @param {Object} options - Novas opções (size, divisions)
   */
  updateGridHelper(name, options = {}) {
    const oldGrid = this.helpers.get(name);
    if (!oldGrid) return;

    const { size = 20, divisions = 20 } = options;

    // Remover grid antigo
    this.scene.remove(oldGrid);
    oldGrid.dispose();

    // Criar novo grid
    const newGrid = new THREE.GridHelper(size, divisions, 0xff5555, 0xaaaaaa);
    newGrid.name = name;
    this.scene.add(newGrid);
    this.helpers.set(name, newGrid);
  }

  /**
   * Atualiza o axes helper
   * @param {string} name - Nome do axes helper
   * @param {Object} options - Novas opções (size)
   */
  updateAxesHelper(name, options = {}) {
    const oldAxes = this.helpers.get(name);
    if (!oldAxes) return;

    const { size = 5 } = options;

    // Remover axes antigo
    this.scene.remove(oldAxes);
    if (oldAxes.dispose) oldAxes.dispose();

    // Criar novo axes
    const newAxes = new THREE.AxesHelper(size);
    newAxes.name = name;
    this.scene.add(newAxes);
    this.helpers.set(name, newAxes);
  }

  /**
   * Define o tipo de câmera
   * @param {string} type - Tipo de câmera ('perspective', 'isometric', 'firstPerson')
   * @param {Object} options - Opções da câmera
   */
  setCameraType(type, options = {}) {
    this.cameraController.setCamera(type, options);
  }

  /**
   * Obtém o tipo de câmera atual
   * @returns {string} Tipo da câmera
   */
  getCameraType() {
    return this.cameraController.getCameraType();
  }

  /**
   * Atualiza a posição da câmera
   * @param {Array<number>} position - Array [x, y, z]
   */
  setCameraPosition(position) {
    const camera = this.cameraController.getCamera();
    camera.position.set(...position);
  }

  /**
   * Obtém a posição atual da câmera
   * @returns {THREE.Vector3} Posição da câmera
   */
  getCameraPosition() {
    const camera = this.cameraController.getCamera();
    return camera.position.clone();
  }

  /**
   * Carrega um modelo 3D
   * @param {string} name - Nome do objeto
   * @param {string} url - URL do arquivo
   * @param {Object} options - Opções de carregamento e posicionamento
   * @returns {Promise<THREE.Object3D>} Promise com o objeto carregado
   */
  async loadModel(name, url, options = {}) {
    try {
      const model = await this.assetLoader.loadModel(url, options);
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = options.castShadow !== false;
          child.receiveShadow = options.receiveShadow !== false;
        }
      });
      return this.addObject(name, model);
    } catch (error) {
      console.error(`Erro ao carregar modelo ${name}:`, error);
      throw error;
    }
  }

  /**
   * Seleciona um objeto na cena (método legacy, usa selectObjects internamente)
   * @param {string} name - Nome do objeto
   */
  selectObject(name) {
    if (name) {
      this.selectObjects([name]);
    } else {
      this.selectObjects([]);
    }
  }

  /**
   * Seleciona múltiplos objetos na cena
   * @param {string[]} names - Array de nomes dos objetos
   */
  selectObjects(names) {
    // Remover highlight de objetos anteriormente selecionados
    if (this.selectedObjects) {
      for (const name of this.selectedObjects) {
        const obj = this.objects.get(name);
        if (obj) {
          this.restoreObjectMaterial(obj);
        }
      }
    }

    // Atualizar lista de selecionados
    this.selectedObjects = names.filter(n => n && this.objects.has(n));
    this.selectedObject = this.selectedObjects.length > 0 ? this.selectedObjects[this.selectedObjects.length - 1] : null;

    // Destacar todos os objetos selecionados
    for (const name of this.selectedObjects) {
      const obj = this.objects.get(name);
      if (obj) {
        this.highlightObject(obj);
      }
    }

    // Anexar gizmo ao objeto primário (último selecionado)
    if (this.selectedObject) {
      const obj = this.objects.get(this.selectedObject);
      if (obj) {
        this.attachTransformControls(obj);

        // Atualizar SelectionController para que G/R/S funcionem
        if (this.selectionController) {
          const selectedObjs = this.selectedObjects
            .map(n => this.objects.get(n))
            .filter(Boolean);
          this.selectionController.setSelectedObjects(selectedObjs);
        }
      }
    } else {
      this.detachTransformControls();
    }
  }

  /**
   * Seleciona todos os objetos da cena
   */
  selectAll() {
    const allNames = Array.from(this.objects.keys());
    this.selectObjects(allNames);

    // Atualizar SelectionController
    if (this.selectionController) {
      this.selectionController.selectAll(this.objects);
    }

    if (this.onObjectSelected) {
      this.onObjectSelected(this.selectedObject, this.selectedObjects);
    }
  }

  /**
   * Obtém todos os objetos selecionados
   * @returns {string[]} Array de nomes dos objetos selecionados
   */
  getSelectedObjects() {
    return this.selectedObjects || [];
  }

  /**
   * Obtém a quantidade de objetos selecionados
   * @returns {number}
   */
  getSelectionCount() {
    return this.selectedObjects ? this.selectedObjects.length : 0;
  }

  /**
   * Destaca um objeto visualmente
   * @param {THREE.Object3D} obj - Objeto a destacar
   */
  highlightObject(obj) {
    obj.traverse((child) => {
      if (child.isMesh && !child.userData.isHelper) {
        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material;
        }
        const highlightMaterial = child.material.clone();
        highlightMaterial.emissive = new THREE.Color(0x00ff00);
        highlightMaterial.emissiveIntensity = 0.3;
        child.material = highlightMaterial;
      }
    });
  }

  /**
   * Restaura o material original de um objeto
   * @param {THREE.Object3D} obj - Objeto a restaurar
   */
  restoreObjectMaterial(obj) {
    obj.traverse((child) => {
      if (child.isMesh && child.userData.originalMaterial) {
        child.material = child.userData.originalMaterial;
        delete child.userData.originalMaterial;
      }
    });
  }

  /**
   * Obtém o objeto selecionado
   * @returns {string|null} Nome do objeto selecionado
   */
  getSelectedObject() {
    return this.selectedObject;
  }

  /**
   * Atualiza a transformação de um objeto
   * @param {string} name - Nome do objeto
   * @param {Object} transform - Transformação {position, rotation, scale}
   * @param {boolean} applyCoordinateSystem - Se deve aplicar o sistema de coordenadas
   */
  updateObjectTransform(name, transform, applyCoordinateSystem = true) {
    const obj = this.objects.get(name);
    if (!obj) return;

    if (transform.position) {
      let position = [...transform.position];
      
      // Aplicar snap se habilitado
      if (this.coordinateSystem.config.snapEnabled) {
        position = this.coordinateSystem.snapPosition(position);
      }
      
      // Aplicar sistema de coordenadas
      if (applyCoordinateSystem) {
        position = this.coordinateSystem.toThreeJS(position);
      }
      
      obj.position.set(...position);
    }
    
    if (transform.rotation) {
      let rotation = [...transform.rotation];
      
      // Aplicar snap de ângulo se habilitado (rotation já está em radianos)
      if (this.coordinateSystem.config.snapEnabled) {
        rotation = rotation.map(angle => {
          const degrees = angle * 180 / Math.PI;
          const snappedDegrees = this.coordinateSystem.snapAngle(degrees);
          return snappedDegrees * Math.PI / 180;
        });
      }
      
      obj.rotation.set(...rotation);
    }
    
    if (transform.scale) {
      if (typeof transform.scale === 'number') {
        obj.scale.setScalar(transform.scale);
      } else {
        obj.scale.set(...transform.scale);
      }
    }
  }

  /**
   * Obtém a transformação de um objeto no sistema de coordenadas do jogo
   * @param {string} name - Nome do objeto
   * @returns {Object} Transformação {position, rotation, scale}
   */
  getObjectTransform(name) {
    const obj = this.objects.get(name);
    if (!obj) return null;

    const position = this.coordinateSystem.fromThreeJS(obj.position.toArray());
    const rotation = obj.rotation.toArray().map(r => r * 180 / Math.PI);
    const scale = obj.scale.toArray();

    return { position, rotation, scale };
  }

  /**
   * Atualiza a configuração do sistema de coordenadas
   * @param {Object} config - Nova configuração
   */
  updateCoordinateConfig(config) {
    this.coordinateSystem.updateConfig(config);
    
    // Atualizar grid helper se necessário
    if (config.gridSize !== undefined || config.gridDivisions !== undefined) {
      const gridHelper = this.helpers.get('grid');
      if (gridHelper) {
        this.removeHelper('grid');
        this.addGridHelper('grid', {
          size: config.gridSize || this.coordinateSystem.config.gridSize,
          divisions: config.gridDivisions || this.coordinateSystem.config.gridDivisions
        });
      }
    }
    
    // Atualizar visibilidade do grid
    if (config.showGrid !== undefined) {
      const gridHelper = this.helpers.get('grid');
      if (gridHelper) {
        gridHelper.visible = config.showGrid && this.mode === 'dev';
      }
    }
    
    // Atualizar visibilidade dos eixos
    if (config.showAxes !== undefined) {
      const axesHelper = this.helpers.get('axes');
      if (axesHelper) {
        axesHelper.visible = config.showAxes && this.mode === 'dev';
      }
    }
    
    // Atualizar tamanho dos eixos
    if (config.axesSize !== undefined) {
      const axesHelper = this.helpers.get('axes');
      if (axesHelper) {
        this.removeHelper('axes');
        this.addAxesHelper('axes', { size: config.axesSize });
      }
    }
  }

  /**
   * Obtém a configuração do sistema de coordenadas
   * @returns {Object} Configuração atual
   */
  getCoordinateConfig() {
    return this.coordinateSystem.getConfig();
  }

  /**
   * Define o modo da engine (dev ou game)
   * @param {string} mode - Modo ('dev' ou 'game')
   */
  setMode(mode) {
    if (mode !== 'dev' && mode !== 'game') {
      console.warn(`Modo inválido: ${mode}. Usando 'dev'`);
      mode = 'dev';
    }

    const previousMode = this.mode;
    this.mode = mode;

    // Mostrar/ocultar helpers baseado no modo
    this.helpers.forEach((helper, name) => {
      helper.visible = mode === 'dev';
    });

    // Mostrar/ocultar TransformControls baseado no modo
    if (this.transformControls) {
      this.transformControls.visible = mode === 'dev';
      this.transformControls.enabled = mode === 'dev';
    }

    // Mostrar/ocultar light helpers
    this.lights.forEach((light, name) => {
      const helper = this.helpers.get(name);
      if (helper) {
        helper.visible = mode === 'dev';
      }
    });

    // Gerenciar RuntimeEngine (já criado no init)
    if (mode === 'game' && previousMode === 'dev') {
      // Entrando em Game mode - iniciar RuntimeEngine
      this.runtimeEngine.start();
    } else if (mode === 'dev' && previousMode === 'game') {
      // Voltando para Dev mode - parar RuntimeEngine
      this.runtimeEngine.stop();
    }
  }

  /**
   * Obtém o modo atual
   * @returns {string} Modo atual
   */
  getMode() {
    return this.mode;
  }

  /**
   * Limpa todos os objetos, luzes e helpers da cena
   */
  clear() {
    // Remover objetos
    this.objects.forEach((_, name) => this.removeObject(name));
    
    // Remover luzes
    this.lights.forEach((_, name) => this.removeLight(name));
    
    // Remover helpers
    this.helpers.forEach((_, name) => this.removeHelper(name));
  }

  // ==================== Serialização ====================

  /**
   * Serializa a cena atual para JSON
   * @returns {Object} Dados da cena em formato JSON
   */
  serializeScene() {
    const sceneData = {
      version: '1.0',
      name: 'Scene',
      timestamp: Date.now(),
      objects: [],
      lights: [],
      environment: {
        backgroundColor: this.scene.background?.getHexString?.() || '1a1a2e',
        skyEnabled: this.skyEnabled,
        skySettings: this.skyEnabled ? this.getSkySettings() : null,
        cloudsEnabled: this.cloudsEnabled
      },
      settings: {
        snapSettings: { ...this.snapSettings },
        transformSpace: this.transformSpace
      }
    };

    // Serializar objetos (excluir luzes que já serão serializadas separadamente)
    this.objects.forEach((obj, name) => {
      // Pular se for uma luz
      if (obj.isLight || obj.userData?.isLight) return;

      const objData = this.serializeObject(obj);
      if (objData) {
        sceneData.objects.push(objData);
      }
    });

    // Serializar luzes
    this.lights.forEach((light, name) => {
      const lightData = this.serializeLight(light);
      if (lightData) {
        sceneData.lights.push(lightData);
      }
    });

    return sceneData;
  }

  /**
   * Serializa um objeto 3D
   * @param {THREE.Object3D} obj
   * @returns {Object|null}
   */
  serializeObject(obj) {
    if (!obj) return null;

    const data = {
      name: obj.name,
      type: obj.userData?.type || obj.geometry?.type || 'unknown',
      visible: obj.visible,
      transform: {
        position: obj.position.toArray(),
        rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
        scale: obj.scale.toArray()
      },
      userData: { ...obj.userData }
    };

    // Serializar geometria
    if (obj.geometry) {
      data.geometry = {
        type: obj.geometry.type,
        parameters: obj.geometry.parameters ? { ...obj.geometry.parameters } : {}
      };
    }

    // Serializar material
    if (obj.material || obj.userData?.originalMaterial) {
      const mat = obj.userData?.originalMaterial || obj.material;
      data.material = {
        color: mat.color?.getHexString?.() || 'ffffff',
        metalness: mat.metalness ?? 0.5,
        roughness: mat.roughness ?? 0.5,
        opacity: mat.opacity ?? 1,
        transparent: mat.transparent ?? false,
        emissive: mat.emissive?.getHexString?.() || '000000',
        emissiveIntensity: mat.emissiveIntensity ?? 0,
        wireframe: mat.wireframe ?? false,
        flatShading: mat.flatShading ?? false,
        side: mat.side ?? 0
      };
    }

    // Para grupos/modelos importados
    if (obj.userData?.sourceFile) {
      data.sourceFile = obj.userData.sourceFile;
    }
    // Caminho real do arquivo para persistência
    if (obj.userData?.filePath) {
      data.filePath = obj.userData.filePath;
    }

    // Serializar scripts anexados ao objeto
    if (obj.userData?.scripts && obj.userData.scripts.length > 0) {
      data.scripts = [...obj.userData.scripts];
    }
    if (obj.userData?.scriptProperties && Object.keys(obj.userData.scriptProperties).length > 0) {
      data.scriptProperties = JSON.parse(JSON.stringify(obj.userData.scriptProperties));
    }

    return data;
  }

  /**
   * Serializa uma luz
   * @param {THREE.Light} light
   * @returns {Object|null}
   */
  serializeLight(light) {
    if (!light) return null;

    const data = {
      name: light.name,
      type: light.type,
      visible: light.visible,
      color: light.color?.getHexString?.() || 'ffffff',
      intensity: light.intensity ?? 1,
      transform: {
        position: light.position.toArray(),
        rotation: [light.rotation.x, light.rotation.y, light.rotation.z]
      }
    };

    // Propriedades específicas por tipo
    if (light.isPointLight || light.isSpotLight) {
      data.distance = light.distance;
      data.decay = light.decay;
    }

    if (light.isSpotLight) {
      data.angle = light.angle;
      data.penumbra = light.penumbra;
    }

    if (light.isDirectionalLight || light.isSpotLight) {
      data.castShadow = light.castShadow;
    }

    if (light.isHemisphereLight) {
      data.groundColor = light.groundColor?.getHexString?.() || '444444';
    }

    return data;
  }

  /**
   * Obtém configurações do sky
   * @returns {Object|null}
   */
  getSkySettings() {
    if (!this.sky) return null;
    const uniforms = this.sky.material.uniforms;
    return {
      turbidity: uniforms.turbidity?.value,
      rayleigh: uniforms.rayleigh?.value,
      mieCoefficient: uniforms.mieCoefficient?.value,
      mieDirectionalG: uniforms.mieDirectionalG?.value,
      sunPosition: this.sun?.toArray()
    };
  }

  /**
   * Carrega uma cena a partir de JSON
   * @param {Object} sceneData - Dados da cena
   */
  async loadScene(sceneData) {
    console.log('Carregando cena:', sceneData);
    console.log('Objetos a carregar:', sceneData.objects?.length || 0);
    console.log('Luzes a carregar:', sceneData.lights?.length || 0);

    // Limpar cena atual
    this.clearScene();

    // Restaurar ambiente
    if (sceneData.environment) {
      const env = sceneData.environment;

      if (env.backgroundColor) {
        this.scene.background = new THREE.Color(`#${env.backgroundColor}`);
      }

      if (env.skyEnabled && env.skySettings) {
        this.enableSky(env.skySettings);
      }

      if (env.cloudsEnabled) {
        this.enableClouds();
      }
    }

    // Restaurar configurações
    if (sceneData.settings) {
      if (sceneData.settings.snapSettings) {
        this.snapSettings = { ...sceneData.settings.snapSettings };
      }
      if (sceneData.settings.transformSpace) {
        this.transformSpace = sceneData.settings.transformSpace;
      }
    }

    // Restaurar objetos
    for (const objData of sceneData.objects || []) {
      await this.deserializeObject(objData);
    }

    // Restaurar luzes
    for (const lightData of sceneData.lights || []) {
      this.deserializeLight(lightData);
    }

    // Notificar mudança
    if (this.onObjectsChanged) {
      this.onObjectsChanged();
    }

    console.log('Cena carregada:', sceneData.name);
  }

  /**
   * Deserializa e cria um objeto
   * @param {Object} data
   */
  async deserializeObject(data) {
    if (!data) return;

    const { name, type, transform, geometry, material } = data;

    console.log('Deserializando objeto:', name, 'tipo:', geometry?.type);

    // Preparar opções de material
    const matOptions = material ? {
      color: parseInt(material.color, 16),
      metalness: material.metalness,
      roughness: material.roughness,
      opacity: material.opacity,
      transparent: material.transparent,
      emissive: parseInt(material.emissive, 16),
      emissiveIntensity: material.emissiveIntensity,
      wireframe: material.wireframe,
      flatShading: material.flatShading,
      side: material.side
    } : {};

    // Criar objeto baseado no tipo de geometria
    const geoType = geometry?.type?.replace('Geometry', '').replace('Buffer', '').toLowerCase();
    const params = geometry?.parameters || {};

    console.log('Tipo de geometria detectado:', geoType, 'params:', params);

    let obj;

    switch (geoType) {
      case 'box':
        obj = this.createBox(name, {
          ...matOptions,
          width: params.width,
          height: params.height,
          depth: params.depth
        });
        break;
      case 'sphere':
        obj = this.createSphere(name, {
          ...matOptions,
          radius: params.radius,
          widthSegments: params.widthSegments,
          heightSegments: params.heightSegments
        });
        break;
      case 'cylinder':
        obj = this.createCylinder(name, {
          ...matOptions,
          radiusTop: params.radiusTop,
          radiusBottom: params.radiusBottom,
          height: params.height
        });
        break;
      case 'plane':
        obj = this.createPlane(name, {
          ...matOptions,
          width: params.width,
          height: params.height
        });
        break;
      case 'cone':
        obj = this.createCone(name, {
          ...matOptions,
          radius: params.radius,
          height: params.height
        });
        break;
      case 'torus':
        obj = this.createTorus(name, {
          ...matOptions,
          radius: params.radius,
          tube: params.tube
        });
        break;
      default:
        // Tentar carregar modelo externo se tiver filePath
        if (data.filePath) {
          try {
            console.log('Carregando modelo de:', data.filePath);
            const extension = data.sourceFile?.split('.').pop().toLowerCase() || 'glb';
            const model = await this.assetLoader.loadModel(data.filePath, { extension });

            model.name = name;
            model.userData.type = 'model';
            model.userData.sourceFile = data.sourceFile;
            model.userData.filePath = data.filePath;

            // Configurar sombras
            model.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            // Adicionar à cena
            this.scene.add(model);
            this.objects.set(name, model);
            obj = model;

            console.log(`Modelo "${name}" recarregado de ${data.filePath}`);
          } catch (error) {
            console.error(`Erro ao carregar modelo ${name} de ${data.filePath}:`, error);
            return;
          }
        } else {
          console.warn(`Tipo de geometria não suportado: ${geoType} (sem filePath)`);
          return;
        }
    }

    // Aplicar transform
    if (obj && transform) {
      obj.position.fromArray(transform.position);
      obj.rotation.set(...transform.rotation);
      obj.scale.fromArray(transform.scale);
    }

    // Aplicar visibilidade
    if (obj) {
      obj.visible = data.visible !== false;
    }

    // Restaurar userData.locked se existia
    if (obj && data.userData?.locked) {
      obj.userData.locked = true;
    }

    // Restaurar scripts anexados ao objeto
    if (obj && data.scripts && data.scripts.length > 0) {
      obj.userData.scripts = [...data.scripts];
    }
    if (obj && data.scriptProperties) {
      obj.userData.scriptProperties = JSON.parse(JSON.stringify(data.scriptProperties));
    }
  }

  /**
   * Deserializa e cria uma luz
   * @param {Object} data
   */
  deserializeLight(data) {
    if (!data) return;

    const { name, type, color, intensity, transform } = data;
    const colorHex = parseInt(color, 16);

    let light;

    switch (type) {
      case 'PointLight':
        this.addPointLight(name, {
          color: colorHex,
          intensity,
          distance: data.distance,
          decay: data.decay,
          position: transform?.position
        });
        break;
      case 'DirectionalLight':
        this.addDirectionalLight(name, {
          color: colorHex,
          intensity,
          position: transform?.position,
          castShadow: data.castShadow
        });
        break;
      case 'SpotLight':
        this.addSpotLight(name, {
          color: colorHex,
          intensity,
          distance: data.distance,
          angle: data.angle,
          penumbra: data.penumbra,
          position: transform?.position,
          castShadow: data.castShadow
        });
        break;
      case 'AmbientLight':
        this.addAmbientLight(name, {
          color: colorHex,
          intensity
        });
        break;
      case 'HemisphereLight':
        this.addHemisphereLight(name, {
          skyColor: colorHex,
          groundColor: parseInt(data.groundColor || '444444', 16),
          intensity
        });
        break;
    }

    // Aplicar visibilidade
    const createdLight = this.lights.get(name);
    if (createdLight) {
      createdLight.visible = data.visible !== false;
    }
  }

  /**
   * Limpa a cena (mantendo helpers)
   */
  clearScene() {
    // Limpar seleção primeiro
    if (this.selectionController) {
      this.selectionController.clearSelection();
    }
    this.selectedObject = null;
    this.selectedObjects = [];

    // Remover todos os objetos
    const objectNames = Array.from(this.objects.keys());
    objectNames.forEach(name => this.removeObject(name));

    // Remover todas as luzes (exceto as default)
    const lightNames = Array.from(this.lights.keys());
    lightNames.forEach(name => {
      if (name !== 'Ambient Light') {
        this.removeLight(name);
      }
    });
  }

  // ========================================
  // 2D ENGINE METHODS
  // ========================================

  /**
   * Inicializa o modo 2D
   * @param {Object} options - Opções de configuração 2D
   */
  init2DMode(options = {}) {
    const {
      backgroundColor = 0x1e1e1e,
      pixelsPerUnit = 16,
      sortingLayers = ['Background', 'Default', 'Foreground', 'UI']
    } = options;

    this.is2D = true;
    this.projectType = '2d';
    this.pixelsPerUnit = pixelsPerUnit;
    this.sortingLayers = sortingLayers;

    // Atualizar cor de fundo
    this.scene.background = new THREE.Color(backgroundColor);

    // Desativar sombras em 2D (não usadas)
    this.renderer.shadowMap.enabled = false;

    // Criar câmera 2D
    this.camera2D = new Camera2D({
      width: this.container.clientWidth,
      height: this.container.clientHeight,
      backgroundColor
    });

    // Criar grid 2D
    this.grid2D = new Grid2D({
      size: 100,
      divisions: 100,
      primaryInterval: 10
    });
    this.scene.add(this.grid2D.getObject());

    // Ativar controles da câmera 2D
    this.camera2D.enable(this.renderer.domElement);

    // Desativar CameraController 3D
    if (this.cameraController) {
      this.cameraController.disable();
    }

    console.log('[ThreeEngine] 2D mode initialized');
  }

  /**
   * Alterna entre modo 2D e 3D
   * @param {string} projectType - '2d' ou '3d'
   */
  setProjectType(projectType) {
    if (projectType === '2d' && !this.is2D) {
      this.init2DMode();
    } else if (projectType === '3d' && this.is2D) {
      this.disable2DMode();
    }
  }

  /**
   * Desativa modo 2D e volta para 3D
   */
  disable2DMode() {
    this.is2D = false;
    this.projectType = '3d';

    // Remover grid 2D
    if (this.grid2D) {
      this.scene.remove(this.grid2D.getObject());
      this.grid2D = null;
    }

    // Desativar câmera 2D
    if (this.camera2D) {
      this.camera2D.disable();
      this.camera2D = null;
    }

    // Reativar CameraController 3D
    if (this.cameraController) {
      this.cameraController.enable();
    }

    // Restaurar sombras
    this.renderer.shadowMap.enabled = this.options.enableShadows;

    console.log('[ThreeEngine] 3D mode restored');
  }

  /**
   * Cria um sprite 2D
   * @param {string} name - Nome do sprite
   * @param {Object} options - Opções do sprite
   */
  createSprite(name, options = {}) {
    // Gerar nome único se necessário
    let finalName = name;
    if (this.objects.has(name)) {
      finalName = `${name}_${generateShortUID()}`;
    }

    const sprite = SpriteRenderer.createSprite({
      name: finalName,
      ...options
    });

    // Adicionar à cena e ao registro
    this.scene.add(sprite);
    this.objects.set(finalName, sprite);

    // Notificar mudanças
    if (this.onObjectsChanged) {
      this.onObjectsChanged();
    }

    return sprite;
  }

  /**
   * Atualiza propriedades de um sprite
   * @param {string} name - Nome do sprite
   * @param {Object} updates - Propriedades a atualizar
   */
  updateSprite(name, updates) {
    const sprite = this.objects.get(name);
    if (!sprite || !sprite.userData.is2D) return;

    // Atualizar posição
    if (updates.position) {
      sprite.position.x = updates.position.x ?? sprite.position.x;
      sprite.position.y = updates.position.y ?? sprite.position.y;
    }

    // Atualizar rotação
    if (updates.rotation !== undefined) {
      sprite.rotation.z = updates.rotation * Math.PI / 180;
    }

    // Atualizar escala
    if (updates.scale) {
      const flipX = sprite.userData.flipX ? -1 : 1;
      const flipY = sprite.userData.flipY ? -1 : 1;
      sprite.scale.x = (updates.scale.x ?? Math.abs(sprite.scale.x)) * flipX;
      sprite.scale.y = (updates.scale.y ?? Math.abs(sprite.scale.y)) * flipY;
    }

    // Atualizar sorting
    if (updates.sortingLayer || updates.sortingOrder !== undefined) {
      SpriteRenderer.updateSorting(
        sprite,
        updates.sortingLayer ?? sprite.userData.sortingLayer,
        updates.sortingOrder ?? sprite.userData.sortingOrder
      );
    }

    // Atualizar flip
    if (updates.flipX !== undefined) {
      SpriteRenderer.setFlipX(sprite, updates.flipX);
    }
    if (updates.flipY !== undefined) {
      SpriteRenderer.setFlipY(sprite, updates.flipY);
    }

    // Atualizar cor
    if (updates.color !== undefined) {
      SpriteRenderer.setColor(sprite, updates.color);
    }

    // Atualizar opacidade
    if (updates.opacity !== undefined) {
      SpriteRenderer.setOpacity(sprite, updates.opacity);
    }
  }

  /**
   * Retorna a câmera ativa (2D ou 3D)
   */
  getActiveCamera() {
    if (this.is2D && this.camera2D) {
      return this.camera2D.getCamera();
    }
    return this.cameraController?.getCamera();
  }

  /**
   * Update do modo 2D (chamado no loop de render)
   */
  update2D(deltaTime) {
    if (!this.is2D || !this.camera2D) return;

    this.camera2D.update(deltaTime);
  }

  /**
   * Converte posição da tela para mundo 2D
   */
  screenToWorld2D(screenX, screenY) {
    if (!this.camera2D) return { x: 0, y: 0 };
    return this.camera2D.screenToWorld(screenX, screenY);
  }

  /**
   * Converte posição do mundo para tela 2D
   */
  worldToScreen2D(worldX, worldY) {
    if (!this.camera2D) return { x: 0, y: 0 };
    return this.camera2D.worldToScreen(worldX, worldY);
  }

  /**
   * Define zoom da câmera 2D
   */
  setZoom2D(zoom) {
    if (this.camera2D) {
      this.camera2D.setZoom(zoom);
    }
  }

  /**
   * Retorna zoom atual da câmera 2D
   */
  getZoom2D() {
    return this.camera2D?.getZoom() || 1;
  }

  /**
   * Move câmera 2D para posição
   */
  moveCameraTo2D(x, y, instant = false) {
    if (this.camera2D) {
      this.camera2D.moveTo(x, y, instant);
    }
  }

  /**
   * Define objeto para câmera 2D seguir
   */
  setCameraFollow2D(target, offset = { x: 0, y: 0 }) {
    if (this.camera2D) {
      this.camera2D.setFollowTarget(target, offset);
    }
  }

  /**
   * Retorna se está em modo 2D
   */
  is2DMode() {
    return this.is2D;
  }

  /**
   * Retorna os sorting layers disponíveis
   */
  getSortingLayers() {
    return this.sortingLayers || Object.keys(SpriteRenderer.SORTING_LAYERS);
  }

  // ========================================
  // END 2D ENGINE METHODS
  // ========================================

  /**
   * Destrói a engine e limpa todos os recursos
   */
  dispose() {
    this.stop();
    this.clear();

    // Limpar histórico de comandos
    if (this.commandHistory) {
      this.commandHistory.dispose();
    }

    // Limpar InputManager
    if (this.inputManager) {
      this.inputManager.dispose();
    }

    // Limpar SelectionController
    if (this.selectionController) {
      this.selectionController.dispose();
    }

    // Limpar TransformControls
    if (this.transformControls) {
      this.transformControls.detach();
      this.scene.remove(this.transformControls);
      this.transformControls.dispose();
      this.transformControls = null;
    }

    // Limpar Camera2D
    if (this.camera2D) {
      this.camera2D.disable();
    }

    // Limpar CameraController
    if (this.cameraController) {
      this.cameraController.dispose();
    }

    // Limpar renderer
    if (this.renderer) {
      this.renderer.dispose();
      if (this.container && this.renderer.domElement) {
        this.container.removeChild(this.renderer.domElement);
      }
    }

    // Limpar ResizeObserver
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    window.removeEventListener('resize', () => this.handleResize());
  }
}

