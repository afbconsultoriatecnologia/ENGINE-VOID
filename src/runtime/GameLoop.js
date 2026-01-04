/**
 * GameLoop - Loop principal do jogo
 * Gerencia update e render em 60fps
 */
export default class GameLoop {
  constructor() {
    this.isRunning = false;
    this.lastTime = 0;
    this.deltaTime = 0;
    this.fps = 0;
    this.frameCount = 0;
    this.fpsUpdateTime = 0;

    // Callbacks
    this.onUpdate = null;  // (deltaTime) => {}
    this.onRender = null;  // () => {}
    this.onFixedUpdate = null; // (fixedDeltaTime) => {} - para física

    // Fixed timestep para física (60fps)
    this.fixedTimeStep = 1 / 60;
    this.accumulator = 0;

    // Bind do loop
    this.loop = this.loop.bind(this);
  }

  /**
   * Inicia o game loop
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTime = performance.now();
    this.fpsUpdateTime = this.lastTime;
    this.frameCount = 0;

    requestAnimationFrame(this.loop);
    console.log('[GameLoop] Started');
  }

  /**
   * Para o game loop
   */
  stop() {
    this.isRunning = false;
    console.log('[GameLoop] Stopped');
  }

  /**
   * Loop principal
   */
  loop(currentTime) {
    if (!this.isRunning) return;

    // Calcular delta time em segundos
    this.deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Limitar delta time para evitar spiral of death
    if (this.deltaTime > 0.25) {
      this.deltaTime = 0.25;
    }

    // Fixed update para física (timestep fixo)
    this.accumulator += this.deltaTime;
    while (this.accumulator >= this.fixedTimeStep) {
      if (this.onFixedUpdate) {
        this.onFixedUpdate(this.fixedTimeStep);
      }
      this.accumulator -= this.fixedTimeStep;
    }

    // Update normal (frame-dependent)
    if (this.onUpdate) {
      this.onUpdate(this.deltaTime);
    }

    // Render
    if (this.onRender) {
      this.onRender();
    }

    // Calcular FPS
    this.frameCount++;
    if (currentTime - this.fpsUpdateTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsUpdateTime = currentTime;
    }

    // Próximo frame
    requestAnimationFrame(this.loop);
  }

  /**
   * Retorna o FPS atual
   */
  getFPS() {
    return this.fps;
  }

  /**
   * Retorna o delta time do último frame
   */
  getDeltaTime() {
    return this.deltaTime;
  }
}
