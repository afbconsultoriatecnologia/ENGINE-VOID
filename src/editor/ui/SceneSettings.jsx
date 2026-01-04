import { useState, useEffect } from 'react';
import './SceneSettings.css';

/**
 * Painel de configurações gerais da cena
 * Controla: Sky, Grid, Axes, Background, etc.
 */
export default function SceneSettings({ engine, isOpen, onClose }) {
  // Sky settings
  const [skyEnabled, setSkyEnabled] = useState(false);
  const [skyTurbidity, setSkyTurbidity] = useState(10);
  const [skyRayleigh, setSkyRayleigh] = useState(2);
  const [skyMieCoefficient, setSkyMieCoefficient] = useState(0.005);
  const [skyMieDirectionalG, setSkyMieDirectionalG] = useState(0.8);

  // Grid & Axes
  const [gridVisible, setGridVisible] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  const [gridDivisions, setGridDivisions] = useState(20);
  const [axesVisible, setAxesVisible] = useState(true);
  const [axesSize, setAxesSize] = useState(5);

  // Background
  const [backgroundColor, setBackgroundColor] = useState('#1a1a1a');

  // Shadows
  const [shadowsEnabled, setShadowsEnabled] = useState(true);
  const [shadowMapSize, setShadowMapSize] = useState(2048);

  // Clouds
  const [cloudsEnabled, setCloudsEnabled] = useState(false);
  const [cloudHeight, setCloudHeight] = useState(500);
  const [cloudOpacity, setCloudOpacity] = useState(0.6);
  const [cloudSpeed, setCloudSpeed] = useState(0.01);

  // Sincronizar com engine
  useEffect(() => {
    if (!engine) return;

    // Verificar estado atual do sky
    setSkyEnabled(engine.skyEnabled || false);

    // Grid
    const grid = engine.helpers?.get('grid');
    if (grid) {
      setGridVisible(grid.visible);
    }

    // Axes
    const axes = engine.helpers?.get('axes');
    if (axes) {
      setAxesVisible(axes.visible);
    }

    // Background
    if (engine.scene?.background) {
      const color = '#' + engine.scene.background.getHexString();
      setBackgroundColor(color);
    }

    // Clouds
    setCloudsEnabled(engine.cloudsEnabled || false);
    if (engine.clouds) {
      setCloudHeight(engine.clouds.position.y);
      setCloudOpacity(engine.clouds.material.opacity);
    }
    setCloudSpeed(engine.cloudSpeed || 0.01);
  }, [engine, isOpen]);

  // === Handlers ===

  const handleSkyToggle = (enabled) => {
    setSkyEnabled(enabled);
    if (enabled) {
      engine?.enableSky?.({
        turbidity: skyTurbidity,
        rayleigh: skyRayleigh,
        mieCoefficient: skyMieCoefficient,
        mieDirectionalG: skyMieDirectionalG
      });
    } else {
      engine?.disableSky?.();
    }
  };

  const handleSkyParamChange = (param, value) => {
    const num = parseFloat(value);
    switch (param) {
      case 'turbidity':
        setSkyTurbidity(num);
        break;
      case 'rayleigh':
        setSkyRayleigh(num);
        break;
      case 'mieCoefficient':
        setSkyMieCoefficient(num);
        break;
      case 'mieDirectionalG':
        setSkyMieDirectionalG(num);
        break;
    }
    if (skyEnabled) {
      engine?.updateSky?.({
        turbidity: param === 'turbidity' ? num : skyTurbidity,
        rayleigh: param === 'rayleigh' ? num : skyRayleigh,
        mieCoefficient: param === 'mieCoefficient' ? num : skyMieCoefficient,
        mieDirectionalG: param === 'mieDirectionalG' ? num : skyMieDirectionalG
      });
    }
  };

  const handleGridToggle = (visible) => {
    setGridVisible(visible);
    const grid = engine?.helpers?.get('grid');
    if (grid) grid.visible = visible;
  };

  const handleGridSizeChange = (value) => {
    const size = parseInt(value) || 20;
    setGridSize(size);
    engine?.updateGridHelper?.('grid', { size, divisions: gridDivisions });
  };

  const handleGridDivisionsChange = (value) => {
    const divisions = parseInt(value) || 20;
    setGridDivisions(divisions);
    engine?.updateGridHelper?.('grid', { size: gridSize, divisions });
  };

  const handleAxesToggle = (visible) => {
    setAxesVisible(visible);
    const axes = engine?.helpers?.get('axes');
    if (axes) axes.visible = visible;
  };

  const handleAxesSizeChange = (value) => {
    const size = parseFloat(value) || 5;
    setAxesSize(size);
    engine?.updateAxesHelper?.('axes', { size });
  };

  const handleBackgroundColorChange = (value) => {
    setBackgroundColor(value);
    if (engine && engine.setBackgroundColor) {
      engine.setBackgroundColor(value);
    }
  };

  const handleShadowsToggle = (enabled) => {
    setShadowsEnabled(enabled);
    if (engine?.renderer) {
      engine.renderer.shadowMap.enabled = enabled;
    }
  };

  const handleCloudsToggle = (enabled) => {
    setCloudsEnabled(enabled);
    if (enabled) {
      engine?.enableClouds?.({
        height: cloudHeight,
        opacity: cloudOpacity,
        speed: cloudSpeed
      });
    } else {
      engine?.disableClouds?.();
    }
  };

  const handleCloudParamChange = (param, value) => {
    const num = parseFloat(value);
    switch (param) {
      case 'height':
        setCloudHeight(num);
        break;
      case 'opacity':
        setCloudOpacity(num);
        break;
      case 'speed':
        setCloudSpeed(num);
        break;
    }
    if (cloudsEnabled) {
      engine?.updateClouds?.({
        height: param === 'height' ? num : cloudHeight,
        opacity: param === 'opacity' ? num : cloudOpacity,
        speed: param === 'speed' ? num : cloudSpeed
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="scene-settings-overlay" onClick={onClose}>
      <div className="scene-settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Configurações da Cena</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="settings-content">
          {/* Sky Section */}
          <div className="settings-section">
            <div className="section-header">
              <h4>Céu (Sky)</h4>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={skyEnabled}
                  onChange={(e) => handleSkyToggle(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {skyEnabled && (
              <div className="section-content">
                <div className="setting-row">
                  <label>Turbidez</label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="0.1"
                    value={skyTurbidity}
                    onChange={(e) => handleSkyParamChange('turbidity', e.target.value)}
                  />
                  <span>{skyTurbidity.toFixed(1)}</span>
                </div>
                <div className="setting-row">
                  <label>Rayleigh</label>
                  <input
                    type="range"
                    min="0"
                    max="4"
                    step="0.1"
                    value={skyRayleigh}
                    onChange={(e) => handleSkyParamChange('rayleigh', e.target.value)}
                  />
                  <span>{skyRayleigh.toFixed(1)}</span>
                </div>
                <div className="setting-row">
                  <label>Mie Coef.</label>
                  <input
                    type="range"
                    min="0"
                    max="0.1"
                    step="0.001"
                    value={skyMieCoefficient}
                    onChange={(e) => handleSkyParamChange('mieCoefficient', e.target.value)}
                  />
                  <span>{skyMieCoefficient.toFixed(3)}</span>
                </div>
                <div className="setting-row">
                  <label>Mie Dir. G</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={skyMieDirectionalG}
                    onChange={(e) => handleSkyParamChange('mieDirectionalG', e.target.value)}
                  />
                  <span>{skyMieDirectionalG.toFixed(2)}</span>
                </div>
                <p className="setting-hint">O céu acompanha a posição da luz direcional automaticamente.</p>
              </div>
            )}
          </div>

          {/* Clouds Section */}
          <div className="settings-section">
            <div className="section-header">
              <h4>Nuvens</h4>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={cloudsEnabled}
                  onChange={(e) => handleCloudsToggle(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {cloudsEnabled && (
              <div className="section-content">
                <div className="setting-row">
                  <label>Altura</label>
                  <input
                    type="range"
                    min="100"
                    max="1000"
                    step="10"
                    value={cloudHeight}
                    onChange={(e) => handleCloudParamChange('height', e.target.value)}
                  />
                  <span>{cloudHeight}</span>
                </div>
                <div className="setting-row">
                  <label>Opacidade</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={cloudOpacity}
                    onChange={(e) => handleCloudParamChange('opacity', e.target.value)}
                  />
                  <span>{cloudOpacity.toFixed(2)}</span>
                </div>
                <div className="setting-row">
                  <label>Velocidade</label>
                  <input
                    type="range"
                    min="0"
                    max="0.1"
                    step="0.005"
                    value={cloudSpeed}
                    onChange={(e) => handleCloudParamChange('speed', e.target.value)}
                  />
                  <span>{cloudSpeed.toFixed(3)}</span>
                </div>
                <p className="setting-hint">As nuvens se movem automaticamente no céu.</p>
              </div>
            )}
          </div>

          {/* Background Section */}
          <div className="settings-section">
            <div className="section-header">
              <h4>Fundo</h4>
            </div>
            <div className="section-content">
              <div className="setting-row">
                <label>Cor de Fundo</label>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => handleBackgroundColorChange(e.target.value)}
                  disabled={skyEnabled}
                />
                {skyEnabled && <span className="hint">(Sky ativo)</span>}
              </div>
            </div>
          </div>

          {/* Grid Section */}
          <div className="settings-section">
            <div className="section-header">
              <h4>Grid</h4>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={gridVisible}
                  onChange={(e) => handleGridToggle(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {gridVisible && (
              <div className="section-content">
                <div className="setting-row">
                  <label>Tamanho</label>
                  <input
                    type="number"
                    value={gridSize}
                    onChange={(e) => handleGridSizeChange(e.target.value)}
                    min="1"
                    step="5"
                  />
                </div>
                <div className="setting-row">
                  <label>Divisões</label>
                  <input
                    type="number"
                    value={gridDivisions}
                    onChange={(e) => handleGridDivisionsChange(e.target.value)}
                    min="1"
                    step="5"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Axes Section */}
          <div className="settings-section">
            <div className="section-header">
              <h4>Eixos (Axes)</h4>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={axesVisible}
                  onChange={(e) => handleAxesToggle(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {axesVisible && (
              <div className="section-content">
                <div className="setting-row">
                  <label>Tamanho</label>
                  <input
                    type="number"
                    value={axesSize}
                    onChange={(e) => handleAxesSizeChange(e.target.value)}
                    min="1"
                    step="1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Shadows Section */}
          <div className="settings-section">
            <div className="section-header">
              <h4>Sombras</h4>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={shadowsEnabled}
                  onChange={(e) => handleShadowsToggle(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
