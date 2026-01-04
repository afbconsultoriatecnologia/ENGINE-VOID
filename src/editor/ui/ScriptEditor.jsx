import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import './ScriptEditor.css';

// Type definitions para IntelliSense da API engine.*
const ENGINE_TYPE_DEFS = `
declare global {
  /** ENGINE VOID Script API */
  const engine: {
    /** Object name */
    readonly name: string;
    /** Object visibility */
    visible: boolean;
    /** Custom user data */
    readonly userData: Record<string, any>;
    /** Object tag */
    tag: string;

    /** Transform API */
    readonly transform: {
      /** Position in world space */
      position: { x: number; y: number; z: number };
      /** Rotation in radians (Euler) */
      rotation: { x: number; y: number; z: number };
      /** Rotation in degrees */
      eulerAngles: { x: number; y: number; z: number };
      /** Scale */
      scale: { x: number; y: number; z: number };
      /** Forward direction (normalized) */
      readonly forward: { x: number; y: number; z: number };
      /** Right direction (normalized) */
      readonly right: { x: number; y: number; z: number };
      /** Up direction (normalized) */
      readonly up: { x: number; y: number; z: number };
      /** Translate in local space */
      translate(x: number, y: number, z: number): void;
      /** Translate in world space */
      translateWorld(x: number, y: number, z: number): void;
      /** Rotate by euler angles */
      rotate(x: number, y: number, z: number): void;
      /** Look at target position */
      lookAt(target: { x: number; y: number; z: number }): void;
      /** Get world position */
      getWorldPosition(): { x: number; y: number; z: number };
    };

    /** Input API */
    readonly input: {
      /** Check if key is currently pressed */
      getKey(keyCode: string): boolean;
      /** Check if key was pressed this frame */
      getKeyDown(keyCode: string): boolean;
      /** Check if key was released this frame */
      getKeyUp(keyCode: string): boolean;
      /** Check if mouse button is pressed (0=left, 1=middle, 2=right) */
      getMouseButton(button: number): boolean;
      /** Check if mouse button was pressed this frame */
      getMouseButtonDown(button: number): boolean;
      /** Mouse position in screen pixels */
      readonly mousePosition: { x: number; y: number };
      /** Mouse movement this frame */
      readonly mouseDelta: { x: number; y: number };
      /** Scroll wheel delta */
      readonly scrollDelta: number;
      /** Get axis value (-1 to 1). Axes: 'horizontal', 'vertical' */
      getAxis(axis: string): number;
    };

    /** Time API */
    readonly time: {
      /** Time since last frame (seconds) */
      readonly deltaTime: number;
      /** Fixed timestep for physics (1/60) */
      readonly fixedDeltaTime: number;
      /** Total time since game start (seconds) */
      readonly time: number;
      /** Total frames since game start */
      readonly frameCount: number;
      /** Current FPS */
      readonly fps: number;
      /** Time scale (1 = normal, 0.5 = slow, 2 = fast) */
      timeScale: number;
    };

    /** Find object by name */
    find(name: string): any | null;
    /** Find all objects with tag */
    findByTag(tag: string): any[];
    /** Distance to another object or position */
    distanceTo(other: any): number;
    /** Direction to another object (normalized) */
    directionTo(other: any): { x: number; y: number; z: number };

    /** Debug API */
    readonly debug: {
      drawLine(from: any, to: any, color?: number): void;
      drawRay(origin: any, direction: any, length?: number, color?: number): void;
      drawSphere(center: any, radius?: number, color?: number): void;
    };
  };

  /** Console (redirected to editor) */
  const console: {
    log(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    info(...args: any[]): void;
  };

  /** THREE.js Vector3 */
  class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
    copy(v: Vector3): this;
    add(v: Vector3): this;
    sub(v: Vector3): this;
    multiplyScalar(s: number): this;
    normalize(): this;
    length(): number;
    distanceTo(v: Vector3): number;
    clone(): Vector3;
  }

  /** THREE.js Color */
  class Color {
    constructor(r?: number, g?: number, b?: number);
    r: number;
    g: number;
    b: number;
    setHex(hex: number): this;
  }

  /** Math utilities */
  const MathUtils: {
    clamp(value: number, min: number, max: number): number;
    lerp(a: number, b: number, t: number): number;
    degToRad(degrees: number): number;
    radToDeg(radians: number): number;
    randFloat(min: number, max: number): number;
    randInt(min: number, max: number): number;
  };
}

// Lifecycle functions
/** Called once when game starts */
declare function start(): void;
/** Called every frame */
declare function update(deltaTime: number): void;
/** Called at fixed timestep (60fps) for physics */
declare function fixedUpdate(fixedDeltaTime: number): void;
/** Called when object is destroyed or game stops */
declare function onDestroy(): void;
/** Called when script is enabled */
declare function onEnable(): void;
/** Called when script is disabled */
declare function onDisable(): void;
/** Called when collision starts */
declare function onCollisionEnter(other: any): void;
/** Called when collision ends */
declare function onCollisionExit(other: any): void;

export {};
`;

