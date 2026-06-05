import { useState, useEffect } from 'react';
import { Project, TimeEntry } from '../types';

interface EventModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: TimeEntry;
  slot?: { start: Date; end: Date };
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
  
  // We need to keep track of full dates to support multi-day events
  const [startDateStr, setStartDateStr] = useState('');
  const [startTimeStr, setStartTimeStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');
  const [endTimeStr, setEndTimeStr] = useState('');

  const formatTimeForInput = (date: Date) => {
    if (!date) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const formatDateForInput = (date: Date) => {
    if (!date) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.title || '');
      setProjectId(initialData?.projectId || '');
      setDescription(initialData?.description || '');
      setNewProjectMode(false);
      setNewProjectTitle('');
      
      let startD = new Date();
      let endD = new Date();
      
      if (initialData?.start) {
        startD = new Date(initialData.start);
      } else if (slot?.start) {
        startD = new Date(slot.start);
      }
      
      if (initialData?.end) {
        endD = new Date(initialData.end);
      } else if (slot?.end) {
        endD = new Date(slot.end);
      } else {
        // Default end to +1 hour if not specified
        endD = new Date(startD);
        endD.setHours(endD.getHours() + 1);
      }

      setStartDateStr(formatDateForInput(startD));
      setStartTimeStr(formatTimeForInput(startD));
      
      setEndDateStr(formatDateForInput(endD));
      setEndTimeStr(formatTimeForInput(endD));
    }
  }, [isOpen, initialData, slot]);

  if (!isOpen) return null;

  const handleSave = () => {
    // Reconstruct start and end dates from strings
    const startDate = new Date(`${startDateStr}T${startTimeStr || '00:00'}:00`);
    const endDate = new Date(`${endDateStr}T${endTimeStr || '00:00'}:00`);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      alert("Invalid date/time format.");
      return;
    }

    if (endDate < startDate) {
      alert("End time must be after start time.");
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
        <div className="form-group">
          <label>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} autoFocus />
        </div>
        
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Start Date & Time</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="date" value={startDateStr} onChange={e => setStartDateStr(e.target.value)} style={{ flex: 2 }} />
              <input type="time" value={startTimeStr} onChange={e => setStartTimeStr(e.target.value)} style={{ flex: 1 }} />
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>End Date & Time</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="date" value={endDateStr} onChange={e => setEndDateStr(e.target.value)} style={{ flex: 2 }} />
              <input type="time" value={endTimeStr} onChange={e => setEndTimeStr(e.target.value)} style={{ flex: 1 }} />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>Project</label>
          {!newProjectMode ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ flex: 1 }}>
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
          <label>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={500} />
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
