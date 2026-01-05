import { useState, useEffect, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import './ControlSettings.css';

/**
 * PropertyLabel - Label com tooltip
 */
function PropertyLabel({ label, tooltip }) {
  return (
    <label title={tooltip}>
      {label}
      {tooltip && <span className="guide-icon small">?</span>}
    </label>
  );
}

/**
 * KeyBindInput - Input para captura de tecla
 */
function KeyBindInput({ value, onChange, label }) {
  const [isCapturing, setIsCapturing] = useState(false);

  const handleKeyDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignorar teclas modificadoras sozinhas
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
      return;
    }

    onChange(e.code);
    setIsCapturing(false);
  }, [onChange]);

  useEffect(() => {
    if (isCapturing) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isCapturing, handleKeyDown]);

  const formatKeyName = (code) => {
    if (!code) return '---';
    return code
      .replace('Key', '')
      .replace('Arrow', '')
      .replace('Digit', '')
      .replace('Numpad', 'Num')
      .replace('ShiftLeft', 'L-Shift')
      .replace('ShiftRight', 'R-Shift')
      .replace('ControlLeft', 'L-Ctrl')
      .replace('ControlRight', 'R-Ctrl');
  };

  return (
    <button
      className={`keybind-input ${isCapturing ? 'capturing' : ''}`}
      onClick={() => setIsCapturing(true)}
      onBlur={() => setIsCapturing(false)}
      title={`Clique para alterar. Atual: ${value}`}
    >
      {isCapturing ? 'Pressione...' : formatKeyName(value)}
    </button>
  );
}

/**
 * CursorImageSelector - Seletor de imagens de cursor customizado
 */
