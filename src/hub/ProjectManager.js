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
function createProjectStructure(name, type = '3d') {
  return {
    // Metadados
    name: name,
    type: type, // '2d' ou '3d'
    version: '1.0.0',
    engineVersion: '0.4.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    // Configurações do projeto
    settings: {
      // Configurações gerais
      defaultScene: 'main',

      // Configurações 3D
      ...(type === '3d' ? {
        skyEnabled: true,
        cloudsEnabled: true,
        defaultCameraMode: 'isometric-wasd'
      } : {}),

      // Configurações 2D
      ...(type === '2d' ? {
        pixelsPerUnit: 16,
        sortingLayers: ['Background', 'Default', 'Foreground', 'UI'],
        defaultCameraSize: 5,
        pixelPerfect: true
      } : {}),

      // Física
      physics: {
        gravity: type === '2d' ? { x: 0, y: -9.8 } : { x: 0, y: -9.8, z: 0 },
        fixedTimestep: 1/60
      }
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

// Cena padrão para projeto 3D
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
      },
      {
        name: 'Player',
        type: 'box',
        position: { x: 0, y: 0.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        material: {
          color: '#4ec9b0',
          metalness: 0.3,
          roughness: 0.5
        },
        userData: {
          isPlayer: true,
          cameraMode: 'isometric-wasd'
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

// Cena padrão para projeto 2D
function createDefault2DScene() {
  return {
    name: 'main',
    type: '2d',
    objects: [
      {
        name: 'Player',
        type: 'sprite',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        sprite: {
          color: '#4ec9b0',
          width: 32,
          height: 32
        },
        userData: {
          isPlayer: true,
          sortingLayer: 'Default',
          sortingOrder: 0
        }
      }
    ],
    camera: {
      type: 'orthographic',
      size: 5,
      backgroundColor: '#1e1e1e'
    }
  };
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

    // Criar estrutura do projeto
    const projectData = createProjectStructure(name, type);
    projectData.path = projectPath;
    projectData.folderName = folderName;

    // Criar cena padrão
    const defaultScene = type === '2d' ? createDefault2DScene() : createDefault3DScene();
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

    const projectPath = this.currentProject.path;

    if (tauriFs && this.projectsPath !== 'localStorage') {
      try {
        const content = await tauriFs.readTextFile(`${projectPath}/scenes/${sceneName}.json`);
        return JSON.parse(content);
      } catch (e) {
        console.error('[ProjectManager] Failed to load scene:', e);
        throw e;
      }
    } else {
      // Fallback localStorage
      try {
        const stored = localStorage.getItem('enginevoid_projects') || '{}';
        const projects = JSON.parse(stored);
        const project = projects[projectPath];
        if (project && project.scenes && project.scenes[sceneName]) {
          return project.scenes[sceneName];
        }
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
