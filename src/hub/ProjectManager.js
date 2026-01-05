/**
 * ProjectManager - Gerenciador de projetos ENGINE VOID
 *
 * Responsável por:
 * - Criar novos projetos (2D/3D)
 * - Listar projetos existentes
 * - Abrir/Carregar projetos
 * - Deletar projetos
 * - Gerenciar metadados dos projetos
 */

// Tauri APIs
let tauriFs = null;
let tauriPath = null;
let tauriDialog = null;

// Inicializar APIs do Tauri
async function initTauri() {
  if (window.__TAURI__) {
    try {
      const fs = await import('@tauri-apps/plugin-fs');
      const path = await import('@tauri-apps/api/path');
      const dialog = await import('@tauri-apps/plugin-dialog');
      tauriFs = fs;
      tauriPath = path;
      tauriDialog = dialog;
      return true;
    } catch (e) {
      console.warn('[ProjectManager] Tauri APIs not available:', e);
      return false;
    }
  }
  return false;
}

// Estrutura padrão de um projeto
function createProjectStructure(name, type = '3d', template = 'empty') {
  // Determinar configurações baseadas no template
  const get3DSettings = (tmpl) => {
    switch (tmpl) {
      case 'first-person':
        return {
          skyEnabled: true,
          cloudsEnabled: true,
          defaultCameraMode: 'firstPerson',
          defaultFOV: 75
        };
      case 'third-person':
        return {
          skyEnabled: true,
          cloudsEnabled: true,
          defaultCameraMode: 'isometric',
          defaultCameraDistance: 12
        };
      case 'isometric':
        return {
          skyEnabled: false,
          cloudsEnabled: false,
          defaultCameraMode: 'clickToMove',
          minimapEnabled: true
        };
      default: // empty
        return {
          skyEnabled: true,
          cloudsEnabled: true,
          defaultCameraMode: 'isometric-wasd'
        };
    }
  };

  const get2DSettings = (tmpl) => {
    switch (tmpl) {
      case 'platformer':
        return {
          pixelsPerUnit: 32,
          sortingLayers: ['Background', 'Default', 'Foreground', 'UI'],
          defaultCameraSize: 6,
          pixelPerfect: false,
          hasGravity: true
        };
      case 'topdown':
        return {
          pixelsPerUnit: 32,
          sortingLayers: ['Background', 'Default', 'Foreground', 'UI'],
          defaultCameraSize: 6,
          pixelPerfect: false,
          hasGravity: false
        };
      case 'pixel-art':
        return {
          pixelsPerUnit: 16,
          sortingLayers: ['Background', 'Default', 'Foreground', 'UI'],
          defaultCameraSize: 8,
          pixelPerfect: true,
          filterMode: 'point',
          hasGravity: false
        };
      default: // empty
        return {
          pixelsPerUnit: 16,
          sortingLayers: ['Background', 'Default', 'Foreground', 'UI'],
          defaultCameraSize: 5,
          pixelPerfect: true
        };
    }
  };

  // Gravity baseada no template
  const getPhysicsSettings = (t, tmpl) => {
    if (t === '2d') {
      if (tmpl === 'platformer') {
        return { gravity: { x: 0, y: -25 }, fixedTimestep: 1/60 };
      }
      return { gravity: { x: 0, y: 0 }, fixedTimestep: 1/60 };
    }
    return { gravity: { x: 0, y: -9.8, z: 0 }, fixedTimestep: 1/60 };
  };

  return {
    // Metadados
    name: name,
    type: type, // '2d' ou '3d'
    template: template, // template usado
    version: '1.0.0',
    engineVersion: '0.5.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    // Configurações do projeto
    settings: {
      // Configurações gerais
      defaultScene: 'main',

      // Configurações específicas do tipo
      ...(type === '3d' ? get3DSettings(template) : get2DSettings(template)),

      // Física
      physics: getPhysicsSettings(type, template)
    },

    // Assets do projeto
    assets: {
      scenes: [],
      scripts: [],
      textures: [],
      models: [],
      audio: [],
      prefabs: []
    }
  };
}

// =====================================================
// 3D SCENE TEMPLATES
// =====================================================

// Cena padrão para projeto 3D (Empty)
function createDefault3DScene() {
  return {
    name: 'main',
    objects: [
      {
        name: 'Floor',
        type: 'plane',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: -90, y: 0, z: 0 },
        scale: { x: 20, y: 20, z: 1 },
        material: {
          color: '#3d3d3d',
          metalness: 0,
          roughness: 0.8
        },
        userData: {
          isLocked: true
        }
      }
    ],
    lights: [
      {
        name: 'Sun',
        type: 'directional',
        position: { x: 5, y: 10, z: 5 },
        color: '#ffffff',
        intensity: 1,
        castShadow: true
      },
      {
        name: 'Ambient',
        type: 'ambient',
        color: '#404040',
        intensity: 0.5
      }
    ],
    environment: {
      background: { type: 'sky' },
      sky: {
        turbidity: 10,
        rayleigh: 2,
        elevation: 45,
        azimuth: 180
      },
      clouds: {
        enabled: true,
        height: 100,
        opacity: 0.8,
        speed: 0.5
      }
    }
  };
}

