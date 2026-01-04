import { useState, useEffect } from 'react';
import './TransformOverlay.css';

/**
 * Overlay que mostra o modo de transformação atual (estilo Blender)
 * Exibe: modo (G/R/S), eixo restrito (X/Y/Z), plano, entrada numérica
 */
export default function TransformOverlay({ engine }) {
  const [transformState, setTransformState] = useState(null);

  useEffect(() => {
    if (!engine?.selectionController) return;

    // Registrar callback para atualizações
    engine.selectionController.onTransformUpdate = (state) => {
      setTransformState(state.mode ? state : null);
    };

    return () => {
      if (engine.selectionController) {
        engine.selectionController.onTransformUpdate = null;
      }
    };
  }, [engine]);

  if (!transformState) return null;

  const getModeLabel = () => {
    switch (transformState.mode) {
      case 'grab': return 'Grab';
      case 'rotate': return 'Rotate';
      case 'scale': return 'Scale';
      default: return '';
    }
  };

  const getModeIcon = () => {
    switch (transformState.mode) {
      case 'grab': return '✥';
      case 'rotate': return '↻';
      case 'scale': return '⤢';
      default: return '';
    }
  };

  const getAxisColor = (axis) => {
    switch (axis) {
      case 'x': return '#ff4444';
      case 'y': return '#44ff44';
      case 'z': return '#4444ff';
      default: return '#ffffff';
    }
  };

  const getConstraintLabel = () => {
    if (transformState.axis) {
      return transformState.axis.toUpperCase();
    }
    if (transformState.plane) {
      return transformState.plane.toUpperCase();
    }
    return null;
  };

  const constraintLabel = getConstraintLabel();

  return (
    <div className="transform-overlay">
      <div className="transform-mode">
        <span className="mode-icon">{getModeIcon()}</span>
        <span className="mode-label">{getModeLabel()}</span>

        {constraintLabel && (
          <span
            className="axis-label"
            style={{
              color: transformState.axis ? getAxisColor(transformState.axis) : '#ffffff',
              borderColor: transformState.axis ? getAxisColor(transformState.axis) : '#ffffff'
            }}
          >
            {constraintLabel}
          </span>
        )}
      </div>

      {transformState.numericInput && (
        <div className="numeric-input">
          <span className="input-value">{transformState.numericInput}</span>
          <span className="input-unit">
            {transformState.mode === 'rotate' ? '°' : transformState.mode === 'scale' ? 'x' : 'm'}
          </span>
        </div>
      )}

      <div className="transform-hint">
        <span>X Y Z</span> para eixo |
        <span> Shift+X Y Z</span> para plano |
        <span> Enter</span> confirmar |
        <span> Esc</span> cancelar
      </div>

      <div className="object-name">
        {transformState.objectName}
      </div>
    </div>
  );
}
