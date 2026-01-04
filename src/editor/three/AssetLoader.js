import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { readFile } from '@tauri-apps/plugin-fs';

/**
 * Carregador de assets 3D
 * Suporta GLTF, OBJ, FBX e outros formatos
 */
export class AssetLoader {
  /**
   * Construtor do carregador de assets
   */
  constructor() {
    this.loaders = {
      gltf: new GLTFLoader(),
      obj: new OBJLoader(),
      fbx: new FBXLoader()
    };

    // Configurar DRACO loader para GLTF comprimido
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    this.loaders.gltf.setDRACOLoader(dracoLoader);

    this.cache = new Map();
    this.blobCache = new Map(); // Cache de blob URLs criados
  }

  /**
   * Verifica se é um caminho de arquivo local
   */
  isLocalPath(path) {
    return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path);
  }

  /**
   * Converte caminho local para Blob URL usando Tauri
   */
  async localPathToBlobUrl(filePath, extension) {
    // Verificar cache de blob
    if (this.blobCache.has(filePath)) {
      return this.blobCache.get(filePath);
    }

    try {
      // Ler arquivo via Tauri
      const fileData = await readFile(filePath);

      // Determinar MIME type
      const mimeTypes = {
        'glb': 'model/gltf-binary',
        'gltf': 'model/gltf+json',
        'obj': 'text/plain',
        'fbx': 'application/octet-stream',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'webp': 'image/webp'
      };
      const mimeType = mimeTypes[extension] || 'application/octet-stream';

      // Criar Blob e URL
      const blob = new Blob([fileData], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      // Cachear
      this.blobCache.set(filePath, blobUrl);

      return blobUrl;
    } catch (error) {
      console.error('Erro ao ler arquivo local:', filePath, error);
      throw error;
    }
  }

  /**
   * Carrega um modelo 3D
   * @param {string} url - URL do arquivo
   * @param {Object} options - Opções de carregamento
   * @param {string} options.extension - Extensão do arquivo (para blob URLs)
   * @returns {Promise<THREE.Object3D>} Promise que resolve com o objeto carregado
   */
  async loadModel(url, options = {}) {
    // Verificar cache
    if (this.cache.has(url) && !options.forceReload) {
      const cached = this.cache.get(url);
      return cached.clone();
    }

    // Para blob URLs, usar extensão passada nas opções
    let extension = options.extension;
    if (!extension) {
      // Tentar extrair da URL
      const urlParts = url.split('.');
      extension = urlParts.length > 1 ? urlParts.pop().toLowerCase().split('?')[0] : null;
    }

    // Se for caminho local, converter para Blob URL via Tauri
    let loadUrl = url;
    if (this.isLocalPath(url)) {
      loadUrl = await this.localPathToBlobUrl(url, extension);
    }

    let result;

    try {
      switch (extension) {
        case 'gltf':
        case 'glb':
          result = await this.loadGLTF(loadUrl);
          break;
        case 'obj':
          result = await this.loadOBJ(loadUrl);
          break;
        case 'fbx':
          result = await this.loadFBX(loadUrl);
          break;
        default:
          throw new Error(`Formato não suportado: ${extension || 'desconhecido'}`);
      }

      // Cachear resultado
      if (!this.cache.has(url)) {
        this.cache.set(url, result);
      }

      // Aplicar opções
      if (options.position) {
        result.position.set(...options.position);
      }
      if (options.rotation) {
        result.rotation.set(...options.rotation);
      }
      if (options.scale) {
        if (typeof options.scale === 'number') {
          result.scale.setScalar(options.scale);
        } else {
          result.scale.set(...options.scale);
        }
      }

      return result;
    } catch (error) {
      console.error(`Erro ao carregar modelo ${url}:`, error);
      throw error;
    }
  }

  /**
   * Carrega um arquivo GLTF/GLB
   * @param {string} url - URL do arquivo
   * @returns {Promise<THREE.Object3D>}
   */
  loadGLTF(url) {
    return new Promise((resolve, reject) => {
      this.loaders.gltf.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          // Adicionar animações se existirem
          if (gltf.animations && gltf.animations.length > 0) {
            model.userData.animations = gltf.animations;
            model.userData.animationMixer = new THREE.AnimationMixer(model);
          }
          resolve(model);
        },
        (progress) => {
          if (progress.total > 0) {
            const percent = (progress.loaded / progress.total) * 100;
            console.log(`Carregando GLTF: ${percent.toFixed(1)}%`);
          }
        },
        (error) => reject(error)
      );
    });
  }

  /**
   * Carrega um arquivo OBJ
   * @param {string} url - URL do arquivo
   * @returns {Promise<THREE.Object3D>}
   */
  loadOBJ(url) {
    return new Promise((resolve, reject) => {
      this.loaders.obj.load(
        url,
        (object) => resolve(object),
        (progress) => {
          if (progress.total > 0) {
            const percent = (progress.loaded / progress.total) * 100;
            console.log(`Carregando OBJ: ${percent.toFixed(1)}%`);
          }
        },
        (error) => reject(error)
      );
    });
  }

  /**
   * Carrega um arquivo FBX
   * @param {string} url - URL do arquivo
   * @returns {Promise<THREE.Object3D>}
   */
  loadFBX(url) {
    return new Promise((resolve, reject) => {
      this.loaders.fbx.load(
        url,
        (object) => resolve(object),
        (progress) => {
          if (progress.total > 0) {
            const percent = (progress.loaded / progress.total) * 100;
            console.log(`Carregando FBX: ${percent.toFixed(1)}%`);
          }
        },
        (error) => reject(error)
      );
    });
  }

  /**
   * Carrega uma textura
   * @param {string} url - URL da textura
   * @returns {Promise<THREE.Texture>}
   */
  loadTexture(url) {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        url,
        (texture) => {
          texture.flipY = false;
          resolve(texture);
        },
        undefined,
        (error) => reject(error)
      );
    });
  }

  /**
   * Limpa o cache
   */
  clearCache() {
    this.cache.clear();
  }
}

