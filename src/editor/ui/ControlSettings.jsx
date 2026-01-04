import { useState, useEffect, useCallback } from 'react';
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
      title={`Click to change. Current: ${value}`}
    >
      {isCapturing ? 'Press a key...' : formatKeyName(value)}
    </button>
  );
}

/**
 * ControlSettings - Seção de configuração de controles no Inspector
 */
export default function ControlSettings({ object, onChange }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    movement: true,
    keys: false,
    mouse: false
  });

  // Obter settings atuais ou defaults
  const getSettings = () => {
    return object?.userData?.controlSettings || getDefaultSettings();
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
          Control Settings
          <span className="section-guide" title="Configure player controls and movement">?</span>
        </h4>
      </div>

      {isExpanded && (
        <div className="section-content">
          {/* Movement Settings */}
          <div className="subsection">
            <div
              className="subsection-header"
              onClick={() => toggleSection('movement')}
            >
              <span className={`arrow ${expandedSections.movement ? 'expanded' : ''}`}>▶</span>
              <span>Movement</span>
            </div>

            {expandedSections.movement && (
              <div className="subsection-content">
                <div className="property-row">
                  <PropertyLabel label="Move Speed" tooltip="Base movement speed in units/second" />
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
                  <PropertyLabel label="Sprint Multiplier" tooltip="Speed multiplier when sprinting" />
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
                  <PropertyLabel label="Jump Force" tooltip="Vertical force applied when jumping" />
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
                  <PropertyLabel label="Gravity" tooltip="Gravity force applied to player" />
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
                  <PropertyLabel label="Rotation Speed" tooltip="How fast the character rotates to face movement direction" />
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
              <span>Key Bindings</span>
            </div>

            {expandedSections.keys && (
              <div className="subsection-content">
                <div className="keybind-grid">
                  <div className="keybind-row">
                    <span className="keybind-label">Forward</span>
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
                    <span className="keybind-label">Backward</span>
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
                    <span className="keybind-label">Left</span>
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
                    <span className="keybind-label">Right</span>
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
                    <span className="keybind-label">Jump</span>
                    <KeyBindInput
                      value={settings.keys.jump}
                      onChange={(v) => updateSetting('keys.jump', v)}
                    />
                  </div>

                  <div className="keybind-row">
                    <span className="keybind-label">Sprint</span>
                    <KeyBindInput
                      value={settings.keys.sprint}
                      onChange={(v) => updateSetting('keys.sprint', v)}
                    />
                  </div>
                </div>

                <div className="keybind-hint">
                  Click a button and press a key to rebind
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
              <span>Mouse / Touch</span>
            </div>

            {expandedSections.mouse && (
              <div className="subsection-content">
                <div className="property-row">
                  <PropertyLabel label="Sensitivity" tooltip="Mouse look sensitivity (First Person)" />
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
                  <label title="Invert vertical mouse movement">
                    <input
                      type="checkbox"
                      checked={settings.mouse.invertY}
                      onChange={(e) => updateSetting('mouse.invertY', e.target.checked)}
                    />
                    <span className="checkbox-text">Invert Y Axis</span>
                  </label>
                </div>

                <div className="property-row">
                  <PropertyLabel label="Zoom Speed" tooltip="Mouse wheel zoom speed (Isometric)" />
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
              title="Reset all control settings to defaults"
            >
              Reset to Defaults
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
      rotationSpeed: 10
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
    }
  };
}
