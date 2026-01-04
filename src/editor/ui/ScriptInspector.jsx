import React, { useState, useEffect, memo, useRef } from 'react';
import './ScriptInspector.css';

/**
 * ScriptInspector - Seção de scripts no Inspector Panel
 */
function ScriptInspectorInner({
  selectedObject,
  scriptManager,
  onOpenScriptEditor
}) {
  // Guardar referência estável do scriptManager
  const scriptManagerRef = useRef(scriptManager);
  scriptManagerRef.current = scriptManager;

  const [scripts, setScripts] = useState([]);
  const [availableScripts, setAvailableScripts] = useState([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [expandedScripts, setExpandedScripts] = useState(new Set());
  const [showNewScriptInput, setShowNewScriptInput] = useState(false);
  const [newScriptName, setNewScriptName] = useState('');

  // Carregar scripts do objeto (só depende de selectedObject)
  useEffect(() => {
    if (!selectedObject || !scriptManager) {
      setScripts([]);
      return;
    }

    loadObjectScripts();
    loadAvailableScripts();

    // Listener para mudanças
    const unsubscribe = scriptManager.addListener?.((event, data) => {
      if (data.object?.uuid === selectedObject.uuid) {
        loadObjectScripts();
      }
    });

    return () => unsubscribe?.();
  }, [selectedObject?.uuid]); // Só re-executa quando o objeto selecionado muda

  const loadObjectScripts = async () => {
    if (!selectedObject || !scriptManager) return;

    const objectScripts = selectedObject.userData.scripts || [];
    const scriptProperties = selectedObject.userData.scriptProperties || {};

    const loadedScripts = [];
    for (const scriptId of objectScripts) {
      try {
        const code = await scriptManager.getScriptCode(scriptId);
        const validation = scriptManager.validateScript(code);
        const properties = scriptManager.context.parseProperties(code);

        loadedScripts.push({
          scriptId,
          name: scriptId.split('_')[0] || scriptId,
          properties,
          values: scriptProperties[scriptId] || {},
          enabled: true,
          hasErrors: !validation.valid
        });
      } catch (error) {
        loadedScripts.push({
          scriptId,
          name: scriptId,
          properties: {},
          values: {},
          enabled: true,
          hasErrors: true,
          error: error.message
        });
      }
    }

    setScripts(loadedScripts);
  };

  const loadAvailableScripts = () => {
    if (!scriptManager) return;
    const available = scriptManager.getAvailableScripts();
    setAvailableScripts(available);
  };

  // Adicionar script ao objeto
  const handleAddScript = async (scriptId) => {
    if (!selectedObject || !scriptManager) return;

    await scriptManager.attachScript(selectedObject, scriptId);
    setShowAddMenu(false);
    setShowNewScriptInput(false);
    setNewScriptName('');
    loadObjectScripts();
  };

  // Criar novo script
  const handleCreateNewScript = () => {
    if (!newScriptName.trim() || !scriptManager) return;

    const { scriptId } = scriptManager.createScript(newScriptName.trim());
    handleAddScript(scriptId);
  };

  // Remover script do objeto
  const handleRemoveScript = (scriptId) => {
    if (!selectedObject || !scriptManager) return;

    scriptManager.detachScript(selectedObject, scriptId);
    loadObjectScripts();
  };

  // Atualizar propriedade do script
  const handlePropertyChange = (scriptId, propertyName, value) => {
    if (!selectedObject || !scriptManager) return;

    scriptManager.updateScriptProperty(selectedObject, scriptId, propertyName, value);
    loadObjectScripts();
  };

  // Toggle expandir/colapsar script
  const toggleExpanded = (scriptId) => {
    const newExpanded = new Set(expandedScripts);
    if (newExpanded.has(scriptId)) {
      newExpanded.delete(scriptId);
    } else {
      newExpanded.add(scriptId);
    }
    setExpandedScripts(newExpanded);
  };

  // Renderizar input de propriedade
  const renderPropertyInput = (script, propName, propDef) => {
    const value = script.values[propName] ?? propDef.default;
    const { type, options } = propDef;

    switch (type) {
      case 'number':
        return (
          <input
            type="number"
            value={value}
            min={options?.min}
            max={options?.max}
            step={options?.step || 0.1}
            onChange={(e) => handlePropertyChange(
              script.scriptId,
              propName,
              parseFloat(e.target.value) || 0
            )}
          />
        );

      case 'string':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handlePropertyChange(
              script.scriptId,
              propName,
              e.target.value
            )}
          />
        );

      case 'boolean':
        return (
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => handlePropertyChange(
              script.scriptId,
              propName,
              e.target.checked
            )}
          />
        );

      case 'vector3':
        return (
          <div className="vector3-input">
            <input
              type="number"
              value={value?.x || 0}
              step="0.1"
              onChange={(e) => handlePropertyChange(
                script.scriptId,
                propName,
                { ...value, x: parseFloat(e.target.value) || 0 }
              )}
            />
            <input
              type="number"
              value={value?.y || 0}
              step="0.1"
              onChange={(e) => handlePropertyChange(
                script.scriptId,
                propName,
                { ...value, y: parseFloat(e.target.value) || 0 }
              )}
            />
            <input
              type="number"
              value={value?.z || 0}
              step="0.1"
              onChange={(e) => handlePropertyChange(
                script.scriptId,
                propName,
                { ...value, z: parseFloat(e.target.value) || 0 }
              )}
            />
          </div>
        );

      case 'color':
        const hexColor = value
          ? `#${Math.round(value.r * 255).toString(16).padStart(2, '0')}${Math.round(value.g * 255).toString(16).padStart(2, '0')}${Math.round(value.b * 255).toString(16).padStart(2, '0')}`
          : '#ffffff';
        return (
          <input
            type="color"
            value={hexColor}
            onChange={(e) => {
              const hex = e.target.value;
              handlePropertyChange(script.scriptId, propName, {
                r: parseInt(hex.slice(1, 3), 16) / 255,
                g: parseInt(hex.slice(3, 5), 16) / 255,
                b: parseInt(hex.slice(5, 7), 16) / 255
              });
            }}
          />
        );

      default:
        return (
          <input
            type="text"
            value={JSON.stringify(value)}
            onChange={(e) => {
              try {
                handlePropertyChange(script.scriptId, propName, JSON.parse(e.target.value));
              } catch {
                // Ignorar JSON inválido
              }
            }}
          />
        );
    }
  };

  if (!selectedObject) return null;

  return (
    <div className="script-inspector">
      {/* Header */}
      <div className="script-header">
        <h4>Scripts</h4>
        <button
          className="add-script-btn"
          onClick={() => setShowAddMenu(!showAddMenu)}
          title="Add Script"
        >
          +
        </button>
      </div>

      {/* Menu de adicionar script */}
      {showAddMenu && (
        <div className="add-script-menu">
          <div className="menu-header">Add Script</div>
          <div className="script-list">
            {availableScripts.map(script => (
              <div
                key={script.id}
                className="script-option"
                onClick={() => handleAddScript(script.id)}
              >
                <span className="script-name">{script.name}</span>
                <span className="script-source">{script.source}</span>
              </div>
            ))}
          </div>
          <div className="menu-footer">
            {showNewScriptInput ? (
              <div className="new-script-input">
                <input
                  type="text"
                  placeholder="Script name..."
                  value={newScriptName}
                  onChange={(e) => setNewScriptName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateNewScript();
                    if (e.key === 'Escape') {
                      setShowNewScriptInput(false);
                      setNewScriptName('');
                    }
                  }}
                  autoFocus
                />
                <button onClick={handleCreateNewScript} className="confirm-btn">✓</button>
                <button onClick={() => { setShowNewScriptInput(false); setNewScriptName(''); }} className="cancel-btn">✕</button>
              </div>
            ) : (
              <button
                className="create-new-btn"
                onClick={() => setShowNewScriptInput(true)}
              >
                + Create New Script
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lista de scripts anexados */}
      <div className="attached-scripts">
        {scripts.length === 0 ? (
          <div className="no-scripts">
            No scripts attached.
            <br />
            Click + to add a script.
          </div>
        ) : (
          scripts.map(script => (
            <div
              key={script.scriptId}
              className={`script-item ${script.hasErrors ? 'has-error' : ''}`}
            >
              {/* Script header */}
              <div className="script-item-header">
                <button
                  className="expand-btn"
                  onClick={() => toggleExpanded(script.scriptId)}
                >
                  {expandedScripts.has(script.scriptId) ? '▼' : '▶'}
                </button>
                <span className="script-name">{script.name}</span>
                {script.hasErrors && <span className="error-badge">!</span>}
                <div className="script-actions">
                  <button
                    className="edit-btn"
                    onClick={() => onOpenScriptEditor?.(script.scriptId)}
                    title="Edit Script"
                  >
                    ✎
                  </button>
                  <button
                    className="remove-btn"
                    onClick={() => handleRemoveScript(script.scriptId)}
                    title="Remove Script"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Script properties */}
              {expandedScripts.has(script.scriptId) && (
                <div className="script-properties">
                  {script.error ? (
                    <div className="script-error">{script.error}</div>
                  ) : Object.keys(script.properties).length === 0 ? (
                    <div className="no-properties">No properties defined</div>
                  ) : (
                    Object.entries(script.properties).map(([name, def]) => (
                      <div key={name} className="script-property-row">
                        <label>{name}</label>
                        {renderPropertyInput(script, name, def)}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Memoizar para evitar re-renders do polling de transform
const ScriptInspector = memo(ScriptInspectorInner, (prevProps, nextProps) => {
  // Retorna true se NÃO deve re-renderizar
  return prevProps.selectedObject?.uuid === nextProps.selectedObject?.uuid;
});

export default ScriptInspector;