function CursorImageSelector({ customCursors, onChange }) {
  const directions = [
    { key: 'default', label: 'Padrão', tooltip: 'Cursor padrão (centro da tela)' },
    { key: 'up', label: '↑ Cima', tooltip: 'Edge scroll para cima' },
    { key: 'down', label: '↓ Baixo', tooltip: 'Edge scroll para baixo' },
    { key: 'left', label: '← Esquerda', tooltip: 'Edge scroll para esquerda' },
    { key: 'right', label: '→ Direita', tooltip: 'Edge scroll para direita' },
    { key: 'upLeft', label: '↖ Cima-Esq', tooltip: 'Edge scroll diagonal cima-esquerda' },
    { key: 'upRight', label: '↗ Cima-Dir', tooltip: 'Edge scroll diagonal cima-direita' },
    { key: 'downLeft', label: '↙ Baixo-Esq', tooltip: 'Edge scroll diagonal baixo-esquerda' },
    { key: 'downRight', label: '↘ Baixo-Dir', tooltip: 'Edge scroll diagonal baixo-direita' }
  ];

  const handleSelectImage = async (direction) => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] }]
      });

      if (selected) {
        onChange(direction, selected);
      }
    } catch (err) {
      console.error('Erro ao selecionar imagem do cursor:', err);
    }
  };

  const handleClearImage = (direction) => {
    onChange(direction, null);
  };

  const getFileName = (path) => {
    if (!path) return null;
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1];
  };

  return (
    <div className="cursor-image-selector">
      <div className="cursor-images-header">
        <span>Imagens por Direção</span>
        <span className="guide-icon small" title="Selecione imagens PNG/SVG para cada direção do cursor">?</span>
      </div>
      <div className="cursor-images-grid">
        {directions.map(({ key, label, tooltip }) => (
          <div key={key} className="cursor-image-item" title={tooltip}>
            <span className="cursor-direction-label">{label}</span>
            <div className="cursor-image-controls">
              {customCursors[key] ? (
                <>
                  <span className="cursor-filename" title={customCursors[key]}>
                    {getFileName(customCursors[key])}
                  </span>
                  <button
                    className="cursor-clear-btn"
                    onClick={() => handleClearImage(key)}
                    title="Remover imagem"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <button
                  className="cursor-select-btn"
                  onClick={() => handleSelectImage(key)}
                >
                  Selecionar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ControlSettings - Seção de configuração de controles no Inspector
 */
export default function ControlSettings({ object, onChange }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    mode2d: true,
    movement: true,
    keys: false,
    mouse: false
  });

  // Obter settings atuais com merge de defaults
  const getSettings = () => {
    const defaults = getDefaultSettings();
    const userSettings = object?.userData?.controlSettings;

    if (!userSettings) {
      return defaults;
    }

    // Merge profundo com defaults para garantir que todas as propriedades existam
    return {
      movement: {
        ...defaults.movement,
        // Suportar formato antigo (moveSpeed) e novo (movement.speed)
        speed: userSettings.movement?.speed ?? userSettings.moveSpeed ?? defaults.movement.speed,
        sprintMultiplier: userSettings.movement?.sprintMultiplier ?? userSettings.sprintMultiplier ?? defaults.movement.sprintMultiplier,
        jumpForce: userSettings.movement?.jumpForce ?? userSettings.jumpForce ?? defaults.movement.jumpForce,
        gravity: userSettings.movement?.gravity ?? userSettings.gravity ?? defaults.movement.gravity,
        rotationSpeed: userSettings.movement?.rotationSpeed ?? defaults.movement.rotationSpeed,
        // Click-to-move
        clickToMove: userSettings.movement?.clickToMove ?? defaults.movement.clickToMove,
        clickStopDistance: userSettings.movement?.clickStopDistance ?? defaults.movement.clickStopDistance,
        // Grid movement
        gridMovement: userSettings.movement?.gridMovement ?? defaults.movement.gridMovement,
        tileSize: userSettings.movement?.tileSize ?? defaults.movement.tileSize
      },
      keys: {
        ...defaults.keys,
        ...(userSettings.keys || {}),
        // Suportar formato antigo (controls.forward) se existir
        ...(userSettings.controls ? {
          forward: userSettings.controls.up || userSettings.controls.forward || defaults.keys.forward,
          backward: userSettings.controls.down || userSettings.controls.backward || defaults.keys.backward,
          left: userSettings.controls.left || defaults.keys.left,
          right: userSettings.controls.right || defaults.keys.right,
          jump: userSettings.controls.jump || defaults.keys.jump,
          sprint: userSettings.controls.sprint || defaults.keys.sprint
        } : {})
      },
      mouse: {
        ...defaults.mouse,
        ...(userSettings.mouse || {}),
        sensitivity: userSettings.mouse?.sensitivity ?? userSettings.mouseSensitivity ?? defaults.mouse.sensitivity,
        invertY: userSettings.mouse?.invertY ?? userSettings.invertY ?? defaults.mouse.invertY,
        zoomSpeed: userSettings.mouse?.zoomSpeed ?? userSettings.zoomSpeed ?? defaults.mouse.zoomSpeed
      },
      camera: {
        ...defaults.camera,
        ...(userSettings.camera || {}),
        mode: userSettings.camera?.mode ?? defaults.camera.mode,
        followSmoothing: userSettings.camera?.followSmoothing ?? defaults.camera.followSmoothing,
        edgeScrollEnabled: userSettings.camera?.edgeScrollEnabled ?? defaults.camera.edgeScrollEnabled,
        edgeScrollMargin: userSettings.camera?.edgeScrollMargin ?? defaults.camera.edgeScrollMargin,
        edgeScrollSpeed: userSettings.camera?.edgeScrollSpeed ?? defaults.camera.edgeScrollSpeed
      },
      cursor: {
        ...defaults.cursor,
        ...(userSettings.cursor || {}),
        hideSystemCursor: userSettings.cursor?.hideSystemCursor ?? defaults.cursor.hideSystemCursor,
        cursorStyle: userSettings.cursor?.cursorStyle ?? defaults.cursor.cursorStyle,
        cursorSize: userSettings.cursor?.cursorSize ?? defaults.cursor.cursorSize,
        cursorColor: userSettings.cursor?.cursorColor ?? defaults.cursor.cursorColor,
        customCursors: {
          ...defaults.cursor.customCursors,
          ...(userSettings.cursor?.customCursors || {})
        }
      }
    };
  };

  const settings = getSettings();

  // Toggle de subsection
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Atualizar setting
  const updateSetting = (path, value) => {
    const newSettings = { ...getSettings() };

    // Navegar pelo path (ex: 'keys.forward' ou 'movement.speed')
    const parts = path.split('.');
    let current = newSettings;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = value;

    // Notificar mudança
    if (onChange) {
      onChange('controlSettings', newSettings);
    }
  };

  // Resetar para defaults
  const resetToDefaults = () => {
    if (onChange) {
      onChange('controlSettings', getDefaultSettings());
    }
  };

  return (
    <div className="control-settings">
      {/* Header */}
      <div className="section-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h4>
          Controles
          <span className="section-guide" title="Configure os controles e movimento do player">?</span>
        </h4>
      </div>

      {isExpanded && (
        <div className="section-content">
          {/* 2D Mode Settings */}
          <div className="subsection">
            <div
              className="subsection-header"
              onClick={() => toggleSection('mode2d')}
            >
              <span className={`arrow ${expandedSections.mode2d ? 'expanded' : ''}`}>▶</span>
              <span>Modo 2D</span>
            </div>

            {expandedSections.mode2d && (
              <div className="subsection-content">
                <div className="property-row checkbox-row">
                  <label title="Clique na cena para mover o player até o ponto (estilo Dota/LoL)">
                    <input
                      type="checkbox"
                      checked={settings.movement.clickToMove}
                      onChange={(e) => updateSetting('movement.clickToMove', e.target.checked)}
                    />
                    <span className="checkbox-text">Click-to-Move (Dota style)</span>
                  </label>
                </div>

                <div className="property-row checkbox-row">
                  <label title="Player se move de tile em tile (estilo Pokémon)">
                    <input
                      type="checkbox"
                      checked={settings.movement.gridMovement}
                      onChange={(e) => updateSetting('movement.gridMovement', e.target.checked)}
                    />
                    <span className="checkbox-text">Movimento em Grid</span>
                  </label>
                </div>

                {settings.movement.gridMovement && (
                  <div className="property-row">
                    <PropertyLabel label="Tamanho Tile" tooltip="Tamanho de cada tile em unidades do mundo" />
                    <input
                      type="number"
                      value={settings.movement.tileSize}
                      onChange={(e) => updateSetting('movement.tileSize', parseFloat(e.target.value) || 1)}
                      min="0.25"
                      max="10"
                      step="0.25"
                    />
                  </div>
                )}

                <div className="property-row">
                  <PropertyLabel label="Modo Câmera" tooltip="'Follow' = câmera segue o player (MU). 'Free' = câmera livre (Dota)" />
                  <select
                    value={settings.camera.mode}
                    onChange={(e) => updateSetting('camera.mode', e.target.value)}
                  >
                    <option value="follow">Seguir Player (MU)</option>
                    <option value="free">Livre (Dota)</option>
                  </select>
                </div>

                {settings.camera.mode === 'follow' && (
                  <div className="property-row">
                    <PropertyLabel label="Suavidade" tooltip="Quão suave a câmera segue o player" />
                    <input
                      type="range"
                      value={settings.camera.followSmoothing}
                      onChange={(e) => updateSetting('camera.followSmoothing', parseFloat(e.target.value))}
                      min="1"
                      max="20"
                      step="1"
                    />
                    <span className="value-display">{settings.camera.followSmoothing}</span>
                  </div>
                )}

                <div className="subsection-divider">Edge Scroll</div>

                <div className="property-row checkbox-row">
                  <label title="Câmera move quando mouse chega na borda da tela">
                    <input
                      type="checkbox"
                      checked={settings.camera.edgeScrollEnabled}
                      onChange={(e) => updateSetting('camera.edgeScrollEnabled', e.target.checked)}
                    />
                    <span className="checkbox-text">Edge Scroll Habilitado</span>
                  </label>
                </div>

                {settings.camera.edgeScrollEnabled && (
                  <>
                    <div className="property-row">
                      <PropertyLabel label="Margem" tooltip="Distância em pixels da borda para ativar o scroll" />
                      <input
                        type="number"
                        value={settings.camera.edgeScrollMargin}
                        onChange={(e) => updateSetting('camera.edgeScrollMargin', parseInt(e.target.value) || 30)}
                        min="10"
                        max="100"
                        step="5"
                      />
                    </div>

                    <div className="property-row">
                      <PropertyLabel label="Velocidade" tooltip="Velocidade do movimento da câmera" />
                      <input
                        type="range"
                        value={settings.camera.edgeScrollSpeed}
                        onChange={(e) => updateSetting('camera.edgeScrollSpeed', parseFloat(e.target.value))}
                        min="1"
                        max="20"
                        step="1"
                      />
                      <span className="value-display">{settings.camera.edgeScrollSpeed}</span>
                    </div>
                  </>
                )}

                <div className="subsection-divider">Cursor</div>

                <div className="property-row checkbox-row">
                  <label title="Esconde o cursor do sistema e mostra cursor customizado">
                    <input
                      type="checkbox"
                      checked={settings.cursor.hideSystemCursor}
                      onChange={(e) => updateSetting('cursor.hideSystemCursor', e.target.checked)}
                    />
                    <span className="checkbox-text">Cursor Customizado</span>
                  </label>
                </div>

                {settings.cursor.hideSystemCursor && (
                  <>
                    <div className="property-row">
                      <PropertyLabel label="Estilo" tooltip="Estilo do cursor customizado" />
                      <select
                        value={settings.cursor.cursorStyle}
                        onChange={(e) => updateSetting('cursor.cursorStyle', e.target.value)}
                      >
                        <option value="circle">Círculo</option>
                        <option value="crosshair">Mira</option>
                        <option value="arrow">Seta</option>
                        <option value="dot">Ponto</option>
                        <option value="custom">Imagem Custom</option>
                      </select>
                    </div>

                    <div className="property-row">
                      <PropertyLabel label="Tamanho" tooltip="Tamanho do cursor em pixels" />
                      <input
                        type="number"
                        value={settings.cursor.cursorSize}
                        onChange={(e) => updateSetting('cursor.cursorSize', parseInt(e.target.value) || 20)}
                        min="10"
                        max="64"
                        step="2"
                      />
                    </div>

                    <div className="property-row">
                      <PropertyLabel label="Cor" tooltip="Cor do cursor" />
                      <input
                        type="color"
                        value={settings.cursor.cursorColor}
                        onChange={(e) => updateSetting('cursor.cursorColor', e.target.value)}
                      />
                      <span className="color-hex">{settings.cursor.cursorColor}</span>
                    </div>

                    {/* Custom Cursor Images */}
                    {settings.cursor.cursorStyle === 'custom' && (
                      <CursorImageSelector
                        customCursors={settings.cursor.customCursors}
                        onChange={(direction, path) => updateSetting(`cursor.customCursors.${direction}`, path)}
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Movement Settings */}
          <div className="subsection">
            <div
              className="subsection-header"
              onClick={() => toggleSection('movement')}
            >
              <span className={`arrow ${expandedSections.movement ? 'expanded' : ''}`}>▶</span>
              <span>Movimento</span>
            </div>

            {expandedSections.movement && (
              <div className="subsection-content">
                <div className="property-row">
                  <PropertyLabel label="Velocidade" tooltip="Velocidade base de movimento em unidades/segundo" />
                  <input
                    type="number"
                    value={settings.movement.speed}
                    onChange={(e) => updateSetting('movement.speed', parseFloat(e.target.value) || 5)}
                    min="0.1"
                    max="50"
                    step="0.5"
                  />
                </div>

                <div className="property-row">
                  <PropertyLabel label="Mult. Corrida" tooltip="Multiplicador de velocidade ao correr (Shift)" />
                  <input
                    type="number"
                    value={settings.movement.sprintMultiplier}
                    onChange={(e) => updateSetting('movement.sprintMultiplier', parseFloat(e.target.value) || 2)}
                    min="1"
                    max="5"
                    step="0.1"
                  />
                </div>

                <div className="property-row">
                  <PropertyLabel label="Força do Pulo" tooltip="Força vertical aplicada ao pular" />
                  <input
                    type="number"
                    value={settings.movement.jumpForce}
                    onChange={(e) => updateSetting('movement.jumpForce', parseFloat(e.target.value) || 8)}
                    min="0"
                    max="30"
                    step="0.5"
                  />
                </div>

                <div className="property-row">
                  <PropertyLabel label="Gravidade" tooltip="Força da gravidade aplicada ao player" />
                  <input
                    type="number"
                    value={settings.movement.gravity}
                    onChange={(e) => updateSetting('movement.gravity', parseFloat(e.target.value) || 20)}
                    min="0"
                    max="50"
                    step="1"
                  />
                </div>

                <div className="property-row">
                  <PropertyLabel label="Vel. Rotação" tooltip="Velocidade que o personagem gira para a direção do movimento" />
                  <input
                    type="number"
                    value={settings.movement.rotationSpeed}
                    onChange={(e) => updateSetting('movement.rotationSpeed', parseFloat(e.target.value) || 10)}
                    min="1"
                    max="30"
                    step="1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Key Bindings */}
          <div className="subsection">
            <div
              className="subsection-header"
              onClick={() => toggleSection('keys')}
            >
              <span className={`arrow ${expandedSections.keys ? 'expanded' : ''}`}>▶</span>
              <span>Teclas</span>
            </div>

            {expandedSections.keys && (
              <div className="subsection-content">
                <div className="keybind-grid">
                  <div className="keybind-row">
                    <span className="keybind-label">Frente</span>
                    <KeyBindInput
                      value={settings.keys.forward}
                      onChange={(v) => updateSetting('keys.forward', v)}
                    />
                    <KeyBindInput
                      value={settings.keys.forwardAlt}
                      onChange={(v) => updateSetting('keys.forwardAlt', v)}
                    />
                  </div>

                  <div className="keybind-row">
                    <span className="keybind-label">Trás</span>
                    <KeyBindInput
                      value={settings.keys.backward}
                      onChange={(v) => updateSetting('keys.backward', v)}
                    />
                    <KeyBindInput
                      value={settings.keys.backwardAlt}
                      onChange={(v) => updateSetting('keys.backwardAlt', v)}
                    />
                  </div>

                  <div className="keybind-row">
                    <span className="keybind-label">Esquerda</span>
                    <KeyBindInput
                      value={settings.keys.left}
                      onChange={(v) => updateSetting('keys.left', v)}
                    />
                    <KeyBindInput
                      value={settings.keys.leftAlt}
                      onChange={(v) => updateSetting('keys.leftAlt', v)}
                    />
                  </div>

                  <div className="keybind-row">
                    <span className="keybind-label">Direita</span>
                    <KeyBindInput
                      value={settings.keys.right}
                      onChange={(v) => updateSetting('keys.right', v)}
                    />
                    <KeyBindInput
                      value={settings.keys.rightAlt}
                      onChange={(v) => updateSetting('keys.rightAlt', v)}
                    />
                  </div>

                  <div className="keybind-row">
                    <span className="keybind-label">Pular</span>
                    <KeyBindInput
                      value={settings.keys.jump}
                      onChange={(v) => updateSetting('keys.jump', v)}
                    />
                  </div>

                  <div className="keybind-row">
                    <span className="keybind-label">Correr</span>
                    <KeyBindInput
                      value={settings.keys.sprint}
                      onChange={(v) => updateSetting('keys.sprint', v)}
                    />
                  </div>
                </div>

                <div className="keybind-hint">
                  Clique no botão e pressione uma tecla para alterar
                </div>
              </div>
            )}
          </div>

          {/* Mouse Settings */}
          <div className="subsection">
            <div
              className="subsection-header"
              onClick={() => toggleSection('mouse')}
            >
              <span className={`arrow ${expandedSections.mouse ? 'expanded' : ''}`}>▶</span>
              <span>Mouse / Toque</span>
            </div>

            {expandedSections.mouse && (
              <div className="subsection-content">
                <div className="property-row">
                  <PropertyLabel label="Sensibilidade" tooltip="Sensibilidade do mouse (Primeira Pessoa)" />
                  <input
                    type="range"
                    value={settings.mouse.sensitivity * 1000}
                    onChange={(e) => updateSetting('mouse.sensitivity', parseFloat(e.target.value) / 1000)}
                    min="0.5"
                    max="10"
                    step="0.1"
                  />
                  <span className="value-display">{(settings.mouse.sensitivity * 1000).toFixed(1)}</span>
                </div>

                <div className="property-row checkbox-row">
                  <label title="Inverte o movimento vertical do mouse">
                    <input
                      type="checkbox"
                      checked={settings.mouse.invertY}
                      onChange={(e) => updateSetting('mouse.invertY', e.target.checked)}
                    />
                    <span className="checkbox-text">Inverter Eixo Y</span>
                  </label>
                </div>

                <div className="property-row">
                  <PropertyLabel label="Vel. Zoom" tooltip="Velocidade do zoom com scroll do mouse (Isométrico)" />
                  <input
                    type="range"
                    value={settings.mouse.zoomSpeed}
                    onChange={(e) => updateSetting('mouse.zoomSpeed', parseFloat(e.target.value))}
                    min="0.1"
                    max="5"
                    step="0.1"
                  />
                  <span className="value-display">{settings.mouse.zoomSpeed.toFixed(1)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Reset Button */}
          <div className="reset-controls">
            <button
              className="reset-btn"
              onClick={resetToDefaults}
              title="Restaurar todas as configurações de controle para os valores padrão"
            >
              Restaurar Padrão
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Retorna as configurações padrão de controles
 */
export function getDefaultSettings() {
  return {
    movement: {
      speed: 5,
      sprintMultiplier: 2,
      jumpForce: 8,
      gravity: 20,
      rotationSpeed: 10,
      // Click-to-move (Dota style)
      clickToMove: false,
      clickStopDistance: 0.1,
      // Grid movement (Pokémon style)
      gridMovement: false,
      tileSize: 1
    },
    keys: {
      forward: 'KeyW',
      forwardAlt: 'ArrowUp',
      backward: 'KeyS',
      backwardAlt: 'ArrowDown',
      left: 'KeyA',
      leftAlt: 'ArrowLeft',
      right: 'KeyD',
      rightAlt: 'ArrowRight',
      jump: 'Space',
      sprint: 'ShiftLeft'
    },
    mouse: {
      sensitivity: 0.002,
      invertY: false,
      zoomSpeed: 1
    },
    camera: {
      mode: 'follow', // 'follow' (MU style) ou 'free' (Dota style)
      followSmoothing: 5,
      // Edge scroll (câmera move quando mouse na borda)
      edgeScrollEnabled: true,
      edgeScrollMargin: 30, // pixels da borda para ativar
      edgeScrollSpeed: 8 // velocidade do scroll
    },
    cursor: {
      hideSystemCursor: true, // Esconder cursor do sistema no Game mode
      cursorStyle: 'circle', // 'circle', 'crosshair', 'arrow', 'custom'
      cursorSize: 20, // Tamanho do cursor em pixels
      cursorColor: '#ffffff', // Cor do cursor
      // Cursores customizados por imagem (URLs ou base64)
      customCursors: {
        default: null, // Cursor padrão
        up: null, // Movendo para cima
        down: null, // Movendo para baixo
        left: null, // Movendo para esquerda
        right: null, // Movendo para direita
        upLeft: null, // Diagonal cima-esquerda
        upRight: null, // Diagonal cima-direita
        downLeft: null, // Diagonal baixo-esquerda
        downRight: null // Diagonal baixo-direita
      }
    }
  };
}
