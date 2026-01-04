# ENGINE VOID

Game Engine 3D estilo Unity com editor visual, construída com React, Three.js e Tauri.

## Como Iniciar

### Requisitos
- Node.js 18+
- Rust (para Tauri)
- Cargo

### Instalacao

```bash
# Instalar dependencias
npm install

# Iniciar em modo desenvolvimento (com Tauri)
cargo tauri dev

# Ou apenas o frontend (sem Tauri)
npm run dev
```

### Build para producao

```bash
cargo tauri build
```

## Estrutura do Projeto

```
src/
├── App.jsx                        # Entry point
├── main.jsx
│
├── editor/                        # EDITOR (React + Three.js)
│   ├── ui/                        # Componentes React
│   │   ├── EditorLayout.jsx       # Layout principal (resize, toggle)
│   │   ├── Toolbar.jsx            # Barra de ferramentas
│   │   ├── HierarchyPanel.jsx     # Arvore de objetos
│   │   ├── InspectorPanel.jsx     # Propriedades
│   │   ├── ProjectPanel.jsx       # Assets browser
│   │   └── SceneSettings.jsx      # Sky, Clouds
│   │
│   ├── three/                     # Renderizacao Three.js
│   │   ├── ThreeEngine.js         # Engine principal
│   │   ├── CameraController.js    # Controle de camera
│   │   ├── SelectionController.js # Sistema de selecao
│   │   ├── AssetLoader.js         # Carregamento de assets
│   │   └── CoordinateSystem.js    # Sistema de coordenadas
│   │
│   └── tools/                     # Ferramentas do editor
│       ├── InputManager.js        # Gerenciamento de input
│       ├── CommandHistory.js      # Undo/Redo
│       └── TransformUtils.js      # Utilitarios de transform

src-tauri/                         # Backend Tauri (Rust)
├── capabilities/default.json      # Permissoes
├── src/lib.rs
├── src/main.rs
└── tauri.conf.json
```

## Layout do Editor

```
┌────────────────────────────────────────────────────────────────────────────┐
│                            Toolbar (48px)                                  │
│  [Dev/Game] [Tools] [Undo/Redo] [Sun] [Save/Load]    [☰][⚙][📁] [🎨]      │
├────────────┬───────────────────────────────────────────────┬───────────────┤
│            ║                                               ║               │
│ Hierarchy  ║              Scene View                       ║  Inspector    │
│ (resize)   ║              (viewport)                       ║   (resize)    │
│            ║                                               ║               │
├────────────╨═══════════════════════════════════════════════╨───────────────┤
│                           Project (resize)                                 │
│  [Assets] [Primitives] [Lights]                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## Funcionalidades

### Editor
- Layout estilo Unity com paineis redimensionaveis
- Paineis podem ser escondidos/mostrados (☰ ⚙ 📁)
- Hierarquia de objetos com lock, rename, multi-selecao
- Inspector com Transform, Material, Geometry, Light properties
- Project Panel com sistema de arquivos virtual
- Drag & drop entre pastas

### Cena
- Primitivos: Box, Sphere, Cylinder, Cone, Torus, Plane
- Luzes: Directional, Point, Spot, Ambient, Hemisphere
- Sky procedural com ciclo solar animado
- Sistema de nuvens

### Ferramentas
- Transformacao estilo Blender (G=Mover, R=Rotacionar, S=Escalar)
- Undo/Redo com historico
- Grid snap e Rotation snap
- Importacao de modelos 3D (GLTF, GLB, OBJ, FBX)

### Persistencia
- Save/Load de cenas via dialogos nativos Tauri
- Persistencia completa de modelos 3D importados

## Atalhos de Teclado

| Tecla | Acao |
|-------|------|
| G | Mover (Grab) |
| R | Rotacionar |
| S | Escalar |
| X/Y/Z | Restringir a eixo |
| Clique | Confirmar |
| ESC | Cancelar / Desselecionar |
| Ctrl+Z | Desfazer |
| Ctrl+Y | Refazer |
| Delete | Deletar objeto |
| Ctrl+D | Duplicar |
| F | Focar no objeto |

## Controles de Camera

| Acao | Controle |
|------|----------|
| Orbitar | Arrastar |
| Pan | Shift + Arrastar |
| Zoom | Scroll |

## Tecnologias

- **Frontend:** React 18, Three.js, Vite
- **Desktop:** Tauri 2.0 (Rust)
- **Plugins:** @tauri-apps/plugin-fs, @tauri-apps/plugin-dialog

## Documentacao

- [Fase 1: Sistema de Input](docs/FASE1_INPUT_SYSTEM.md)
- [Fase 2: UI Layout](docs/FASE2_UI_LAYOUT.md)

## Roadmap

### Fase 1: Editor - COMPLETO
- [x] Layout estilo Unity
- [x] Sistema de input cross-platform
- [x] Undo/Redo
- [x] Paineis redimensionaveis e escondíveis
- [x] Save/Load com Tauri
- [x] Importacao de modelos 3D

### Fase 2: Runtime Engine
- [ ] Game loop independente
- [ ] Sistema ECS
- [ ] Physics com Rapier.js

### Fase 3: Scripting
- [ ] Scripts em JavaScript/TypeScript
- [ ] Hot reload
- [ ] Console de debug

### Fase 4: Multiplayer
- [ ] WebSocket server (Rust)
- [ ] Sincronizacao de estado
- [ ] Lobby system

---

**ENGINE VOID** - Game Engine 3D
