import { useState, useEffect } from 'react';
import { Project, TimeEntry } from '../types';

interface EventModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: TimeEntry;
  slot?: { start: Date; end: Date };
  selectedDate?: Date;
  projects: Project[];
  onClose: () => void;
  onSave: (data: Partial<TimeEntry>) => void;
  onDelete: () => void;
  onAddProject: (title: string) => Project;
}

export const EventModal = ({
  isOpen,
  mode,
  initialData,
  slot,
  selectedDate,
  projects,
  onClose,
  onSave,
  onDelete,
  onAddProject
}: EventModalProps) => {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [description, setDescription] = useState('');
  const [newProjectMode, setNewProjectMode] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Track only times since dates are fixed to selectedDate
  const [startTimeStr, setStartTimeStr] = useState('');
  const [endTimeStr, setEndTimeStr] = useState('');

  const formatTimeForInput = (date: Date) => {
    if (!date) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.title || '');
      setProjectId(initialData?.projectId || '');
      setDescription(initialData?.description || '');
      setNewProjectMode(false);
      setNewProjectTitle('');
      setError(null);
      
      let baseDate = new Date();
      
      if (initialData?.start) {
        baseDate = new Date(initialData.start);
      } else if (slot?.start) {
        baseDate = new Date(slot.start);
      } else if (selectedDate) {
        baseDate = new Date(selectedDate);
      }
      
      setStartTimeStr(formatTimeForInput(baseDate));
      
      let endBaseDate = new Date(baseDate);
      if (initialData?.end) {
        endBaseDate = new Date(initialData.end);
      } else if (slot?.end) {
        endBaseDate = new Date(slot.end);
      } else {
        // Default end to +1 hour if not specified
        endBaseDate.setHours(endBaseDate.getHours() + 1);
      }
      
      setEndTimeStr(formatTimeForInput(endBaseDate));
    }
  }, [isOpen, initialData, slot, selectedDate]);

  if (!isOpen) return null;

  const handleSave = () => {
    setError(null);

    if (!startTimeStr || !endTimeStr) {
      setError("Please fill in start and end times.");
      return;
    }

    let startDate: Date;
    let endDate: Date;

    if (selectedDate) {
      // If we have a selectedDate, we use it as the base
      startDate = new Date(selectedDate);
      const [h, m] = startTimeStr.split(':').map(Number);
      startDate.setHours(h ?? 0, m ?? 0, 0, 0);

      // For the end date, if initialData/slot had a different day, keep it?
      // But the prompt says "they all happen in the selected day".
      // Let's assume if it's multi-day, we might want to keep the original day if provided,
      // but the prompt says "the start and end should only be time based, they all happen in the selected day".
      // This implies even for multi-day events, if we are editing them in this modal, we are fixing them to today.
      // However, if it's a "create" mode, it's definitely on the selected day.
      
      // Let's stick to the selected day for both start and end.
      endDate = new Date(selectedDate);
      const [eh, em] = endTimeStr.split(':').map(Number);
      endDate.setHours(eh ?? 0, em ?? 0, 0, 0);
    } else {
      // Fallback if no selectedDate is provided (shouldn't happen with our changes)
      startDate = new Date();
      const [h, m] = startTimeStr.split(':').map(Number);
      startDate.setHours(h ?? 0, m ?? 0, 0, 0);
      endDate = new Date(startDate);
      const [eh, em] = endTimeStr.split(':').map(Number);
      endDate.setHours(eh ?? 0, em ?? 0, 0, 0);
    }

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      setError("Invalid date/time format.");
      return;
    }

    if (endDate < startDate) {
      setError("End time must be after start time.");
      return;
    }
    
    // Simple sanitization/limits
    const safeTitle = title.slice(0, 100);
    const safeDescription = description.slice(0, 500);

    if (newProjectMode && newProjectTitle.trim()) {
      const safeProjectTitle = newProjectTitle.trim().slice(0, 100);
      const newProj = onAddProject(safeProjectTitle);
      onSave({
        title: safeTitle,
        projectId: newProj.id,
        description: safeDescription,
        start: startDate,
        end: endDate
      });
    } else {
      onSave({
        title: safeTitle,
        projectId,
        description: safeDescription,
        start: startDate,
        end: endDate
      });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          {mode === 'create' ? 'New Event' : 'Edit Event'}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
        </div>

        {error && (
          <div style={{
            color: 'var(--indicator-color)',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            padding: '8px 12px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '0.85rem',
            fontWeight: 500,
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="event-title">Title</label>
          <input id="event-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={100} autoFocus />
        </div>
        
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor="event-start-time">Start</label>
            <input id="event-start-time" type="time" value={startTimeStr} onChange={e => setStartTimeStr(e.target.value)} style={{ width: '100%' }} aria-label="Start" />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor="event-end-time">End</label>
            <input id="event-end-time" type="time" value={endTimeStr} onChange={e => setEndTimeStr(e.target.value)} style={{ width: '100%' }} aria-label="End" />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="event-project">Project</label>
          {!newProjectMode ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <select id="event-project" value={projectId} onChange={e => setProjectId(e.target.value)} style={{ flex: 1 }}>
                <option value="">No Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <button type="button" className="btn" onClick={() => setNewProjectMode(true)}>New</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                id="event-project-new"
                placeholder="New project title"
                value={newProjectTitle}
                onChange={e => setNewProjectTitle(e.target.value)}
                maxLength={100}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn" onClick={() => setNewProjectMode(false)}>Cancel</button>
            </div>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="event-description">Description</label>
          <textarea id="event-description" value={description} onChange={e => setDescription(e.target.value)} maxLength={500} />
        </div>
        <div className="modal-actions">
          {mode === 'edit' && (
            <button type="button" className="btn" style={{ marginRight: 'auto', color: 'var(--indicator-color)', borderColor: 'var(--indicator-color)' }} onClick={onDelete}>
              Delete
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
};