// First Person Template - FPS style camera
function createFirstPerson3DScene() {
  return {
    name: 'main',
    objects: [
      {
        name: 'Floor',
        type: 'plane',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: -90, y: 0, z: 0 },
        scale: { x: 50, y: 50, z: 1 },
        material: {
          color: '#2d2d2d',
          metalness: 0,
          roughness: 0.9
        },
        userData: {
          isLocked: true
        }
      },
      {
        name: 'Player',
        type: 'capsule',
        position: { x: 0, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.5, y: 1, z: 0.5 },
        material: {
          color: '#4ec9b0',
          metalness: 0.2,
          roughness: 0.6
        },
        userData: {
          isPlayer: true,
          cameraMode: 'firstPerson',
          cameraSettings: {
            height: 1.7,
            distance: 0,
            angle: 0,
            fov: 75
          },
          controlSettings: {
            movement: {
              speed: 5,
              sprintMultiplier: 1.8,
              jumpForce: 8,
              gravity: 20,
              rotationSpeed: 10
            },
            mouse: {
              sensitivity: 0.002,
              invertY: false,
              zoomSpeed: 1
            }
          }
        }
      },
      // Some walls for reference
      {
        name: 'Wall1',
        type: 'box',
        position: { x: 0, y: 1.5, z: -10 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 20, y: 3, z: 0.5 },
        material: {
          color: '#555555',
          metalness: 0,
          roughness: 0.8
        }
      }
    ],
    lights: [
      {
        name: 'Sun',
        type: 'directional',
        position: { x: 10, y: 20, z: 10 },
        color: '#ffffff',
        intensity: 1.2,
        castShadow: true
      },
      {
        name: 'Ambient',
        type: 'ambient',
        color: '#404060',
        intensity: 0.4
      }
    ],
    environment: {
      background: { type: 'sky' },
      sky: {
        turbidity: 8,
        rayleigh: 2,
        elevation: 60,
        azimuth: 180
      },
      clouds: {
        enabled: true,
        height: 100,
        opacity: 0.6,
        speed: 0.3
      }
    }
  };
}

// Third Person Template - Camera behind player
function createThirdPerson3DScene() {
  return {
    name: 'main',
    objects: [
      {
        name: 'Floor',
        type: 'plane',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: -90, y: 0, z: 0 },
        scale: { x: 40, y: 40, z: 1 },
        material: {
          color: '#3a5a3a',
          metalness: 0,
          roughness: 0.9
        },
        userData: {
          isLocked: true
        }
      },
      {
        name: 'Player',
        type: 'capsule',
        position: { x: 0, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.5, y: 1, z: 0.5 },
        material: {
          color: '#4ec9b0',
          metalness: 0.3,
          roughness: 0.5
        },
        userData: {
          isPlayer: true,
          cameraMode: 'isometric',
          cameraSettings: {
            height: 8,
            distance: 12,
            angle: 45,
            fov: 60
          },
          controlSettings: {
            movement: {
              speed: 6,
              sprintMultiplier: 1.5,
              jumpForce: 10,
              gravity: 20,
              rotationSpeed: 10
            },
            mouse: {
              sensitivity: 0.003,
              invertY: false,
              zoomSpeed: 1
            }
          }
        }
      },
      // Some obstacles
      {
        name: 'Tree1',
        type: 'cylinder',
        position: { x: 5, y: 1.5, z: 5 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.5, y: 3, z: 0.5 },
        material: {
          color: '#8b4513',
          metalness: 0,
          roughness: 1
        }
      },
      {
        name: 'TreeTop1',
        type: 'sphere',
        position: { x: 5, y: 4, z: 5 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 2, y: 2, z: 2 },
        material: {
          color: '#228b22',
          metalness: 0,
          roughness: 0.8
        }
      }
    ],
    lights: [
      {
        name: 'Sun',
        type: 'directional',
        position: { x: 8, y: 15, z: 8 },
        color: '#fff5e6',
        intensity: 1,
        castShadow: true
      },
      {
        name: 'Ambient',
        type: 'ambient',
        color: '#404050',
        intensity: 0.5
      }
    ],
    environment: {
      background: { type: 'sky' },
      sky: {
        turbidity: 10,
        rayleigh: 2.5,
        elevation: 50,
        azimuth: 200
      },
      clouds: {
        enabled: true,
        height: 100,
        opacity: 0.7,
        speed: 0.4
      }
    }
  };
}

