/**
 * EngineBridge - Camada de abstração entre Editor e Core
 *
 * Esta ponte permite trocar a implementação do core (TypeScript ou Rust/WASM)
 * sem afetar o código do editor.
 *
 * Padrão: Strategy Pattern + Factory
 */

/**
 * @typedef {'typescript' | 'wasm' | 'native'} BackendType
 */

/**
 * Interface que todo backend deve implementar
 * @interface IEngineCore
 */

/**
 * Factory para criar instância do core
 */
export class EngineCoreFactory {
  /**
   * Cria uma instância do core engine
   * @param {BackendType} backend - Tipo de backend
   * @returns {Promise<IEngineCore>}
   */
  static async create(backend = 'typescript') {
    switch (backend) {
      case 'typescript':
        // Implementação TypeScript (atual)
        // TODO: Migrar ThreeEngine para implementar IEngineCore
        console.log('[EngineBridge] Using TypeScript backend');
        return null; // Placeholder

      case 'wasm':
        // Implementação Rust/WASM (futuro)
        console.log('[EngineBridge] WASM backend not yet implemented');
        throw new Error('WASM backend not yet implemented');

      case 'native':
        // Implementação Rust Native via Tauri (futuro)
        console.log('[EngineBridge] Native backend not yet implemented');
        throw new Error('Native backend not yet implemented');

      default:
        throw new Error(`Unknown backend type: ${backend}`);
    }
  }

  /**
   * Detecta o melhor backend disponível
   * @returns {BackendType}
   */
  static detectBestBackend() {
    // Verificar se WASM está disponível
    if (typeof WebAssembly !== 'undefined') {
      // TODO: Verificar se o módulo WASM está carregado
      // return 'wasm';
    }

    // Verificar se estamos no Tauri
    if (typeof window !== 'undefined' && window.__TAURI__) {
      return 'native';
    }

    // Fallback para TypeScript
    return 'typescript';
  }
}

/**
 * Configuração de backend por ambiente
 */
export const backendConfig = {
  development: {
    backend: 'typescript',
    debug: true,
    hotReload: true
  },
  production: {
    backend: 'wasm',
    debug: false,
    hotReload: false
  },
  desktop: {
    backend: 'native',
    debug: false
  }
};

/**
 * Obtém configuração baseada no ambiente
 * @returns {Object}
 */
export function getBackendConfig() {
  const env = import.meta.env?.MODE || 'development';
  return backendConfig[env] || backendConfig.development;
}
