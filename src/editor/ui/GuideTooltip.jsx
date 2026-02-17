import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Tooltip renderizado via portal no body — escapa overflow dos containers
 */
function Tooltip({ text, anchorRef }) {
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      top: rect.top + rect.height / 2,
      right: window.innerWidth - rect.left + 8
    });
  }, [anchorRef]);

  if (!pos) return null;

  return createPortal(
    <div className="guide-tooltip" style={{ top: pos.top, right: pos.right, transform: 'translateY(-50%)' }}>
      {text}
    </div>,
    document.body
  );
}

/**
 * GuideIcon — ícone "?" com tooltip via portal
 */
export function GuideIcon({ tooltip }) {
  const [show, setShow] = useState(false);
  const iconRef = useRef(null);

  if (!tooltip) return null;

  return (
    <>
      <span
        ref={iconRef}
        className="guide-icon small"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >?</span>
      {show && <Tooltip text={tooltip} anchorRef={iconRef} />}
    </>
  );
}

/**
 * PropertyLabel — label com ícone "?" e tooltip
 */
export function PropertyLabel({ label, tooltip }) {
  return (
    <label>
      {label}
      {tooltip && <GuideIcon tooltip={tooltip} />}
    </label>
  );
}