/**
 * ScriptEditor - Editor de código Monaco integrado
 */
export default function ScriptEditor({
  scriptId,
  initialCode,
  language = 'javascript',
  onSave,
  onClose,
  onMinimize,
  onToggleMaximize,
  isMaximized = false,
  scriptManager
}) {
  const [code, setCode] = useState(initialCode || '');
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  // Configurar Monaco quando montar
  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configurar tema escuro
    monaco.editor.defineTheme('engine-void', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955' },
        { token: 'keyword', foreground: 'C586C0' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'type', foreground: '4EC9B0' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editor.lineHighlightBackground': '#2d2d2d',
        'editor.selectionBackground': '#264f78',
        'editorCursor.foreground': '#ffffff',
      }
    });
    monaco.editor.setTheme('engine-void');

    // Adicionar type definitions para IntelliSense
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      lib: ['es2020'],
    });

    // Adicionar definições da API
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      ENGINE_TYPE_DEFS,
      'file:///engine.d.ts'
    );

    // Atalho Ctrl+S para salvar
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });

    // Focar editor
    editor.focus();
  };

  // Validar código quando muda
  useEffect(() => {
    if (!scriptManager) return;

    const validation = scriptManager.validateScript(code);
    setValidationErrors(validation.errors);
  }, [code, scriptManager]);

  // Salvar
  const handleSave = () => {
    if (onSave) {
      onSave(code);
      setHasChanges(false);
    }
  };

  // Mudança no código
  const handleChange = (value) => {
    setCode(value);
    setHasChanges(true);
  };

  // Fechar (com confirmação se houver mudanças)
  const handleClose = () => {
    if (hasChanges) {
      const confirm = window.confirm('You have unsaved changes. Close anyway?');
      if (!confirm) return;
    }
    onClose?.();
  };

  // Formatar código
  const handleFormat = () => {
    editorRef.current?.getAction('editor.action.formatDocument')?.run();
  };

  return (
    <div className="script-editor">
      {/* Toolbar */}
      <div className="script-editor-toolbar">
        <div className="toolbar-left">
          <span className="script-name">
            {scriptId}
            {hasChanges && <span className="unsaved-dot">●</span>}
          </span>
          <span className="script-language">{language.toUpperCase()}</span>
        </div>
        <div className="toolbar-right">
          {validationErrors.length > 0 && (
            <span className="error-count">
              {validationErrors.length} error{validationErrors.length > 1 ? 's' : ''}
            </span>
          )}
          <button onClick={handleFormat} title="Format (Shift+Alt+F)">
            Format
          </button>
          <button
            onClick={handleSave}
            className={hasChanges ? 'primary' : ''}
            title="Save (Ctrl+S)"
          >
            Save
          </button>
          <button
            onClick={() => onMinimize?.({ scriptId, code, hasChanges })}
            className="minimize-btn"
            title="Minimize"
          >
            ─
          </button>
          <button
            onClick={() => onToggleMaximize?.()}
            className="maximize-btn"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? '❐' : '□'}
          </button>
          <button onClick={handleClose} className="close-btn" title="Close">
            ✕
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="script-editor-content">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={handleChange}
          onMount={handleEditorMount}
          options={{
            fontSize: 13,
            fontFamily: "'Consolas', 'Monaco', monospace",
            minimap: { enabled: true, scale: 0.8 },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            lineNumbers: 'on',
            glyphMargin: true,
            folding: true,
            bracketPairColorization: { enabled: true },
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false,
            },
          }}
        />
      </div>

      {/* Error panel */}
      {validationErrors.length > 0 && (
        <div className="script-editor-errors">
          <div className="errors-header">
            Errors ({validationErrors.length})
          </div>
          <div className="errors-list">
            {validationErrors.map((err, i) => (
              <div
                key={i}
                className="error-item"
                onClick={() => {
                  if (err.line && editorRef.current) {
                    editorRef.current.revealLineInCenter(err.line);
                    editorRef.current.setPosition({ lineNumber: err.line, column: 1 });
                    editorRef.current.focus();
                  }
                }}
              >
                <span className="error-icon">✕</span>
                <span className="error-line">
                  {err.line ? `Line ${err.line}:` : ''}
                </span>
                <span className="error-message">{err.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
