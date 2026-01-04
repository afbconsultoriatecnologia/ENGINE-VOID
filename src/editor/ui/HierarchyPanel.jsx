import { useState, useRef, useEffect } from 'react';
import './HierarchyPanel.css';

/**
 * Painel de hierarquia de objetos (esquerda)
 * Lista todos os objetos da cena com suporte a:
 * - Renomear (duplo-clique)
 * - Drag-and-drop para reordenar/criar hierarquia
 * - Validação de nomes únicos
 * - Grupos para organização
 */
export default function HierarchyPanel({
  objects,
  selectedObject,
  selectedObjects = [], // Array de objetos selecionados
  onSelectObject,
  onRemoveObject,
  onAddObject,
  engine
}) {
  // Converter selectedObjects para Set de UUIDs para busca rápida
  const selectedUuids = new Set(selectedObjects.map(obj => obj?.uuid).filter(Boolean));
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [dropPosition, setDropPosition] = useState(null);
  const [hierarchyOrder, setHierarchyOrder] = useState([]);
  const inputRef = useRef(null);

  // Inicializar ordem quando objetos mudam
  useEffect(() => {
    if (!objects) return;

    setHierarchyOrder(prevOrder => {
      const existingUuids = new Set(prevOrder);
      const currentUuids = objects.map(o => o.uuid);

      // Manter ordem existente e adicionar novos no final
      const newOrder = prevOrder.filter(uuid => currentUuids.includes(uuid));
      currentUuids.forEach(uuid => {
        if (!existingUuids.has(uuid)) {
          newOrder.push(uuid);
        }
      });

      return newOrder;
    });
  }, [objects]);

  // Focar input quando começar a editar
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const getObjectIcon = (obj) => {
    // Verificar se é grupo
    if (obj?.userData?.isGroup) return '📁';

    // Verificar se é luz
    if (obj?.userData?.isLight || obj?.isLight) {
      const lightType = obj?.userData?.lightType || obj?.type || '';
      switch (lightType) {
        case 'AmbientLight': return '◌';
        case 'DirectionalLight': return '☀';
        case 'PointLight': return '💡';
        case 'SpotLight': return '🔦';
        case 'HemisphereLight': return '🌓';
        case 'RectAreaLight': return '▭';
        default: return '💡';
      }
    }

    const type = obj?.userData?.type || obj?.geometry?.type || '';
    switch (type.toLowerCase()) {
      case 'box':
      case 'boxgeometry': return '◻';
      case 'sphere':
      case 'spheregeometry': return '○';
      case 'cylinder':
      case 'cylindergeometry': return '◎';
      case 'plane':
      case 'planegeometry': return '▭';
      case 'cone':
      case 'conegeometry': return '△';
      case 'torus':
      case 'torusgeometry': return '◯';
      case 'torusknot':
      case 'torusknotgeometry': return '∞';
      case 'capsule':
      case 'capsulegeometry': return '⬭';
      case 'ring':
      case 'ringgeometry': return '◎';
      case 'tetrahedron':
      case 'tetrahedrongeometry': return '△';
      case 'octahedron':
      case 'octahedrongeometry': return '◇';
      case 'dodecahedron':
      case 'dodecahedrongeometry': return '⬡';
      case 'icosahedron':
      case 'icosahedrongeometry': return '⬢';
      default: return '◇';
    }
  };

  // Verificar se nome já existe
  const isNameTaken = (name, excludeUuid) => {
    return objects.some(obj => obj.name === name && obj.uuid !== excludeUuid);
  };

  // Gerar UID curto (4 caracteres hex)
  const generateShortUID = () => {
    return Math.random().toString(16).substring(2, 6);
  };

  // Gerar nome único com UID
  const generateUniqueName = (baseName, excludeUuid) => {
    // Sempre gerar com UID para manter consistência
    let newName = `${baseName}_${generateShortUID()}`;
    while (isNameTaken(newName, excludeUuid)) {
      newName = `${baseName}_${generateShortUID()}`;
    }
    return newName;
  };

  // Iniciar edição de nome
  const handleStartEdit = (obj, e) => {
    e.stopPropagation();
    setEditingId(obj.uuid);
    setEditName(obj.name || 'Object');
  };

  // Confirmar renomeação
  const handleConfirmRename = (obj) => {
    if (!editName.trim()) {
      setEditName(obj.name);
      setEditingId(null);
      return;
    }

    let newName = editName.trim();

    if (isNameTaken(newName, obj.uuid)) {
      newName = generateUniqueName(newName, obj.uuid);
    }

    if (engine) {
      const oldName = obj.name;
      obj.name = newName;

      if (engine.objects.has(oldName)) {
        engine.objects.delete(oldName);
        engine.objects.set(newName, obj);
      }
    }

    setEditingId(null);
    setEditName('');

    if (onAddObject) {
      onAddObject(null, () => {});
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleKeyDown = (e, obj) => {
    if (e.key === 'Enter') {
      handleConfirmRename(obj);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // === Drag and Drop ===

  const handleDragStart = (e, obj) => {
    setDraggedItem(obj);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', obj.uuid);
    setTimeout(() => {
      e.target.classList.add('dragging');
    }, 0);
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove('dragging');
    setDraggedItem(null);
    setDragOverItem(null);
    setDropPosition(null);
  };

  const handleDragOver = (e, obj) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.uuid === obj.uuid) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    if (y < height * 0.25) {
      setDropPosition('before');
    } else if (y > height * 0.75) {
      setDropPosition('after');
    } else {
      setDropPosition('inside');
    }

    setDragOverItem(obj);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverItem(null);
      setDropPosition(null);
    }
  };

  const handleDrop = (e, targetObj) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.uuid === targetObj.uuid) return;

    if (isDescendant(draggedItem, targetObj)) return;

    if (dropPosition === 'inside') {
      setParent(draggedItem, targetObj);
    } else {
      // Reordenar visualmente
      reorderInHierarchy(draggedItem, targetObj, dropPosition);
    }

    setDraggedItem(null);
    setDragOverItem(null);
    setDropPosition(null);
  };

  const isDescendant = (potentialParent, obj) => {
    let current = obj.parent;
    while (current) {
      if (current.uuid === potentialParent.uuid) return true;
      current = current.parent;
    }
    return false;
  };

  const setParent = (child, parent) => {
    if (!engine) return;

    const worldPosition = child.getWorldPosition(child.position.clone());

    if (child.parent) {
      child.parent.remove(child);
    }

    parent.add(child);
    parent.worldToLocal(worldPosition);
    child.position.copy(worldPosition);

    if (onAddObject) {
      onAddObject(null, () => {});
    }
  };

  // Reordenar na lista visual
  const reorderInHierarchy = (obj, target, position) => {
    if (!engine) return;

    // Se tem parent diferente da scene, remover do parent
    if (obj.parent && obj.parent !== engine.scene) {
      const worldPosition = obj.getWorldPosition(obj.position.clone());
      obj.parent.remove(obj);
      engine.scene.add(obj);
      obj.position.copy(worldPosition);
    }

    // Atualizar ordem visual
    setHierarchyOrder(prevOrder => {
      const newOrder = prevOrder.filter(uuid => uuid !== obj.uuid);
      const targetIndex = newOrder.indexOf(target.uuid);

      if (position === 'before') {
        newOrder.splice(targetIndex, 0, obj.uuid);
      } else {
        newOrder.splice(targetIndex + 1, 0, obj.uuid);
      }

      return newOrder;
    });

    if (onAddObject) {
      onAddObject(null, () => {});
    }
  };

  // Construir lista hierárquica respeitando a ordem
  const buildHierarchyList = () => {
    if (!objects || !engine) return [];

    const result = [];
    const processed = new Set();
    const objectMap = new Map(objects.map(o => [o.uuid, o]));

    const addWithChildren = (obj, depth = 0) => {
      if (processed.has(obj.uuid)) return;
      processed.add(obj.uuid);

      result.push({ obj, depth });

      // Adicionar filhos na ordem
      const childUuids = obj.children
        .filter(child => objectMap.has(child.uuid))
        .map(child => child.uuid)
        .sort((a, b) => {
          const aIndex = hierarchyOrder.indexOf(a);
          const bIndex = hierarchyOrder.indexOf(b);
          return aIndex - bIndex;
        });

      childUuids.forEach(uuid => {
        addWithChildren(objectMap.get(uuid), depth + 1);
      });
    };

    // Objetos root ordenados
    const rootObjects = objects
      .filter(obj => !obj.parent || obj.parent === engine.scene)
      .sort((a, b) => {
        const aIndex = hierarchyOrder.indexOf(a.uuid);
        const bIndex = hierarchyOrder.indexOf(b.uuid);
        return aIndex - bIndex;
      });

    rootObjects.forEach(obj => addWithChildren(obj));

    return result;
  };

  // Opções do menu
  const primitives = [
    { type: 'box', label: 'Box', method: 'createBox' },
    { type: 'sphere', label: 'Sphere', method: 'createSphere' },
    { type: 'cylinder', label: 'Cylinder', method: 'createCylinder' },
    { type: 'plane', label: 'Plane', method: 'createPlane' },
    { type: 'cone', label: 'Cone', method: 'createCone' },
    { type: 'torus', label: 'Torus', method: 'createTorus' },
  ];

  const generateName = (type) => {
    const baseName = type.charAt(0).toUpperCase() + type.slice(1);
    return generateUniqueName(baseName, null);
  };

  const getRandomColor = () => {
    const colors = [0x4a90d9, 0x50c878, 0xff6b6b, 0xffd93d, 0x6c5ce7, 0x00cec9, 0xfd79a8];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const handleAddObject = (item) => {
    if (!engine) return;

    const name = generateName(item.type);
    const method = engine[item.method];

    if (method) {
      method.call(engine, name, {
        color: getRandomColor(),
        position: [0, 1, 0],
        metalness: 0.3,
        roughness: 0.7
      });

      if (onAddObject) {
        onAddObject(name, () => {});
      }
    }
    setShowAddMenu(false);
  };

  const handleCreateGroup = () => {
    if (!engine) return;

    const name = generateUniqueName('Group', null);
    engine.createGroup(name, { position: [0, 0, 0] });

    if (onAddObject) {
      onAddObject(name, () => {});
    }
    setShowAddMenu(false);
  };

  const hierarchyList = buildHierarchyList();

  return (
    <div className="hierarchy-panel">
      <div className="panel-header">
        <h3>Hierarchy</h3>
        <div className="panel-actions">
          <div className="add-dropdown">
            <button
              className="btn-icon"
              title="Adicionar objeto"
              onClick={() => setShowAddMenu(!showAddMenu)}
            >
              +
            </button>
            {showAddMenu && (
              <div className="dropdown-content show">
                <button onClick={handleCreateGroup} className="menu-group">
                  📁 Group
                </button>
                <div className="menu-divider" />
                {primitives.map((item) => (
                  <button key={item.type} onClick={() => handleAddObject(item)}>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="panel-content">
        <div className="hierarchy-list">
          {hierarchyList.length > 0 ? (
            hierarchyList.map(({ obj, depth }) => (
              <div
                key={obj.uuid}
                className={`hierarchy-item
                  ${selectedUuids.has(obj.uuid) ? 'selected' : ''}
                  ${selectedObject?.uuid === obj.uuid ? 'primary-selected' : ''}
                  ${obj.userData?.isGroup ? 'is-group' : ''}
                  ${obj.userData?.isLight || obj.isLight ? 'is-light' : ''}
                  ${!obj.visible ? 'is-hidden' : ''}
                  ${obj.userData?.locked ? 'is-locked' : ''}
                  ${draggedItem?.uuid === obj.uuid ? 'dragging' : ''}
                  ${dragOverItem?.uuid === obj.uuid ? `drag-over drag-over-${dropPosition}` : ''}`}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
                onClick={(e) => {
                  // Não selecionar objetos travados
                  if (obj.userData?.locked) return;
                  onSelectObject?.(obj, e.shiftKey);
                }}
                onDoubleClick={(e) => {
                  // Não permitir renomear objetos travados
                  if (obj.userData?.locked) return;
                  handleStartEdit(obj, e);
                }}
                draggable={editingId !== obj.uuid && !obj.userData?.locked}
                onDragStart={(e) => {
                  // Não permitir arrastar objetos travados
                  if (obj.userData?.locked) {
                    e.preventDefault();
                    return;
                  }
                  handleDragStart(e, obj);
                }}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, obj)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, obj)}
              >
                {depth > 0 && <span className="indent-line" style={{ left: `${4 + (depth - 1) * 16}px` }} />}
                <span className="item-icon">{getObjectIcon(obj)}</span>

                {editingId === obj.uuid ? (
                  <input
                    ref={inputRef}
                    type="text"
                    className="item-name-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleConfirmRename(obj)}
                    onKeyDown={(e) => handleKeyDown(e, obj)}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className={`item-name ${!obj.visible ? 'hidden-item' : ''} ${obj.userData?.locked ? 'locked-item' : ''}`}>
                    {obj.name || 'Object'}
                  </span>
                )}

                <div className="item-controls">
                  {/* Visibility Toggle */}
                  <button
                    className={`item-toggle ${!obj.visible ? 'off' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const newVisible = !obj.visible;
                      obj.visible = newVisible;

                      // Se for uma luz, também ocultar/mostrar o helper
                      if (obj.userData?.helperName && engine) {
                        const helper = engine.helpers?.get(obj.userData.helperName);
                        if (helper) {
                          helper.visible = newVisible;
                        }
                      }

                      // Forçar re-render
                      if (onAddObject) onAddObject(null, () => {});
                    }}
                    title={obj.visible ? 'Ocultar' : 'Mostrar'}
                  >
                    {obj.visible ? '👁' : '👁‍🗨'}
                  </button>

                  {/* Lock Toggle */}
                  <button
                    className={`item-toggle ${obj.userData?.locked ? 'on' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      obj.userData.locked = !obj.userData.locked;
                      // Forçar re-render
                      if (onAddObject) onAddObject(null, () => {});
                    }}
                    title={obj.userData?.locked ? 'Destravar' : 'Travar'}
                  >
                    {obj.userData?.locked ? '🔒' : '🔓'}
                  </button>

                  {/* Delete Button - não mostrar para objetos travados */}
                  {!obj.userData?.locked && (
                    <button
                      className="item-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveObject?.(obj);
                      }}
                      title="Remover"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="hierarchy-empty">
              <p>Nenhum objeto na cena</p>
              <p className="hint">Clique em + para adicionar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
