import { useState, useEffect } from 'react';
import './InspectorPanel.css';
import ScriptInspector from './ScriptInspector';
import ControlSettings from './ControlSettings';
import MinimapSettings from './MinimapSettings';

/**
 * Componente de label com tooltip
 */
function PropertyLabel({ label, tooltip }) {
  return (
    <label>
      {label}
      {tooltip && <span className="guide-icon small" title={tooltip}>?</span>}
    </label>
  );
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

  // Sorting
  const [sortingLayer, setSortingLayer] = useState('Default');
  const [sortingOrder, setSortingOrder] = useState(0);

  // Flip
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);

  // Game properties
  const [isPlayer, setIsPlayer] = useState(false);
  const [controlMode, setControlMode] = useState('topDown'); // topDown, platformer, clickToMove
  const [cameraSettings, setCameraSettings] = useState({
    viewSize: 8,
    followSmoothing: 5
  });

  // Sorting layers disponíveis
  const sortingLayers = ['Background', 'Default', 'Foreground', 'UI'];

  // Sincronizar Transform em tempo real (atualiza a cada 100ms)
  useEffect(() => {
    if (!selectedObject) return;

    const updateTransform = () => {
      // Position
      setPosition({
        x: parseFloat(selectedObject.position.x.toFixed(3)),
        y: parseFloat(selectedObject.position.y.toFixed(3))
      });

      // Rotation
      setRotation(parseFloat((selectedObject.rotation.z * 180 / Math.PI).toFixed(1)));

      // Scale
      setScale({
        x: parseFloat(Math.abs(selectedObject.scale.x).toFixed(3)),
        y: parseFloat(Math.abs(selectedObject.scale.y).toFixed(3))
      });

      // Visibility
      setVisible(selectedObject.visible);
    };

    updateTransform();

    // Atualizar periodicamente o Transform
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

    // Game properties
    setIsPlayer(userData.isPlayer || false);
    setControlMode(userData.controlMode || 'topDown');
    setCameraSettings(userData.cameraSettings || { viewSize: 8, followSmoothing: 5 });
  }, [selectedObject]);

  // Handlers
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
    const opacity = parseFloat(value);
    setOpacity(opacity);
    selectedObject.material.opacity = opacity;
    selectedObject.material.transparent = opacity < 1;
    if (selectedObject.userData) {
      selectedObject.userData.opacity = opacity;
    }
  };

  const handleVisibleChange = (value) => {
    if (!selectedObject) return;
    setVisible(value);
    selectedObject.visible = value;
  };

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
    // Clampar valor entre -999 e 999 para evitar objetos fora do range visível
    const order = Math.max(-999, Math.min(999, parseInt(value) || 0));
    setSortingOrder(order);
    if (selectedObject.userData) {
      selectedObject.userData.sortingOrder = order;
    }
    engine.updateSprite?.(selectedObject.name, { sortingOrder: order });
  };

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

  const handleIsPlayerChange = (checked) => {
    if (!selectedObject) return;

    // Remover isPlayer de outros objetos
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

    // Aplicar configurações padrão baseado no controlMode
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

    switch (mode) {
      case 'topDown':
        // Top-down: sem gravidade, movimento livre em X/Y
        selectedObject.userData.controlSettings.movement.gravity = 0;
        selectedObject.userData.controlSettings.movement.speed = 5;
        break;
      case 'platformer':
        // Platformer: gravidade, pulo
        selectedObject.userData.controlSettings.movement.gravity = 20;
        selectedObject.userData.controlSettings.movement.jumpForce = 10;
        selectedObject.userData.controlSettings.movement.speed = 5;
        break;
      case 'clickToMove':
        // Click to move: sem gravidade
        selectedObject.userData.controlSettings.movement.gravity = 0;
        selectedObject.userData.controlSettings.movement.speed = 3;
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

      {/* Game Properties - NO TOPO como no 3D */}
      <div className="inspector-section">
        <div className="section-header">
          <h4>Jogo</h4>
          <span className="section-guide" title="Propriedades para o modo Jogo. Player = objeto controlável">?</span>
        </div>
        <div className="section-content">
          {/* Is Player */}
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

          {/* Control Mode - só aparece quando é Player */}
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

              {/* Camera Settings */}
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
          {/* Position */}
          <div className="property-row">
            <label>Posição <span className="guide-icon small" title="Posição do objeto no mundo (em unidades)">?</span></label>
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

          {/* Rotation */}
          <div className="property-row">
            <label>Rotação <span className="guide-icon small" title="Rotação em graus (eixo Z). Positivo = anti-horário">?</span></label>
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

          {/* Scale */}
          <div className="property-row">
            <label>Escala <span className="guide-icon small" title="Multiplicador do tamanho. 1 = tamanho original, 2 = dobro">?</span></label>
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

          {/* Flip */}
          <div className="property-row">
            <label>Espelhar <span className="guide-icon small" title="Inverte o sprite horizontalmente (X) ou verticalmente (Y)">?</span></label>
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
          <span className="section-guide" title="Aparência visual do sprite (cor, opacidade, visibilidade)">?</span>
        </div>
        <div className="section-content">
          {/* Color */}
          <div className="property-row">
            <label>Cor <span className="guide-icon small" title="Cor do sprite. Clique para abrir o seletor de cores">?</span></label>
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
            <label>Opacidade <span className="guide-icon small" title="Transparência do sprite. 0 = invisível, 1 = sólido">?</span></label>
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
            <label>Visível <span className="guide-icon small" title="Se desmarcado, o sprite fica invisível na cena e no jogo">?</span></label>
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

      {/* Sorting */}
      <div className="inspector-section">
        <div className="section-header">
          <h4>Ordenação</h4>
          <span className="section-guide" title="Controla qual sprite aparece na frente de qual">?</span>
        </div>
        <div className="section-content">
          {/* Sorting Layer */}
          <div className="property-row">
            <label>Camada <span className="guide-icon small" title="Camada de ordenação. Background = atrás, Foreground = frente, UI = topo">?</span></label>
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

          {/* Sorting Order */}
          <div className="property-row">
            <label>Ordem <span className="guide-icon small" title="Ordem dentro da camada (-999 a 999). Número maior = mais na frente">?</span></label>
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

      {/* Scripts */}
      <ScriptInspector
        selectedObject={selectedObject}
        scriptManager={scriptManager}
        onOpenScriptEditor={onOpenScriptEditor}
      />
    </div>
  );
}
