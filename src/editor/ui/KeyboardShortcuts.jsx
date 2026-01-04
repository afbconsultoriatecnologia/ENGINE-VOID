import { useState, useEffect } from 'react';
import './KeyboardShortcuts.css';

/**
 * Seção colapsável do guia
 */
function GuideSection({ title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`guide-section ${isOpen ? 'open' : ''}`}>
      <button className="section-toggle" onClick={() => setIsOpen(!isOpen)}>
        <span className="toggle-icon">{isOpen ? '▼' : '▶'}</span>
        <span className="section-title">{title}</span>
      </button>
      {isOpen && <div className="section-content">{children}</div>}
    </div>
  );
}

/**
 * Subcategoria dentro de uma seção
 */
function ShortcutGroup({ title, description, items }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`shortcut-group ${isOpen ? 'open' : ''}`}>
      <button className="group-toggle" onClick={() => setIsOpen(!isOpen)}>
        <span className="toggle-icon small">{isOpen ? '−' : '+'}</span>
        <span>{title}</span>
      </button>
      {isOpen && (
        <div className="group-content">
          {description && <p className="group-description">{description}</p>}
          <ul>
            {items.map((item) => (
              <li key={item.action}>
                <span className="action">{item.action}</span>
                <span className="shortcut">{item.shortcut}</span>
                {item.hint && <span className="hint">{item.hint}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Componente de Guia do Editor
 * Contém atalhos de teclado, dicas e informações úteis
 */
export default function KeyboardShortcuts({ inputManager }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    const mac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    setIsMac(mac);
  }, []);

  const formatShortcut = (shortcut) => {
    if (isMac) {
      return shortcut
        .replace('Ctrl', '⌘')
        .replace('Alt', '⌥')
        .replace('Shift', '⇧')
        .replace('Delete', '⌫')
        .replace(/\+/g, '');
    }
    return shortcut;
  };

  // Atalhos organizados por categoria
  const shortcutGroups = {
    transform: [
      {
        title: 'Transformação (Blender)',
        description: 'Selecione um objeto e use:',
        items: [
          { action: 'Selecionar', shortcut: 'Q', hint: 'Volta ao modo de seleção' },
          { action: 'Mover (Grab)', shortcut: 'G', hint: 'Ativa modo de movimento' },
          { action: 'Rotacionar', shortcut: 'R', hint: 'Ativa modo de rotação' },
          { action: 'Escalar', shortcut: 'S', hint: 'Ativa modo de escala' },
          { action: 'Confirmar', shortcut: 'Enter / Clique', hint: 'Aplica a transformação' },
          { action: 'Cancelar', shortcut: 'Esc / Q', hint: 'Restaura valores originais' },
        ]
      },
      {
        title: 'Restrição de Eixo',
        description: 'Durante G/R/S, pressione:',
        items: [
          { action: 'Eixo X', shortcut: 'X', hint: 'Restringe ao eixo X (vermelho)' },
          { action: 'Eixo Y', shortcut: 'Y', hint: 'Restringe ao eixo Y (verde)' },
          { action: 'Eixo Z', shortcut: 'Z', hint: 'Restringe ao eixo Z (azul)' },
          { action: 'Plano YZ', shortcut: formatShortcut('Shift+X'), hint: 'Exclui eixo X' },
          { action: 'Plano XZ', shortcut: formatShortcut('Shift+Y'), hint: 'Exclui eixo Y' },
          { action: 'Plano XY', shortcut: formatShortcut('Shift+Z'), hint: 'Exclui eixo Z' },
        ]
      },
      {
        title: 'Entrada Numérica',
        description: 'Durante G/R/S, digite:',
        items: [
          { action: 'Valor', shortcut: '0-9', hint: 'Ex: G → X → 5 → Enter' },
          { action: 'Decimal', shortcut: '.', hint: 'Ex: 2.5 unidades' },
          { action: 'Negativo', shortcut: '-', hint: 'Ex: -90 graus' },
          { action: 'Apagar', shortcut: 'Backspace', hint: 'Remove último dígito' },
        ]
      },
      {
        title: 'Reset & Snap',
        items: [
          { action: 'Reset Tudo', shortcut: formatShortcut('Alt+R'), hint: 'Reseta posição, rotação e escala' },
          { action: 'Reset Posição', shortcut: formatShortcut('Alt+G'), hint: 'Move para origem (0,0,0)' },
          { action: 'Reset Escala', shortcut: formatShortcut('Alt+S'), hint: 'Escala para (1,1,1)' },
          { action: 'Local/World', shortcut: 'P', hint: 'Alterna espaço de transformação' },
        ]
      },
      {
        title: 'Copiar Transform',
        items: [
          { action: 'Copiar', shortcut: formatShortcut('Ctrl+C'), hint: 'Copia transform do objeto' },
          { action: 'Colar', shortcut: formatShortcut('Ctrl+V'), hint: 'Cola transform completo' },
          { action: 'Colar Posição', shortcut: formatShortcut('Ctrl+Shift+V'), hint: 'Cola apenas posição' },
        ]
      },
    ],
    objects: [
      {
        title: 'Seleção',
        items: [
          { action: 'Selecionar', shortcut: 'Clique', hint: 'Seleciona um objeto' },
          { action: 'Multi-seleção', shortcut: formatShortcut('Shift+Clique'), hint: 'Adiciona/remove da seleção' },
          { action: 'Selecionar Tudo', shortcut: formatShortcut('Ctrl+A'), hint: 'Seleciona todos os objetos' },
          { action: 'Deselecionar', shortcut: 'Esc', hint: 'Remove seleção' },
          { action: 'Focar', shortcut: 'F', hint: 'Centraliza câmera no objeto' },
        ]
      },
      {
        title: 'Edição',
        items: [
          { action: 'Deletar', shortcut: isMac ? '⌫ / Delete' : 'Delete', hint: 'Remove objeto selecionado' },
          { action: 'Duplicar', shortcut: formatShortcut('Ctrl+D'), hint: 'Cria cópia do objeto' },
        ]
      },
      {
        title: 'Histórico',
        items: [
          { action: 'Desfazer', shortcut: formatShortcut('Ctrl+Z'), hint: 'Volta ação anterior' },
          { action: 'Refazer', shortcut: isMac ? '⌘⇧Z' : 'Ctrl+Y', hint: 'Refaz ação desfeita' },
        ]
      },
    ],
    camera: [
      {
        title: 'Mouse',
        items: [
          { action: 'Orbitar', shortcut: 'Arrastar', hint: 'Gira ao redor da cena' },
          { action: 'Pan', shortcut: formatShortcut('Shift+Arrastar'), hint: 'Move a câmera lateralmente' },
          { action: 'Zoom', shortcut: 'Scroll', hint: 'Aproxima/afasta' },
        ]
      },
      {
        title: 'Touch',
        description: 'Gestos para tela touch:',
        items: [
          { action: 'Orbitar', shortcut: '1 dedo', hint: 'Arraste para girar' },
          { action: 'Pan + Zoom', shortcut: '2 dedos', hint: 'Arraste para pan, pinça para zoom' },
          { action: 'Selecionar', shortcut: 'Toque', hint: 'Toque para selecionar' },
        ]
      },
      {
        title: 'Trackpad (Mac)',
        items: [
          { action: 'Orbitar', shortcut: '1 dedo', hint: 'Arraste para girar' },
          { action: 'Pan', shortcut: '2 dedos scroll', hint: 'Scroll com dois dedos' },
          { action: 'Zoom', shortcut: 'Pinça', hint: 'Aproxime/afaste dois dedos' },
        ]
      },
    ],
  };

  return (
    <div className="guide-container">
      <button
        className="guide-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Guia do Editor"
      >
        ?
      </button>

      {isOpen && (
        <div className="guide-panel">
          <div className="guide-header">
            <h3>Guia do Editor</h3>
            <span className="platform-badge">{isMac ? 'Mac' : 'Windows'}</span>
            <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
          </div>

          <div className="guide-content">
            {/* Funcionalidades */}
            <GuideSection title="Funcionalidades" defaultOpen={true}>
              <div className="features-section">
                <div className="feature-group">
                  <h5>Transformação</h5>
                  <ul className="feature-list">
                    <li>
                      <span className="feature-name">Mover / Rotacionar / Escalar</span>
                      <span className="feature-access">Gizmo ou teclas G/R/S</span>
                    </li>
                    <li>
                      <span className="feature-name">Restrição de eixo</span>
                      <span className="feature-access">X/Y/Z durante transform</span>
                    </li>
                    <li>
                      <span className="feature-name">Entrada numérica</span>
                      <span className="feature-access">Digite valores durante G/R/S</span>
                    </li>
                    <li>
                      <span className="feature-name">Local / World Space</span>
                      <span className="feature-access">Tecla P ou botão no Inspector</span>
                    </li>
                  </ul>
                </div>

                <div className="feature-group">
                  <h5>Snap & Reset</h5>
                  <ul className="feature-list">
                    <li>
                      <span className="feature-name">Snap to Grid</span>
                      <span className="feature-access">Botão Grid no Inspector</span>
                    </li>
                    <li>
                      <span className="feature-name">Snap de Rotação</span>
                      <span className="feature-access">Botão Rot no Inspector (15°)</span>
                    </li>
                    <li>
                      <span className="feature-name">Snap to Floor</span>
                      <span className="feature-access">Botão Floor (apoia no Y=0)</span>
                    </li>
                    <li>
                      <span className="feature-name">Center to Origin</span>
                      <span className="feature-access">Botão Center (X=0, Z=0)</span>
                    </li>
                    <li>
                      <span className="feature-name">Reset Transform</span>
                      <span className="feature-access">{formatShortcut('Alt+R')} ou botões Reset</span>
                    </li>
                    <li>
                      <span className="feature-name">Reset Position</span>
                      <span className="feature-access">{formatShortcut('Alt+G')} ou botão Pos</span>
                    </li>
                    <li>
                      <span className="feature-name">Reset Scale</span>
                      <span className="feature-access">{formatShortcut('Alt+S')} ou botão Scale</span>
                    </li>
                  </ul>
                </div>

                <div className="feature-group">
                  <h5>Copiar & Colar</h5>
                  <ul className="feature-list">
                    <li>
                      <span className="feature-name">Copiar Transform</span>
                      <span className="feature-access">{formatShortcut('Ctrl+C')} ou botão Copy</span>
                    </li>
                    <li>
                      <span className="feature-name">Colar Transform</span>
                      <span className="feature-access">{formatShortcut('Ctrl+V')} ou botão Paste</span>
                    </li>
                    <li>
                      <span className="feature-name">Colar só Posição</span>
                      <span className="feature-access">{formatShortcut('Ctrl+Shift+V')}</span>
                    </li>
                    <li>
                      <span className="feature-name">Duplicar Objeto</span>
                      <span className="feature-access">{formatShortcut('Ctrl+D')}</span>
                    </li>
                  </ul>
                </div>

                <div className="feature-group">
                  <h5>Multi-seleção (2+ objetos)</h5>
                  <ul className="feature-list">
                    <li>
                      <span className="feature-name">Selecionar múltiplos</span>
                      <span className="feature-access">{formatShortcut('Shift+Clique')}</span>
                    </li>
                    <li>
                      <span className="feature-name">Selecionar todos</span>
                      <span className="feature-access">{formatShortcut('Ctrl+A')}</span>
                    </li>
                    <li>
                      <span className="feature-name">Alinhar X (esquerda/centro/direita)</span>
                      <span className="feature-access">Botões ← | → no Inspector</span>
                    </li>
                    <li>
                      <span className="feature-name">Alinhar Y (baixo/centro/cima)</span>
                      <span className="feature-access">Botões ↓ ─ ↑ no Inspector</span>
                    </li>
                    <li>
                      <span className="feature-name">Alinhar Z (frente/centro/trás)</span>
                      <span className="feature-access">Botões no Inspector</span>
                    </li>
                  </ul>
                </div>

                <div className="feature-group">
                  <h5>Distribuir (3+ objetos)</h5>
                  <ul className="feature-list">
                    <li>
                      <span className="feature-name">Distribuir Horizontal</span>
                      <span className="feature-access">Botão X no Inspector</span>
                    </li>
                    <li>
                      <span className="feature-name">Distribuir Vertical</span>
                      <span className="feature-access">Botão Y no Inspector</span>
                    </li>
                    <li>
                      <span className="feature-name">Distribuir Profundidade</span>
                      <span className="feature-access">Botão Z no Inspector</span>
                    </li>
                  </ul>
                </div>

                <div className="feature-group">
                  <h5>Câmera & Navegação</h5>
                  <ul className="feature-list">
                    <li>
                      <span className="feature-name">Orbitar</span>
                      <span className="feature-access">Arrastar mouse / 1 dedo</span>
                    </li>
                    <li>
                      <span className="feature-name">Pan</span>
                      <span className="feature-access">{formatShortcut('Shift+Arrastar')} / 2 dedos</span>
                    </li>
                    <li>
                      <span className="feature-name">Zoom</span>
                      <span className="feature-access">Scroll / Pinça</span>
                    </li>
                    <li>
                      <span className="feature-name">Focar no objeto</span>
                      <span className="feature-access">Tecla F</span>
                    </li>
                  </ul>
                </div>

                <div className="feature-group">
                  <h5>Edição</h5>
                  <ul className="feature-list">
                    <li>
                      <span className="feature-name">Deletar objeto</span>
                      <span className="feature-access">{isMac ? '⌫ Delete' : 'Delete'}</span>
                    </li>
                    <li>
                      <span className="feature-name">Desfazer</span>
                      <span className="feature-access">{formatShortcut('Ctrl+Z')}</span>
                    </li>
                    <li>
                      <span className="feature-name">Refazer</span>
                      <span className="feature-access">{isMac ? '⌘⇧Z' : 'Ctrl+Y'}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </GuideSection>

            {/* Atalhos de Teclado */}
            <GuideSection title="Atalhos de Teclado">
              <div className="shortcuts-section">
                <h5>Transformação</h5>
                {shortcutGroups.transform.map((group) => (
                  <ShortcutGroup key={group.title} {...group} />
                ))}
              </div>

              <div className="shortcuts-section">
                <h5>Objetos</h5>
                {shortcutGroups.objects.map((group) => (
                  <ShortcutGroup key={group.title} {...group} />
                ))}
              </div>

              <div className="shortcuts-section">
                <h5>Câmera</h5>
                {shortcutGroups.camera.map((group) => (
                  <ShortcutGroup key={group.title} {...group} />
                ))}
              </div>
            </GuideSection>

            {/* Iluminação */}
            <GuideSection title="Iluminação">
              <div className="info-content">
                <p>Adicione luzes pelo painel <strong>Project → Lights</strong> (inferior).</p>

                <div className="lights-guide">
                  <div className="light-item">
                    <span className="light-icon">💡</span>
                    <div className="light-info">
                      <strong>Point Light</strong>
                      <p>Emite luz em todas as direções como uma lâmpada. Tem alcance (distance) e decaimento (decay).</p>
                      <span className="light-use">Uso: Lâmpadas, velas, tochas, fogueiras</span>
                      <span className="light-shadow">✅ Sombras</span>
                    </div>
                  </div>

                  <div className="light-item">
                    <span className="light-icon">☀</span>
                    <div className="light-info">
                      <strong>Directional Light</strong>
                      <p>Raios paralelos como o sol. Ilumina toda a cena de uma direção. A posição define a direção.</p>
                      <span className="light-use">Uso: Sol, lua, iluminação externa</span>
                      <span className="light-shadow">✅ Sombras</span>
                    </div>
                  </div>

                  <div className="light-item">
                    <span className="light-icon">🔦</span>
                    <div className="light-info">
                      <strong>Spot Light</strong>
                      <p>Cone de luz focado. Tem ângulo (angle) e suavidade da borda (penumbra).</p>
                      <span className="light-use">Uso: Holofotes, lanternas, faróis, palco</span>
                      <span className="light-shadow">✅ Sombras</span>
                    </div>
                  </div>

                  <div className="light-item">
                    <span className="light-icon">◌</span>
                    <div className="light-info">
                      <strong>Ambient Light</strong>
                      <p>Ilumina todos os objetos igualmente. Simula luz indireta/refletida do ambiente.</p>
                      <span className="light-use">Uso: Luz base, preenchimento, ambientes internos</span>
                      <span className="light-shadow">❌ Sem sombras</span>
                    </div>
                  </div>

                  <div className="light-item">
                    <span className="light-icon">🌓</span>
                    <div className="light-info">
                      <strong>Hemisphere Light</strong>
                      <p>Gradiente de duas cores: céu (cima) e terra (baixo). Iluminação natural realista.</p>
                      <span className="light-use">Uso: Céu aberto, ambientes externos naturais</span>
                      <span className="light-shadow">❌ Sem sombras</span>
                    </div>
                  </div>

                  <div className="light-item">
                    <span className="light-icon">▭</span>
                    <div className="light-info">
                      <strong>Rect Area Light</strong>
                      <p>Área retangular emissora. Luz suave e difusa com largura e altura configuráveis.</p>
                      <span className="light-use">Uso: Janelas, TVs, painéis LED, soft boxes</span>
                      <span className="light-shadow">❌ Sem sombras (requer MeshStandardMaterial)</span>
                    </div>
                  </div>
                </div>

                <p><strong>Dicas de Iluminação:</strong></p>
                <ul>
                  <li><strong>Combinação básica:</strong> Ambient (0.3-0.5) + Directional (0.8-1.0) para cenas externas</li>
                  <li><strong>Interno realista:</strong> Ambient baixo + Point Lights onde há lâmpadas</li>
                  <li><strong>Parentear luz:</strong> Arraste luz para dentro de objeto na Hierarchy para seguir o objeto</li>
                  <li><strong>Performance:</strong> Cada luz com sombra custa renderização. Use com moderação.</li>
                </ul>
              </div>
            </GuideSection>

            {/* Painel Inspector */}
            <GuideSection title="Painel Inspector">
              <div className="info-content">
                <p>O Inspector aparece à direita quando um objeto está selecionado.</p>

                <p><strong>Transform Settings (topo):</strong></p>
                <ul>
                  <li><strong>World / Local</strong> - Alterna espaço de transformação. World usa eixos globais, Local usa eixos do objeto</li>
                  <li><strong>Grid</strong> - Ativa snap de posição. Clique para toggle, valor configurável abaixo</li>
                  <li><strong>Rot</strong> - Ativa snap de rotação (padrão 15°). Útil para rotações precisas</li>
                </ul>

                <p><strong>Transform (Position/Rotation/Scale):</strong></p>
                <ul>
                  <li>Campos numéricos editáveis para cada eixo X, Y, Z</li>
                  <li>Cores: <span style={{color: '#f44336'}}>X vermelho</span>, <span style={{color: '#4caf50'}}>Y verde</span>, <span style={{color: '#2196f3'}}>Z azul</span></li>
                </ul>

                <p><strong>Ações de Transform:</strong></p>
                <ul>
                  <li><strong>Reset</strong> - All (tudo), Pos (posição→0), Rot (rotação→0), Scale (escala→1)</li>
                  <li><strong>Snap</strong> - Floor (apoia no chão Y=0), Center (centraliza em X=0, Z=0)</li>
                  <li><strong>Copy/Paste</strong> - Copia transform e cola em outros objetos</li>
                </ul>

                <p><strong>Multi-seleção (aparece com 2+ objetos):</strong></p>
                <ul>
                  <li><strong>Align X/Y/Z</strong> - Alinha por min (←↓), centro (|─), max (→↑)</li>
                  <li><strong>Distribute</strong> - Espaça uniformemente (precisa 3+ objetos)</li>
                </ul>

                <p><strong>Material (se objeto tiver):</strong></p>
                <ul>
                  <li>Color, Metalness, Roughness, Opacity</li>
                  <li>Wireframe, Flat Shading, Transparent</li>
                </ul>
              </div>
            </GuideSection>

            {/* Layout do Editor */}
            <GuideSection title="Layout do Editor">
              <div className="info-content">
                <p><strong>Painéis Redimensionáveis:</strong></p>
                <ul>
                  <li>Arraste a borda entre os painéis para redimensionar</li>
                  <li><strong>Hierarchy</strong> - Borda direita (150px - 400px)</li>
                  <li><strong>Inspector</strong> - Borda esquerda (200px - 500px)</li>
                  <li><strong>Project</strong> - Borda superior (100px - 400px)</li>
                </ul>

                <p><strong>Esconder/Mostrar Painéis:</strong></p>
                <ul>
                  <li><strong>☰</strong> - Toggle Hierarchy (lista de objetos)</li>
                  <li><strong>⚙</strong> - Toggle Inspector (propriedades)</li>
                  <li><strong>📁</strong> - Toggle Project (assets)</li>
                  <li>Botões ficam na toolbar à direita</li>
                  <li>Quando painel está fechado, botão aparece no Scene View para reabrir</li>
                </ul>

                <p><strong>Toolbar (barra superior):</strong></p>
                <ul>
                  <li><strong>Dev/Game</strong> - Alterna modo de edição/jogo</li>
                  <li><strong>Ferramentas</strong> - Select, Move, Rotate, Scale</li>
                  <li><strong>Undo/Redo</strong> - Histórico de ações</li>
                  <li><strong>☀ Ciclo Solar</strong> - Anima posição do sol</li>
                  <li><strong>💾 📂</strong> - Salvar/Carregar cena</li>
                  <li><strong>🎨</strong> - Configurações de céu e nuvens</li>
                </ul>
              </div>
            </GuideSection>

            {/* Save/Load e Assets */}
            <GuideSection title="Arquivos & Assets">
              <div className="info-content">
                <p><strong>Salvar/Carregar Cena:</strong></p>
                <ul>
                  <li><strong>💾 Salvar</strong> - Abre diálogo para escolher onde salvar (.json)</li>
                  <li><strong>📂 Carregar</strong> - Abre diálogo para escolher arquivo (.json)</li>
                  <li>Salva: objetos, luzes, materiais, transforms, céu, nuvens</li>
                  <li>Modelos 3D importados são salvos com caminho do arquivo</li>
                </ul>

                <p><strong>Project Panel (painel inferior):</strong></p>
                <ul>
                  <li><strong>Assets</strong> - Navegador de arquivos virtual</li>
                  <li><strong>Primitives</strong> - Criar objetos básicos (Box, Sphere, etc)</li>
                  <li><strong>Lights</strong> - Adicionar luzes à cena</li>
                </ul>

                <p><strong>Importar Modelos 3D:</strong></p>
                <ul>
                  <li>Clique em <strong>Importar</strong> no Project Panel</li>
                  <li>Formatos: GLTF, GLB, OBJ, FBX</li>
                  <li>Modelo é adicionado à pasta atual e pode ser arrastado para a cena</li>
                </ul>

                <p><strong>Organizar Assets:</strong></p>
                <ul>
                  <li><strong>Criar pasta</strong> - Botão + no Project Panel</li>
                  <li><strong>Mover arquivo</strong> - Arraste para outra pasta</li>
                  <li><strong>Deletar</strong> - Botão X no item</li>
                  <li><strong>Navegar</strong> - Clique nas pastas ou use breadcrumb</li>
                </ul>
              </div>
            </GuideSection>

            {/* Céu e Ambiente */}
            <GuideSection title="Céu & Ambiente">
              <div className="info-content">
                <p>Acesse clicando em <strong>🎨</strong> na toolbar.</p>

                <p><strong>Background:</strong></p>
                <ul>
                  <li><strong>Color</strong> - Cor sólida de fundo</li>
                  <li><strong>Sky</strong> - Céu procedural realista</li>
                </ul>

                <p><strong>Sky (céu procedural):</strong></p>
                <ul>
                  <li><strong>Turbidity</strong> - Névoa/partículas no ar (2-10)</li>
                  <li><strong>Rayleigh</strong> - Dispersão da luz (azul do céu)</li>
                  <li><strong>Mie Coefficient</strong> - Brilho ao redor do sol</li>
                  <li><strong>Elevation</strong> - Altura do sol (0° = horizonte, 90° = zênite)</li>
                  <li><strong>Azimuth</strong> - Direção do sol (0-360°)</li>
                  <li><strong>Exposure</strong> - Brilho geral do céu</li>
                </ul>

                <p><strong>Clouds (nuvens):</strong></p>
                <ul>
                  <li><strong>Enable</strong> - Liga/desliga sistema de nuvens</li>
                  <li><strong>Height</strong> - Altura das nuvens</li>
                  <li><strong>Opacity</strong> - Transparência das nuvens</li>
                  <li><strong>Speed</strong> - Velocidade de movimento</li>
                </ul>

                <p><strong>Ciclo Solar (☀ na toolbar):</strong></p>
                <ul>
                  <li>Anima automaticamente a posição do sol</li>
                  <li>Slider controla velocidade (0.1x - 5x)</li>
                  <li>Afeta Directional Light e Sky simultaneamente</li>
                </ul>
              </div>
            </GuideSection>

            {/* Hierarchy Panel */}
            <GuideSection title="Hierarchy Panel">
              <div className="info-content">
                <p>Painel esquerdo com lista de objetos da cena.</p>

                <p><strong>Objetos:</strong></p>
                <ul>
                  <li><strong>Clique</strong> - Seleciona objeto</li>
                  <li><strong>Shift+Clique</strong> - Multi-seleção</li>
                  <li><strong>Duplo clique</strong> - Renomear objeto</li>
                  <li><strong>🔒</strong> - Objeto travado (não pode ser selecionado/movido)</li>
                  <li><strong>+ Adicionar</strong> - Menu para criar novos objetos</li>
                </ul>

                <p><strong>Luzes:</strong></p>
                <ul>
                  <li>Listadas separadamente abaixo dos objetos</li>
                  <li>Ícones indicam o tipo de luz</li>
                  <li><strong>+ Adicionar</strong> - Menu para criar novas luzes</li>
                </ul>

                <p><strong>Objetos Travados (Lock):</strong></p>
                <ul>
                  <li>Floor vem travado por padrão</li>
                  <li>Objetos travados não podem ser selecionados clicando na cena</li>
                  <li>Ainda podem ser selecionados pela Hierarchy</li>
                </ul>
              </div>
            </GuideSection>

            {/* Game Mode */}
            <GuideSection title="Game Mode (Runtime)">
              <div className="info-content">
                <p>Alterne entre <strong>Dev</strong> e <strong>Game</strong> na toolbar para testar o jogo.</p>

                <p><strong>Configurar Player:</strong></p>
                <ul>
                  <li>Selecione um objeto (ex: Cylinder)</li>
                  <li>No Inspector, marque <strong>Player</strong> na seção Game</li>
                  <li>Escolha o <strong>Camera Mode</strong> desejado</li>
                </ul>

                <p><strong>Modos de Câmera:</strong></p>
                <ul>
                  <li><strong>Isometric (WASD)</strong> - Câmera fixa estilo MU Online/Dota. WASD move o personagem, Scroll = zoom</li>
                  <li><strong>Isometric (Click to Move)</strong> - Câmera fixa estilo Diablo. Clique no chão para mover, Scroll = zoom</li>
                  <li><strong>First Person</strong> - Câmera em primeira pessoa. Mouse olha, WASD anda</li>
                  <li><strong>Custom</strong> - Ajuste manual de altura, distância, ângulo e FOV</li>
                </ul>

                <p><strong>Configurações da Câmera:</strong></p>
                <ul>
                  <li><strong>Height</strong> - Altura da câmera acima do player</li>
                  <li><strong>Distance</strong> - Distância horizontal da câmera ao player</li>
                  <li><strong>Angle</strong> - Ângulo horizontal (45° = isométrico clássico)</li>
                  <li><strong>FOV</strong> - Campo de visão (60° padrão, 75° primeira pessoa)</li>
                </ul>

                <p><strong>Controles no Game Mode:</strong></p>
                <ul>
                  <li><strong>WASD</strong> - Mover personagem (isometric/first person)</li>
                  <li><strong>Clique no chão</strong> - Mover para local (click to move)</li>
                  <li><strong>Mouse</strong> - Olhar ao redor (first person)</li>
                  <li><strong>Scroll</strong> - Zoom in/out (isometric)</li>
                  <li><strong>Shift</strong> - Correr</li>
                  <li><strong>Espaço</strong> - Pular</li>
                </ul>

                <p><strong>Dicas:</strong></p>
                <ul>
                  <li>Os painéis se escondem automaticamente no Game mode</li>
                  <li>Clique em <strong>Dev</strong> para voltar ao modo de edição</li>
                  <li>A posição do player é restaurada ao sair do Game mode</li>
                  <li>Marcadores de teste aparecem em Click to Move para debug</li>
                </ul>
              </div>
            </GuideSection>

            {/* Control Settings */}
            <GuideSection title="Control Settings">
              <div className="info-content">
                <p>Configure controles do player no Inspector (seção Control Settings).</p>

                <p><strong>Movement:</strong></p>
                <ul>
                  <li><strong>Move Speed</strong> - Velocidade base de movimento (unidades/segundo)</li>
                  <li><strong>Sprint Multiplier</strong> - Multiplicador de velocidade ao correr</li>
                  <li><strong>Jump Force</strong> - Força do pulo</li>
                  <li><strong>Gravity</strong> - Força da gravidade</li>
                  <li><strong>Rotation Speed</strong> - Velocidade de rotação do personagem</li>
                </ul>

                <p><strong>Key Bindings:</strong></p>
                <ul>
                  <li><strong>Forward/Backward</strong> - Teclas de movimento (padrão: W/S ou Setas)</li>
                  <li><strong>Left/Right</strong> - Teclas laterais (padrão: A/D ou Setas)</li>
                  <li><strong>Jump</strong> - Tecla de pulo (padrão: Espaço)</li>
                  <li><strong>Sprint</strong> - Tecla de correr (padrão: Shift)</li>
                  <li>Clique no botão da tecla e pressione uma nova tecla para rebind</li>
                  <li>Cada ação pode ter uma tecla principal e uma alternativa</li>
                </ul>

                <p><strong>Mouse / Touch:</strong></p>
                <ul>
                  <li><strong>Sensitivity</strong> - Sensibilidade do mouse (First Person)</li>
                  <li><strong>Invert Y Axis</strong> - Inverter eixo vertical do mouse</li>
                  <li><strong>Zoom Speed</strong> - Velocidade do zoom (Isometric)</li>
                </ul>

                <p><strong>Dicas:</strong></p>
                <ul>
                  <li>As configurações são salvas no objeto Player</li>
                  <li>Cada modo de câmera usa configurações relevantes</li>
                  <li>Clique em "Reset to Defaults" para restaurar valores padrão</li>
                  <li>As teclas alternativas (Alt) permitem usar setas junto com WASD</li>
                </ul>
              </div>
            </GuideSection>

            {/* Minimap & Fog of War */}
            <GuideSection title="Minimap & Fog of War">
              <div className="info-content">
                <p>Sistema de minimap configurável que aparece no Game mode.</p>

                <p><strong>Ativar Minimap:</strong></p>
                <ul>
                  <li>Selecione o objeto Player na Hierarchy</li>
                  <li>No Inspector, expanda <strong>Minimap Settings</strong></li>
                  <li>Ative o toggle <strong>Enabled</strong></li>
                  <li>Entre no Game mode para visualizar</li>
                </ul>

                <p><strong>Posição & Tamanho:</strong></p>
                <ul>
                  <li><strong>Position</strong> - top-right, top-left, bottom-right, bottom-left</li>
                  <li><strong>Offset X/Y</strong> - Distância das bordas em pixels</li>
                  <li><strong>Shape</strong> - circle, square ou rectangle</li>
                  <li><strong>Size</strong> - Tamanho em pixels (150 padrão)</li>
                  <li><strong>Scale</strong> - Zoom do mapa (1 = 1:1 com mundo)</li>
                </ul>

                <p><strong>World Bounds:</strong></p>
                <ul>
                  <li>Define a área do mundo visível no minimap</li>
                  <li><strong>Min/Max X</strong> - Limites horizontais (-100 a 100)</li>
                  <li><strong>Min/Max Z</strong> - Limites de profundidade (-100 a 100)</li>
                  <li>A imagem de fundo se adapta a estes limites</li>
                </ul>

                <p><strong>Opções de Exibição:</strong></p>
                <ul>
                  <li><strong>Rotate with Camera</strong> - O mapa gira junto com a câmera</li>
                  <li><strong>Show Coordinates</strong> - Exibe posição X/Z do player</li>
                  <li><strong>Show Grid</strong> - Exibe grid sobre o mapa</li>
                  <li><strong>Show Direction</strong> - Seta indicando direção do player</li>
                </ul>

                <p><strong>Fog of War:</strong></p>
                <ul>
                  <li><strong>Enabled</strong> - Ativa/desativa o sistema de fog</li>
                  <li><strong>Mode permanent</strong> - Áreas visitadas ficam reveladas para sempre (RTS)</li>
                  <li><strong>Mode limited</strong> - Só mostra área ao redor do player (Roguelike)</li>
                  <li><strong>Mode hybrid</strong> - Atual clara, visitadas em cinza, não visitadas escuras (RPG)</li>
                  <li><strong>Reveal Radius</strong> - Raio de visão ao redor do player</li>
                  <li><strong>Explored Opacity</strong> - Transparência de áreas já exploradas (hybrid)</li>
                  <li><strong>Fog Color</strong> - Cor das áreas não exploradas</li>
                </ul>

                <p><strong>Aparência:</strong></p>
                <ul>
                  <li><strong>Background</strong> - Cor de fundo (se não usar imagem)</li>
                  <li><strong>Background Image</strong> - Imagem customizada (do Photoshop)</li>
                  <li><strong>Border Color/Width</strong> - Cor e espessura da borda</li>
                  <li><strong>Player Color/Size</strong> - Cor e tamanho do marcador</li>
                </ul>

                <p><strong>Adicionar Imagem de Fundo:</strong></p>
                <ul>
                  <li>Crie seu mapa no Photoshop com mesmas proporções do worldBounds</li>
                  <li>Exporte como PNG ou JPG</li>
                  <li>No Inspector, clique <strong>Select</strong> em Background Image</li>
                  <li>Escolha o arquivo - ele se adapta automaticamente</li>
                  <li>Use <strong>Clear</strong> para remover a imagem</li>
                </ul>

                <p><strong>Dicas:</strong></p>
                <ul>
                  <li>O minimap só aparece no Game mode</li>
                  <li>Configure worldBounds para corresponder ao tamanho da sua cena</li>
                  <li>Use Scale maior que 1 para zoom (mostra área menor, mais detalhada)</li>
                  <li>Fog of War é salvo/restaurado automaticamente com a cena</li>
                  <li>Cores de Fog, Border e Player mostram valor hex para precisão</li>
                </ul>
              </div>
            </GuideSection>

            {/* Dicas Rápidas */}
            <GuideSection title="Dicas & Workflows">
              <ul className="tips-list">
                <li><strong>Posicionamento preciso:</strong> Ative Grid snap, depois use G → X/Y/Z → digite valor → Enter</li>
                <li><strong>Rotação em 90°:</strong> Ative Rot snap (15°), depois R → eixo → 90 → Enter, ou gire 6 snaps</li>
                <li><strong>Copiar posição entre objetos:</strong> Selecione origem → {formatShortcut('Ctrl+C')} → selecione destino → {formatShortcut('Ctrl+Shift+V')}</li>
                <li><strong>Alinhar vários objetos:</strong> {formatShortcut('Shift+Clique')} para selecionar → use botões Align no Inspector</li>
                <li><strong>Distribuir uniformemente:</strong> Selecione 3+ objetos → botão Distribute X/Y/Z</li>
                <li><strong>Resetar objeto:</strong> {formatShortcut('Alt+R')} reseta tudo, ou use botões individuais Pos/Rot/Scale</li>
                <li><strong>Apoiar no chão:</strong> Botão Floor no Inspector move objeto para Y=0</li>
                <li><strong>Centralizar:</strong> Botão Center move para X=0, Z=0 mantendo Y</li>
                <li><strong>Overlay de transformação:</strong> Durante G/R/S aparece overlay mostrando modo e valores</li>
                <li><strong>Focar objeto:</strong> Selecione e pressione F para centralizar câmera</li>
              </ul>
            </GuideSection>
          </div>

          <div className="guide-footer">
            <p>Pressione <kbd>?</kbd> para abrir/fechar este guia</p>
          </div>
        </div>
      )}
    </div>
  );
}
