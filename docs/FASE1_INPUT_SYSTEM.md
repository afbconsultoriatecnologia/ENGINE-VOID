# Fase 1: Sistema de Input Cross-Platform

## Status: ✅ Concluído

---

## Objetivo
Criar um sistema robusto de input que suporte **mouse, teclado e trackpad** em **Windows e Mac**, com atalhos estilo Blender e sistema de **Undo/Redo**.

---

## Arquivos Criados

### 1. `src/engine/InputManager.js`
Sistema unificado de input usando Pointer Events API.

**Funcionalidades:**
- Detecção automática de plataforma (Mac/Windows)
- Normalização de eventos (mouse, touch, pen)
- Registro de atalhos de teclado cross-platform
- Suporte a modifier keys (Cmd no Mac, Ctrl no Windows)
- Eventos: `pointerDown`, `pointerMove`, `pointerUp`, `pointerCancel`, `keyDown`, `keyUp`, `wheel`

**Correções aplicadas:**
- `pointerup` registrado no `window` (não no canvas) para funcionar no trackpad do Mac
- Removido tratamento de `pointerleave` como cancel (quebrava Mac)

---

### 2. `src/engine/CommandHistory.js`
Sistema de Undo/Redo usando padrão Command.

**Classes implementadas:**
- `Command` - Classe base
- `TransformCommand` - Para position, rotation, scale
- `CreateObjectCommand` - Adicionar objetos
- `DeleteObjectCommand` - Remover objetos
- `DuplicateCommand` - Clonar objetos
- `MaterialCommand` - Alterar materiais
- `CompositeCommand` - Agrupar comandos
- `CommandHistory` - Gerenciador com stacks de undo/redo

**Configuração:**
- Limite de 50 comandos no histórico
- Callbacks para atualizar UI

---

### 3. `src/components/KeyboardShortcuts.jsx` + `.css`
Painel de atalhos de teclado.

**Funcionalidades:**
- Detecção automática Mac vs Windows
- Símbolos corretos (⌘, ⇧, ⌥ para Mac)
- Botão "?" no canto inferior direito
- Categorias: Transformar, Geral, Camera

---

## Arquivos Modificados

### `src/engine/SelectionController.js`
- Integração com InputManager (Pointer Events)
- **Modos de transformação estilo Blender:**
  - `startTransformMode('grab' | 'rotate' | 'scale')`
  - `confirmTransform()` - confirma com clique
  - `cancelTransform()` - cancela com ESC
- Suporte a snapping durante transformações
- Callbacks `onDragStart` e `onDragEnd` para undo

### `src/engine/CameraController.js`
- Integração com InputManager
- Método `focusOnObject(object)` para tecla F

### `src/engine/ThreeEngine.js`
- Integração de InputManager e CommandHistory
- Registro de todos os atalhos de teclado
- Métodos `undo()`, `redo()`, `deleteSelectedObject()`, `duplicateSelectedObject()`

### `src/components/GameEditor.jsx` + `.css`
- Botões de Undo/Redo na toolbar
- Estado do histórico via `useEffect`
- Integração do componente KeyboardShortcuts

---

## Atalhos Implementados

### Transformação (Estilo Blender)
| Tecla | Ação |
|-------|------|
| G | Mover (Grab) |
| R | Rotacionar |
| S | Escalar |
| Clique | Confirmar transformação |
| ESC | Cancelar transformação |

### Geral
| Tecla | Windows | Mac |
|-------|---------|-----|
| Desfazer | Ctrl+Z | ⌘Z |
| Refazer | Ctrl+Y | ⌘⇧Z |
| Deletar | Delete | ⌫ |
| Duplicar | Ctrl+D | ⌘D |
| Deselecionar | ESC | ESC |
| Focar objeto | F | F |

### Câmera
| Ação | Controle |
|------|----------|
| Orbitar | Arrastar |
| Pan | Shift + Arrastar |
| Zoom | Scroll |

---

## Problemas Resolvidos

### 1. Trackpad do Mac não funcionava
**Problema:** Eventos `pointerleave` eram disparados incorretamente, cancelando o estado.

**Solução:**
- Removido listener de `pointerleave`
- Movido `pointerup` para `window` em vez do canvas

### 2. Objetos não soltavam após arrastar
**Problema:** `setPointerCapture` conflitava com OrbitControls.

**Solução:**
- Removido pointer capture do InputManager
- Pointer capture agora é opcional e controlado pelo SelectionController

### 3. Undo não funcionava
**Problema:** Comandos não eram adicionados ao histórico porque `onDragEnd` não era chamado.

**Solução:**
- Corrigido fluxo de eventos de pointer
- Adicionado callback `onDragEnd` no SelectionController

---

## Próximos Passos (Fase 2)

- [ ] Suporte a eixos específicos (G+X, G+Y, G+Z)
- [ ] Gizmos visuais para transformação
- [ ] Snap configurável por eixo
- [ ] Histórico visual de comandos
- [ ] Persistência com PostgreSQL + Docker

---

## Arquitetura Final

```
┌─────────────────────────────────────────────────────────┐
│                    React.js (UI)                        │
│  GameEditor, KeyboardShortcuts, TransformTab            │
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
