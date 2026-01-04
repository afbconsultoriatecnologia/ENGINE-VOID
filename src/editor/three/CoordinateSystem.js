/**
 * Sistema de configuração de coordenadas e escalas
 * Permite configurar diferentes sistemas de coordenadas e escalas para o jogo
 */
export class CoordinateSystem {
  /**
   * Construtor do sistema de coordenadas
   * @param {Object} config - Configuração inicial
   */
  constructor(config = {}) {
    this.config = {
      // Sistema de coordenadas (right-handed, left-handed)
      coordinateSystem: config.coordinateSystem || 'right-handed', // 'right-handed' | 'left-handed'
      
      // Unidades de escala
      unitScale: config.unitScale || 1, // 1 unidade = X metros
      unitName: config.unitName || 'meter', // 'meter' | 'centimeter' | 'inch' | 'foot'
      
      // Escalas por eixo (para sistemas não uniformes)
      axisScales: config.axisScales || { x: 1, y: 1, z: 1 },
      
      // Grid settings
      gridSize: config.gridSize || 1, // Tamanho de cada célula do grid
      gridDivisions: config.gridDivisions || 10, // Divisões do grid
      
      // Snap settings
      snapEnabled: config.snapEnabled !== false,
      snapDistance: config.snapDistance || 0.1, // Distância de snap
      snapAngle: config.snapAngle || 15, // Snap de rotação em graus
      
      // Display settings
      showGrid: config.showGrid !== false,
      showAxes: config.showAxes !== false,
      axesSize: config.axesSize || 5,
      
      ...config
    };
  }

  /**
   * Converte coordenadas do sistema de jogo para Three.js
   * @param {Array<number>} position - Posição [x, y, z]
   * @returns {Array<number>} Posição convertida
   */
  toThreeJS(position) {
    let [x, y, z] = position;
    
    // Aplicar escalas por eixo
    x *= this.config.axisScales.x;
    y *= this.config.axisScales.y;
    z *= this.config.axisScales.z;
    
    // Converter sistema de coordenadas se necessário
    if (this.config.coordinateSystem === 'left-handed') {
      z = -z;
    }
    
    // Aplicar escala de unidade
    const scale = this.config.unitScale;
    return [x * scale, y * scale, z * scale];
  }

  /**
   * Converte coordenadas do Three.js para o sistema de jogo
   * @param {Array<number>} position - Posição [x, y, z]
   * @returns {Array<number>} Posição convertida
   */
  fromThreeJS(position) {
    let [x, y, z] = position;
    
    // Reverter escala de unidade
    const scale = this.config.unitScale;
    x /= scale;
    y /= scale;
    z /= scale;
    
    // Reverter sistema de coordenadas se necessário
    if (this.config.coordinateSystem === 'left-handed') {
      z = -z;
    }
    
    // Reverter escalas por eixo
    x /= this.config.axisScales.x;
    y /= this.config.axisScales.y;
    z /= this.config.axisScales.z;
    
    return [x, y, z];
  }

  /**
   * Aplica snap a uma posição
   * @param {Array<number>} position - Posição [x, y, z]
   * @returns {Array<number>} Posição com snap aplicado
   */
  snapPosition(position) {
    if (!this.config.snapEnabled) return position;
    
    const snap = this.config.snapDistance;
    return position.map(coord => Math.round(coord / snap) * snap);
  }

  /**
   * Aplica snap a um ângulo
   * @param {number} angle - Ângulo em graus
   * @returns {number} Ângulo com snap aplicado
   */
  snapAngle(angle) {
    if (!this.config.snapEnabled) return angle;
    
    const snap = this.config.snapAngle;
    return Math.round(angle / snap) * snap;
  }

  /**
   * Converte unidades para metros
   * @param {number} value - Valor na unidade configurada
   * @returns {number} Valor em metros
   */
  toMeters(value) {
    const conversions = {
      meter: 1,
      centimeter: 0.01,
      inch: 0.0254,
      foot: 0.3048
    };
    
    return value * (conversions[this.config.unitName] || 1);
  }

  /**
   * Converte metros para unidades configuradas
   * @param {number} meters - Valor em metros
   * @returns {number} Valor na unidade configurada
   */
  fromMeters(meters) {
    const conversions = {
      meter: 1,
      centimeter: 0.01,
      inch: 0.0254,
      foot: 0.3048
    };
    
    return meters / (conversions[this.config.unitName] || 1);
  }

  /**
   * Atualiza a configuração
   * @param {Object} newConfig - Nova configuração
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Obtém a configuração atual
   * @returns {Object} Configuração atual
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Formata uma posição para exibição
   * @param {Array<number>} position - Posição [x, y, z]
   * @returns {string} String formatada
   */
  formatPosition(position) {
    const [x, y, z] = position;
    const unit = this.config.unitName === 'meter' ? 'm' : 
                 this.config.unitName === 'centimeter' ? 'cm' :
                 this.config.unitName === 'inch' ? 'in' : 'ft';
    
    return `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}) ${unit}`;
  }
}

