/**
 * IEngineCore - Interface do Core Engine
 *
 * Define o contrato que tanto a implementação TypeScript
 * quanto a implementação Rust/WASM devem seguir.
 *
 * Esta interface é a base para o sistema multi-backend.
 */

// ==================== Tipos Base ====================

export type EntityId = string;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Transform {
  position: Vec3;
  rotation: Vec3; // Euler angles em radianos
  scale: Vec3;
}

export type EntityType = 'mesh' | 'light' | 'camera' | 'empty';

export interface EntityParams {
  name?: string;
  transform?: Partial<Transform>;
  parent?: EntityId;
  [key: string]: unknown;
}

export interface EntityData {
  id: EntityId;
  name: string;
  type: EntityType;
  transform: Transform;
  parent: EntityId | null;
  children: EntityId[];
  components: Record<string, unknown>;
}

export interface QueryFilter {
  type?: EntityType;
  name?: string;
  hasComponent?: string;
  inRadius?: { center: Vec3; radius: number };
}

export interface RaycastHit {
  entityId: EntityId;
  point: Vec3;
  normal: Vec3;
  distance: number;
}

export interface SceneData {
  version: string;
  entities: EntityData[];
  settings: Record<string, unknown>;
}

// ==================== Interface Principal ====================

export interface IEngineCore {
  // ==================== Entity Management ====================

  /**
   * Cria uma nova entidade
   */
  createEntity(type: EntityType, params?: EntityParams): EntityId;

  /**
   * Remove uma entidade
   */
  destroyEntity(id: EntityId): void;

  /**
   * Obtém dados de uma entidade
   */
  getEntity(id: EntityId): EntityData | null;

  /**
   * Busca entidades com filtro
   */
  queryEntities(filter?: QueryFilter): EntityData[];

  // ==================== Transform ====================

  /**
   * Define o transform de uma entidade
   */
  setTransform(id: EntityId, transform: Partial<Transform>): void;

  /**
   * Obtém o transform de uma entidade
   */
  getTransform(id: EntityId): Transform | null;

  /**
   * Obtém o transform mundial (considerando hierarquia)
   */
  getWorldTransform(id: EntityId): Transform | null;

  // ==================== Hierarchy ====================

  /**
   * Define o parent de uma entidade
   */
  setParent(id: EntityId, parentId: EntityId | null): void;

  /**
   * Obtém filhos de uma entidade
   */
  getChildren(id: EntityId): EntityId[];

  // ==================== Components ====================

  /**
   * Adiciona um componente a uma entidade
   */
  addComponent<T>(id: EntityId, componentType: string, data: T): void;

  /**
   * Obtém um componente de uma entidade
   */
  getComponent<T>(id: EntityId, componentType: string): T | null;

  /**
   * Remove um componente de uma entidade
   */
  removeComponent(id: EntityId, componentType: string): void;

  // ==================== Scene ====================

  /**
   * Carrega uma cena a partir de dados JSON
   */
  loadScene(data: SceneData): void;

  /**
   * Serializa a cena atual para JSON
   */
  saveScene(): SceneData;

  /**
   * Limpa a cena atual
   */
  clearScene(): void;

  // ==================== Physics (opcional) ====================

  /**
   * Avança a simulação física
   */
  stepPhysics?(deltaTime: number): void;

  /**
   * Lança um raio e retorna colisões
   */
  raycast?(origin: Vec3, direction: Vec3, maxDistance?: number): RaycastHit | null;

  // ==================== Lifecycle ====================

  /**
   * Inicializa o core
   */
  init(): Promise<void>;

  /**
   * Atualiza o core (chamado a cada frame)
   */
  update(deltaTime: number): void;

  /**
   * Libera recursos
   */
  dispose(): void;
}
