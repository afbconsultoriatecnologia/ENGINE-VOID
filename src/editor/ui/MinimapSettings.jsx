import React, { useState, useEffect } from 'react';
import MinimapSystem from '../../runtime/minimap/MinimapSystem.js';
import './MinimapSettings.css';

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
 * PropertyLabel com tooltip
 */
function PropertyLabel({ label, tooltip }) {
  return (
    <label>
      {label}
      <span className="guide-icon" title={tooltip}>?</span>
    </label>
  );
}

/**
 * MinimapSettings - Seção de configuração do minimap no Inspector
 * Renderizado quando o objeto selecionado é o Player
 */
export default function MinimapSettings({ object, onChange }) {
  // Obter settings atuais ou criar defaults
  const getSettings = () => {
    return object?.userData?.minimapSettings || MinimapSystem.getDefaultSettings();
  };

  const [settings, setSettings] = useState(getSettings());
  const [expandedSections, setExpandedSections] = useState({
    position: true,
    size: true,
    scale: false,
    fogOfWar: true,
    appearance: false,
    markers: false
  });

  // Atualizar quando objeto muda
  useEffect(() => {
    setSettings(getSettings());
  }, [object]);

  // Atualizar settings no objeto
  const updateSettings = (newSettings) => {
    setSettings(newSettings);

    if (object && object.userData) {
      object.userData.minimapSettings = newSettings;
    }

    if (onChange) {
      onChange(newSettings);
    }
  };

  // Handler genérico para mudanças
  const handleChange = (path, value) => {
    const newSettings = { ...settings };
    const keys = path.split('.');
    let current = newSettings;

    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    updateSettings(newSettings);
  };

  // Toggle seção expandida
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Selecionar imagem de fundo do minimap
  const handleSelectBackgroundImage = async () => {
    try {
      if (tauriDialog) {
        // Usar diálogo nativo do Tauri
        const selected = await tauriDialog.open({
          multiple: false,
          filters: [{
            name: 'Images',
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif']
          }]
        });

        if (selected) {
          handleChange('backgroundImage', selected);
        }
      } else {
        // Fallback para input HTML
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            // Para web, usar URL do blob
            const url = URL.createObjectURL(file);
            handleChange('backgroundImage', url);
          }
        };
        input.click();
      }
    } catch (err) {
      console.error('Erro ao selecionar imagem:', err);
    }
  };

  // Limpar imagem de fundo
  const handleClearBackgroundImage = () => {
    handleChange('backgroundImage', null);
    handleChange('backgroundImageLoaded', null);
  };

  return (
    <div className="minimap-settings">
      <div className="section-header">
        <h4>Minimap</h4>
        <span className="section-guide" title="Mini mapa exibido durante o Game mode com fog of war e marcadores">?</span>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => handleChange('enabled', e.target.checked)}
          />
          Enabled
        </label>
      </div>

      {settings.enabled && (
        <div className="section-content">
          {/* POSIÇÃO */}
          <div className="subsection">
            <div
              className="subsection-header"
              onClick={() => toggleSection('position')}
            >
              <span className={`arrow ${expandedSections.position ? 'expanded' : ''}`}>▶</span>
              Position
            </div>
            {expandedSections.position && (
              <div className="subsection-content">
                <div className="property-row">
                  <PropertyLabel label="Corner" tooltip="Canto da tela onde o minimap será posicionado" />
                  <select
                    value={settings.position}
                    onChange={(e) => handleChange('position', e.target.value)}
                  >
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                  </select>
                </div>
                <div className="property-row">
                  <PropertyLabel label="Offset X" tooltip="Distância horizontal da borda da tela em pixels" />
                  <input
                    type="number"
                    value={settings.offsetX}
                    onChange={(e) => handleChange('offsetX', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="property-row">
                  <PropertyLabel label="Offset Y" tooltip="Distância vertical da borda da tela em pixels" />
                  <input
                    type="number"
                    value={settings.offsetY}
                    onChange={(e) => handleChange('offsetY', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* TAMANHO E FORMATO */}
          <div className="subsection">
            <div
              className="subsection-header"
              onClick={() => toggleSection('size')}
            >
              <span className={`arrow ${expandedSections.size ? 'expanded' : ''}`}>▶</span>
              Size & Shape
            </div>
            {expandedSections.size && (
              <div className="subsection-content">
                <div className="property-row">
                  <PropertyLabel label="Shape" tooltip="Formato do minimap: círculo, quadrado ou retângulo" />
                  <select
                    value={settings.shape}
                    onChange={(e) => handleChange('shape', e.target.value)}
                  >
                    <option value="circle">Circle</option>
                    <option value="square">Square</option>
                    <option value="rectangle">Rectangle</option>
                  </select>
                </div>
                <div className="property-row">
                  <PropertyLabel label="Size" tooltip="Tamanho do minimap em pixels" />
                  <input
                    type="range"
                    min="80"
                    max="300"
                    value={settings.size}
                    onChange={(e) => handleChange('size', parseInt(e.target.value))}
                  />
                  <span className="value-display">{settings.size}px</span>
                </div>
                {settings.shape === 'rectangle' && (
                  <div className="property-row">
                    <PropertyLabel label="Height" tooltip="Altura do minimap retangular em pixels" />
                    <input
                      type="range"
                      min="60"
                      max="250"
                      value={settings.height}
                      onChange={(e) => handleChange('height', parseInt(e.target.value))}
                    />
                    <span className="value-display">{settings.height}px</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ESCALA E COORDENADAS */}
          <div className="subsection">
            <div
              className="subsection-header"
              onClick={() => toggleSection('scale')}
            >
              <span className={`arrow ${expandedSections.scale ? 'expanded' : ''}`}>▶</span>
              Scale & Coordinates
            </div>
            {expandedSections.scale && (
              <div className="subsection-content">
                <div className="property-row">
                  <PropertyLabel label="Scale" tooltip="Zoom do minimap. 1x = escala normal, valores maiores = mais zoom" />
                  <input
                    type="range"
                    min="0.5"
                    max="5"
                    step="0.1"
                    value={settings.scale}
                    onChange={(e) => handleChange('scale', parseFloat(e.target.value))}
                  />
                  <span className="value-display">{settings.scale}x</span>
                </div>
                <div className="property-row checkbox-row">
                  <label title="Quando ativo, o minimap rotaciona junto com a câmera. O 'norte' sempre aponta para frente do player">
                    <input
                      type="checkbox"
                      checked={settings.rotateWithCamera !== false}
                      onChange={(e) => handleChange('rotateWithCamera', e.target.checked)}
                    />
                    <span className="checkbox-text">Rotate with Camera</span>
                    <span className="guide-icon small">?</span>
                  </label>
                </div>
                <div className="property-row checkbox-row">
                  <label title="Exibe as coordenadas X e Z do player abaixo do minimap">
                    <input
                      type="checkbox"
                      checked={settings.showCoordinates}
                      onChange={(e) => handleChange('showCoordinates', e.target.checked)}
                    />
                    <span className="checkbox-text">Show Coordinates</span>
                    <span className="guide-icon small">?</span>
                  </label>
                </div>
                <div className="property-row checkbox-row">
                  <label title="Exibe uma grade de referência no minimap">
                    <input
                      type="checkbox"
                      checked={settings.showGrid}
                      onChange={(e) => handleChange('showGrid', e.target.checked)}
                    />
                    <span className="checkbox-text">Show Grid</span>
                    <span className="guide-icon small">?</span>
                  </label>
                </div>
                {settings.showGrid && (
                  <div className="property-row">
                    <PropertyLabel label="Grid Size" tooltip="Espaçamento entre as linhas da grade em unidades do mundo" />
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={settings.gridSize}
                      onChange={(e) => handleChange('gridSize', parseInt(e.target.value) || 10)}
                    />
                  </div>
                )}
                <div className="world-bounds">
                  <PropertyLabel label="World Bounds" tooltip="Limites do mundo visíveis no minimap. Define a área total que o minimap representa" />
                  <div className="bounds-grid">
                    <div className="bound-input">
                      <span>Min X</span>
                      <input
                        type="number"
                        value={settings.worldBounds.minX}
                        onChange={(e) => handleChange('worldBounds.minX', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="bound-input">
                      <span>Max X</span>
                      <input
                        type="number"
                        value={settings.worldBounds.maxX}
                        onChange={(e) => handleChange('worldBounds.maxX', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="bound-input">
                      <span>Min Z</span>
                      <input
                        type="number"
                        value={settings.worldBounds.minZ}
                        onChange={(e) => handleChange('worldBounds.minZ', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="bound-input">
                      <span>Max Z</span>
                      <input
                        type="number"
                        value={settings.worldBounds.maxZ}
                        onChange={(e) => handleChange('worldBounds.maxZ', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* FOG OF WAR */}
          <div className="subsection">
            <div
              className="subsection-header"
              onClick={() => toggleSection('fogOfWar')}
            >
              <span className={`arrow ${expandedSections.fogOfWar ? 'expanded' : ''}`}>▶</span>
              Fog of War
              <label className="toggle-label" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={settings.fogOfWar.enabled}
                  onChange={(e) => handleChange('fogOfWar.enabled', e.target.checked)}
                />
              </label>
            </div>
            {expandedSections.fogOfWar && settings.fogOfWar.enabled && (
              <div className="subsection-content">
                <div className="property-row">
                  <PropertyLabel label="Mode" tooltip="Permanent: áreas visitadas ficam reveladas. Limited: só mostra área atual. Hybrid: visitadas ficam semi-transparentes" />
                  <select
                    value={settings.fogOfWar.mode}
                    onChange={(e) => handleChange('fogOfWar.mode', e.target.value)}
                  >
                    <option value="permanent">Permanent (RTS)</option>
                    <option value="limited">Limited (Roguelike)</option>
                    <option value="hybrid">Hybrid (RPG)</option>
                  </select>
                </div>
                <div className="property-row">
                  <PropertyLabel label="Reveal Radius" tooltip="Raio de visão ao redor do player em unidades do mundo" />
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={settings.fogOfWar.revealRadius}
                    onChange={(e) => handleChange('fogOfWar.revealRadius', parseInt(e.target.value))}
                  />
                  <span className="value-display">{settings.fogOfWar.revealRadius}</span>
                </div>
                {settings.fogOfWar.mode === 'hybrid' && (
                  <div className="property-row">
                    <PropertyLabel label="Explored Opacity" tooltip="Opacidade do fog em áreas já exploradas. 0% = totalmente visível, 100% = totalmente coberto" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={settings.fogOfWar.exploredOpacity}
                      onChange={(e) => handleChange('fogOfWar.exploredOpacity', parseFloat(e.target.value))}
                    />
                    <span className="value-display">{(settings.fogOfWar.exploredOpacity * 100).toFixed(0)}%</span>
                  </div>
                )}
                <div className="property-row">
                  <PropertyLabel label="Fog Color" tooltip="Cor do fog que cobre áreas não exploradas" />
                  <div className="color-input">
                    <input
                      type="color"
                      value={settings.fogOfWar.unexploredColor}
                      onChange={(e) => handleChange('fogOfWar.unexploredColor', e.target.value)}
                    />
                    <span className="color-hex">{settings.fogOfWar.unexploredColor}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* APARÊNCIA */}
          <div className="subsection">
            <div
              className="subsection-header"
              onClick={() => toggleSection('appearance')}
            >
              <span className={`arrow ${expandedSections.appearance ? 'expanded' : ''}`}>▶</span>
              Appearance
            </div>
            {expandedSections.appearance && (
              <div className="subsection-content">
                {/* Background Image */}
                <div className="property-row background-image-row">
                  <PropertyLabel label="Map Image" tooltip="Imagem de fundo do minimap (representa o World Bounds)" />
                  <div className="image-controls">
                    <button
                      className="select-image-btn"
                      onClick={handleSelectBackgroundImage}
                      title="Selecionar imagem"
                    >
                      📁
                    </button>
                    {settings.backgroundImage && (
                      <button
                        className="clear-image-btn"
                        onClick={handleClearBackgroundImage}
                        title="Remover imagem"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                {settings.backgroundImage && (
                  <div className="image-preview-row">
                    <span className="image-path" title={settings.backgroundImage}>
                      {settings.backgroundImage.split('/').pop().substring(0, 20)}...
                    </span>
                  </div>
                )}
                <div className="property-row">
                  <PropertyLabel label="Border Color" tooltip="Cor da borda do minimap" />
                  <div className="color-input">
                    <input
                      type="color"
                      value={settings.borderColor}
                      onChange={(e) => handleChange('borderColor', e.target.value)}
                    />
                    <span className="color-hex">{settings.borderColor}</span>
                  </div>
                </div>
                <div className="property-row">
                  <PropertyLabel label="Border Width" tooltip="Espessura da borda do minimap em pixels" />
                  <input
                    type="range"
                    min="0"
                    max="5"
                    value={settings.borderWidth}
                    onChange={(e) => handleChange('borderWidth', parseInt(e.target.value))}
                  />
                  <span className="value-display">{settings.borderWidth}px</span>
                </div>
                <div className="property-row">
                  <PropertyLabel label="Player Color" tooltip="Cor do marcador do player no minimap" />
                  <div className="color-input">
                    <input
                      type="color"
                      value={settings.playerColor}
                      onChange={(e) => handleChange('playerColor', e.target.value)}
                    />
                    <span className="color-hex">{settings.playerColor}</span>
                  </div>
                </div>
                <div className="property-row">
                  <PropertyLabel label="Player Size" tooltip="Tamanho do marcador do player em pixels" />
                  <input
                    type="range"
                    min="4"
                    max="16"
                    value={settings.playerSize}
                    onChange={(e) => handleChange('playerSize', parseInt(e.target.value))}
                  />
                  <span className="value-display">{settings.playerSize}px</span>
                </div>
                <div className="property-row checkbox-row">
                  <label title="Exibe uma seta indicando a direção que o player está olhando">
                    <input
                      type="checkbox"
                      checked={settings.showPlayerDirection}
                      onChange={(e) => handleChange('showPlayerDirection', e.target.checked)}
                    />
                    <span className="checkbox-text">Show Player Direction</span>
                    <span className="guide-icon small">?</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* MARCADORES */}
          <div className="subsection">
            <div
              className="subsection-header"
              onClick={() => toggleSection('markers')}
            >
              <span className={`arrow ${expandedSections.markers ? 'expanded' : ''}`}>▶</span>
              Markers
            </div>
            {expandedSections.markers && (
              <div className="subsection-content">
                <div className="property-row checkbox-row">
                  <label title="Exibe objetos com tag 'enemy' no minimap (triângulos)">
                    <input
                      type="checkbox"
                      checked={settings.showEnemies}
                      onChange={(e) => handleChange('showEnemies', e.target.checked)}
                    />
                    <span className="checkbox-text">Show Enemies</span>
                    <span className="guide-icon small">?</span>
                  </label>
                  <input
                    type="color"
                    value={settings.markerColors?.enemy || '#ff0000'}
                    onChange={(e) => handleChange('markerColors.enemy', e.target.value)}
                    style={{ width: '30px', marginLeft: 'auto' }}
                  />
                </div>
                <div className="property-row checkbox-row">
                  <label title="Exibe objetos com tag 'item' no minimap (quadrados)">
                    <input
                      type="checkbox"
                      checked={settings.showItems}
                      onChange={(e) => handleChange('showItems', e.target.checked)}
                    />
                    <span className="checkbox-text">Show Items</span>
                    <span className="guide-icon small">?</span>
                  </label>
                  <input
                    type="color"
                    value={settings.markerColors?.item || '#ffff00'}
                    onChange={(e) => handleChange('markerColors.item', e.target.value)}
                    style={{ width: '30px', marginLeft: 'auto' }}
                  />
                </div>
                <div className="property-row checkbox-row">
                  <label title="Exibe objetos com tag 'waypoint' no minimap (losangos)">
                    <input
                      type="checkbox"
                      checked={settings.showWaypoints}
                      onChange={(e) => handleChange('showWaypoints', e.target.checked)}
                    />
                    <span className="checkbox-text">Show Waypoints</span>
                    <span className="guide-icon small">?</span>
                  </label>
                  <input
                    type="color"
                    value={settings.markerColors?.waypoint || '#00ffff'}
                    onChange={(e) => handleChange('markerColors.waypoint', e.target.value)}
                    style={{ width: '30px', marginLeft: 'auto' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
