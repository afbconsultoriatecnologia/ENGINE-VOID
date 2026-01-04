import React from 'react';

/**
 * ProjectCard - Card de projeto para o Project Hub
 */
export default function ProjectCard({ project, onOpen, onDelete, isRecent = false }) {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getTypeIcon = (type) => {
    return type === '2d' ? '🎮' : '🎲';
  };

  const getTypeLabel = (type) => {
    return type === '2d' ? '2D' : '3D';
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Tem certeza que deseja deletar o projeto "${project.name}"?\n\nEsta ação não pode ser desfeita.`)) {
      onDelete(project.path || project.folderName);
    }
  };

  return (
    <div
      className="project-card"
      onClick={() => onOpen(project.path || project.folderName)}
    >
      {/* Thumbnail / Preview */}
      <div className="project-thumbnail">
        <div className="project-type-badge">
          <span className="type-icon">{getTypeIcon(project.type)}</span>
          <span className="type-label">{getTypeLabel(project.type)}</span>
        </div>
        {/* Placeholder para preview */}
        <div className="thumbnail-placeholder">
          <span className="thumbnail-icon">
            {project.type === '2d' ? '⬛' : '🧊'}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="project-info">
        <h3 className="project-name">{project.name}</h3>
        <div className="project-meta">
          <span className="project-date">
            {isRecent ? (
              <>Aberto: {formatDate(project.lastOpened)}</>
            ) : (
              <>Atualizado: {formatDate(project.updatedAt)}</>
            )}
          </span>
        </div>
        {project.version && (
          <span className="project-version">v{project.version}</span>
        )}
      </div>

      {/* Actions */}
      <div className="project-actions">
        <button
          className="action-btn open-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(project.path || project.folderName);
          }}
          title="Abrir Projeto"
        >
          ▶
        </button>
        <button
          className="action-btn delete-btn"
          onClick={handleDelete}
          title="Deletar Projeto"
        >
          🗑
        </button>
      </div>
    </div>
  );
}
