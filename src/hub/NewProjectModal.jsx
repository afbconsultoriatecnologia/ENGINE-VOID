import React, { useState } from 'react';

/**
 * NewProjectModal - Modal para criar novo projeto
 */
export default function NewProjectModal({ isOpen, onClose, onCreate }) {
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState('3d');
  const [template, setTemplate] = useState('empty');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const templates = {
    '3d': [
      { id: 'empty', name: 'Empty 3D', description: 'Projeto 3D vazio com cena básica', icon: '📦' },
      { id: 'first-person', name: 'First Person', description: 'Template FPS com controles em primeira pessoa', icon: '🎯' },
      { id: 'third-person', name: 'Third Person', description: 'Template com câmera em terceira pessoa', icon: '🏃' },
      { id: 'isometric', name: 'Isometric RPG', description: 'Template isométrico estilo Diablo/MU', icon: '⚔️' }
    ],
    '2d': [
      { id: 'empty', name: 'Empty 2D', description: 'Projeto 2D vazio com câmera ortográfica', icon: '🖼️' },
      { id: 'platformer', name: 'Platformer', description: 'Template de plataforma 2D', icon: '🍄' },
      { id: 'topdown', name: 'Top Down', description: 'Template top-down 2D', icon: '🗺️' },
      { id: 'pixel-art', name: 'Pixel Art', description: 'Configurado para pixel art (16x16)', icon: '👾' }
    ]
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!projectName.trim()) {
      setError('Digite um nome para o projeto');
      return;
    }

    // Validar nome (sem caracteres especiais problemáticos)
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(projectName)) {
      setError('Nome deve conter apenas letras, números, espaços, hífens e underlines');
      return;
    }

    setError('');
    setIsCreating(true);

    try {
      await onCreate(projectName.trim(), projectType, template);
      // Reset form
      setProjectName('');
      setProjectType('3d');
      setTemplate('empty');
      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao criar projeto');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setProjectName('');
      setProjectType('3d');
      setTemplate('empty');
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content new-project-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>Novo Projeto</h2>
          <button className="modal-close" onClick={handleClose} disabled={isCreating}>
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Nome do Projeto */}
            <div className="form-group">
              <label htmlFor="projectName">Nome do Projeto</label>
              <input
                type="text"
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Meu Jogo Incrível"
                autoFocus
                disabled={isCreating}
              />
            </div>

            {/* Tipo do Projeto */}
            <div className="form-group">
              <label>Tipo de Projeto</label>
              <div className="type-selector">
                <button
                  type="button"
                  className={`type-option ${projectType === '3d' ? 'selected' : ''}`}
                  onClick={() => {
                    setProjectType('3d');
                    setTemplate('empty');
                  }}
                  disabled={isCreating}
                >
                  <span className="type-icon">🎲</span>
                  <span className="type-name">3D</span>
                  <span className="type-desc">Jogos em 3 dimensões</span>
                </button>
                <button
                  type="button"
                  className={`type-option ${projectType === '2d' ? 'selected' : ''}`}
                  onClick={() => {
                    setProjectType('2d');
                    setTemplate('empty');
                  }}
                  disabled={isCreating}
                >
                  <span className="type-icon">🎮</span>
                  <span className="type-name">2D</span>
                  <span className="type-desc">Jogos 2D e Pixel Art</span>
                </button>
              </div>
            </div>

            {/* Templates */}
            <div className="form-group">
              <label>Template</label>
              <div className="template-grid">
                {templates[projectType].map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    className={`template-option ${template === tmpl.id ? 'selected' : ''}`}
                    onClick={() => setTemplate(tmpl.id)}
                    disabled={isCreating}
                  >
                    <span className="template-icon">{tmpl.icon}</span>
                    <span className="template-name">{tmpl.name}</span>
                    <span className="template-desc">{tmpl.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="form-error">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isCreating || !projectName.trim()}
            >
              {isCreating ? 'Criando...' : 'Criar Projeto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
