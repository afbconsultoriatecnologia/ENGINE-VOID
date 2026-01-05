import React, { useState, useEffect } from 'react';
import projectManager from './ProjectManager';
import ProjectCard from './ProjectCard';
import NewProjectModal from './NewProjectModal';
import './ProjectHub.css';

/**
 * ProjectHub - Tela principal de gerenciamento de projetos
 * Estilo Unity Hub
 */
export default function ProjectHub({ onProjectOpen }) {
  const [projects, setProjects] = useState([]);
  const [recentProjects, setRecentProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [activeTab, setActiveTab] = useState('projects'); // 'projects' | 'recent' | 'learn'
  const [searchQuery, setSearchQuery] = useState('');

  // Estado para modal de confirmação de delete
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { project, isDeleting }

  // Carregar projetos na inicialização
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      await projectManager.initialize();
      const allProjects = await projectManager.listProjects();
      const recent = projectManager.getRecentProjects();

      setProjects(allProjects);
      setRecentProjects(recent);
    } catch (e) {
      console.error('Failed to load projects:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async (name, type, template) => {
    try {
      const project = await projectManager.createProject(name, type, template);
      await loadProjects(); // Recarregar lista
      onProjectOpen(project); // Abrir o projeto criado
    } catch (e) {
      console.error('Failed to create project:', e);
      throw e;
    }
  };

  const handleOpenProject = async (projectPath) => {
    try {
      const project = await projectManager.openProject(projectPath);
      onProjectOpen(project);
    } catch (e) {
      console.error('Failed to open project:', e);
      alert('Erro ao abrir projeto: ' + e.message);
    }
  };

  // Solicitar confirmação de delete (abre modal)
  const handleRequestDelete = (project) => {
    setDeleteConfirm({ project, isDeleting: false });
  };

  // Confirmar delete
  const handleConfirmDelete = async () => {
    if (!deleteConfirm?.project) return;

    setDeleteConfirm(prev => ({ ...prev, isDeleting: true }));

    try {
      const projectPath = deleteConfirm.project.path || deleteConfirm.project.folderName;
      await projectManager.deleteProject(projectPath);
      await loadProjects(); // Recarregar lista
      setDeleteConfirm(null); // Fechar modal
    } catch (e) {
      console.error('Failed to delete project:', e);
      alert('Erro ao deletar projeto: ' + e.message);
      setDeleteConfirm(null);
    }
  };

  // Cancelar delete
  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  const handleImportProject = async () => {
    try {
      const project = await projectManager.importProject();
      if (project) {
        await loadProjects();
        onProjectOpen(project);
      }
    } catch (e) {
      console.error('Failed to import project:', e);
      alert('Erro ao importar projeto: ' + e.message);
    }
  };

  // Filtrar projetos pela busca
  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRecent = recentProjects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="project-hub">
      {/* Sidebar */}
      <aside className="hub-sidebar">
        <div className="hub-logo">
          <div className="logo-icon">◆</div>
          <div className="logo-text">
            <span className="logo-name">ENGINE VOID</span>
            <span className="logo-version">v0.5.0</span>
          </div>
        </div>

        <nav className="hub-nav">
          <button
            className={`nav-item ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            <span className="nav-icon">📁</span>
            <span className="nav-label">Projetos</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'recent' ? 'active' : ''}`}
            onClick={() => setActiveTab('recent')}
          >
            <span className="nav-icon">🕐</span>
            <span className="nav-label">Recentes</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'learn' ? 'active' : ''}`}
            onClick={() => setActiveTab('learn')}
          >
            <span className="nav-icon">📚</span>
            <span className="nav-label">Aprender</span>
          </button>
        </nav>

        <div className="hub-sidebar-footer">
          <div className="hub-info">
            <span>TypeScript + Rust/WASM</span>
            <span>Tauri 2.0</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="hub-main">
        {/* Header */}
        <header className="hub-header">
          <div className="header-title">
            {activeTab === 'projects' && <h1>Meus Projetos</h1>}
            {activeTab === 'recent' && <h1>Projetos Recentes</h1>}
            {activeTab === 'learn' && <h1>Aprender</h1>}
          </div>

          <div className="header-actions">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Buscar projetos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <button
              className="btn btn-secondary"
              onClick={handleImportProject}
              title="Importar projeto existente"
            >
              📂 Importar
            </button>

            <button
              className="btn btn-primary"
              onClick={() => setShowNewProjectModal(true)}
            >
              ➕ Novo Projeto
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="hub-content">
          {isLoading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <span>Carregando projetos...</span>
            </div>
          ) : (
            <>
              {/* Projects Tab */}
              {activeTab === 'projects' && (
                <div className="projects-grid">
                  {filteredProjects.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📦</div>
                      <h3>Nenhum projeto encontrado</h3>
                      <p>Crie seu primeiro projeto ou importe um existente</p>
                      <button
                        className="btn btn-primary"
                        onClick={() => setShowNewProjectModal(true)}
                      >
                        ➕ Criar Projeto
                      </button>
                    </div>
                  ) : (
                    filteredProjects.map((project) => (
                      <ProjectCard
                        key={project.path || project.folderName}
                        project={project}
                        onOpen={handleOpenProject}
                        onRequestDelete={handleRequestDelete}
                      />
                    ))
                  )}
                </div>
              )}

              {/* Recent Tab */}
              {activeTab === 'recent' && (
                <div className="projects-grid">
                  {filteredRecent.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">🕐</div>
                      <h3>Nenhum projeto recente</h3>
                      <p>Projetos abertos recentemente aparecerão aqui</p>
                    </div>
                  ) : (
                    filteredRecent.map((project) => (
                      <ProjectCard
                        key={project.path}
                        project={project}
                        onOpen={handleOpenProject}
                        onRequestDelete={handleRequestDelete}
                        isRecent
                      />
                    ))
                  )}
                </div>
              )}

              {/* Learn Tab */}
              {activeTab === 'learn' && (
                <div className="learn-content">
                  <div className="learn-section">
                    <h2>Começando</h2>
                    <div className="learn-cards">
                      <div className="learn-card">
                        <span className="learn-icon">🎮</span>
                        <h3>Primeiro Projeto 3D</h3>
                        <p>Aprenda a criar seu primeiro jogo 3D com ENGINE VOID</p>
                      </div>
                      <div className="learn-card">
                        <span className="learn-icon">🕹️</span>
                        <h3>Primeiro Projeto 2D</h3>
                        <p>Crie um jogo 2D estilo platformer do zero</p>
                      </div>
                      <div className="learn-card">
                        <span className="learn-icon">📝</span>
                        <h3>Sistema de Scripts</h3>
                        <p>Aprenda a criar comportamentos com JavaScript</p>
                      </div>
                    </div>
                  </div>

                  <div className="learn-section">
                    <h2>Recursos</h2>
                    <div className="learn-cards">
                      <div className="learn-card">
                        <span className="learn-icon">📖</span>
                        <h3>Documentação</h3>
                        <p>Guia completo de todas as funcionalidades</p>
                      </div>
                      <div className="learn-card">
                        <span className="learn-icon">💬</span>
                        <h3>Comunidade</h3>
                        <p>Tire dúvidas e compartilhe seus projetos</p>
                      </div>
                      <div className="learn-card">
                        <span className="learn-icon">🎨</span>
                        <h3>Assets Gratuitos</h3>
                        <p>Biblioteca de modelos, texturas e sons</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onCreate={handleCreateProject}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirmar Exclusão</h2>
              <button className="modal-close" onClick={handleCancelDelete} disabled={deleteConfirm.isDeleting}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="delete-warning">
                <span className="warning-icon">⚠️</span>
                <p>
                  Tem certeza que deseja deletar o projeto <strong>"{deleteConfirm.project.name}"</strong>?
                </p>
                <p className="warning-text">Esta ação não pode ser desfeita.</p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancelDelete}
                disabled={deleteConfirm.isDeleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={deleteConfirm.isDeleting}
              >
                {deleteConfirm.isDeleting ? 'Deletando...' : 'Deletar Projeto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
