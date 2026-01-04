import { useState, useCallback, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { AssetLoader } from '../three/AssetLoader';
import './ProjectPanel.css';

// Instância compartilhada do AssetLoader
const assetLoader = new AssetLoader();

/**
 * Sistema de arquivos virtual para o projeto
 */
const initialFileSystem = {
  '/': {
    type: 'folder',
    name: 'Assets',
    children: ['Scenes', 'Materials', 'Models', 'Textures', 'Prefabs']
  },
  '/Scenes': {
    type: 'folder',
    name: 'Scenes',
    children: ['MainScene.scene']
  },
  '/Scenes/MainScene.scene': {
    type: 'scene',
    name: 'MainScene.scene',
    data: null
  },
  '/Materials': {
    type: 'folder',
    name: 'Materials',
    children: ['Default.mat', 'Metal.mat', 'Glass.mat']
  },
  '/Materials/Default.mat': {
    type: 'material',
    name: 'Default.mat',
    data: { color: '#808080', metalness: 0.5, roughness: 0.5 }
  },
  '/Materials/Metal.mat': {
    type: 'material',
    name: 'Metal.mat',
    data: { color: '#c0c0c0', metalness: 0.9, roughness: 0.1 }
  },
  '/Materials/Glass.mat': {
    type: 'material',
    name: 'Glass.mat',
    data: { color: '#88ccff', metalness: 0.1, roughness: 0.1, opacity: 0.5 }
  },
  '/Models': {
    type: 'folder',
    name: 'Models',
    children: []
  },
  '/Textures': {
    type: 'folder',
    name: 'Textures',
    children: []
  },
  '/Prefabs': {
    type: 'folder',
    name: 'Prefabs',
    children: []
  }
};

/**
 * Ícones por tipo de arquivo
 */
const fileIcons = {
  folder: '📁',
  scene: '🎬',
  material: '🎨',
  model: '🧊',
  texture: '🖼️',
  prefab: '📦',
  unknown: '📄'
};

/**
 * Primitivos 3D disponíveis
 */
const primitives = [
  { type: 'box', icon: '◻', label: 'Box', method: 'createBox' },
  { type: 'sphere', icon: '○', label: 'Sphere', method: 'createSphere' },
  { type: 'cylinder', icon: '◎', label: 'Cylinder', method: 'createCylinder' },
  { type: 'plane', icon: '▭', label: 'Plane', method: 'createPlane' },
  { type: 'cone', icon: '△', label: 'Cone', method: 'createCone' },
  { type: 'torus', icon: '◯', label: 'Torus', method: 'createTorus' },
  { type: 'capsule', icon: '⬭', label: 'Capsule', method: 'createCapsule' },
  { type: 'ring', icon: '◎', label: 'Ring', method: 'createRing' },
];

/**
 * Luzes disponíveis
 */
const lights = [
  { type: 'pointLight', icon: '💡', label: 'Point', method: 'addPointLight' },
  { type: 'directionalLight', icon: '☀', label: 'Directional', method: 'addDirectionalLight' },
  { type: 'spotLight', icon: '🔦', label: 'Spot', method: 'addSpotLight' },
  { type: 'ambientLight', icon: '◌', label: 'Ambient', method: 'addAmbientLight' },
  { type: 'hemisphereLight', icon: '🌓', label: 'Hemisphere', method: 'addHemisphereLight' },
];

/**
 * Painel de projeto (inferior)
 * Navegador de assets e criação rápida de objetos
 */
export default function ProjectPanel({
  onAddObject,
  engine,
  minimizedScripts = [],
  onRestoreScript,
  onCloseMinimizedScript
}) {
  const [activeTab, setActiveTab] = useState('assets');
  const [fileSystem, setFileSystem] = useState(initialFileSystem);
  const [currentPath, setCurrentPath] = useState('/');
  const [selectedItem, setSelectedItem] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' ou 'list'
  const [isDragging, setIsDragging] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Custom drag state (mouse-based, não HTML5)
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [hoveredFolder, setHoveredFolder] = useState(null);

  const tabs = [
    { id: 'assets', label: 'Assets', icon: '📁' },
    { id: 'primitives', label: 'Primitives', icon: '🧊' },
    { id: 'lights', label: 'Lights', icon: '💡' },
  ];

  // Obter itens do diretório atual
  const getCurrentItems = useCallback(() => {
    const folder = fileSystem[currentPath];
    if (!folder || folder.type !== 'folder') return [];

    return folder.children.map(childName => {
      const childPath = currentPath === '/'
        ? `/${childName}`
        : `${currentPath}/${childName}`;
      return {
        path: childPath,
        ...fileSystem[childPath]
      };
    }).filter(Boolean);
  }, [fileSystem, currentPath]);

  // Navegação por breadcrumb
  const getBreadcrumbs = useCallback(() => {
    if (currentPath === '/') return [{ path: '/', name: 'Assets' }];

    const parts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [{ path: '/', name: 'Assets' }];

    let accPath = '';
    for (const part of parts) {
      accPath += `/${part}`;
      breadcrumbs.push({ path: accPath, name: part });
    }

    return breadcrumbs;
  }, [currentPath]);

  // Navegar para pasta
  const navigateTo = (path) => {
    if (fileSystem[path]?.type === 'folder') {
      setCurrentPath(path);
      setSelectedItem(null);
    }
  };

  // Duplo clique em item
  const handleDoubleClick = (item) => {
    if (item.type === 'folder') {
      navigateTo(item.path);
    } else if (item.type === 'model') {
      // Carregar modelo 3D na cena
      loadModelToScene(item);
    } else if (item.type === 'material' && engine) {
      // Aplicar material ao objeto selecionado
      console.log('Apply material:', item.data);
    } else if (item.type === 'scene') {
      console.log('Load scene:', item.path);
    }
  };

  // Criar nova pasta
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;

    const folderPath = currentPath === '/'
      ? `/${newFolderName}`
      : `${currentPath}/${newFolderName}`;

    setFileSystem(prev => {
      const parentFolder = prev[currentPath];
      return {
        ...prev,
        [currentPath]: {
          ...parentFolder,
          children: [...parentFolder.children, newFolderName]
        },
        [folderPath]: {
          type: 'folder',
          name: newFolderName,
          children: []
        }
      };
    });

    setIsCreatingFolder(false);
    setNewFolderName('');
  };

  // Deletar item selecionado
  const handleDelete = () => {
    if (!selectedItem) return;

    const itemName = selectedItem.name;
    const parentPath = currentPath;

    setFileSystem(prev => {
      const parentFolder = prev[parentPath];
      const newChildren = parentFolder.children.filter(c => c !== itemName);

      // Remover item e seus filhos (se for pasta)
      const newFs = { ...prev };
      delete newFs[selectedItem.path];
      newFs[parentPath] = { ...parentFolder, children: newChildren };

      return newFs;
    });

    setSelectedItem(null);
  };

  // Mover item para outra pasta
  const moveItemToFolder = (draggedItem, targetFolderPath) => {
    if (!draggedItem || !targetFolderPath) return;
    if (draggedItem.type === 'folder') return; // Não mover pastas por enquanto

    const itemName = draggedItem.name;
    const sourcePath = draggedItem.path;
    const sourceParentPath = sourcePath.substring(0, sourcePath.lastIndexOf('/')) || '/';

    // Não mover para a mesma pasta
    if (sourceParentPath === targetFolderPath) {
      console.log('Mesma pasta, ignorando');
      return;
    }

    const newItemPath = targetFolderPath === '/'
      ? `/${itemName}`
      : `${targetFolderPath}/${itemName}`;

    setFileSystem(prev => {
      // Verificar se o item existe no filesystem
      const originalItem = prev[sourcePath];
      if (!originalItem) {
        console.error('Item não encontrado no filesystem:', sourcePath);
        return prev;
      }

      const newFs = { ...prev };

      // Remover do pai atual
      const sourceParent = newFs[sourceParentPath];
      if (sourceParent && sourceParent.children) {
        newFs[sourceParentPath] = {
          ...sourceParent,
          children: sourceParent.children.filter(c => c !== itemName)
        };
      }

      // Adicionar ao novo pai
      const targetParent = newFs[targetFolderPath];
      if (targetParent && targetParent.children) {
        // Verificar se já não existe
        if (!targetParent.children.includes(itemName)) {
          newFs[targetFolderPath] = {
            ...targetParent,
            children: [...targetParent.children, itemName]
          };
        }
      }

      // Mover o item (preservando todos os dados originais)
      delete newFs[sourcePath];
      newFs[newItemPath] = {
        ...originalItem // Mantém type, name, data, etc.
      };

      return newFs;
    });
  };

  // Drag & Drop externo (arquivos do sistema)
  const handleExternalDragOver = (e) => {
    if (!draggedItem) { // Só para drags externos
      e.preventDefault();
      setIsDragging(true);
    }
  };

  const handleExternalDragLeave = () => {
    setIsDragging(false);
  };

  const handleExternalDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleImportFiles(files);
    }
  };

  // Custom drag interno (mouse-based)
  const handleMouseDown = (e, item) => {
    if (item.type === 'folder') return;
    e.preventDefault();
    setDraggedItem(item);
    setDragPosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = useCallback((e) => {
    if (!draggedItem) return;
    setDragPosition({ x: e.clientX, y: e.clientY });
  }, [draggedItem]);

  const handleMouseUp = useCallback((e) => {
    if (!draggedItem) return;

    // Verificar se soltou sobre uma pasta
    if (hoveredFolder) {
      moveItemToFolder(draggedItem, hoveredFolder);
    }

    setDraggedItem(null);
    setHoveredFolder(null);
  }, [draggedItem, hoveredFolder]);

  // Detectar quando mouse entra em uma pasta durante drag
  const handleFolderMouseEnter = (folderPath) => {
    if (draggedItem) {
      setHoveredFolder(folderPath);
    }
  };

  const handleFolderMouseLeave = () => {
    if (draggedItem) {
      setHoveredFolder(null);
    }
  };

  // Event listeners globais para mouse
  useEffect(() => {
    if (draggedItem) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggedItem, handleMouseMove, handleMouseUp]);

  // Importar arquivos via Tauri (salva caminho real)
  const handleImportWithTauri = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Assets',
          extensions: ['gltf', 'glb', 'obj', 'fbx', 'png', 'jpg', 'jpeg', 'webp']
        }]
      });

      if (!selected) return;

      // Garantir que é array
      const files = Array.isArray(selected) ? selected : [selected];

      for (const filePath of files) {
        const fileName = filePath.split('/').pop();
        const ext = fileName.split('.').pop().toLowerCase();
        let type = 'unknown';

        if (['gltf', 'glb', 'obj', 'fbx'].includes(ext)) type = 'model';
        else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) type = 'texture';

        const virtualPath = currentPath === '/'
          ? `/${fileName}`
          : `${currentPath}/${fileName}`;

        setFileSystem(prev => {
          const parentFolder = prev[currentPath];
          return {
            ...prev,
            [currentPath]: {
              ...parentFolder,
              children: [...parentFolder.children, fileName]
            },
            [virtualPath]: {
              type,
              name: fileName,
              data: { filePath, size: 0 }  // Caminho real do arquivo
            }
          };
        });

        console.log(`Asset "${fileName}" importado com caminho: ${filePath}`);
      }
    } catch (error) {
      console.error('Erro ao importar:', error);
    }
  };

  // Importar arquivos via drag & drop (fallback com blob URL)
  const handleImportFiles = async (files) => {
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      let type = 'unknown';

      if (['gltf', 'glb', 'obj', 'fbx'].includes(ext)) type = 'model';
      else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) type = 'texture';

      // Criar blob URL para o arquivo (drag & drop não dá caminho real)
      const blobUrl = URL.createObjectURL(file);

      const filePath = currentPath === '/'
        ? `/${file.name}`
        : `${currentPath}/${file.name}`;

      setFileSystem(prev => {
        const parentFolder = prev[currentPath];
        return {
          ...prev,
          [currentPath]: {
            ...parentFolder,
            children: [...parentFolder.children, file.name]
          },
          [filePath]: {
            type,
            name: file.name,
            data: { file, size: file.size, blobUrl }
          }
        };
      });

      console.log(`Asset "${file.name}" importado (blob URL - não persistirá)`);
    }
  };

  // Carregar modelo 3D na cena
  const loadModelToScene = async (item) => {
    if (!engine) {
      console.error('Engine não disponível');
      return;
    }

    try {
      // Extrair extensão do nome do arquivo
      const extension = item.name.split('.').pop().toLowerCase();

      let model;

      // Se tem caminho real do arquivo (Tauri), usar ele
      if (item.data?.filePath) {
        model = await assetLoader.loadModel(item.data.filePath, { extension });
      } else if (item.data?.blobUrl) {
        // Fallback para blob URL
        model = await assetLoader.loadModel(item.data.blobUrl, { extension });
      } else {
        console.error('Arquivo sem URL ou caminho');
        return;
      }

      const modelName = generateName(item.name.replace(/\.[^/.]+$/, ''));

      model.name = modelName;
      model.userData.type = 'model';
      model.userData.sourceFile = item.name;
      // Salvar caminho real para persistência
      model.userData.filePath = item.data?.filePath || null;

      // Configurar sombras
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Adicionar à cena
      engine.scene.add(model);
      engine.objects.set(modelName, model);

      // Notificar mudança
      if (onAddObject) onAddObject(modelName, () => {});

      console.log(`Modelo "${item.name}" adicionado à cena como "${modelName}"`);
    } catch (error) {
      console.error(`Erro ao carregar modelo ${item.name}:`, error);
    }
  };

  // Gerar nome único para objeto
  const generateName = (type) => {
    const timestamp = Date.now().toString(36);
    return `${type}_${timestamp}`;
  };

  // Cores aleatórias
  const getRandomColor = () => {
    const colors = [0x4a90d9, 0x50c878, 0xff6b6b, 0xffd93d, 0x6c5ce7, 0x00cec9, 0xfd79a8];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Adicionar primitivo
  const handleAddPrimitive = (item) => {
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

      if (onAddObject) onAddObject(name, () => {});
    }
  };

  // Adicionar luz
  const handleAddLight = (item) => {
    if (!engine) return;

    const name = generateName(item.type);
    const method = engine[item.method];

    if (method) {
      method.call(engine, name, {
        color: 0xffffff,
        intensity: 1,
        position: [0, 5, 0]
      });

      if (onAddObject) onAddObject(name, () => {});
    }
  };

  // Renderizar conteúdo baseado na tab
  const renderContent = () => {
    switch (activeTab) {
      case 'assets':
        return (
          <div
            className={`assets-browser ${isDragging ? 'dragging' : ''} ${draggedItem ? 'internal-dragging' : ''}`}
            onDragOver={handleExternalDragOver}
            onDragLeave={handleExternalDragLeave}
            onDrop={handleExternalDrop}
          >
            {/* Breadcrumb com botão voltar */}
            <div className="breadcrumb">
              {currentPath !== '/' && (
                <button
                  className="breadcrumb-back"
                  onClick={() => {
                    // Voltar para o diretório pai
                    const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
                    navigateTo(parentPath);
                  }}
                  title="Voltar"
                >
                  ←
                </button>
              )}
              {getBreadcrumbs().map((bc, i) => (
                <span key={bc.path}>
                  {i > 0 && <span className="separator">/</span>}
                  <button
                    className="breadcrumb-item"
                    onClick={() => navigateTo(bc.path)}
                  >
                    {bc.name}
                  </button>
                </span>
              ))}
            </div>

            {/* Grid de itens */}
            <div className={`file-grid ${viewMode}`}>
              {getCurrentItems().map(item => (
                <div
                  key={item.path}
                  className={`file-item ${selectedItem?.path === item.path ? 'selected' : ''} ${item.type === 'folder' && hoveredFolder === item.path ? 'drag-over' : ''} ${draggedItem?.path === item.path ? 'being-dragged' : ''}`}
                  onClick={() => !draggedItem && setSelectedItem(item)}
                  onDoubleClick={() => handleDoubleClick(item)}
                  onMouseDown={(e) => handleMouseDown(e, item)}
                  onMouseEnter={() => item.type === 'folder' && handleFolderMouseEnter(item.path)}
                  onMouseLeave={() => item.type === 'folder' && handleFolderMouseLeave()}
                >
                  <span className="file-icon">{fileIcons[item.type] || fileIcons.unknown}</span>
                  <span className="file-name">{item.name}</span>
                </div>
              ))}

              {/* Ghost element durante drag */}
              {draggedItem && (
                <div
                  className="drag-ghost"
                  style={{
                    position: 'fixed',
                    left: dragPosition.x + 10,
                    top: dragPosition.y + 10,
                    pointerEvents: 'none',
                    zIndex: 1000,
                    opacity: 0.8
                  }}
                >
                  <span className="file-icon">{fileIcons[draggedItem.type] || fileIcons.unknown}</span>
                  <span className="file-name">{draggedItem.name}</span>
                </div>
              )}

              {/* Input para nova pasta */}
              {isCreatingFolder && (
                <div className="file-item new-folder">
                  <span className="file-icon">📁</span>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateFolder();
                      if (e.key === 'Escape') setIsCreatingFolder(false);
                    }}
                    onBlur={handleCreateFolder}
                    autoFocus
                    placeholder="Nova pasta"
                  />
                </div>
              )}

              {/* Estado vazio */}
              {getCurrentItems().length === 0 && !isCreatingFolder && (
                <div className="empty-folder">
                  <p>Pasta vazia</p>
                  <p className="hint">Arraste arquivos ou crie uma pasta</p>
                </div>
              )}
            </div>

            {/* Overlay de drag */}
            {isDragging && (
              <div className="drop-overlay">
                <span>📥</span>
                <p>Solte para importar</p>
              </div>
            )}
          </div>
        );

      case 'primitives':
        return (
          <div className="asset-grid">
            {primitives.map((item) => (
              <button
                key={item.type}
                className="asset-item"
                onClick={() => handleAddPrimitive(item)}
                title={`Adicionar ${item.label}`}
              >
                <span className="asset-icon">{item.icon}</span>
                <span className="asset-label">{item.label}</span>
              </button>
            ))}
          </div>
        );

      case 'lights':
        return (
          <div className="asset-grid">
            {lights.map((item) => (
              <button
                key={item.type}
                className="asset-item"
                onClick={() => handleAddLight(item)}
                title={`Adicionar ${item.label}`}
              >
                <span className="asset-icon light">{item.icon}</span>
                <span className="asset-label">{item.label}</span>
              </button>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="project-panel">
      <div className="panel-header">
        <h3>Project</h3>

        {/* Tabs */}
        <div className="panel-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Scripts minimizados */}
        {minimizedScripts.length > 0 && (
          <div className="minimized-scripts">
            {minimizedScripts.map(script => (
              <div
                key={script.scriptId}
                className={`minimized-tab ${script.hasChanges ? 'has-changes' : ''}`}
                onClick={() => onRestoreScript?.(script.scriptId)}
                title={`Open ${script.scriptId}`}
              >
                <span className="tab-icon">📜</span>
                <span className="tab-name">
                  {script.scriptId.split('_')[0] || script.scriptId}
                  {script.hasChanges && <span className="unsaved-dot">●</span>}
                </span>
                <button
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseMinimizedScript?.(script.scriptId);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        {activeTab === 'assets' && (
          <div className="panel-toolbar">
            <button
              className="toolbar-btn"
              onClick={() => setIsCreatingFolder(true)}
              title="Nova pasta"
            >
              📁+
            </button>
            <button
              className="toolbar-btn"
              onClick={handleImportWithTauri}
              title="Importar"
            >
              📥
            </button>
            <button
              className={`toolbar-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              ⊞
            </button>
            <button
              className={`toolbar-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              ☰
            </button>
            {selectedItem && (
              <button
                className="toolbar-btn danger"
                onClick={handleDelete}
                title="Deletar"
              >
                🗑
              </button>
            )}
          </div>
        )}

      </div>

      <div className="panel-content">
        {renderContent()}
      </div>
    </div>
  );
}
