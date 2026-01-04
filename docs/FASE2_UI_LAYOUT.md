# Fase 2: UI Layout Estilo Unity

## Status: ✅ Concluído

---

## Objetivo
Reorganizar a interface do editor seguindo o padrão do Unity Editor, com painéis organizados em posições específicas usando CSS Grid.

---

## Layout Implementado

```
┌────────────────────────────────────────────────────────────────────────────┐
│                            Toolbar (48px)                                  │
│  [Logo] [Dev/Game] [Tools] [Undo/Redo] [Sun] [Save/Load]  [☰][⚙][📁] [🎨] │
├────────────┬───────────────────────────────────────────────┬───────────────┤
│            ║                                               ║               │
│ Hierarchy  ║                                               ║  Inspector    │
│ (150-400px)║              Scene View                       ║ (200-500px)   │
│ ◄──────────║              (viewport)                       ║──────────────►│
│            ║                                               ║               │
│ - Objetos  ║    [☰] ← aparece quando Hierarchy fechado     ║ - Transform   │
│ - Luzes    ║    [⚙] → aparece quando Inspector fechado     ║ - Material    │
│ - Cameras  ║    [📁] ↓ aparece quando Project fechado      ║ - Geometry    │
│            ║                                               ║ - Light Props │
├────────────╨═══════════════════════════════════════════════╨───────────────┤
│                        Project (100-400px altura)                          │
│  [Assets] [Primitives] [Lights]                   [Criar] [Importar]       │
└────────────────────────────────────────────────────────────────────────────┘

Legenda:
  ║ = Resize handle vertical (arrastar para redimensionar)
  ═ = Resize handle horizontal (arrastar para redimensionar)
  [☰][⚙][📁] = Toggle buttons para esconder/mostrar painéis
```

---

## Arquivos Criados

### Estrutura de Pastas
```
src/editor/
├── ui/                        # Componentes React
│   ├── EditorLayout.jsx       # Container principal com CSS Grid + Resize
│   ├── EditorLayout.css       # Grid layout e variáveis CSS
│   ├── Toolbar.jsx            # Barra superior + Panel toggles
│   ├── Toolbar.css
│   ├── HierarchyPanel.jsx     # Lista de objetos (esquerda)
│   ├── HierarchyPanel.css
│   ├── InspectorPanel.jsx     # Propriedades (direita)
│   ├── InspectorPanel.css
│   ├── ProjectPanel.jsx       # Assets/Primitives (inferior)
│   ├── ProjectPanel.css
│   ├── SceneSettings.jsx      # Configurações de céu/nuvens
│   └── SceneSettings.css
│
├── three/                     # Renderização Three.js
│   ├── ThreeEngine.js         # Engine principal
│   ├── CameraController.js    # Controle de câmera
│   ├── SelectionController.js # Sistema de seleção
│   ├── AssetLoader.js         # Carregamento de assets (Tauri-aware)
│   └── CoordinateSystem.js    # Sistema de coordenadas
│
└── tools/                     # Ferramentas
    ├── InputManager.js        # Gerenciamento de input
    ├── CommandHistory.js      # Undo/Redo
    └── TransformUtils.js      # Utilitários de transform
```

---

## Componentes

### 1. EditorLayout.jsx
Container principal usando CSS Grid.

```css
grid-template-areas:
  "toolbar toolbar toolbar"
  "hierarchy scene inspector"
  "project project project";
grid-template-columns: 250px 1fr 300px;
grid-template-rows: 48px 1fr 180px;
```

### 2. Toolbar.jsx
Barra de ferramentas superior contendo:
- Logo/Título do editor
- Toggle Dev/Game mode
- Ferramentas de transformação (Select, Move, Rotate, Scale)
- Botões Undo/Redo
- Botão de configurações

### 3. HierarchyPanel.jsx
Painel esquerdo com lista de objetos:
- Lista de todos os objetos da cena
- Ícones por tipo de objeto
- Seleção com destaque visual
- Botão de deletar por item
- Dropdown para adicionar novos objetos

### 4. InspectorPanel.jsx
Painel direito com propriedades do objeto selecionado:
- Nome do objeto
- Transform (Position, Rotation, Scale)
- Inputs vetoriais coloridos (X=vermelho, Y=verde, Z=azul)
- Material (Color picker)

### 5. ProjectPanel.jsx
Painel inferior com assets e primitivos:
- Tabs: Primitives, Lights, Assets
- Grid de ícones clicáveis para criar objetos
- Área de arrastar arquivos (futura importação)

---

## Paleta de Cores (Unity Dark Theme)

```css
:root {
  --bg-dark: #1e1e1e;
  --bg-panel: #2d2d2d;
  --bg-hover: #3d3d3d;
  --bg-selected: #2c5d87;
  --bg-input: #1a1a1a;
  --border: #3d3d3d;
  --text: #d4d4d4;
  --text-muted: #808080;
  --accent: #3d9df6;
  --accent-green: #4ec9b0;
  --danger: #f14c4c;
}
```

---

## Arquivos Modificados

### src/App.jsx
- Substituído `GameEditor` por `EditorLayout`
- Passagem de `containerRef` para o viewport no layout
- Sincronização de seleção usando `useMemo`

### src/App.css
- Estilos globais simplificados
- Reset CSS básico
- Estilos para o canvas dentro do scene-view

---

## Funcionalidades Implementadas

- [x] Layout responsivo com CSS Grid
- [x] Toolbar com controles de modo e ferramentas
- [x] Hierarquia de objetos com seleção
- [x] Inspector com edição de Transform
- [x] Inspector com edição de Material (cor)
- [x] Painel de projeto com primitivos e luzes
- [x] Tema escuro estilo Unity
- [x] Scrollbar customizada
- [x] Hover states e transições

---

## Funcionalidades Implementadas (Atualizações)

- [x] **Painéis redimensionáveis (drag borders)** ✅
- [x] **Painéis podem ser fechados/abertos via Toolbar** ✅
- [x] **Importação de assets (.obj, .gltf, .glb)** ✅
- [x] **Save/Load de cenas com Tauri native dialogs** ✅
- [x] **Drag & drop entre pastas (custom mouse events)** ✅

## Funcionalidades Pendentes

- [ ] Hierarquia com drag & drop para reordenar
- [ ] Hierarquia em árvore (parent/child)
- [ ] Componentes customizados no Inspector
- [ ] Thumbnails de preview no Project Panel
- [ ] Tabs flutuantes (undock)

---

## Arquitetura Atualizada

```
┌─────────────────────────────────────────────────────────┐
│                    React.js (UI)                        │
│  EditorLayout, Toolbar, Hierarchy, Inspector, Project   │
├─────────────────────────────────────────────────────────┤
│                  Three.js (Renderização)                │
│  ThreeEngine, CameraController, SelectionController     │
├─────────────────────────────────────────────────────────┤
│              Sistema de Input (InputManager)            │
│  Pointer Events, Keyboard Shortcuts, Cross-Platform     │
├─────────────────────────────────────────────────────────┤
│              Sistema de Comandos (CommandHistory)       │
│  Undo/Redo, Transform, Create, Delete, Duplicate        │
└─────────────────────────────────────────────────────────┘
```

---

**Data de conclusão:** Janeiro 2026
