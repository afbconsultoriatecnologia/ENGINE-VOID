/**
 * Tipos compartilhados entre Editor e Core
 *
 * Estes tipos são usados para comunicação entre
 * o frontend (React) e o backend (TS/Rust).
 */

// Re-exportar tipos do IEngineCore
export type {
  EntityId,
  Vec3,
  Quaternion,
  Transform,
  EntityType,
  EntityParams,
  EntityData,
  QueryFilter,
  RaycastHit,
  SceneData,
  IEngineCore
} from './IEngineCore';

// ==================== Eventos ====================

export type EditorEventType =
  | 'entity:created'
  | 'entity:destroyed'
  | 'entity:updated'
  | 'selection:changed'
  | 'scene:loaded'
  | 'scene:saved'
  | 'transform:changed'
  | 'component:added'
  | 'component:removed';

export interface EditorEvent<T = unknown> {
  type: EditorEventType;
  timestamp: number;
  data: T;
}

// ==================== Commands (Undo/Redo) ====================

export interface Command {
  id: string;
  type: string;
  description: string;
  execute(): void;
  undo(): void;
}

// ==================== Material ====================

export interface MaterialData {
  color: string; // hex
  metalness: number;
  roughness: number;
  opacity: number;
  transparent: boolean;
  emissive: string;
  emissiveIntensity: number;
  wireframe: boolean;
  flatShading: boolean;
  side: 'front' | 'back' | 'double';
}

// ==================== Geometry ====================

export type GeometryType =
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'plane'
  | 'torus'
  | 'ring'
  | 'capsule';

export interface GeometryParams {
  type: GeometryType;
  [key: string]: unknown;
}

// ==================== Light ====================

export type LightType =
  | 'ambient'
  | 'directional'
  | 'point'
  | 'spot'
  | 'hemisphere'
  | 'rectarea';

export interface LightData {
  type: LightType;
  color: string;
  intensity: number;
  castShadow?: boolean;
  // Propriedades específicas por tipo
  distance?: number;
  decay?: number;
  angle?: number;
  penumbra?: number;
  groundColor?: string;
  width?: number;
  height?: number;
}