// Isometric RPG Template - Diablo/MU style click-to-move
function createIsometric3DScene() {
  return {
    name: 'main',
    objects: [
      {
        name: 'Floor',
        type: 'plane',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: -90, y: 0, z: 0 },
        scale: { x: 30, y: 30, z: 1 },
        material: {
          color: '#4a3a2a',
          metalness: 0,
          roughness: 0.95
        },
        userData: {
          isLocked: true
        }
      },
      {
        name: 'Player',
        type: 'capsule',
        position: { x: 0, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.4, y: 0.8, z: 0.4 },
        material: {
          color: '#4ec9b0',
          metalness: 0.4,
          roughness: 0.4
        },
        userData: {
          isPlayer: true,
          cameraMode: 'clickToMove',
          cameraSettings: {
            height: 15,
            distance: 20,
            angle: 45,
            fov: 50
          },
          controlSettings: {
            movement: {
              speed: 8,
              sprintMultiplier: 1.5,
              jumpForce: 0,
              gravity: 0,
              rotationSpeed: 15
            },
            mouse: {
              sensitivity: 0.002,
              invertY: false,
              zoomSpeed: 0.5,
              minZoom: 10,
              maxZoom: 40
            }
          },
          minimapSettings: {
            enabled: true,
            position: 'top-right',
            shape: 'circle',
            size: 150,
            fogOfWar: {
              enabled: true,
              mode: 'hybrid',
              revealRadius: 15
            }
          }
        }
      },
      // Some dungeon elements
      {
        name: 'Pillar1',
        type: 'cylinder',
        position: { x: -5, y: 2, z: -5 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 4, z: 1 },
        material: {
          color: '#666666',
          metalness: 0.1,
          roughness: 0.9
        }
      },
      {
        name: 'Pillar2',
        type: 'cylinder',
        position: { x: 5, y: 2, z: -5 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 4, z: 1 },
        material: {
          color: '#666666',
          metalness: 0.1,
          roughness: 0.9
        }
      },
      {
        name: 'Chest',
        type: 'box',
        position: { x: 0, y: 0.4, z: -8 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1.5, y: 0.8, z: 1 },
        material: {
          color: '#8b6914',
          metalness: 0.5,
          roughness: 0.5
        },
        userData: {
          tag: 'item'
        }
      }
    ],
    lights: [
      {
        name: 'Sun',
        type: 'directional',
        position: { x: 5, y: 15, z: 5 },
        color: '#ffe4c4',
        intensity: 0.8,
        castShadow: true
      },
      {
        name: 'Ambient',
        type: 'ambient',
        color: '#303040',
        intensity: 0.6
      },
      {
        name: 'TorchLight',
        type: 'point',
        position: { x: 0, y: 3, z: -5 },
        color: '#ff6600',
        intensity: 2,
        distance: 15,
        decay: 2
      }
    ],
    environment: {
      background: { type: 'color', color: '#1a1a2e' },
      sky: {
        turbidity: 10,
        rayleigh: 2,
        elevation: 20,
        azimuth: 180
      },
      clouds: {
        enabled: false
      }
    }
  };
}

// =====================================================
// 2D SCENE TEMPLATES
// =====================================================

// Cena padrão para projeto 2D (Empty)
function createDefault2DScene() {
  return {
    name: 'main',
    type: '2d',
    objects: [],
    camera: {
      type: 'orthographic',
      size: 5,
      backgroundColor: '#1a1a2e'
    }
  };
}

// Platformer Template - Side-scroller with gravity
function createPlatformer2DScene() {
  return {
    name: 'main',
    type: '2d',
    objects: [
      {
        name: 'Player',
        type: 'sprite',
        position: { x: 0, y: 2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.8, y: 1.2, z: 1 }, // Slightly taller than wide (character shape)
        sprite: {
          color: '#4ec9b0',
          width: 1,  // 1 world unit
          height: 1
        },
        userData: {
          isPlayer: true,
          sortingLayer: 'Default',
          sortingOrder: 10,
          controlSettings: {
            movement: {
              speed: 5,
              sprintMultiplier: 1.5,
              jumpForce: 12,
              gravity: 25,
              rotationSpeed: 10
            }
            // Keys use defaults: WASD + Arrow keys + Space for jump
          },
          physics2d: {
            hasGravity: true,
            isKinematic: false
          }
        }
      },
      // Ground platform
      {
        name: 'Ground',
        type: 'sprite',
        position: { x: 0, y: -3, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 20, y: 1, z: 1 },
        sprite: {
          color: '#4a3a2a',
          width: 1,
          height: 1
        },
        userData: {
          sortingLayer: 'Background',
          sortingOrder: 0,
          isStatic: true,
          isLocked: true,
          tag: 'ground'
        }
      },
      // Floating platforms
      {
        name: 'Platform_Left',
        type: 'sprite',
        position: { x: -3, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 3, y: 0.5, z: 1 },
        sprite: {
          color: '#5a4a3a',
          width: 1,
          height: 1
        },
        userData: {
          sortingLayer: 'Background',
          sortingOrder: 0,
          isStatic: true,
          tag: 'ground'
        }
      },
      {
        name: 'Platform_Right',
        type: 'sprite',
        position: { x: 3, y: 1.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 3, y: 0.5, z: 1 },
        sprite: {
          color: '#5a4a3a',
          width: 1,
          height: 1
        },
        userData: {
          sortingLayer: 'Background',
          sortingOrder: 0,
          isStatic: true,
          tag: 'ground'
        }
      }
    ],
    camera: {
      type: 'orthographic',
      size: 6,
      backgroundColor: '#0d1b2a',
      followPlayer: true
    },
    settings: {
      physics2d: {
        gravity: { x: 0, y: -25 }
      }
    }
  };
}

