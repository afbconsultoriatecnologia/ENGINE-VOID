import React, { useRef, useEffect, useState, useCallback } from 'react';
import MinimapSystem from '../../runtime/minimap/MinimapSystem.js';
import FogOfWarManager from '../../runtime/minimap/FogOfWarManager.js';
import MinimapRenderer from '../../runtime/minimap/MinimapRenderer.js';
import './MinimapOverlay.css';

// Tentar importar Tauri para leitura de arquivos
let tauriFs = null;
try {
  import('@tauri-apps/plugin-fs').then(mod => { tauriFs = mod; });
} catch (e) {
  // Tauri não disponível
}

/**
 * MinimapOverlay - Componente React que renderiza o minimap no Game mode
 */
export default function MinimapOverlay({ runtimeEngine }) {
  const canvasRef = useRef(null);
  const minimapSystemRef = useRef(null);
  const fogManagerRef = useRef(null);
  const rendererRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isInitializedRef = useRef(false);
  const backgroundImageRef = useRef(null);

  const [coordinates, setCoordinates] = useState({ x: 0, z: 0 });
  const [backgroundImageLoaded, setBackgroundImageLoaded] = useState(null);

  // Obter settings do player
  const getSettings = useCallback(() => {
    if (!runtimeEngine?.playerObject) return null;

    // Obter settings do player - minimap SÓ aparece se minimapSettings estiver definido
    const minimapSettings = runtimeEngine.playerObject.userData?.minimapSettings;

    // Se não tem minimapSettings definido, NÃO mostrar minimap
    if (!minimapSettings) return null;

    // Verificar se está habilitado
    if (minimapSettings.enabled === false) return null;

    // Mesclar com defaults
    const defaults = MinimapSystem.getDefaultSettings();
    const merged = {
      ...defaults,
      ...minimapSettings,
      fogOfWar: { ...defaults.fogOfWar, ...minimapSettings.fogOfWar },
      markerColors: { ...defaults.markerColors, ...minimapSettings.markerColors }
    };

    console.log('[MinimapOverlay] Settings:', merged);
    return merged;
  }, [runtimeEngine]);

  const settings = getSettings();

  // Carregar imagem de fundo quando o caminho mudar
  useEffect(() => {
    if (!settings?.backgroundImage) {
      setBackgroundImageLoaded(null);
      backgroundImageRef.current = null;
      return;
    }

    const loadImage = async () => {
      try {
        const img = new Image();

        // Verificar se é um caminho local (Tauri) ou URL
        if (settings.backgroundImage.startsWith('blob:') ||
            settings.backgroundImage.startsWith('http') ||
            settings.backgroundImage.startsWith('data:')) {
          // URL direta
          img.src = settings.backgroundImage;
        } else if (tauriFs) {
          // Caminho local - ler via Tauri
          const fileData = await tauriFs.readFile(settings.backgroundImage);
          const blob = new Blob([fileData]);
          img.src = URL.createObjectURL(blob);
        } else {
          // Fallback - tentar como URL
          img.src = settings.backgroundImage;
        }

        img.onload = () => {
          console.log('[MinimapOverlay] Background image loaded:', img.width, 'x', img.height);
          backgroundImageRef.current = img;
          setBackgroundImageLoaded(img);
        };

        img.onerror = (err) => {
          console.error('[MinimapOverlay] Failed to load background image:', err);
          setBackgroundImageLoaded(null);
        };
      } catch (err) {
        console.error('[MinimapOverlay] Error loading background image:', err);
      }
    };

    loadImage();
  }, [settings?.backgroundImage]);

  // Inicializar e renderizar
  useEffect(() => {
    if (!runtimeEngine?.playerObject || !canvasRef.current || !settings) {
      return;
    }

    const player = runtimeEngine.playerObject;
    const canvas = canvasRef.current;

    const is2D = runtimeEngine.threeEngine.is2D || false;
    console.log('[MinimapOverlay] Initializing...', { player: player.name, settings, is2D });

    // Criar MinimapSystem
    const minimapSystem = new MinimapSystem(
      runtimeEngine.threeEngine.scene,
      player,
      settings,
      is2D
    );
    minimapSystemRef.current = minimapSystem;

    // Criar FogOfWarManager se fog está habilitado
    if (settings.fogOfWar?.enabled) {
      const fogManager = new FogOfWarManager(
        settings.worldBounds,
        2 // gridResolution
      );
      fogManager.setMode(settings.fogOfWar.mode);
      fogManagerRef.current = fogManager;
      minimapSystem.setFogManager(fogManager);
    }

    // Criar Renderer
    const renderer = new MinimapRenderer(canvas, settings);
    rendererRef.current = renderer;
    minimapSystem.setRenderer(renderer);

    isInitializedRef.current = true;

    // Loop de renderização
    const render = () => {
      if (!minimapSystemRef.current || !rendererRef.current) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      // Atualizar ângulo da câmera se disponível
      if (runtimeEngine.cameraController && runtimeEngine.cameraController.angle !== undefined) {
        minimapSystemRef.current.setCameraAngle(runtimeEngine.cameraController.angle);
      }

      // Passar imagem de fundo carregada para o sistema (se disponível)
      if (backgroundImageRef.current) {
        minimapSystemRef.current.settings.backgroundImageLoaded = backgroundImageRef.current;
      }

      // Atualizar sistema
      minimapSystemRef.current.update(1 / 60);

      // Renderizar
      rendererRef.current.render(
        minimapSystemRef.current,
        fogManagerRef.current
      );

      // Atualizar coordenadas para display
      const coords = minimapSystemRef.current.getFormattedCoordinates();
      setCoordinates(coords);

      // Próximo frame
      animationFrameRef.current = requestAnimationFrame(render);
    };

    // Iniciar renderização
    animationFrameRef.current = requestAnimationFrame(render);

    // Cleanup
    return () => {
      console.log('[MinimapOverlay] Cleanup');
      isInitializedRef.current = false;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (minimapSystemRef.current) {
        minimapSystemRef.current.dispose();
        minimapSystemRef.current = null;
      }
      if (fogManagerRef.current) {
        fogManagerRef.current.dispose();
        fogManagerRef.current = null;
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [runtimeEngine, settings?.enabled]);

  // Não renderizar se não houver settings
  if (!settings) {
    return null;
  }

  // Calcular tamanho do canvas
  const canvasWidth = settings.size || 150;
  const canvasHeight = settings.shape === 'rectangle' ? (settings.height || 100) : canvasWidth;

  return (
    <div
      className={`minimap-overlay ${settings.position || 'top-right'}`}
      style={{
        '--offset-x': `${settings.offsetX || 20}px`,
        '--offset-y': `${settings.offsetY || 20}px`
      }}
    >
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className={`minimap-canvas ${settings.shape || 'circle'}`}
        style={{
          width: canvasWidth,
          height: canvasHeight
        }}
      />
      {settings.showCoordinates && (
        <div className="minimap-coordinates">
          X: {coordinates.x} | Z: {coordinates.z}
        </div>
      )}
    </div>
  );
}
