import { useState, useMemo } from 'react';
import { Project, TimeEntry } from '../types';
import { ProjectItem } from './ProjectItem';

interface ProjectsModalProps {
  isOpen: boolean;
  projects: Project[];
  events: TimeEntry[];
  onClose: () => void;
  onSaveProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onAddProject: (title: string) => void;
}

export const ProjectsModal = ({
  isOpen,
  projects,
  events,
  onClose,
  onSaveProject,
  onDeleteProject,
  onAddProject
}: ProjectsModalProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  // Pre-compute project IDs that have events for O(1) lookups in render loop
  const projectsWithEvents = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (e.projectId) {
        set.add(e.projectId);
      }
    }
    return set;
  }, [events]);

  if (!isOpen) return null;

  const handleAdd = () => {
    if (newTitle.trim()) {
      onAddProject(newTitle.trim().slice(0, 100));
      setNewTitle('');
      setIsAdding(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content projects-modal">
        <div className="modal-header">
          Manage Projects
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          {!isAdding ? (
            <button className="btn primary" style={{ width: '100%' }} onClick={() => setIsAdding(true)}>
              + Add New Project
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px', padding: '8px', backgroundColor: 'var(--today-bg)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <input
                placeholder="Project title..."
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                maxLength={100}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                style={{ flex: 1, padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                autoFocus
              />
              <button className="btn primary" onClick={handleAdd} style={{ padding: '4px 12px' }}>Add</button>
              <button className="btn" onClick={() => { setIsAdding(false); setNewTitle(''); }} style={{ padding: '4px 12px' }}>Cancel</button>
            </div>
          )}
        </div>

        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {projects.map((p) => {
            const hasEvents = projectsWithEvents.has(p.id);
            return (
              <ProjectItem 
                key={p.id} 
                project={p} 
                hasEvents={hasEvents} 
                onSave={onSaveProject} 
                onDelete={onDeleteProject} 
              />
            );
          })}
          {projects.length === 0 && !isAdding && (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
              No projects found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