// Top Down Template - 8-direction movement (similar to 3D Isometric but 2D)
function createTopDown2DScene() {
  return {
    name: 'main',
    type: '2d',
    objects: [
      // Player - similar to 3D isometric player
      {
        name: 'Player',
        type: 'sprite',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.8, y: 0.8, z: 1 },
        sprite: {
          color: '#4ec9b0',
          width: 1,
          height: 1
        },
        userData: {
          isPlayer: true,
          sortingLayer: 'Default',
          sortingOrder: 10,
          controlSettings: {
            movement: {
              speed: 5,
              sprintMultiplier: 1.5,
              jumpForce: 0,
              gravity: 0,
              rotationSpeed: 10,
              // Click-to-move estilo Dota/LoL
              clickToMove: true,
              clickStopDistance: 0.1
            },
            keys: {
              forward: 'KeyW',
              forwardAlt: 'ArrowUp',
              backward: 'KeyS',
              backwardAlt: 'ArrowDown',
              left: 'KeyA',
              leftAlt: 'ArrowLeft',
              right: 'KeyD',
              rightAlt: 'ArrowRight'
            },
            camera: {
              mode: 'free', // Câmera livre estilo Dota/LoL
              followSmoothing: 5
            }
          },
          minimapSettings: {
            enabled: true,
            position: 'top-right',
            shape: 'circle',
            size: 120,
            worldBounds: {
              minX: -10, maxX: 10,
              minZ: -10, maxZ: 10
            },
            showPlatforms: true,
            fogOfWar: {
              enabled: true,
              mode: 'hybrid',
              revealRadius: 5
            }
          }
        }
      },
      // Pillar 1 - similar to 3D pillar
      {
        name: 'Pillar1',
        type: 'sprite',
        position: { x: -4, y: 4, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        sprite: {
          color: '#666666',
          width: 1,
          height: 1
        },
        userData: {
          sortingLayer: 'Default',
          sortingOrder: 0,
          isStatic: true,
          tag: 'obstacle'
        }
      },
      // Pillar 2
      {
        name: 'Pillar2',
        type: 'sprite',
        position: { x: 4, y: 4, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        sprite: {
          color: '#666666',
          width: 1,
          height: 1
        },
        userData: {
          sortingLayer: 'Default',
          sortingOrder: 0,
          isStatic: true,
          tag: 'obstacle'
        }
      },
      // Pillar 3
      {
        name: 'Pillar3',
        type: 'sprite',
        position: { x: -4, y: -4, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        sprite: {
          color: '#666666',
          width: 1,
          height: 1
        },
        userData: {
          sortingLayer: 'Default',
          sortingOrder: 0,
          isStatic: true,
          tag: 'obstacle'
        }
      },
      // Pillar 4
      {
        name: 'Pillar4',
        type: 'sprite',
        position: { x: 4, y: -4, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        sprite: {
          color: '#666666',
          width: 1,
          height: 1
        },
        userData: {
          sortingLayer: 'Default',
          sortingOrder: 0,
          isStatic: true,
          tag: 'obstacle'
        }
      },
      // Item/Coin
      {
        name: 'Coin',
        type: 'sprite',
        position: { x: 3, y: 2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.5, y: 0.5, z: 1 },
        sprite: {
          color: '#ffd700',
          width: 1,
          height: 1
        },
        userData: {
          sortingLayer: 'Foreground',
          sortingOrder: 5,
          tag: 'item'
        }
      }
    ],
    lights: [
      {
        name: 'Ambient Light',
        type: 'ambient',
        color: '#ffffff',
        intensity: 1.0
      }
    ],
    camera: {
      type: 'orthographic',
      size: 8,  // Shows 8 units vertically
      backgroundColor: '#1a1a2a',
      followPlayer: false
    },
    settings: {
      showGrid: true,
      gridSize: 1,
      physics2d: {
        gravity: { x: 0, y: 0 }
      }
    }
  };
}

// Pixel Art Template - 16x16 pixel-perfect com movimento em grid
function createPixelArt2DScene() {
  // Criar tilemap checkerboard para visual retrô
  const tiles = [];
  const tileColors = ['#2a2a3a', '#252535']; // Duas cores para checkerboard

  for (let x = -4; x <= 4; x++) {
    for (let y = -3; y <= 3; y++) {
      const colorIndex = (x + y) % 2 === 0 ? 0 : 1;
      tiles.push({
        name: `Tile_${x + 4}_${y + 3}`,
        type: 'sprite',
        position: { x: x, y: y, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        sprite: {
          color: tileColors[colorIndex],
          width: 1,
          height: 1
        },
        userData: {
          sortingLayer: 'Background',
          sortingOrder: -10,
          isStatic: true,
          tag: 'ground'
        }
      });
    }
  }

  return {
    name: 'main',
    type: '2d',
    objects: [
      // Player com movimento em grid
      {
        name: 'Player',
        type: 'sprite',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.8, y: 0.8, z: 1 }, // Menor que 1 tile para visual melhor
        sprite: {
          color: '#4ec9b0',
          width: 1,
          height: 1
        },
        userData: {
          isPlayer: true,
          sortingLayer: 'Default',
          sortingOrder: 10,
          controlSettings: {
            movement: {
              speed: 8, // Velocidade de transição entre tiles
              gridMovement: true, // NOVO: Movimento em grid (tile a tile)
              tileSize: 1, // Tamanho do tile em unidades do mundo
              jumpForce: 0,
              gravity: 0
            }
          },
          minimapSettings: {
            enabled: true,
            position: 'top-right',
            shape: 'square', // Quadrado combina melhor com pixel art
            size: 100,
            worldBounds: {
              minX: -5, maxX: 5,
              minZ: -4, maxZ: 4
            },
            showPlatforms: true,
            fogOfWar: {
              enabled: true,
              mode: 'hybrid',
              revealRadius: 3 // Menor para grid-based
            },
            markerColors: {
              enemy: '#ff4444',
              item: '#ffd700',
              obstacle: '#5a4a3a'
            }
          }
        }
      },
      // Tilemap (chão checkerboard)
      ...tiles,
      // Paredes/Obstáculos para testar colisão
      {
        name: 'Wall_1',
        type: 'sprite',
        position: { x: 2, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        sprite: {
          color: '#5a4a3a',
          width: 1,
          height: 1
        },
        userData: {
          sortingLayer: 'Default',
          sortingOrder: 0,
          isStatic: true,
          tag: 'obstacle',
          blocksMovement: true
        }
      },
      {
        name: 'Wall_2',
        type: 'sprite',
        position: { x: 2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        sprite: {
          color: '#5a4a3a',
          width: 1,
          height: 1
        },
        userData: {
          sortingLayer: 'Default',
          sortingOrder: 0,
          isStatic: true,
          tag: 'obstacle',
          blocksMovement: true
        }
      },
      {
        name: 'Wall_3',
        type: 'sprite',
        position: { x: 2, y: -1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        sprite: {
          color: '#5a4a3a',
          width: 1,
          height: 1
        },
        userData: {
          sortingLayer: 'Default',
          sortingOrder: 0,
          isStatic: true,
          tag: 'obstacle',
          blocksMovement: true
        }
      },
      // Item coletável (estilo retrô)
      {
        name: 'Gem',
        type: 'sprite',
        position: { x: -2, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.6, y: 0.6, z: 1 },
        sprite: {
          color: '#ff6b9d',
          width: 1,
          height: 1
        },
        userData: {
          sortingLayer: 'Foreground',
          sortingOrder: 5,
          tag: 'item'
        }
      },
      // Outro item
      {
        name: 'Key',
        type: 'sprite',
        position: { x: 3, y: 2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.5, y: 0.5, z: 1 },
        sprite: {
          color: '#ffd700',
          width: 1,
          height: 1
        },
        userData: {
          sortingLayer: 'Foreground',
          sortingOrder: 5,
          tag: 'item'
        }
      }
    ],
    lights: [
      {
        name: 'Ambient Light',
        type: 'ambient',
        color: '#ffffff',
        intensity: 1.0
      }
    ],
    camera: {
      type: 'orthographic',
      size: 6, // Zoom mais próximo para ver os pixels
      backgroundColor: '#0f0f1a',
      pixelPerfect: true,
      followPlayer: true
    },
    settings: {
      pixelsPerUnit: 16,
      filterMode: 'point', // Nearest neighbor - pixels nítidos
      pixelSnap: true,
      gridMovement: true, // Flag global para movimento em grid
      tileSize: 1,
      physics2d: {
        gravity: { x: 0, y: 0 }
      }
    }
  };
}

// =====================================================
// HELPER FUNCTION TO GET SCENE BY TEMPLATE
// =====================================================

function getSceneForTemplate(type, template) {
  if (type === '3d') {
    switch (template) {
      case 'first-person':
        return createFirstPerson3DScene();
      case 'third-person':
        return createThirdPerson3DScene();
      case 'isometric':
        return createIsometric3DScene();
      case 'empty':
      default:
        return createDefault3DScene();
    }
  } else {
    // 2D
    switch (template) {
      case 'platformer':
        return createPlatformer2DScene();
      case 'topdown':
        return createTopDown2DScene();
      case 'pixel-art':
        return createPixelArt2DScene();
      case 'empty':
      default:
        return createDefault2DScene();
    }
  }
}

// Script de exemplo
function createExampleScript() {
  return `// PlayerController.js
// Script de exemplo para controle do player

function start() {
  this.speed = 5;
  console.log('PlayerController started!');
}

function update(deltaTime) {
  // Movimento horizontal
  if (engine.input.getKey('KeyA') || engine.input.getKey('ArrowLeft')) {
    engine.transform.translate(-this.speed * deltaTime, 0, 0);
  }
  if (engine.input.getKey('KeyD') || engine.input.getKey('ArrowRight')) {
    engine.transform.translate(this.speed * deltaTime, 0, 0);
  }

  // Movimento vertical (3D) ou pulo (2D)
  if (engine.input.getKey('KeyW') || engine.input.getKey('ArrowUp')) {
    engine.transform.translate(0, 0, -this.speed * deltaTime);
  }
  if (engine.input.getKey('KeyS') || engine.input.getKey('ArrowDown')) {
    engine.transform.translate(0, 0, this.speed * deltaTime);
  }
}

function onDestroy() {
  console.log('PlayerController destroyed');
}
`;
}

class ProjectManager {
  constructor() {
    this.projectsPath = null;
    this.currentProject = null;
    this.recentProjects = [];
    this.initialized = false;
  }

  /**
   * Inicializa o ProjectManager
   */
  async initialize() {
    if (this.initialized) return true;

    const tauriAvailable = await initTauri();

    if (tauriAvailable && tauriPath) {
      try {
        // Pasta padrão de projetos: ~/Documents/ENGINE-VOID-Projects
        const documentsDir = await tauriPath.documentDir();
        this.projectsPath = `${documentsDir}ENGINE-VOID-Projects`;

        // Criar pasta se não existir
        try {
          await tauriFs.mkdir(this.projectsPath, { recursive: true });
        } catch (e) {
          // Pasta já existe
        }

        // Carregar projetos recentes do localStorage
        this.loadRecentProjects();

        this.initialized = true;
        console.log('[ProjectManager] Initialized. Projects path:', this.projectsPath);
        return true;
      } catch (e) {
        console.error('[ProjectManager] Failed to initialize:', e);
        return false;
      }
    } else {
      // Fallback para localStorage (dev mode sem Tauri)
      this.projectsPath = 'localStorage';
      this.loadRecentProjects();
      this.initialized = true;
      console.log('[ProjectManager] Initialized in localStorage mode (no Tauri)');
      return true;
    }
  }

  /**
   * Carrega lista de projetos recentes do localStorage
   */
  loadRecentProjects() {
    try {
      const stored = localStorage.getItem('enginevoid_recent_projects');
      if (stored) {
        this.recentProjects = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[ProjectManager] Failed to load recent projects:', e);
      this.recentProjects = [];
    }
  }

  /**
   * Salva lista de projetos recentes no localStorage
   */
  saveRecentProjects() {
    try {
      localStorage.setItem('enginevoid_recent_projects', JSON.stringify(this.recentProjects));
    } catch (e) {
      console.warn('[ProjectManager] Failed to save recent projects:', e);
    }
  }

  /**
   * Adiciona projeto à lista de recentes
   */
  addToRecentProjects(project) {
    // Remover se já existir
    this.recentProjects = this.recentProjects.filter(p => p.path !== project.path);

    // Adicionar no início
    this.recentProjects.unshift({
      name: project.name,
      path: project.path,
      type: project.type,
      lastOpened: new Date().toISOString()
    });

    // Manter apenas os 10 mais recentes
    this.recentProjects = this.recentProjects.slice(0, 10);

    this.saveRecentProjects();
  }

  /**
   * Lista todos os projetos na pasta de projetos
   */
  async listProjects() {
    if (!this.initialized) await this.initialize();

    const projects = [];

    if (tauriFs && this.projectsPath !== 'localStorage') {
      try {
        const entries = await tauriFs.readDir(this.projectsPath);

        for (const entry of entries) {
          if (entry.isDirectory) {
            try {
              const projectJsonPath = `${this.projectsPath}/${entry.name}/project.json`;
              const content = await tauriFs.readTextFile(projectJsonPath);
              const projectData = JSON.parse(content);

              projects.push({
                ...projectData,
                path: `${this.projectsPath}/${entry.name}`,
                folderName: entry.name
              });
            } catch (e) {
              // Não é um projeto válido, ignorar
            }
          }
        }
      } catch (e) {
        console.error('[ProjectManager] Failed to list projects:', e);
      }
    } else {
      // Fallback localStorage
      try {
        const stored = localStorage.getItem('enginevoid_projects');
        if (stored) {
          const localProjects = JSON.parse(stored);
          return Object.values(localProjects);
        }
      } catch (e) {
        console.warn('[ProjectManager] Failed to load localStorage projects:', e);
      }
    }

    return projects;
  }

  /**
   * Cria um novo projeto
   */
  async createProject(name, type = '3d', template = 'empty') {
    if (!this.initialized) await this.initialize();

    // Sanitizar nome para usar como pasta
    const folderName = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const projectPath = tauriFs ? `${this.projectsPath}/${folderName}` : folderName;

    // Criar estrutura do projeto com template
    const projectData = createProjectStructure(name, type, template);
    projectData.path = projectPath;
    projectData.folderName = folderName;

    // Criar cena baseada no template selecionado
    const defaultScene = getSceneForTemplate(type, template);
    projectData.assets.scenes.push('main');

    // Criar script de exemplo
    const exampleScript = createExampleScript();
    projectData.assets.scripts.push('PlayerController');

    if (tauriFs && this.projectsPath !== 'localStorage') {
      try {
        // Criar pasta do projeto
        await tauriFs.mkdir(projectPath, { recursive: true });

        // Criar subpastas
        await tauriFs.mkdir(`${projectPath}/scenes`, { recursive: true });
        await tauriFs.mkdir(`${projectPath}/scripts`, { recursive: true });
        await tauriFs.mkdir(`${projectPath}/assets`, { recursive: true });
        await tauriFs.mkdir(`${projectPath}/assets/textures`, { recursive: true });
        await tauriFs.mkdir(`${projectPath}/assets/models`, { recursive: true });
        await tauriFs.mkdir(`${projectPath}/assets/audio`, { recursive: true });
        await tauriFs.mkdir(`${projectPath}/prefabs`, { recursive: true });

        // Salvar project.json
        await tauriFs.writeTextFile(
          `${projectPath}/project.json`,
          JSON.stringify(projectData, null, 2)
        );

        // Salvar cena padrão
        await tauriFs.writeTextFile(
          `${projectPath}/scenes/main.json`,
          JSON.stringify(defaultScene, null, 2)
        );

        // Salvar script de exemplo
        await tauriFs.writeTextFile(
          `${projectPath}/scripts/PlayerController.js`,
          exampleScript
        );

        console.log('[ProjectManager] Project created:', projectPath);
      } catch (e) {
        console.error('[ProjectManager] Failed to create project:', e);
        throw e;
      }
    } else {
      // Fallback localStorage
      try {
        const stored = localStorage.getItem('enginevoid_projects') || '{}';
        const projects = JSON.parse(stored);

        projects[folderName] = {
          ...projectData,
          scenes: { main: defaultScene },
          scripts: { PlayerController: exampleScript }
        };

        localStorage.setItem('enginevoid_projects', JSON.stringify(projects));
        console.log('[ProjectManager] Project created in localStorage:', folderName);
      } catch (e) {
        console.error('[ProjectManager] Failed to create localStorage project:', e);
        throw e;
      }
    }

    // Adicionar cenas ao projectData para que esteja disponível imediatamente
    projectData.scenes = { main: defaultScene };
    projectData.scripts = { PlayerController: exampleScript };

    // Adicionar aos recentes
    this.addToRecentProjects(projectData);

    return projectData;
  }

  /**
   * Abre um projeto existente
   */
  async openProject(projectPath) {
    if (!this.initialized) await this.initialize();

    let projectData = null;

    if (tauriFs && this.projectsPath !== 'localStorage') {
      try {
        const content = await tauriFs.readTextFile(`${projectPath}/project.json`);
        projectData = JSON.parse(content);
        projectData.path = projectPath;
      } catch (e) {
        console.error('[ProjectManager] Failed to open project:', e);
        throw e;
      }
    } else {
      // Fallback localStorage
      try {
        const stored = localStorage.getItem('enginevoid_projects') || '{}';
        const projects = JSON.parse(stored);
        projectData = projects[projectPath];
        if (!projectData) {
          throw new Error('Project not found');
        }
      } catch (e) {
        console.error('[ProjectManager] Failed to open localStorage project:', e);
        throw e;
      }
    }

    this.currentProject = projectData;
    this.addToRecentProjects(projectData);

    return projectData;
  }

  /**
   * Carrega uma cena do projeto atual
   */
  async loadScene(sceneName) {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    console.log('[ProjectManager] Loading scene:', sceneName, 'from project:', this.currentProject.name);

    // Primeiro, verificar se o projeto já tem a cena embutida (modo localStorage)
    if (this.currentProject.scenes && this.currentProject.scenes[sceneName]) {
      console.log('[ProjectManager] Scene found embedded in project');
      return this.currentProject.scenes[sceneName];
    }

    const projectPath = this.currentProject.path;

    if (tauriFs && this.projectsPath !== 'localStorage') {
      try {
        const content = await tauriFs.readTextFile(`${projectPath}/scenes/${sceneName}.json`);
        return JSON.parse(content);
      } catch (e) {
        console.error('[ProjectManager] Failed to load scene from file:', e);
        throw e;
      }
    } else {
      // Fallback localStorage
      try {
        const stored = localStorage.getItem('enginevoid_projects') || '{}';
        const projects = JSON.parse(stored);
        const project = projects[projectPath];
        if (project && project.scenes && project.scenes[sceneName]) {
          console.log('[ProjectManager] Scene found in localStorage');
          return project.scenes[sceneName];
        }
        console.warn('[ProjectManager] Scene not found in localStorage, projectPath:', projectPath);
        throw new Error('Scene not found');
      } catch (e) {
        console.error('[ProjectManager] Failed to load localStorage scene:', e);
        throw e;
      }
    }
  }

  /**
   * Salva uma cena no projeto atual
   */
  async saveScene(sceneName, sceneData) {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const projectPath = this.currentProject.path;

    if (tauriFs && this.projectsPath !== 'localStorage') {
      try {
        await tauriFs.writeTextFile(
          `${projectPath}/scenes/${sceneName}.json`,
          JSON.stringify(sceneData, null, 2)
        );

        // Atualizar updatedAt
        this.currentProject.updatedAt = new Date().toISOString();
        await tauriFs.writeTextFile(
          `${projectPath}/project.json`,
          JSON.stringify(this.currentProject, null, 2)
        );
      } catch (e) {
        console.error('[ProjectManager] Failed to save scene:', e);
        throw e;
      }
    } else {
      // Fallback localStorage
      try {
        const stored = localStorage.getItem('enginevoid_projects') || '{}';
        const projects = JSON.parse(stored);

        if (!projects[projectPath]) {
          projects[projectPath] = this.currentProject;
        }
        if (!projects[projectPath].scenes) {
          projects[projectPath].scenes = {};
        }

        projects[projectPath].scenes[sceneName] = sceneData;
        projects[projectPath].updatedAt = new Date().toISOString();

        localStorage.setItem('enginevoid_projects', JSON.stringify(projects));
      } catch (e) {
        console.error('[ProjectManager] Failed to save localStorage scene:', e);
        throw e;
      }
    }
  }

  /**
   * Deleta um projeto
   */
  async deleteProject(projectPath) {
    if (!this.initialized) await this.initialize();

    if (tauriFs && this.projectsPath !== 'localStorage') {
      try {
        await tauriFs.remove(projectPath, { recursive: true });
        console.log('[ProjectManager] Project deleted:', projectPath);
      } catch (e) {
        console.error('[ProjectManager] Failed to delete project:', e);
        throw e;
      }
    } else {
      // Fallback localStorage
      try {
        const stored = localStorage.getItem('enginevoid_projects') || '{}';
        const projects = JSON.parse(stored);
        delete projects[projectPath];
        localStorage.setItem('enginevoid_projects', JSON.stringify(projects));
      } catch (e) {
        console.error('[ProjectManager] Failed to delete localStorage project:', e);
        throw e;
      }
    }

    // Remover dos recentes
    this.recentProjects = this.recentProjects.filter(p => p.path !== projectPath);
    this.saveRecentProjects();
  }

  /**
   * Abre diálogo para selecionar pasta de projeto existente
   */
  async importProject() {
    if (!tauriDialog) {
      console.warn('[ProjectManager] Dialog not available');
      return null;
    }

    try {
      const selected = await tauriDialog.open({
        directory: true,
        multiple: false,
        title: 'Selecionar Pasta do Projeto'
      });

      if (selected) {
        return await this.openProject(selected);
      }
    } catch (e) {
      console.error('[ProjectManager] Failed to import project:', e);
      throw e;
    }

    return null;
  }

  /**
   * Retorna o projeto atual
   */
  getCurrentProject() {
    return this.currentProject;
  }

  /**
   * Retorna os projetos recentes
   */
  getRecentProjects() {
    return this.recentProjects;
  }
}

// Singleton
const projectManager = new ProjectManager();

export default projectManager;
export { createProjectStructure, createDefault3DScene, createDefault2DScene };
