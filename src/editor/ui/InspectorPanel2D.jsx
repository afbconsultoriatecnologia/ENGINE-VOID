import { useState, useEffect, useRef, useCallback } from 'react';
import './InspectorPanel.css';
import ScriptInspector from './ScriptInspector';
import ControlSettings from './ControlSettings';
import MinimapSettings from './MinimapSettings';
import { PropertyLabel, GuideIcon } from './GuideTooltip';
import SpriteRenderer from '../../runtime/2d/SpriteRenderer.js';

// Tentar importar Tauri para diálogos nativos
let tauriDialog = null;
let tauriFs = null;
try {
  import('@tauri-apps/plugin-dialog').then(mod => { tauriDialog = mod; });
  import('@tauri-apps/plugin-fs').then(mod => { tauriFs = mod; });
} catch (e) {
  // Tauri não disponível
}

/**
 * Painel inspetor para projetos 2D
 * Exibe propriedades específicas de sprites e objetos 2D
 */
export default function InspectorPanel2D({ engine, selectedObject, scriptManager, onOpenScriptEditor }) {
  // Transform 2D (apenas X, Y e rotação Z)
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState({ x: 1, y: 1 });

  // Sprite properties
  const [color, setColor] = useState('#ffffff');
  const [opacity, setOpacity] = useState(1);
  const [visible, setVisible] = useState(true);

  // Texture
  const [texturePath, setTexturePath] = useState(null);
  const [texturePreview, setTexturePreview] = useState(null);
  const [textureFilter, setTextureFilter] = useState('nearest');
  const [textureRepeat, setTextureRepeat] = useState({ x: 1, y: 1 });
  const [textureOffset, setTextureOffset] = useState({ x: 0, y: 0 });

  // Dimensions
  const [spriteWidth, setSpriteWidth] = useState(1);
  const [spriteHeight, setSpriteHeight] = useState(1);
  const [pixelsPerUnit, setPixelsPerUnit] = useState(16);

  // Sorting
  const [sortingLayer, setSortingLayer] = useState('Default');
  const [sortingOrder, setSortingOrder] = useState(0);
  const [renderOrder, setRenderOrder] = useState(0);

  // Flip
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);

  // Game properties
  const [isPlayer, setIsPlayer] = useState(false);
  const [controlMode, setControlMode] = useState('topDown');
  const [cameraSettings, setCameraSettings] = useState({
    viewSize: 8,
    followSmoothing: 5
  });

  // Spritesheet
  const [isSpriteSheet, setIsSpriteSheet] = useState(false);
  const [sheetColumns, setSheetColumns] = useState(4);
  const [sheetRows, setSheetRows] = useState(4);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [animations, setAnimations] = useState([]);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const previewAnimRef = useRef(null);

  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    texture: true,
    dimensions: false,
    spritesheet: false
  });

  // Sorting layers disponíveis
  const sortingLayers = ['Background', 'Default', 'Foreground', 'UI'];

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Sincronizar Transform em tempo real (atualiza a cada 100ms)
  useEffect(() => {
    if (!selectedObject) return;

    const updateTransform = () => {
      setPosition({
        x: parseFloat(selectedObject.position.x.toFixed(3)),
        y: parseFloat(selectedObject.position.y.toFixed(3))
      });
      setRotation(parseFloat((selectedObject.rotation.z * 180 / Math.PI).toFixed(1)));
      setScale({
        x: parseFloat(Math.abs(selectedObject.scale.x).toFixed(3)),
        y: parseFloat(Math.abs(selectedObject.scale.y).toFixed(3))
      });
      setVisible(selectedObject.visible);
    };

    updateTransform();
    const interval = setInterval(updateTransform, 100);
    return () => clearInterval(interval);
  }, [selectedObject]);

  // Sincronizar propriedades estáticas (apenas quando objeto muda)
  useEffect(() => {
    if (!selectedObject) return;

    const userData = selectedObject.userData || {};

    // Sprite properties
    if (userData.is2D) {
      setColor(userData.color ? '#' + userData.color.toString(16).padStart(6, '0') : '#ffffff');
      setOpacity(userData.opacity ?? 1);
      setSortingLayer(userData.sortingLayer || 'Default');
      setSortingOrder(userData.sortingOrder || 0);
      setFlipX(userData.flipX || false);
      setFlipY(userData.flipY || false);
    }

    // Material color
    if (selectedObject.material?.color) {
      setColor('#' + selectedObject.material.color.getHexString());
    }
    if (selectedObject.material?.opacity !== undefined) {
      setOpacity(selectedObject.material.opacity);
    }

    // Texture
    setTexturePath(userData.texturePath || null);
    setTextureFilter(userData.textureFilter || 'nearest');
    setTextureRepeat(userData.textureRepeat || { x: 1, y: 1 });
    setTextureOffset(userData.textureOffset || { x: 0, y: 0 });

    // Gerar preview da textura
    if (userData.texturePath) {
      generateTexturePreview(userData.texturePath);
    } else {
      setTexturePreview(null);
    }

    // Dimensions
    setSpriteWidth(userData.originalWidth || 1);
    setSpriteHeight(userData.originalHeight || 1);
    setPixelsPerUnit(userData.pixelsPerUnit || 16);
    setRenderOrder(selectedObject.renderOrder || 0);

    // Spritesheet
    if (userData.spritesheet) {
      setIsSpriteSheet(true);
      setSheetColumns(userData.spritesheet.columns || 4);
      setSheetRows(userData.spritesheet.rows || 4);
      setCurrentFrame(userData.spritesheet.currentFrame || 0);
    } else {
      setIsSpriteSheet(false);
    }

    // Animations
    setAnimations(userData.animations || []);

    // Game properties
    setIsPlayer(userData.isPlayer || false);
    setControlMode(userData.controlMode || 'topDown');
    setCameraSettings(userData.cameraSettings || { viewSize: 8, followSmoothing: 5 });
  }, [selectedObject]);

  // Cleanup preview animation on unmount
  useEffect(() => {
    return () => {
      if (previewAnimRef.current) {
        cancelAnimationFrame(previewAnimRef.current);
      }
    };
  }, []);

  // Gerar preview de textura (blob URL para Tauri ou URL direto)
  const generateTexturePreview = async (path) => {
    try {
      if (tauriFs && (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path))) {
        const fileData = await tauriFs.readFile(path);
        const ext = path.split('.').pop().toLowerCase();
        const mimeTypes = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
        const blob = new Blob([fileData], { type: mimeTypes[ext] || 'image/png' });
        setTexturePreview(URL.createObjectURL(blob));
      } else {
        setTexturePreview(path);
      }
    } catch (err) {
      console.error('Erro ao gerar preview:', err);
      setTexturePreview(null);
    }
  };

  // =====================
  // HANDLERS — Transform
  // =====================

  const handlePositionChange = (axis, value) => {
    if (!selectedObject) return;
    const newPos = { ...position, [axis]: parseFloat(value) || 0 };
    setPosition(newPos);
    selectedObject.position.x = newPos.x;
    selectedObject.position.y = newPos.y;
  };

  const handleRotationChange = (value) => {
    if (!selectedObject) return;
    const degrees = parseFloat(value) || 0;
    setRotation(degrees);
    selectedObject.rotation.z = degrees * Math.PI / 180;
  };

  const handleScaleChange = (axis, value) => {
    if (!selectedObject) return;
    const newScale = { ...scale, [axis]: parseFloat(value) || 1 };
    setScale(newScale);
    const flipXMult = flipX ? -1 : 1;
    const flipYMult = flipY ? -1 : 1;
    selectedObject.scale.x = newScale.x * flipXMult;
    selectedObject.scale.y = newScale.y * flipYMult;
  };

  // ========================
  // HANDLERS — Sprite Visual
  // ========================

  const handleColorChange = (value) => {
    if (!selectedObject?.material) return;
    setColor(value);
    selectedObject.material.color.set(value);
    if (selectedObject.userData) {
      selectedObject.userData.color = parseInt(value.replace('#', ''), 16);
    }
  };

  const handleOpacityChange = (value) => {
    if (!selectedObject?.material) return;
    const op = parseFloat(value);
    setOpacity(op);
    selectedObject.material.opacity = op;
    selectedObject.material.transparent = op < 1;
    if (selectedObject.userData) {
      selectedObject.userData.opacity = op;
    }
  };

  const handleVisibleChange = (value) => {
    if (!selectedObject) return;
    setVisible(value);
    selectedObject.visible = value;
  };

  // ====================
  // HANDLERS — Texture
  // ====================

  const handleLoadTexture = async () => {
    try {
      if (tauriDialog) {
        const selected = await tauriDialog.open({
          multiple: false,
          filters: [{
            name: 'Images',
            extensions: ['png', 'jpg', 'jpeg', 'webp']
          }]
        });
        if (selected) {
          await applyTexture(selected);
        }
      } else {
        // Fallback web
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (file) {
            const url = URL.createObjectURL(file);
            await applyTexture(url);
          }
        };
        input.click();
      }
    } catch (err) {
      console.error('Erro ao carregar textura:', err);
    }
  };

  const applyTexture = async (path) => {
    if (!selectedObject || !engine) return;
    setTexturePath(path);
    generateTexturePreview(path);
    await engine.updateSpriteTexture(selectedObject.name, path, {
      filterMode: textureFilter,
      repeat: textureRepeat,
      offset: textureOffset
    });
  };

  const handleRemoveTexture = async () => {
    if (!selectedObject || !engine) return;
    setTexturePath(null);
    setTexturePreview(null);
    await engine.updateSpriteTexture(selectedObject.name, null);
  };

  const handleFilterChange = async (value) => {
    if (!selectedObject || !engine) return;
    setTextureFilter(value);
    if (texturePath) {
      await engine.updateSpriteTexture(selectedObject.name, texturePath, {
        filterMode: value,
        repeat: textureRepeat,
        offset: textureOffset
      });
    }
  };

  const handleRepeatChange = async (axis, value) => {
    if (!selectedObject || !engine) return;
    const newRepeat = { ...textureRepeat, [axis]: parseFloat(value) || 1 };
    setTextureRepeat(newRepeat);
    selectedObject.userData.textureRepeat = newRepeat;
    if (texturePath && selectedObject.material?.map) {
      selectedObject.material.map.wrapS = 1000; // THREE.RepeatWrapping
      selectedObject.material.map.wrapT = 1000;
      selectedObject.material.map.repeat.set(newRepeat.x, newRepeat.y);
      selectedObject.material.map.needsUpdate = true;
    }
  };

  const handleOffsetChange = async (axis, value) => {
    if (!selectedObject) return;
    const newOffset = { ...textureOffset, [axis]: parseFloat(value) || 0 };
    setTextureOffset(newOffset);
    selectedObject.userData.textureOffset = newOffset;
    if (selectedObject.material?.map) {
      selectedObject.material.map.offset.set(newOffset.x, newOffset.y);
      selectedObject.material.map.needsUpdate = true;
    }
  };

  // =======================
  // HANDLERS — Dimensions
  // =======================

  const handleWidthChange = (value) => {
    if (!selectedObject || !engine) return;
    const w = Math.max(0.01, parseFloat(value) || 1);
    setSpriteWidth(w);
    engine.updateSpriteDimensions(selectedObject.name, w, spriteHeight);
  };

  const handleHeightChange = (value) => {
    if (!selectedObject || !engine) return;
    const h = Math.max(0.01, parseFloat(value) || 1);
    setSpriteHeight(h);
    engine.updateSpriteDimensions(selectedObject.name, spriteWidth, h);
  };

  const handlePixelsPerUnitChange = (value) => {
    if (!selectedObject) return;
    const ppu = Math.max(1, parseInt(value) || 16);
    setPixelsPerUnit(ppu);
    selectedObject.userData.pixelsPerUnit = ppu;
  };

  const handleRenderOrderChange = (value) => {
    if (!selectedObject) return;
    const order = parseInt(value) || 0;
    setRenderOrder(order);
    selectedObject.renderOrder = order;
    selectedObject.userData.renderOrder = order;
  };

  // ====================
  // HANDLERS — Sorting
  // ====================

  const handleSortingLayerChange = (value) => {
    if (!selectedObject || !engine) return;
    setSortingLayer(value);
    if (selectedObject.userData) {
      selectedObject.userData.sortingLayer = value;
    }
    engine.updateSprite?.(selectedObject.name, { sortingLayer: value });
  };

  const handleSortingOrderChange = (value) => {
    if (!selectedObject || !engine) return;
    const order = Math.max(-999, Math.min(999, parseInt(value) || 0));
    setSortingOrder(order);
    if (selectedObject.userData) {
      selectedObject.userData.sortingOrder = order;
    }
    engine.updateSprite?.(selectedObject.name, { sortingOrder: order });
  };

  // ====================
  // HANDLERS — Flip
  // ====================

  const handleFlipXChange = (value) => {
    if (!selectedObject) return;
    setFlipX(value);
    selectedObject.scale.x = Math.abs(selectedObject.scale.x) * (value ? -1 : 1);
    if (selectedObject.userData) {
      selectedObject.userData.flipX = value;
    }
  };

  const handleFlipYChange = (value) => {
    if (!selectedObject) return;
    setFlipY(value);
    selectedObject.scale.y = Math.abs(selectedObject.scale.y) * (value ? -1 : 1);
    if (selectedObject.userData) {
      selectedObject.userData.flipY = value;
    }
  };

  // ====================
  // HANDLERS — Game
  // ====================

  const handleIsPlayerChange = (checked) => {
    if (!selectedObject) return;

    if (checked && engine?.scene) {
      engine.scene.traverse((child) => {
        if (child.userData) {
          child.userData.isPlayer = false;
        }
      });
    }

    selectedObject.userData = selectedObject.userData || {};
    selectedObject.userData.isPlayer = checked;
    setIsPlayer(checked);

    if (checked) {
      applyControlModeDefaults(controlMode);
    }
  };

  const handleControlModeChange = (mode) => {
    if (!selectedObject) return;
    setControlMode(mode);
    selectedObject.userData = selectedObject.userData || {};
    selectedObject.userData.controlMode = mode;
    applyControlModeDefaults(mode);
  };

  const applyControlModeDefaults = (mode) => {
    if (!selectedObject) return;

    selectedObject.userData.controlSettings = selectedObject.userData.controlSettings || {};
    selectedObject.userData.controlSettings.movement = selectedObject.userData.controlSettings.movement || {};
    selectedObject.userData.controlSettings.camera = selectedObject.userData.controlSettings.camera || {};

    switch (mode) {
      case 'topDown':
        selectedObject.userData.controlSettings.gameStyle = 'followWASD';
        selectedObject.userData.controlSettings.movement.gravity = 0;
        selectedObject.userData.controlSettings.movement.speed = 5;
        selectedObject.userData.controlSettings.movement.clickToMove = false;
        selectedObject.userData.controlSettings.movement.gridMovement = false;
        selectedObject.userData.controlSettings.camera.mode = 'follow';
        selectedObject.userData.controlSettings.camera.edgeScrollEnabled = false;
        break;
      case 'platformer':
        selectedObject.userData.controlSettings.gameStyle = 'followWASD';
        selectedObject.userData.controlSettings.movement.gravity = 20;
        selectedObject.userData.controlSettings.movement.jumpForce = 10;
        selectedObject.userData.controlSettings.movement.speed = 5;
        selectedObject.userData.controlSettings.movement.clickToMove = false;
        selectedObject.userData.controlSettings.movement.gridMovement = false;
        selectedObject.userData.controlSettings.camera.mode = 'follow';
        selectedObject.userData.controlSettings.camera.edgeScrollEnabled = false;
        break;
      case 'clickToMove':
        selectedObject.userData.controlSettings.gameStyle = 'freeClick';
        selectedObject.userData.controlSettings.movement.gravity = 0;
        selectedObject.userData.controlSettings.movement.speed = 3;
        selectedObject.userData.controlSettings.movement.clickToMove = true;
        selectedObject.userData.controlSettings.movement.gridMovement = false;
        selectedObject.userData.controlSettings.camera.mode = 'free';
        selectedObject.userData.controlSettings.camera.edgeScrollEnabled = true;
        break;
    }
  };

  const handleCameraSettingChange = (key, value) => {
    if (!selectedObject) return;
    const newSettings = { ...cameraSettings, [key]: parseFloat(value) };
    setCameraSettings(newSettings);
    selectedObject.userData = selectedObject.userData || {};
    selectedObject.userData.cameraSettings = newSettings;
  };

  // ========================
  // HANDLERS — Spritesheet
  // ========================

  const handleToggleSpriteSheet = (enabled) => {
    if (!selectedObject) return;
    setIsSpriteSheet(enabled);

    if (enabled) {
      const totalFrames = sheetColumns * sheetRows;
      const ssData = {
        columns: sheetColumns,
        rows: sheetRows,
        currentFrame: 0,
        totalFrames
      };
      selectedObject.userData.spritesheet = ssData;
      setCurrentFrame(0);

      // Aplicar UV do primeiro frame
      if (selectedObject.material?.map) {
        SpriteRenderer.setFrame(selectedObject, 0);
      }
    } else {
      selectedObject.userData.spritesheet = null;
      // Resetar UVs para exibir textura completa
      if (selectedObject.geometry?.attributes?.uv) {
        const uvs = selectedObject.geometry.attributes.uv;
        const baseUVs = [[0, 1], [1, 1], [0, 0], [1, 0]];
        for (let i = 0; i < uvs.count && i < 4; i++) {
          uvs.setXY(i, baseUVs[i][0], baseUVs[i][1]);
        }
        uvs.needsUpdate = true;
      }
    }
  };

  const handleSheetColumnsChange = (value) => {
    if (!selectedObject) return;
    const cols = Math.max(1, parseInt(value) || 1);
    setSheetColumns(cols);
    if (selectedObject.userData.spritesheet) {
      selectedObject.userData.spritesheet.columns = cols;
      selectedObject.userData.spritesheet.totalFrames = cols * sheetRows;
      // Re-apply current frame with new grid
      const frame = Math.min(currentFrame, cols * sheetRows - 1);
      setCurrentFrame(frame);
      selectedObject.userData.spritesheet.currentFrame = frame;
      SpriteRenderer.setFrame(selectedObject, frame);
    }
  };

  const handleSheetRowsChange = (value) => {
    if (!selectedObject) return;
    const rows = Math.max(1, parseInt(value) || 1);
    setSheetRows(rows);
    if (selectedObject.userData.spritesheet) {
      selectedObject.userData.spritesheet.rows = rows;
      selectedObject.userData.spritesheet.totalFrames = sheetColumns * rows;
      const frame = Math.min(currentFrame, sheetColumns * rows - 1);
      setCurrentFrame(frame);
      selectedObject.userData.spritesheet.currentFrame = frame;
      SpriteRenderer.setFrame(selectedObject, frame);
    }
  };

  const handleFrameChange = (value) => {
    if (!selectedObject?.userData?.spritesheet) return;
    const totalFrames = sheetColumns * sheetRows;
    const frame = Math.max(0, Math.min(parseInt(value) || 0, totalFrames - 1));
    setCurrentFrame(frame);
    selectedObject.userData.spritesheet.currentFrame = frame;
    SpriteRenderer.setFrame(selectedObject, frame);
  };

  // ========================
  // HANDLERS — Animations
  // ========================

  const handleAddAnimation = () => {
    if (!selectedObject) return;
    const totalFrames = sheetColumns * sheetRows;
    const newAnim = {
      name: `Anim_${animations.length}`,
      frameStart: 0,
      frameEnd: Math.min(3, totalFrames - 1),
      fps: 10,
      loop: true
    };
    const newAnims = [...animations, newAnim];
    setAnimations(newAnims);
    selectedObject.userData.animations = newAnims;
  };

  const handleUpdateAnimation = (index, field, value) => {
    if (!selectedObject) return;
    const newAnims = [...animations];
    if (field === 'fps') {
      newAnims[index][field] = Math.max(1, parseInt(value) || 1);
    } else if (field === 'frameStart' || field === 'frameEnd') {
      newAnims[index][field] = Math.max(0, parseInt(value) || 0);
    } else if (field === 'loop') {
      newAnims[index][field] = value;
    } else {
      newAnims[index][field] = value;
    }
    setAnimations(newAnims);
    selectedObject.userData.animations = newAnims;
  };

  const handleRemoveAnimation = (index) => {
    if (!selectedObject) return;
    const newAnims = animations.filter((_, i) => i !== index);
    setAnimations(newAnims);
    selectedObject.userData.animations = newAnims;
  };

  const handlePreviewAnimation = useCallback((anim) => {
    if (!selectedObject?.userData?.spritesheet) return;

    if (previewPlaying) {
      // Stop
      setPreviewPlaying(false);
      if (previewAnimRef.current) {
        cancelAnimationFrame(previewAnimRef.current);
        previewAnimRef.current = null;
      }
      return;
    }

    setPreviewPlaying(true);
    const frames = [];
    for (let i = anim.frameStart; i <= anim.frameEnd; i++) {
      frames.push(i);
    }
    if (frames.length === 0) return;

    let frameIdx = 0;
    let lastTime = performance.now();
    const frameInterval = 1000 / anim.fps;

    const animate = (now) => {
      const delta = now - lastTime;
      if (delta >= frameInterval) {
        lastTime = now - (delta % frameInterval);
        frameIdx++;
        if (frameIdx >= frames.length) {
          if (anim.loop) {
            frameIdx = 0;
          } else {
            setPreviewPlaying(false);
            previewAnimRef.current = null;
            return;
          }
        }
        const frame = frames[frameIdx];
        setCurrentFrame(frame);
        SpriteRenderer.setFrame(selectedObject, frame);
      }
      previewAnimRef.current = requestAnimationFrame(animate);
    };

    previewAnimRef.current = requestAnimationFrame(animate);
  }, [selectedObject, previewPlaying, currentFrame]);

  // Se nenhum objeto selecionado
  if (!selectedObject) {
    return (
      <div className="inspector-panel">
        <div className="inspector-section">
          <div className="section-header">
            <h4>Inspetor</h4>
            <span className="badge-2d">2D</span>
          </div>
        </div>
        <div className="inspector-empty">
          <p>Selecione um objeto para ver suas propriedades</p>
        </div>
      </div>
    );
  }

  const objectName = selectedObject.name || 'Sem nome';
  const objectType = selectedObject.userData?.type || 'sprite';
  const hasTexture = !!texturePath;
  const totalFrames = sheetColumns * sheetRows;

  return (
    <div className="inspector-panel">
      {/* Object Name Section */}
      <div className="inspector-section">
        <div className="section-header">
          <h4>Inspetor</h4>
          <span className="badge-2d">2D</span>
        </div>
        <div className="section-content">
          <div className="object-name">
            <span className="name-icon">&#9671;</span>
            <span className="name-text">{objectName}</span>
            <span className="object-type-badge">{objectType}</span>
          </div>
        </div>
      </div>

      {/* Game Properties */}
      <div className="inspector-section">
        <div className="section-header">
          <h4>Jogo</h4>
          <span className="section-guide" title="Propriedades para o modo Jogo. Player = objeto controlável">?</span>
        </div>
        <div className="section-content">
          <div className="property-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isPlayer}
                onChange={(e) => handleIsPlayerChange(e.target.checked)}
              />
              <span>Player</span>
              <span className="property-hint">Controlável com teclado</span>
            </label>
          </div>

          {isPlayer && (
            <>
              <div className="property-row">
                <PropertyLabel label="Modo de Controle" tooltip="Tipo de controle: Top-Down (movimento livre), Platformer (com gravidade e pulo), ou Clique para Mover" />
                <select
                  value={controlMode}
                  onChange={(e) => handleControlModeChange(e.target.value)}
                  className="select-input"
                >
                  <option value="topDown">Top-Down (WASD)</option>
                  <option value="platformer">Platformer (WASD + Pulo)</option>
                  <option value="clickToMove">Clique para Mover</option>
                </select>
              </div>

              <div className="property-row">
                <PropertyLabel label="Tamanho da Câmera" tooltip="Quantidade de unidades visíveis na vertical. Menor = mais zoom" />
                <div className="slider-input">
                  <input
                    type="range"
                    min="2"
                    max="20"
                    step="0.5"
                    value={cameraSettings.viewSize}
                    onChange={(e) => handleCameraSettingChange('viewSize', e.target.value)}
                  />
                  <input
                    type="number"
                    min="2"
                    max="50"
                    step="0.5"
                    value={cameraSettings.viewSize}
                    onChange={(e) => handleCameraSettingChange('viewSize', e.target.value)}
                  />
                </div>
              </div>

              <div className="property-row">
                <PropertyLabel label="Suavidade da Câmera" tooltip="Suavidade do movimento da câmera ao seguir o player. Maior = mais suave" />
                <div className="slider-input">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={cameraSettings.followSmoothing}
                    onChange={(e) => handleCameraSettingChange('followSmoothing', e.target.value)}
                  />
                  <input
                    type="number"
                    min="1"
                    max="20"
                    step="0.5"
                    value={cameraSettings.followSmoothing}
                    onChange={(e) => handleCameraSettingChange('followSmoothing', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Control Settings (se for player) */}
      {isPlayer && (
        <ControlSettings
          object={selectedObject}
          controlMode={controlMode}
          onChange={(key, value) => {
            if (selectedObject) {
              selectedObject.userData = selectedObject.userData || {};
              selectedObject.userData[key] = value;
            }
          }}
        />
      )}

      {/* Minimap Settings (se for player) */}
      {isPlayer && (
        <MinimapSettings
          object={selectedObject}
          onChange={() => {
            setIsPlayer(selectedObject?.userData?.isPlayer || false);
          }}
        />
      )}

      {/* Transform 2D */}
      <div className="inspector-section">
        <div className="section-header">
          <h4>Transform</h4>
          <span className="section-guide" title="Posição, rotação e escala do objeto no espaço 2D">?</span>
        </div>
        <div className="section-content">
          <div className="property-row">
            <label>Posição <GuideIcon tooltip="Posição do objeto no mundo (em unidades)" /></label>
            <div className="vector-inputs">
              <div className="vector-input">
                <span className="axis x">X</span>
                <input
                  type="number"
                  value={position.x}
                  onChange={(e) => handlePositionChange('x', e.target.value)}
                  step="0.1"
                />
              </div>
              <div className="vector-input">
                <span className="axis y">Y</span>
                <input
                  type="number"
                  value={position.y}
                  onChange={(e) => handlePositionChange('y', e.target.value)}
                  step="0.1"
                />
              </div>
            </div>
          </div>

          <div className="property-row">
            <label>Rotação <GuideIcon tooltip="Rotação em graus (eixo Z). Positivo = anti-horário" /></label>
            <div className="vector-inputs">
              <div className="vector-input rotation-single">
                <span className="axis z">Z</span>
                <input
                  type="number"
                  value={rotation}
                  onChange={(e) => handleRotationChange(e.target.value)}
                  step="1"
                />
              </div>
            </div>
          </div>

          <div className="property-row">
            <label>Escala <GuideIcon tooltip="Multiplicador do tamanho. 1 = tamanho original, 2 = dobro" /></label>
            <div className="vector-inputs">
              <div className="vector-input">
                <span className="axis x">X</span>
                <input
                  type="number"
                  value={scale.x}
                  onChange={(e) => handleScaleChange('x', e.target.value)}
                  step="0.1"
                  min="0.01"
                />
              </div>
              <div className="vector-input">
                <span className="axis y">Y</span>
                <input
                  type="number"
                  value={scale.y}
                  onChange={(e) => handleScaleChange('y', e.target.value)}
                  step="0.1"
                  min="0.01"
                />
              </div>
            </div>
          </div>

          <div className="property-row">
            <label>Espelhar <GuideIcon tooltip="Inverte o sprite horizontalmente (X) ou verticalmente (Y)" /></label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={flipX}
                  onChange={(e) => handleFlipXChange(e.target.checked)}
                />
                <span>X</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={flipY}
                  onChange={(e) => handleFlipYChange(e.target.checked)}
                />
                <span>Y</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Sprite Renderer */}
      <div className="inspector-section">
        <div className="section-header">
          <h4>Sprite</h4>
          <span className="section-guide" title="Aparência visual do sprite (textura, cor, opacidade)">?</span>
        </div>
        <div className="section-content">
          {/* Texture */}
          <div className="property-row">
            <label>Textura <GuideIcon tooltip="Imagem do sprite. Carregue uma imagem PNG, JPG ou WebP" /></label>
            <div className="texture-controls">
              {texturePreview ? (
                <div className="texture-preview-container">
                  <img
                    src={texturePreview}
                    alt="Texture preview"
                    className="texture-preview"
                  />
                  <div className="texture-info">
                    <span className="texture-name" title={texturePath}>
                      {texturePath ? texturePath.split('/').pop() : 'textura'}
                    </span>
                    <button
                      className="texture-btn remove"
                      onClick={handleRemoveTexture}
                      title="Remover textura"
                    >
                      X
                    </button>
                  </div>
                </div>
              ) : (
                <button className="texture-btn load" onClick={handleLoadTexture}>
                  Carregar Imagem
                </button>
              )}
              {hasTexture && (
                <button className="texture-btn change" onClick={handleLoadTexture}>
                  Trocar
                </button>
              )}
            </div>
          </div>

          {/* Filter Mode */}
          {hasTexture && (
            <div className="property-row">
              <PropertyLabel label="Filtragem" tooltip="Pixel Art (NearestFilter) mantém pixels nítidos. Suave (LinearFilter) interpola entre pixels" />
              <select
                className="select-input"
                value={textureFilter}
                onChange={(e) => handleFilterChange(e.target.value)}
              >
                <option value="nearest">Pixel Art (Nearest)</option>
                <option value="linear">Suave (Linear)</option>
              </select>
            </div>
          )}

          {/* Tiling */}
          {hasTexture && (
            <div className="property-row">
              <PropertyLabel label="Repetição" tooltip="Quantas vezes a textura repete. Útil para padrões/tiles" />
              <div className="vector-inputs">
                <div className="vector-input">
                  <span className="axis x">X</span>
                  <input
                    type="number"
                    value={textureRepeat.x}
                    onChange={(e) => handleRepeatChange('x', e.target.value)}
                    step="0.1"
                    min="0.1"
                  />
                </div>
                <div className="vector-input">
                  <span className="axis y">Y</span>
                  <input
                    type="number"
                    value={textureRepeat.y}
                    onChange={(e) => handleRepeatChange('y', e.target.value)}
                    step="0.1"
                    min="0.1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Offset */}
          {hasTexture && (
            <div className="property-row">
              <PropertyLabel label="Offset" tooltip="Deslocamento da textura em UV (0 a 1)" />
              <div className="vector-inputs">
                <div className="vector-input">
                  <span className="axis x">X</span>
                  <input
                    type="number"
                    value={textureOffset.x}
                    onChange={(e) => handleOffsetChange('x', e.target.value)}
                    step="0.01"
                  />
                </div>
                <div className="vector-input">
                  <span className="axis y">Y</span>
                  <input
                    type="number"
                    value={textureOffset.y}
                    onChange={(e) => handleOffsetChange('y', e.target.value)}
                    step="0.01"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Color (tint when has texture, solid color otherwise) */}
          <div className="property-row">
            <label>{hasTexture ? 'Tint' : 'Cor'} <GuideIcon tooltip={hasTexture ? 'Cor de tint aplicada sobre a textura' : 'Cor sólida do sprite'} /></label>
            <div className="color-input">
              <input
                type="color"
                value={color}
                onChange={(e) => handleColorChange(e.target.value)}
              />
              <input
                type="text"
                value={color.toUpperCase()}
                onChange={(e) => handleColorChange(e.target.value)}
                className="color-text"
              />
            </div>
          </div>

          {/* Opacity */}
          <div className="property-row">
            <label>Opacidade <GuideIcon tooltip="Transparência do sprite. 0 = invisível, 1 = sólido" /></label>
            <div className="slider-input">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={opacity}
                onChange={(e) => handleOpacityChange(e.target.value)}
              />
              <input
                type="number"
                value={opacity}
                onChange={(e) => handleOpacityChange(e.target.value)}
                min="0"
                max="1"
                step="0.01"
              />
            </div>
          </div>

          {/* Visible */}
          <div className="property-row">
            <label>Visível <GuideIcon tooltip="Se desmarcado, o sprite fica invisível na cena e no jogo" /></label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => handleVisibleChange(e.target.checked)}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Dimensions */}
      <div className="inspector-section">
        <div className="section-header collapsible" onClick={() => toggleSection('dimensions')}>
          <h4>Dimensões</h4>
          <span className="section-toggle">{expandedSections.dimensions ? '-' : '+'}</span>
        </div>
        {expandedSections.dimensions && (
          <div className="section-content">
            <div className="property-row">
              <PropertyLabel label="Largura" tooltip="Largura do sprite em unidades do mundo" />
              <div className="vector-inputs">
                <div className="vector-input">
                  <span className="axis x">W</span>
                  <input
                    type="number"
                    value={spriteWidth}
                    onChange={(e) => handleWidthChange(e.target.value)}
                    step="0.1"
                    min="0.01"
                  />
                </div>
              </div>
            </div>

            <div className="property-row">
              <PropertyLabel label="Altura" tooltip="Altura do sprite em unidades do mundo" />
              <div className="vector-inputs">
                <div className="vector-input">
                  <span className="axis y">H</span>
                  <input
                    type="number"
                    value={spriteHeight}
                    onChange={(e) => handleHeightChange(e.target.value)}
                    step="0.1"
                    min="0.01"
                  />
                </div>
              </div>
            </div>

            <div className="property-row">
              <PropertyLabel label="Pixels Por Unidade" tooltip="Resolução da textura por unidade. Maior = mais detalhado" />
              <input
                type="number"
                value={pixelsPerUnit}
                onChange={(e) => handlePixelsPerUnitChange(e.target.value)}
                step="1"
                min="1"
              />
            </div>

            <div className="property-row">
              <PropertyLabel label="Render Order" tooltip="Ordem de renderização global (independente do sorting layer)" />
              <input
                type="number"
                value={renderOrder}
                onChange={(e) => handleRenderOrderChange(e.target.value)}
                step="1"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sorting */}
      <div className="inspector-section">
        <div className="section-header">
          <h4>Ordenação</h4>
          <span className="section-guide" title="Controla qual sprite aparece na frente de qual">?</span>
        </div>
        <div className="section-content">
          <div className="property-row">
            <label>Camada <GuideIcon tooltip="Camada de ordenação. Background = atrás, Foreground = frente, UI = topo" /></label>
            <select
              className="select-input"
              value={sortingLayer}
              onChange={(e) => handleSortingLayerChange(e.target.value)}
            >
              {sortingLayers.map(layer => (
                <option key={layer} value={layer}>{layer}</option>
              ))}
            </select>
          </div>

          <div className="property-row">
            <label>Ordem <GuideIcon tooltip="Ordem dentro da camada (-999 a 999). Número maior = mais na frente" /></label>
            <input
              type="number"
              value={sortingOrder}
              onChange={(e) => handleSortingOrderChange(e.target.value)}
              step="1"
              min="-999"
              max="999"
            />
          </div>
        </div>
      </div>

      {/* Sprite Sheet & Animation (Fase 3) — Only when texture loaded */}
      {hasTexture && (
        <div className="inspector-section">
          <div className="section-header collapsible" onClick={() => toggleSection('spritesheet')}>
            <h4>Sprite Sheet</h4>
            <span className="section-toggle">{expandedSections.spritesheet ? '-' : '+'}</span>
          </div>
          {expandedSections.spritesheet && (
            <div className="section-content">
              {/* Toggle Spritesheet */}
              <div className="property-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isSpriteSheet}
                    onChange={(e) => handleToggleSpriteSheet(e.target.checked)}
                  />
                  <span>É Sprite Sheet</span>
                  <GuideIcon tooltip="Ativa se a textura contém múltiplos frames em grid" />
                </label>
              </div>

              {isSpriteSheet && (
                <>
                  {/* Grid Config */}
                  <div className="property-row">
                    <PropertyLabel label="Grid" tooltip="Quantidade de colunas e linhas no sprite sheet" />
                    <div className="vector-inputs">
                      <div className="vector-input">
                        <span className="axis x">C</span>
                        <input
                          type="number"
                          value={sheetColumns}
                          onChange={(e) => handleSheetColumnsChange(e.target.value)}
                          step="1"
                          min="1"
                        />
                      </div>
                      <div className="vector-input">
                        <span className="axis y">R</span>
                        <input
                          type="number"
                          value={sheetRows}
                          onChange={(e) => handleSheetRowsChange(e.target.value)}
                          step="1"
                          min="1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Frame Preview Grid */}
                  {texturePreview && (
                    <div className="property-row">
                      <label>Frames <GuideIcon tooltip="Clique em um frame para selecioná-lo" /></label>
                      <div className="spritesheet-preview">
                        <div
                          className="frame-grid"
                          style={{
                            gridTemplateColumns: `repeat(${sheetColumns}, 1fr)`,
                            backgroundImage: `url(${texturePreview})`,
                            backgroundSize: '100% 100%',
                            aspectRatio: `${sheetColumns}/${sheetRows}`
                          }}
                        >
                          {Array.from({ length: totalFrames }, (_, i) => (
                            <div
                              key={i}
                              className={`frame-cell ${i === currentFrame ? 'active' : ''}`}
                              onClick={() => handleFrameChange(i)}
                              title={`Frame ${i}`}
                            >
                              <span className="frame-number">{i}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Current Frame Slider */}
                  <div className="property-row">
                    <PropertyLabel label="Frame Atual" tooltip="Frame atualmente exibido no viewport" />
                    <div className="slider-input">
                      <input
                        type="range"
                        min="0"
                        max={totalFrames - 1}
                        step="1"
                        value={currentFrame}
                        onChange={(e) => handleFrameChange(e.target.value)}
                      />
                      <input
                        type="number"
                        value={currentFrame}
                        onChange={(e) => handleFrameChange(e.target.value)}
                        min="0"
                        max={totalFrames - 1}
                        step="1"
                      />
                    </div>
                  </div>

                  {/* Animations Section */}
                  <div className="property-row">
                    <label>Animações <GuideIcon tooltip="Lista de animações definidas para este sprite sheet" /></label>
                  </div>

                  {animations.map((anim, idx) => (
                    <div key={idx} className="animation-item">
                      <div className="animation-header">
                        <input
                          type="text"
                          value={anim.name}
                          onChange={(e) => handleUpdateAnimation(idx, 'name', e.target.value)}
                          className="animation-name-input"
                          placeholder="Nome"
                        />
                        <button
                          className={`texture-btn ${previewPlaying ? 'remove' : 'load'}`}
                          onClick={() => handlePreviewAnimation(anim)}
                          title={previewPlaying ? 'Parar preview' : 'Tocar preview'}
                        >
                          {previewPlaying ? 'Stop' : 'Play'}
                        </button>
                        <button
                          className="texture-btn remove"
                          onClick={() => handleRemoveAnimation(idx)}
                          title="Remover animação"
                        >
                          X
                        </button>
                      </div>
                      <div className="animation-config">
                        <div className="vector-inputs">
                          <div className="vector-input">
                            <span className="axis x" title="Frame inicial">De</span>
                            <input
                              type="number"
                              value={anim.frameStart}
                              onChange={(e) => handleUpdateAnimation(idx, 'frameStart', e.target.value)}
                              min="0"
                              max={totalFrames - 1}
                              step="1"
                            />
                          </div>
                          <div className="vector-input">
                            <span className="axis y" title="Frame final">Até</span>
                            <input
                              type="number"
                              value={anim.frameEnd}
                              onChange={(e) => handleUpdateAnimation(idx, 'frameEnd', e.target.value)}
                              min="0"
                              max={totalFrames - 1}
                              step="1"
                            />
                          </div>
                        </div>
                        <div className="animation-options">
                          <div className="vector-input">
                            <span className="axis z" title="Frames por segundo">FPS</span>
                            <input
                              type="number"
                              value={anim.fps}
                              onChange={(e) => handleUpdateAnimation(idx, 'fps', e.target.value)}
                              min="1"
                              max="60"
                              step="1"
                            />
                          </div>
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={anim.loop}
                              onChange={(e) => handleUpdateAnimation(idx, 'loop', e.target.checked)}
                            />
                            <span>Loop</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button className="texture-btn load full-width" onClick={handleAddAnimation}>
                    + Adicionar Animação
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scripts */}
      <ScriptInspector
        selectedObject={selectedObject}
        scriptManager={scriptManager}
        onOpenScriptEditor={onOpenScriptEditor}
      />
    </div>
  );
}
