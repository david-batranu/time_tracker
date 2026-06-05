import React, { useState, useEffect } from 'react';
import { Project } from '../types';

interface ProjectItemProps {
  project: Project;
  hasEvents: boolean;
  onSave: (project: Project) => void;
  onDelete: (projectId: string) => void;
}

export const ProjectItem = React.memo(({ project, hasEvents, onSave, onDelete }: ProjectItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(project.title);

  const resolveColor = (c: string) => {
    if (c && c.startsWith('var(')) {
      const varName = c.match(/var\(([^)]+)\)/)?.[1];
      if (varName) {
        return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      }
    }
    return c || '#e0e7ff';
  };

  const [color, setColor] = useState(resolveColor(project.color));

  useEffect(() => {
    setColor(resolveColor(project.color));
    setTitle(project.title);
  }, [project]);

  const handleSave = () => {
    onSave({ ...project, title: title.slice(0, 100), color });
    setIsEditing(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
      {isEditing ? (
        <>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ padding: 0, border: 'none', background: 'none', width: '24px', height: '24px', cursor: 'pointer' }} />
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} style={{ flex: 1, padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: '4px' }} autoFocus />
          <button className="btn primary" onClick={handleSave} style={{ padding: '4px 8px' }}>Save</button>
          <button className="btn" onClick={() => { setIsEditing(false); setTitle(project.title); setColor(project.color); }} style={{ padding: '4px 8px' }}>Cancel</button>
        </>
      ) : (
        <>
          <div style={{ width: '20px', height: '20px', backgroundColor: resolveColor(project.color), borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>{project.title}</div>
          <button className="btn" onClick={() => setIsEditing(true)} style={{ padding: '4px 8px' }}>Edit</button>
          <button
            className="btn"
            style={{ padding: '4px 8px', color: hasEvents ? 'var(--text-secondary)' : 'var(--indicator-color)', borderColor: hasEvents ? 'var(--border-color)' : 'var(--indicator-color)', opacity: hasEvents ? 0.5 : 1, cursor: hasEvents ? 'not-allowed' : 'pointer' }}
            onClick={() => !hasEvents && onDelete(project.id)}
            title={hasEvents ? "Cannot delete project with assigned events" : ""}
            disabled={hasEvents}
          >
            Delete
          </button>
        </>
      )}
    </div>
  );
});

ProjectItem.displayName = 'ProjectItem';
