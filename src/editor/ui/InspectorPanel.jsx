import { useState, useEffect } from 'react';
import * as THREE from 'three';
import './InspectorPanel.css';
import ScriptInspector from './ScriptInspector';
import MinimapSettings from './MinimapSettings';
import ControlSettings from './ControlSettings';

/**
 * Componente de label com ícone de guia
 */
function PropertyLabel({ label, tooltip }) {
  return (
    <label className="property-label">
      {label}
      <span className="guide-icon" title={tooltip}>?</span>
    </label>
  );
}

/**
 * Painel inspetor (direita)
 * Exibe e edita propriedades do objeto selecionado
 */
export default function InspectorPanel({ engine, selectedObject, scriptManager, onOpenScriptEditor }) {
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const [scale, setScale] = useState({ x: 1, y: 1, z: 1 });

  // Transform settings
  const [transformSpace, setTransformSpace] = useState('world');
  const [snapSettings, setSnapSettings] = useState({
    gridSnap: false,
    gridSize: 1,
    rotationSnap: false,
    rotationSnapAngle: 15
  });
  const [selectionCount, setSelectionCount] = useState(0);

  // Material properties
  const [color, setColor] = useState('#ffffff');
  const [metalness, setMetalness] = useState(0.5);
  const [roughness, setRoughness] = useState(0.5);
  const [opacity, setOpacity] = useState(1);
  const [side, setSide] = useState('front');
  const [wireframe, setWireframe] = useState(false);
  const [flatShading, setFlatShading] = useState(false);
  const [transparent, setTransparent] = useState(false);

  // Rendering properties
  const [visible, setVisible] = useState(true);
  const [castShadow, setCastShadow] = useState(true);
  const [receiveShadow, setReceiveShadow] = useState(true);

  // Emissive properties
  const [emissive, setEmissive] = useState('#000000');
  const [emissiveIntensity, setEmissiveIntensity] = useState(0);

  // Geometry properties
  const [geometryType, setGeometryType] = useState(null);
  const [geometryParams, setGeometryParams] = useState({});

  // Game properties
  const [isPlayer, setIsPlayer] = useState(false);
  const [isMainCamera, setIsMainCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState('isometric'); // isometric, firstPerson, custom
  const [cameraSettings, setCameraSettings] = useState({
    height: 15,
    distance: 20,
    angle: 45,
    fov: 60
  });

  // Light properties
  const [isLight, setIsLight] = useState(false);
  const [lightType, setLightType] = useState(null);
  const [lightColor, setLightColor] = useState('#ffffff');
  const [lightIntensity, setLightIntensity] = useState(1);
  const [lightDistance, setLightDistance] = useState(0);
  const [lightDecay, setLightDecay] = useState(2);
  const [lightAngle, setLightAngle] = useState(Math.PI / 3);
  const [lightPenumbra, setLightPenumbra] = useState(0);
  const [lightGroundColor, setLightGroundColor] = useState('#444444');
  const [lightWidth, setLightWidth] = useState(10);
  const [lightHeight, setLightHeight] = useState(10);

  // Sincronizar propriedades estáticas (Material, Geometry, Light) apenas quando o objeto muda
  useEffect(() => {
    if (!selectedObject) {
      return;
    }

    // Material
    const mat = selectedObject.material;
    if (mat) {
      if (mat.color) {
        setColor('#' + mat.color.getHexString());
      }
      if (mat.metalness !== undefined) setMetalness(mat.metalness);
      if (mat.roughness !== undefined) setRoughness(mat.roughness);
      if (mat.opacity !== undefined) setOpacity(mat.opacity);
      if (mat.transparent !== undefined) setTransparent(mat.transparent);
      if (mat.wireframe !== undefined) setWireframe(mat.wireframe);
      if (mat.flatShading !== undefined) setFlatShading(mat.flatShading);

      // Side
      if (mat.side === THREE.DoubleSide) setSide('double');
      else if (mat.side === THREE.BackSide) setSide('back');
      else setSide('front');

      // Emissive
      if (mat.emissive) {
        setEmissive('#' + mat.emissive.getHexString());
        setEmissiveIntensity(mat.emissiveIntensity || 0);
      }
    }

    // Rendering
    setVisible(selectedObject.visible);
    setCastShadow(selectedObject.castShadow || false);
    setReceiveShadow(selectedObject.receiveShadow || false);

    // Geometry
    const geom = selectedObject.geometry;
    if (geom && geom.parameters) {
      const type = geom.type;
      setGeometryType(type);
      setGeometryParams({ ...geom.parameters });
    } else {
      setGeometryType(null);
      setGeometryParams({});
    }

    // Light detection
    const objIsLight = selectedObject.isLight || selectedObject.userData?.isLight;
    setIsLight(objIsLight);
    if (objIsLight) {
      setLightType(selectedObject.type);
      if (selectedObject.color) {
        setLightColor('#' + selectedObject.color.getHexString());
      }
      setLightIntensity(selectedObject.intensity ?? 1);
      setLightDistance(selectedObject.distance ?? 0);
      setLightDecay(selectedObject.decay ?? 2);
      setLightAngle(selectedObject.angle ?? Math.PI / 3);
      setLightPenumbra(selectedObject.penumbra ?? 0);
      if (selectedObject.groundColor) {
        setLightGroundColor('#' + selectedObject.groundColor.getHexString());
      }
      setLightWidth(selectedObject.width ?? 10);
      setLightHeight(selectedObject.height ?? 10);
    }

    // Game properties
    setIsPlayer(selectedObject.userData?.isPlayer || false);
    setIsMainCamera(selectedObject.userData?.isMainCamera || false);
    setCameraMode(selectedObject.userData?.cameraMode || 'isometric');
    setCameraSettings(selectedObject.userData?.cameraSettings || {
      height: 15,
      distance: 20,
      angle: 45,
      fov: 60
    });
  }, [selectedObject]);

  // Sincronizar Transform com intervalo (para acompanhar gizmos de transformação)
  useEffect(() => {
    if (!selectedObject) return;

    const updateTransform = () => {
      setPosition({
        x: parseFloat(selectedObject.position.x.toFixed(3)),
        y: parseFloat(selectedObject.position.y.toFixed(3)),
        z: parseFloat(selectedObject.position.z.toFixed(3)),
      });
      setRotation({
        x: parseFloat((selectedObject.rotation.x * 180 / Math.PI).toFixed(1)),
        y: parseFloat((selectedObject.rotation.y * 180 / Math.PI).toFixed(1)),
        z: parseFloat((selectedObject.rotation.z * 180 / Math.PI).toFixed(1)),
      });
      setScale({
        x: parseFloat(selectedObject.scale.x.toFixed(3)),
        y: parseFloat(selectedObject.scale.y.toFixed(3)),
        z: parseFloat(selectedObject.scale.z.toFixed(3)),
      });
    };

    updateTransform();

    // Atualizar periodicamente apenas o Transform
    const interval = setInterval(updateTransform, 100);
    return () => clearInterval(interval);
  }, [selectedObject]);

  // Sincronizar configurações de transform da engine
  useEffect(() => {
    if (!engine) return;

    const updateSettings = () => {
      setTransformSpace(engine.getTransformSpace?.() || 'world');
      setSnapSettings(engine.getSnapSettings?.() || {
        gridSnap: false,
        gridSize: 1,
        rotationSnap: false,
        rotationSnapAngle: 15
      });
      setSelectionCount(engine.getSelectionCount?.() || 0);
    };

    updateSettings();

    // Registrar callback para mudanças nas configurações
    if (engine.onTransformSettingsChange === null) {
      engine.onTransformSettingsChange = (settings) => {
        setTransformSpace(settings.transformSpace);
        setSnapSettings(settings.snapSettings);
      };
    }

    const interval = setInterval(updateSettings, 500);
    return () => clearInterval(interval);
  }, [engine]);

  // === Transform Settings Handlers ===
  const handleToggleSpace = () => {
    engine?.toggleTransformSpace?.();
  };

  const handleToggleGridSnap = () => {
    engine?.toggleGridSnap?.();
  };

  const handleToggleRotationSnap = () => {
    engine?.toggleRotationSnap?.();
  };

  const handleGridSizeChange = (value) => {
    const num = parseFloat(value) || 1;
    engine?.setSnapSettings?.({ gridSize: num });
  };

  const handleRotationSnapAngleChange = (value) => {
    const num = parseFloat(value) || 15;
    engine?.setSnapSettings?.({ rotationSnapAngle: num });
  };

  // === Reset Transform Handlers ===
  const handleResetAll = () => engine?.resetSelectedTransform?.();
  const handleResetPosition = () => engine?.resetSelectedPosition?.();
  const handleResetRotation = () => engine?.resetSelectedRotation?.();
  const handleResetScale = () => engine?.resetSelectedScale?.();

  // === Copy/Paste Transform ===
  const handleCopyTransform = () => engine?.copySelectedTransform?.();
  const handlePasteTransform = () => engine?.pasteTransform?.();
  const handlePastePosition = () => engine?.pasteTransform?.({ position: true, rotation: false, scale: false });

  // === Snap to Floor/Center ===
  const handleSnapToFloor = () => engine?.snapSelectedToFloor?.();
  const handleCenterToOrigin = () => engine?.centerSelectedToOrigin?.();

  // === Align Handlers ===
  const handleAlignX = (type) => engine?.alignSelectedObjects?.('x', type);
  const handleAlignY = (type) => engine?.alignSelectedObjects?.('y', type);
  const handleAlignZ = (type) => engine?.alignSelectedObjects?.('z', type);

  // === Distribute Handlers ===
  const handleDistributeX = () => engine?.distributeSelectedObjects?.('x');
  const handleDistributeY = () => engine?.distributeSelectedObjects?.('y');
  const handleDistributeZ = () => engine?.distributeSelectedObjects?.('z');

  // === Game Properties Handlers ===
  const handleIsPlayerChange = (checked) => {
    if (!selectedObject) return;

    // Remover isPlayer de outros objetos (só pode ter um player)
    if (checked && engine?.scene) {
      engine.scene.traverse((child) => {
        if (child.userData) {
          child.userData.isPlayer = false;
        }
      });
    }

    selectedObject.userData = selectedObject.userData || {};
    selectedObject.userData.isPlayer = checked;
    setIsPlayer(checked);
  };

  const handleIsMainCameraChange = (checked) => {
    if (!selectedObject) return;

    // Remover isMainCamera de outras câmeras (só pode ter uma principal)
    if (checked && engine?.scene) {
      engine.scene.traverse((child) => {
        if (child.userData) {
          child.userData.isMainCamera = false;
        }
      });
    }

    selectedObject.userData = selectedObject.userData || {};
    selectedObject.userData.isMainCamera = checked;
    setIsMainCamera(checked);
  };

  const handleCameraModeChange = (mode) => {
    if (!selectedObject) return;

    selectedObject.userData = selectedObject.userData || {};
    selectedObject.userData.cameraMode = mode;
    setCameraMode(mode);

    // Aplicar presets
    let newSettings = { ...cameraSettings };
    if (mode === 'isometric' || mode === 'clickToMove') {
      newSettings = { height: 15, distance: 20, angle: 45, fov: 60 };
    } else if (mode === 'firstPerson') {
      newSettings = { height: 1.7, distance: 0, angle: 0, fov: 75 };
    }
    selectedObject.userData.cameraSettings = newSettings;
    setCameraSettings(newSettings);
  };

  const handleCameraSettingChange = (key, value) => {
    if (!selectedObject) return;

    const num = parseFloat(value) || 0;
    const newSettings = { ...cameraSettings, [key]: num };

    selectedObject.userData = selectedObject.userData || {};
    selectedObject.userData.cameraSettings = newSettings;
    selectedObject.userData.cameraMode = 'custom'; // Muda para custom ao editar
    setCameraSettings(newSettings);
    setCameraMode('custom');
  };

  // === Transform Handlers ===
  const handlePositionChange = (axis, value) => {
    if (!selectedObject) return;
    const num = parseFloat(value) || 0;
    selectedObject.position[axis] = num;
    setPosition(prev => ({ ...prev, [axis]: num }));
  };

  const handleRotationChange = (axis, value) => {
    if (!selectedObject) return;
    const deg = parseFloat(value) || 0;
    selectedObject.rotation[axis] = deg * Math.PI / 180;
    setRotation(prev => ({ ...prev, [axis]: deg }));
  };

  const handleScaleChange = (axis, value) => {
    if (!selectedObject) return;
    const num = parseFloat(value) || 1;
    selectedObject.scale[axis] = num;
    setScale(prev => ({ ...prev, [axis]: num }));
  };

  // === Material Handlers ===
  const handleColorChange = (value) => {
    if (!engine?.scene || !selectedObject) return;

    const objectName = selectedObject.name;

    // Buscar o mesh diretamente na cena e mudar a cor
    engine.scene.traverse((child) => {
      if (child.name === objectName && child.isMesh && child.material) {
        // Mudar cor no material atual (highlight)
        child.material.color.set(value);

        // IMPORTANTE: Também atualizar o material original salvo em userData
        // Quando o objeto é desselecionado, o material original é restaurado
        if (child.userData.originalMaterial?.color) {
          child.userData.originalMaterial.color.set(value);
        }
      }
    });

    setColor(value);
  };

  const handleMetalnessChange = (value) => {
    if (!selectedObject?.material) return;
    const num = parseFloat(value);
    selectedObject.material.metalness = num;
    // Também atualizar o material original
    if (selectedObject.userData?.originalMaterial) {
      selectedObject.userData.originalMaterial.metalness = num;
    }
    setMetalness(num);
  };

  const handleRoughnessChange = (value) => {
    if (!selectedObject?.material) return;
    const num = parseFloat(value);
    selectedObject.material.roughness = num;
    // Também atualizar o material original
    if (selectedObject.userData?.originalMaterial) {
      selectedObject.userData.originalMaterial.roughness = num;
    }
    setRoughness(num);
  };

  const handleOpacityChange = (value) => {
    if (!selectedObject?.material) return;
    const num = parseFloat(value);
    selectedObject.material.opacity = num;
    if (selectedObject.userData?.originalMaterial) {
      selectedObject.userData.originalMaterial.opacity = num;
    }
    if (num < 1) {
      selectedObject.material.transparent = true;
      if (selectedObject.userData?.originalMaterial) {
        selectedObject.userData.originalMaterial.transparent = true;
      }
      setTransparent(true);
    }
    setOpacity(num);
  };

  const handleTransparentChange = (checked) => {
    if (!selectedObject?.material) return;
    selectedObject.material.transparent = checked;
    if (selectedObject.userData?.originalMaterial) {
      selectedObject.userData.originalMaterial.transparent = checked;
    }
    setTransparent(checked);
  };

  const handleSideChange = (value) => {
    if (!selectedObject?.material) return;
    let sideValue;
    switch (value) {
      case 'double': sideValue = THREE.DoubleSide; break;
      case 'back': sideValue = THREE.BackSide; break;
      default: sideValue = THREE.FrontSide;
    }
    selectedObject.material.side = sideValue;
    selectedObject.material.needsUpdate = true;
    if (selectedObject.userData?.originalMaterial) {
      selectedObject.userData.originalMaterial.side = sideValue;
      selectedObject.userData.originalMaterial.needsUpdate = true;
    }
    setSide(value);
  };

  const handleWireframeChange = (checked) => {
    if (!selectedObject?.material) return;
    selectedObject.material.wireframe = checked;
    if (selectedObject.userData?.originalMaterial) {
      selectedObject.userData.originalMaterial.wireframe = checked;
    }
    setWireframe(checked);
  };

  const handleFlatShadingChange = (checked) => {
    if (!selectedObject?.material) return;
    selectedObject.material.flatShading = checked;
    selectedObject.material.needsUpdate = true;
    if (selectedObject.userData?.originalMaterial) {
      selectedObject.userData.originalMaterial.flatShading = checked;
      selectedObject.userData.originalMaterial.needsUpdate = true;
    }
    setFlatShading(checked);
  };

  // === Rendering Handlers ===
  const handleVisibleChange = (checked) => {
    if (!selectedObject) return;
    selectedObject.visible = checked;
    setVisible(checked);
  };

  const handleCastShadowChange = (checked) => {
    if (!selectedObject) return;
    selectedObject.castShadow = checked;
    setCastShadow(checked);
  };

  const handleReceiveShadowChange = (checked) => {
    if (!selectedObject) return;
    selectedObject.receiveShadow = checked;
    setReceiveShadow(checked);
  };

  // === Emissive Handlers ===
  const handleEmissiveChange = (value) => {
    if (!selectedObject?.material?.emissive) return;
    selectedObject.material.emissive.set(value);
    if (selectedObject.userData?.originalMaterial?.emissive) {
      selectedObject.userData.originalMaterial.emissive.set(value);
    }
    setEmissive(value);
  };

  const handleEmissiveIntensityChange = (value) => {
    if (!selectedObject?.material) return;
    const num = parseFloat(value);
    selectedObject.material.emissiveIntensity = num;
    if (selectedObject.userData?.originalMaterial) {
      selectedObject.userData.originalMaterial.emissiveIntensity = num;
    }
    setEmissiveIntensity(num);
  };

  // === Geometry Handlers ===
  const handleGeometryChange = (param, value) => {
    if (!selectedObject || !engine) return;
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;

    const newParams = { ...geometryParams, [param]: num };
    setGeometryParams(newParams);

    // Recriar geometria com novos parâmetros
    let newGeometry;
    switch (geometryType) {
      case 'PlaneGeometry':
        newGeometry = new THREE.PlaneGeometry(
          newParams.width || 1,
          newParams.height || 1,
          newParams.widthSegments || 1,
          newParams.heightSegments || 1
        );
        break;
      case 'BoxGeometry':
        newGeometry = new THREE.BoxGeometry(
          newParams.width || 1,
          newParams.height || 1,
          newParams.depth || 1,
          newParams.widthSegments || 1,
          newParams.heightSegments || 1,
          newParams.depthSegments || 1
        );
        break;
      case 'SphereGeometry':
        newGeometry = new THREE.SphereGeometry(
          newParams.radius || 1,
          newParams.widthSegments || 32,
          newParams.heightSegments || 16
        );
        break;
      case 'CylinderGeometry':
        newGeometry = new THREE.CylinderGeometry(
          newParams.radiusTop || 1,
          newParams.radiusBottom || 1,
          newParams.height || 1,
          newParams.radialSegments || 32,
          newParams.heightSegments || 1,
          newParams.openEnded || false
        );
        break;
      case 'ConeGeometry':
        newGeometry = new THREE.ConeGeometry(
          newParams.radius || 1,
          newParams.height || 1,
          newParams.radialSegments || 32,
          newParams.heightSegments || 1
        );
        break;
      case 'TorusGeometry':
        newGeometry = new THREE.TorusGeometry(
          newParams.radius || 1,
          newParams.tube || 0.4,
          newParams.radialSegments || 16,
          newParams.tubularSegments || 48
        );
        break;
      case 'RingGeometry':
        newGeometry = new THREE.RingGeometry(
          newParams.innerRadius || 0.5,
          newParams.outerRadius || 1,
          newParams.thetaSegments || 32
        );
        break;
      default:
        return;
    }

    if (newGeometry) {
      const oldGeometry = selectedObject.geometry;
      selectedObject.geometry = newGeometry;
      oldGeometry.dispose();
    }
  };

  // === Light Handlers ===
  const handleLightColorChange = (value) => {
    if (!selectedObject?.color) return;
    selectedObject.color.set(value);
    setLightColor(value);
    engine?.updateLightHelper?.(selectedObject.name);
  };

  const handleLightIntensityChange = (value) => {
    if (!selectedObject) return;
    const num = parseFloat(value);
    selectedObject.intensity = num;
    setLightIntensity(num);
  };

  const handleLightDistanceChange = (value) => {
    if (!selectedObject) return;
    const num = parseFloat(value);
    selectedObject.distance = num;
    setLightDistance(num);
  };

  const handleLightDecayChange = (value) => {
    if (!selectedObject) return;
    const num = parseFloat(value);
    selectedObject.decay = num;
    setLightDecay(num);
  };

  const handleLightAngleChange = (value) => {
    if (!selectedObject) return;
    const num = parseFloat(value) * Math.PI / 180;
    selectedObject.angle = num;
    setLightAngle(num);
    engine?.updateLightHelper?.(selectedObject.name);
  };

  const handleLightPenumbraChange = (value) => {
    if (!selectedObject) return;
    const num = parseFloat(value);
    selectedObject.penumbra = num;
    setLightPenumbra(num);
  };

  const handleLightGroundColorChange = (value) => {
    if (!selectedObject?.groundColor) return;
    selectedObject.groundColor.set(value);
    setLightGroundColor(value);
  };

  const handleLightWidthChange = (value) => {
    if (!selectedObject) return;
    const num = parseFloat(value);
    selectedObject.width = num;
    setLightWidth(num);
  };

  const handleLightHeightChange = (value) => {
    if (!selectedObject) return;
    const num = parseFloat(value);
    selectedObject.height = num;
    setLightHeight(num);
  };

  // Helper para obter nome legível do tipo de geometria
  const getGeometryDisplayName = (type) => {
    const names = {
      'PlaneGeometry': 'Plane',
      'BoxGeometry': 'Box',
      'SphereGeometry': 'Sphere',
      'CylinderGeometry': 'Cylinder',
      'ConeGeometry': 'Cone',
      'TorusGeometry': 'Torus',
      'RingGeometry': 'Ring',
      'CapsuleGeometry': 'Capsule',
      'TorusKnotGeometry': 'Torus Knot'
    };
    return names[type] || type?.replace('Geometry', '') || 'Unknown';
  };

  // Helper para obter nome legível do tipo de luz
  const getLightDisplayName = (type) => {
    const names = {
      'AmbientLight': 'Ambient',
      'DirectionalLight': 'Directional',
      'PointLight': 'Point',
      'SpotLight': 'Spot',
      'HemisphereLight': 'Hemisphere',
      'RectAreaLight': 'Rect Area'
    };
    return names[type] || type?.replace('Light', '') || 'Light';
  };

  if (!selectedObject) {
    return (
      <div className="inspector-panel">
        <div className="panel-header">
          <h3>Inspector</h3>
        </div>
        <div className="panel-content">
          <div className="inspector-empty">
            <p>Nenhum objeto selecionado</p>
            <p className="hint">Clique em um objeto na cena ou na hierarquia</p>
          </div>
        </div>
      </div>
    );
  }

  const hasMaterial = selectedObject.material && !selectedObject.userData?.isGroup;

  return (
    <div className="inspector-panel">
      <div className="panel-header">
        <h3>Inspector</h3>
      </div>
      <div className="panel-content">
        {/* Nome do objeto */}
        <div className="inspector-section">
          <div className="object-name">
            <span className="name-icon">◇</span>
            <span className="name-text">{selectedObject.name || 'Object'}</span>
          </div>
        </div>

        {/* Game Properties */}
        <div className="inspector-section">
          <div className="section-header">
            <h4>Game</h4>
            <span className="section-guide" title="Propriedades para o modo Game. Player = objeto controlável">?</span>
          </div>
          <div className="section-content">
            <div className="property-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isPlayer}
                  onChange={(e) => handleIsPlayerChange(e.target.checked)}
                />
                <span>Player</span>
                <span className="property-hint">Controlável com WASD</span>
              </label>
            </div>

            {/* Camera Mode - só aparece quando é Player */}
            {isPlayer && (
              <>
                <div className="property-row">
                  <PropertyLabel label="Camera Mode" tooltip="Tipo de câmera: Isometric, First Person, ou Custom" />
                  <select
                    value={cameraMode}
                    onChange={(e) => handleCameraModeChange(e.target.value)}
                    className="select-input"
                  >
                    <option value="isometric">Isometric (WASD)</option>
                    <option value="clickToMove">Isometric (Click to Move)</option>
                    <option value="firstPerson">First Person</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                {/* Camera Settings */}
                <div className="property-row">
                  <PropertyLabel label="Height" tooltip="Altura da câmera acima do player" />
                  <div className="slider-input">
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="0.5"
                      value={cameraSettings.height}
                      onChange={(e) => handleCameraSettingChange('height', e.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={cameraSettings.height}
                      onChange={(e) => handleCameraSettingChange('height', e.target.value)}
                    />
                  </div>
                </div>

                <div className="property-row">
                  <PropertyLabel label="Distance" tooltip="Distância da câmera ao player (0 = primeira pessoa)" />
                  <div className="slider-input">
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="0.5"
                      value={cameraSettings.distance}
                      onChange={(e) => handleCameraSettingChange('distance', e.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={cameraSettings.distance}
                      onChange={(e) => handleCameraSettingChange('distance', e.target.value)}
                    />
                  </div>
                </div>

                <div className="property-row">
                  <PropertyLabel label="Angle" tooltip="Ângulo horizontal da câmera (45° = isométrico clássico)" />
                  <div className="slider-input">
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="5"
                      value={cameraSettings.angle}
                      onChange={(e) => handleCameraSettingChange('angle', e.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      max="360"
                      step="5"
                      value={cameraSettings.angle}
                      onChange={(e) => handleCameraSettingChange('angle', e.target.value)}
                    />
                  </div>
                </div>

                <div className="property-row">
                  <PropertyLabel label="FOV" tooltip="Field of View - ângulo de visão da câmera" />
                  <div className="slider-input">
                    <input
                      type="range"
                      min="30"
                      max="120"
                      step="1"
                      value={cameraSettings.fov}
                      onChange={(e) => handleCameraSettingChange('fov', e.target.value)}
                    />
                    <input
                      type="number"
                      min="30"
                      max="120"
                      step="1"
                      value={cameraSettings.fov}
                      onChange={(e) => handleCameraSettingChange('fov', e.target.value)}
                    />
                  </div>
                </div>

                <div className="property-info">
                  <small>
                    {cameraMode === 'isometric' && '🎮 Câmera fixa, WASD move o personagem'}
                    {cameraMode === 'clickToMove' && '🎮 Clique no chão para mover (estilo Diablo)'}
                    {cameraMode === 'firstPerson' && '🎮 Mouse olha, WASD anda'}
                    {cameraMode === 'custom' && '🎮 Configuração personalizada'}
                  </small>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Minimap Settings - Seção separada, só aparece quando é Player */}
        {isPlayer && (
          <MinimapSettings
            object={selectedObject}
            onChange={() => {
              // Força re-render se necessário
              setIsPlayer(selectedObject?.userData?.isPlayer || false);
            }}
          />
        )}

        {/* Control Settings - Seção separada, só aparece quando é Player */}
        {isPlayer && (
          <ControlSettings
            object={selectedObject}
            onChange={(key, value) => {
              if (selectedObject) {
                if (!selectedObject.userData) {
                  selectedObject.userData = {};
                }
                selectedObject.userData[key] = value;
              }
            }}
          />
        )}

        {/* Transform */}
        <div className="inspector-section">
          <div className="section-header">
            <h4>Transform</h4>
            <span className="section-guide" title="Controla posição, rotação e escala do objeto no espaço 3D">?</span>
          </div>
          <div className="section-content">
            {/* Transform Settings Row */}
            <div className="transform-settings-row">
              <button
                className={`toggle-btn ${transformSpace === 'local' ? 'active' : ''}`}
                onClick={handleToggleSpace}
                title="Alternar entre espaço Local e World (P)"
              >
                {transformSpace === 'local' ? 'Local' : 'World'}
              </button>
              <button
                className={`toggle-btn ${snapSettings.gridSnap ? 'active' : ''}`}
                onClick={handleToggleGridSnap}
                title="Snap to Grid"
              >
                Grid
              </button>
              <button
                className={`toggle-btn ${snapSettings.rotationSnap ? 'active' : ''}`}
                onClick={handleToggleRotationSnap}
                title="Snap Rotation"
              >
                Rot
              </button>
            </div>

            {/* Snap Settings (conditional) */}
            {(snapSettings.gridSnap || snapSettings.rotationSnap) && (
              <div className="snap-settings">
                {snapSettings.gridSnap && (
                  <div className="snap-input">
                    <span>Grid:</span>
                    <input
                      type="number"
                      value={snapSettings.gridSize}
                      onChange={(e) => handleGridSizeChange(e.target.value)}
                      min="0.1"
                      step="0.1"
                    />
                  </div>
                )}
                {snapSettings.rotationSnap && (
                  <div className="snap-input">
                    <span>Ang:</span>
                    <input
                      type="number"
                      value={snapSettings.rotationSnapAngle}
                      onChange={(e) => handleRotationSnapAngleChange(e.target.value)}
                      min="1"
                      step="1"
                    />
                    <span>°</span>
                  </div>
                )}
              </div>
            )}

            {/* Position */}
            <div className="property-row">
              <PropertyLabel
                label="Position"
                tooltip="Posição do objeto no mundo 3D. X: horizontal, Y: vertical, Z: profundidade. Use G + X/Y/Z para mover com teclado."
              />
              <div className="vector-inputs">
                <div className="vector-input">
                  <span className="axis x">X</span>
                  <input
                    type="number"
                    value={position.x}
                    onChange={(e) => handlePositionChange('x', e.target.value)}
                    step="0.1"
                  />
                </div>
                <div className="vector-input">
                  <span className="axis y">Y</span>
                  <input
                    type="number"
                    value={position.y}
                    onChange={(e) => handlePositionChange('y', e.target.value)}
                    step="0.1"
                  />
                </div>
                <div className="vector-input">
                  <span className="axis z">Z</span>
                  <input
                    type="number"
                    value={position.z}
                    onChange={(e) => handlePositionChange('z', e.target.value)}
                    step="0.1"
                  />
                </div>
              </div>
            </div>

            {/* Rotation */}
            <div className="property-row">
              <PropertyLabel
                label="Rotation"
                tooltip="Rotação do objeto em graus. X: pitch (inclinação), Y: yaw (giro), Z: roll. Use R + X/Y/Z para rotacionar com teclado."
              />
              <div className="vector-inputs">
                <div className="vector-input">
                  <span className="axis x">X</span>
                  <input
                    type="number"
                    value={rotation.x}
                    onChange={(e) => handleRotationChange('x', e.target.value)}
                    step="1"
                  />
                </div>
                <div className="vector-input">
                  <span className="axis y">Y</span>
                  <input
                    type="number"
                    value={rotation.y}
                    onChange={(e) => handleRotationChange('y', e.target.value)}
                    step="1"
                  />
                </div>
                <div className="vector-input">
                  <span className="axis z">Z</span>
                  <input
                    type="number"
                    value={rotation.z}
                    onChange={(e) => handleRotationChange('z', e.target.value)}
                    step="1"
                  />
                </div>
              </div>
            </div>

            {/* Scale */}
            <div className="property-row">
              <PropertyLabel
                label="Scale"
                tooltip="Escala do objeto. 1 = tamanho original. Valores menores que 1 reduzem, maiores aumentam. Use S + X/Y/Z para escalar com teclado."
              />
              <div className="vector-inputs">
                <div className="vector-input">
                  <span className="axis x">X</span>
                  <input
                    type="number"
                    value={scale.x}
                    onChange={(e) => handleScaleChange('x', e.target.value)}
                    step="0.1"
                  />
                </div>
                <div className="vector-input">
                  <span className="axis y">Y</span>
                  <input
                    type="number"
                    value={scale.y}
                    onChange={(e) => handleScaleChange('y', e.target.value)}
                    step="0.1"
                  />
                </div>
                <div className="vector-input">
                  <span className="axis z">Z</span>
                  <input
                    type="number"
                    value={scale.z}
                    onChange={(e) => handleScaleChange('z', e.target.value)}
                    step="0.1"
                  />
                </div>
              </div>
            </div>

            {/* Transform Actions */}
            <div className="transform-actions">
              <div className="action-group">
                <span className="action-label">Reset:</span>
                <button onClick={handleResetAll} title="Reset All (Alt+R)">All</button>
                <button onClick={handleResetPosition} title="Reset Position (Alt+G)">Pos</button>
                <button onClick={handleResetRotation} title="Reset Rotation">Rot</button>
                <button onClick={handleResetScale} title="Reset Scale (Alt+S)">Scale</button>
              </div>
              <div className="action-group">
                <span className="action-label">Snap:</span>
                <button onClick={handleSnapToFloor} title="Snap to Floor (Y=0)">Floor</button>
                <button onClick={handleCenterToOrigin} title="Center to Origin (X=0, Z=0)">Center</button>
              </div>
              <div className="action-group">
                <span className="action-label">Copy:</span>
                <button onClick={handleCopyTransform} title="Copy Transform (Ctrl+C)">Copy</button>
                <button
                  onClick={handlePasteTransform}
                  title="Paste Transform (Ctrl+V)"
                  disabled={!engine?.hasTransformClipboard?.()}
                >
                  Paste
                </button>
              </div>
            </div>

            {/* Align/Distribute (only show when multiple objects selected) */}
            {selectionCount >= 2 && (
              <div className="multi-select-actions">
                <div className="action-group">
                  <span className="action-label">Align X:</span>
                  <button onClick={() => handleAlignX('min')} title="Align Left">←</button>
                  <button onClick={() => handleAlignX('center')} title="Align Center X">|</button>
                  <button onClick={() => handleAlignX('max')} title="Align Right">→</button>
                </div>
                <div className="action-group">
                  <span className="action-label">Align Y:</span>
                  <button onClick={() => handleAlignY('min')} title="Align Bottom">↓</button>
                  <button onClick={() => handleAlignY('center')} title="Align Center Y">─</button>
                  <button onClick={() => handleAlignY('max')} title="Align Top">↑</button>
                </div>
                <div className="action-group">
                  <span className="action-label">Align Z:</span>
                  <button onClick={() => handleAlignZ('min')} title="Align Front">◇</button>
                  <button onClick={() => handleAlignZ('center')} title="Align Center Z">◆</button>
                  <button onClick={() => handleAlignZ('max')} title="Align Back">◇</button>
                </div>
                {selectionCount >= 3 && (
                  <div className="action-group">
                    <span className="action-label">Distribute:</span>
                    <button onClick={handleDistributeX} title="Distribute Horizontal">X</button>
                    <button onClick={handleDistributeY} title="Distribute Vertical">Y</button>
                    <button onClick={handleDistributeZ} title="Distribute Depth">Z</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Geometry */}
        {geometryType && !isLight && (
          <div className="inspector-section">
            <div className="section-header">
              <h4>Geometry ({getGeometryDisplayName(geometryType)})</h4>
              <span className="section-guide" title="Dimensões reais da malha 3D. Diferente de Scale, isso altera os vértices reais do objeto.">?</span>
            </div>
            <div className="section-content">
              {/* Plane */}
              {geometryType === 'PlaneGeometry' && (
                <>
                  <div className="property-row">
                    <PropertyLabel label="Width" tooltip="Largura do plano em unidades" />
                    <input type="number" value={geometryParams.width || 1} onChange={(e) => handleGeometryChange('width', e.target.value)} step="0.5" min="0.1" />
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="Height" tooltip="Altura do plano em unidades" />
                    <input type="number" value={geometryParams.height || 1} onChange={(e) => handleGeometryChange('height', e.target.value)} step="0.5" min="0.1" />
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="W Segments" tooltip="Subdivisões na largura (mais = mais detalhes)" />
                    <input type="number" value={geometryParams.widthSegments || 1} onChange={(e) => handleGeometryChange('widthSegments', e.target.value)} step="1" min="1" />
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="H Segments" tooltip="Subdivisões na altura (mais = mais detalhes)" />
                    <input type="number" value={geometryParams.heightSegments || 1} onChange={(e) => handleGeometryChange('heightSegments', e.target.value)} step="1" min="1" />
                  </div>
                </>
              )}

              {/* Box */}
              {geometryType === 'BoxGeometry' && (
                <>
                  <div className="property-row">
                    <PropertyLabel label="Width" tooltip="Largura do cubo (eixo X)" />
                    <input type="number" value={geometryParams.width || 1} onChange={(e) => handleGeometryChange('width', e.target.value)} step="0.5" min="0.1" />
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="Height" tooltip="Altura do cubo (eixo Y)" />
                    <input type="number" value={geometryParams.height || 1} onChange={(e) => handleGeometryChange('height', e.target.value)} step="0.5" min="0.1" />
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="Depth" tooltip="Profundidade do cubo (eixo Z)" />
                    <input type="number" value={geometryParams.depth || 1} onChange={(e) => handleGeometryChange('depth', e.target.value)} step="0.5" min="0.1" />
                  </div>
                </>
              )}

              {/* Sphere */}
              {geometryType === 'SphereGeometry' && (
                <>
                  <div className="property-row">
                    <PropertyLabel label="Radius" tooltip="Raio da esfera" />
                    <input type="number" value={geometryParams.radius || 1} onChange={(e) => handleGeometryChange('radius', e.target.value)} step="0.1" min="0.1" />
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="W Segments" tooltip="Segmentos horizontais (mais = mais suave)" />
                    <input type="number" value={geometryParams.widthSegments || 32} onChange={(e) => handleGeometryChange('widthSegments', e.target.value)} step="1" min="3" />
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="H Segments" tooltip="Segmentos verticais (mais = mais suave)" />
                    <input type="number" value={geometryParams.heightSegments || 16} onChange={(e) => handleGeometryChange('heightSegments', e.target.value)} step="1" min="2" />
                  </div>
                </>
              )}

              {/* Cylinder */}
              {geometryType === 'CylinderGeometry' && (
                <>
                  <div className="property-row">
                    <PropertyLabel label="Radius Top" tooltip="Raio do topo do cilindro" />
                    <input type="number" value={geometryParams.radiusTop || 1} onChange={(e) => handleGeometryChange('radiusTop', e.target.value)} step="0.1" min="0" />
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="Radius Bottom" tooltip="Raio da base do cilindro" />
                    <input type="number" value={geometryParams.radiusBottom || 1} onChange={(e) => handleGeometryChange('radiusBottom', e.target.value)} step="0.1" min="0" />
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="Height" tooltip="Altura do cilindro" />
                    <input type="number" value={geometryParams.height || 1} onChange={(e) => handleGeometryChange('height', e.target.value)} step="0.5" min="0.1" />
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="Segments" tooltip="Segmentos radiais (mais = mais suave)" />
                    <input type="number" value={geometryParams.radialSegments || 32} onChange={(e) => handleGeometryChange('radialSegments', e.target.value)} step="1" min="3" />
                  </div>
                </>
              )}

              {/* Cone */}
              {geometryType === 'ConeGeometry' && (
                <>
                  <div className="property-row">
                    <PropertyLabel label="Radius" tooltip="Raio da base do cone" />
                    <input type="number" value={geometryParams.radius || 1} onChange={(e) => handleGeometryChange('radius', e.target.value)} step="0.1" min="0.1" />
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="Height" tooltip="Altura do cone" />
                    <input type="number" value={geometryParams.height || 1} onChange={(e) => handleGeometryChange('height', e.target.value)} step="0.5" min="0.1" />
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="Segments" tooltip="Segmentos radiais (mais = mais suave)" />
                    <input type="number" value={geometryParams.radialSegments || 32} onChange={(e) => handleGeometryChange('radialSegments', e.target.value)} step="1" min="3" />
                  </div>
                </>
              )}

              {/* Torus */}
              {geometryType === 'TorusGeometry' && (
                <>
                  <div className="property-row">
                    <PropertyLabel label="Radius" tooltip="Raio do centro ao centro do tubo" />
                    <input type="number" value={geometryParams.radius || 1} onChange={(e) => handleGeometryChange('radius', e.target.value)} step="0.1" min="0.1" />
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="Tube" tooltip="Raio do tubo" />
                    <input type="number" value={geometryParams.tube || 0.4} onChange={(e) => handleGeometryChange('tube', e.target.value)} step="0.1" min="0.1" />
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="Radial Seg." tooltip="Segmentos radiais" />
                    <input type="number" value={geometryParams.radialSegments || 16} onChange={(e) => handleGeometryChange('radialSegments', e.target.value)} step="1" min="3" />
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="Tubular Seg." tooltip="Segmentos tubulares" />
                    <input type="number" value={geometryParams.tubularSegments || 48} onChange={(e) => handleGeometryChange('tubularSegments', e.target.value)} step="1" min="3" />
                  </div>
                </>
              )}

              {/* Ring */}
              {geometryType === 'RingGeometry' && (
                <>
                  <div className="property-row">
                    <PropertyLabel label="Inner Radius" tooltip="Raio interno (buraco)" />
                    <input type="number" value={geometryParams.innerRadius || 0.5} onChange={(e) => handleGeometryChange('innerRadius', e.target.value)} step="0.1" min="0" />
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="Outer Radius" tooltip="Raio externo" />
                    <input type="number" value={geometryParams.outerRadius || 1} onChange={(e) => handleGeometryChange('outerRadius', e.target.value)} step="0.1" min="0.1" />
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="Segments" tooltip="Segmentos (mais = mais suave)" />
                    <input type="number" value={geometryParams.thetaSegments || 32} onChange={(e) => handleGeometryChange('thetaSegments', e.target.value)} step="1" min="3" />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Light Properties */}
        {isLight && (
          <div className="inspector-section">
            <div className="section-header">
              <h4>Light ({getLightDisplayName(lightType)})</h4>
              <span className="section-guide" title="Propriedades da fonte de luz">?</span>
            </div>
            <div className="section-content">
              {/* Color - all lights except Hemisphere */}
              {lightType !== 'HemisphereLight' && (
                <div className="property-row">
                  <PropertyLabel label="Color" tooltip="Cor da luz emitida" />
                  <div className="color-input">
                    <input type="color" value={lightColor} onChange={(e) => handleLightColorChange(e.target.value)} />
                    <span className="color-hex">{lightColor.toUpperCase()}</span>
                  </div>
                </div>
              )}

              {/* Hemisphere Light - Sky and Ground colors */}
              {lightType === 'HemisphereLight' && (
                <>
                  <div className="property-row">
                    <PropertyLabel label="Sky Color" tooltip="Cor da luz vinda de cima (céu)" />
                    <div className="color-input">
                      <input type="color" value={lightColor} onChange={(e) => handleLightColorChange(e.target.value)} />
                      <span className="color-hex">{lightColor.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="Ground Color" tooltip="Cor da luz vinda de baixo (chão)" />
                    <div className="color-input">
                      <input type="color" value={lightGroundColor} onChange={(e) => handleLightGroundColorChange(e.target.value)} />
                      <span className="color-hex">{lightGroundColor.toUpperCase()}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Intensity - all lights */}
              <div className="property-row">
                <PropertyLabel label="Intensity" tooltip="Intensidade/brilho da luz" />
                <div className="slider-input">
                  <input type="range" min="0" max="10" step="0.1" value={lightIntensity} onChange={(e) => handleLightIntensityChange(e.target.value)} />
                  <input type="number" min="0" step="0.1" value={lightIntensity} onChange={(e) => handleLightIntensityChange(e.target.value)} />
                </div>
              </div>

              {/* Distance - Point and Spot */}
              {(lightType === 'PointLight' || lightType === 'SpotLight') && (
                <div className="property-row">
                  <PropertyLabel label="Distance" tooltip="Distância máxima da luz (0 = infinito)" />
                  <input type="number" value={lightDistance} onChange={(e) => handleLightDistanceChange(e.target.value)} step="1" min="0" />
                </div>
              )}

              {/* Decay - Point and Spot */}
              {(lightType === 'PointLight' || lightType === 'SpotLight') && (
                <div className="property-row">
                  <PropertyLabel label="Decay" tooltip="Quão rápido a luz diminui com a distância (2 = fisicamente correto)" />
                  <input type="number" value={lightDecay} onChange={(e) => handleLightDecayChange(e.target.value)} step="0.1" min="0" />
                </div>
              )}

              {/* Angle - Spot only */}
              {lightType === 'SpotLight' && (
                <div className="property-row">
                  <PropertyLabel label="Angle" tooltip="Ângulo do cone de luz em graus" />
                  <div className="slider-input">
                    <input type="range" min="0" max="90" step="1" value={(lightAngle * 180 / Math.PI).toFixed(0)} onChange={(e) => handleLightAngleChange(e.target.value)} />
                    <input type="number" min="0" max="90" step="1" value={(lightAngle * 180 / Math.PI).toFixed(0)} onChange={(e) => handleLightAngleChange(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Penumbra - Spot only */}
              {lightType === 'SpotLight' && (
                <div className="property-row">
                  <PropertyLabel label="Penumbra" tooltip="Suavidade da borda do cone (0 = dura, 1 = muito suave)" />
                  <div className="slider-input">
                    <input type="range" min="0" max="1" step="0.01" value={lightPenumbra} onChange={(e) => handleLightPenumbraChange(e.target.value)} />
                    <input type="number" min="0" max="1" step="0.01" value={lightPenumbra} onChange={(e) => handleLightPenumbraChange(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Width/Height - RectArea only */}
              {lightType === 'RectAreaLight' && (
                <>
                  <div className="property-row">
                    <PropertyLabel label="Width" tooltip="Largura da área de luz" />
                    <input type="number" value={lightWidth} onChange={(e) => handleLightWidthChange(e.target.value)} step="0.5" min="0.1" />
                  </div>
                  <div className="property-row">
                    <PropertyLabel label="Height" tooltip="Altura da área de luz" />
                    <input type="number" value={lightHeight} onChange={(e) => handleLightHeightChange(e.target.value)} step="0.5" min="0.1" />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Material */}
        {hasMaterial && !isLight && (
          <div className="inspector-section">
            <div className="section-header">
              <h4>Material</h4>
              <span className="section-guide" title="Propriedades visuais do objeto: cor, brilho, transparência e renderização">?</span>
            </div>
            <div className="section-content">
              {/* Color */}
              <div className="property-row">
                <PropertyLabel
                  label="Color"
                  tooltip="Cor base do material. Clique para abrir o seletor de cores."
                />
                <div className="color-input">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => handleColorChange(e.target.value)}
                  />
                  <span className="color-hex">{color.toUpperCase()}</span>
                </div>
              </div>

              {/* Metalness */}
              <div className="property-row">
                <PropertyLabel
                  label="Metalness"
                  tooltip="Quão metálico o material parece. 0 = não-metálico (plástico, madeira), 1 = totalmente metálico (ouro, prata)."
                />
                <div className="slider-input">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={metalness}
                    onChange={(e) => handleMetalnessChange(e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={metalness}
                    onChange={(e) => handleMetalnessChange(e.target.value)}
                  />
                </div>
              </div>

              {/* Roughness */}
              <div className="property-row">
                <PropertyLabel
                  label="Roughness"
                  tooltip="Rugosidade da superfície. 0 = espelhado/polido, 1 = fosco/áspero. Afeta como a luz reflete."
                />
                <div className="slider-input">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={roughness}
                    onChange={(e) => handleRoughnessChange(e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={roughness}
                    onChange={(e) => handleRoughnessChange(e.target.value)}
                  />
                </div>
              </div>

              {/* Opacity */}
              <div className="property-row">
                <PropertyLabel
                  label="Opacity"
                  tooltip="Opacidade do material. 1 = totalmente opaco, 0 = invisível. Ativa 'Transparent' automaticamente se menor que 1."
                />
                <div className="slider-input">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={opacity}
                    onChange={(e) => handleOpacityChange(e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={opacity}
                    onChange={(e) => handleOpacityChange(e.target.value)}
                  />
                </div>
              </div>

              {/* Side */}
              <div className="property-row">
                <PropertyLabel
                  label="Side"
                  tooltip="Qual lado do material é renderizado. Front = apenas frente, Back = apenas trás, Double = ambos os lados (útil para planos)."
                />
                <select
                  value={side}
                  onChange={(e) => handleSideChange(e.target.value)}
                  className="select-input"
                >
                  <option value="front">Front Side</option>
                  <option value="back">Back Side</option>
                  <option value="double">Double Side</option>
                </select>
              </div>

              {/* Emissive */}
              <div className="property-row">
                <PropertyLabel
                  label="Emissive"
                  tooltip="Cor de emissão (brilho próprio). O objeto parece brilhar com esta cor, independente da iluminação."
                />
                <div className="color-input">
                  <input
                    type="color"
                    value={emissive}
                    onChange={(e) => handleEmissiveChange(e.target.value)}
                  />
                  <span className="color-hex">{emissive.toUpperCase()}</span>
                </div>
              </div>

              {/* Emissive Intensity */}
              <div className="property-row">
                <PropertyLabel
                  label="Emissive Int."
                  tooltip="Intensidade do brilho emissivo. 0 = sem brilho, valores maiores = mais brilho."
                />
                <div className="slider-input">
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.1"
                    value={emissiveIntensity}
                    onChange={(e) => handleEmissiveIntensityChange(e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={emissiveIntensity}
                    onChange={(e) => handleEmissiveIntensityChange(e.target.value)}
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="property-row checkbox-group">
                <label className="checkbox-label" title="Mostra apenas as bordas/arestas do objeto como linhas">
                  <input
                    type="checkbox"
                    checked={wireframe}
                    onChange={(e) => handleWireframeChange(e.target.checked)}
                  />
                  <span>Wireframe</span>
                  <span className="guide-icon small">?</span>
                </label>
                <label className="checkbox-label" title="Usa sombreamento plano (cada face tem uma cor uniforme) em vez de suave">
                  <input
                    type="checkbox"
                    checked={flatShading}
                    onChange={(e) => handleFlatShadingChange(e.target.checked)}
                  />
                  <span>Flat Shading</span>
                  <span className="guide-icon small">?</span>
                </label>
                <label className="checkbox-label" title="Permite que o objeto seja semi-transparente. Necessário para Opacity menor que 1">
                  <input
                    type="checkbox"
                    checked={transparent}
                    onChange={(e) => handleTransparentChange(e.target.checked)}
                  />
                  <span>Transparent</span>
                  <span className="guide-icon small">?</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Rendering */}
        <div className="inspector-section">
          <div className="section-header">
            <h4>Rendering</h4>
            <span className="section-guide" title="Controla como o objeto é renderizado na cena: visibilidade e sombras">?</span>
          </div>
          <div className="section-content">
            <div className="property-row checkbox-group">
              <label className="checkbox-label" title="Se o objeto é visível na cena. Desmarque para esconder temporariamente">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => handleVisibleChange(e.target.checked)}
                />
                <span>Visible</span>
                <span className="guide-icon small">?</span>
              </label>
              <label className="checkbox-label" title="Se o objeto projeta sombra sobre outros objetos">
                <input
                  type="checkbox"
                  checked={castShadow}
                  onChange={(e) => handleCastShadowChange(e.target.checked)}
                />
                <span>Cast Shadow</span>
                <span className="guide-icon small">?</span>
              </label>
              <label className="checkbox-label" title="Se o objeto recebe/mostra sombras projetadas por outros objetos">
                <input
                  type="checkbox"
                  checked={receiveShadow}
                  onChange={(e) => handleReceiveShadowChange(e.target.checked)}
                />
                <span>Receive Shadow</span>
                <span className="guide-icon small">?</span>
              </label>
            </div>
          </div>
        </div>

        {/* Scripts */}
        <ScriptInspector
          selectedObject={selectedObject}
          scriptManager={scriptManager}
          onOpenScriptEditor={onOpenScriptEditor}
        />
      </div>
    </div>
  );
}
