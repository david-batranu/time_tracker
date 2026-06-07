import { useState, useMemo, useRef } from 'react';
import { Project, TimeEntry } from '../types';
import { ProjectItem } from './ProjectItem';
import { AlertTriangle, Download, Upload } from 'lucide-react';
import { storage } from '../storage';

interface SettingsModalProps {
  isOpen: boolean;
  projects: Project[];
  events: TimeEntry[];
  showWeekends: boolean;
  quotaUsage: { percentage: number };
  onClose: () => void;
  onSaveProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onAddProject: (title: string) => void;
  setShowWeekends: (show: boolean) => void;
}

type Tab = 'projects' | 'preferences' | 'data';

export const SettingsModal = ({
  isOpen,
  projects,
  events,
  showWeekends,
  quotaUsage,
  onClose,
  onSaveProject,
  onDeleteProject,
  onAddProject,
  setShowWeekends
}: SettingsModalProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('projects');
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectsWithEvents = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (e.projectId) set.add(e.projectId);
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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await storage.importData(file);
      alert('Data imported successfully! The page will now reload to apply changes.');
      window.location.reload();
    } catch (err) {
      alert('Failed to import data. Please ensure the JSON file is valid.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content projects-modal">
        <div className="modal-header" style={{ marginBottom: 0, paddingBottom: '10px' }}>
          Settings
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
        </div>
        
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '15px' }}>
          <button 
             onClick={() => setActiveTab('projects')}
             style={{ flex: 1, padding: '10px', background: 'none', border: 'none', borderBottom: activeTab === 'projects' ? '2px solid var(--primary-color)' : '2px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'projects' ? 'bold' : 'normal', color: activeTab === 'projects' ? 'var(--primary-color)' : 'var(--text-secondary)' }}
          >
            Projects
          </button>
          <button 
             onClick={() => setActiveTab('preferences')}
             style={{ flex: 1, padding: '10px', background: 'none', border: 'none', borderBottom: activeTab === 'preferences' ? '2px solid var(--primary-color)' : '2px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'preferences' ? 'bold' : 'normal', color: activeTab === 'preferences' ? 'var(--primary-color)' : 'var(--text-secondary)' }}
          >
            Preferences
          </button>
          <button 
             onClick={() => setActiveTab('data')}
             style={{ flex: 1, padding: '10px', background: 'none', border: 'none', borderBottom: activeTab === 'data' ? '2px solid var(--primary-color)' : '2px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'data' ? 'bold' : 'normal', color: activeTab === 'data' ? 'var(--primary-color)' : 'var(--text-secondary)' }}
          >
            Data & Storage
          </button>
        </div>

        {activeTab === 'projects' && (
          <>
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

            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
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
          </>
        )}

        {activeTab === 'preferences' && (
          <div style={{ padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Show Weekends</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Include Saturday and Sunday in the calendar views</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showWeekends}
                  onChange={(e) => setShowWeekends(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
          </div>
        )}

        {activeTab === 'data' && (
          <div style={{ padding: '10px 0' }}>
            <div style={{ marginBottom: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong>Cloud Storage Usage</strong>
                <span style={{ color: quotaUsage.percentage > 80 ? 'var(--delete-color)' : 'var(--text-color)' }}>
                  {quotaUsage.percentage.toFixed(1)}%
                </span>
              </div>
              <div style={{ width: '100%', height: '10px', backgroundColor: 'var(--border-color)', borderRadius: '5px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    width: `${Math.min(quotaUsage.percentage, 100)}%`, 
                    height: '100%', 
                    backgroundColor: quotaUsage.percentage > 80 ? 'var(--delete-color)' : 'var(--primary-color)',
                    transition: 'width 0.3s ease, background-color 0.3s ease'
                  }} 
                />
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.4' }}>
                {quotaUsage.percentage > 80 ? (
                  <span style={{ display: 'flex', gap: '6px', color: 'var(--delete-color)', alignItems: 'flex-start' }}>
                    <AlertTriangle size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                    When storage limit approaches, older data is automatically offloaded to your local machine to keep sync fast.
                  </span>
                ) : (
                  'Sync storage handles your data across all your connected browsers.'
                )}
              </p>
            </div>

            <div>
              <strong style={{ display: 'block', marginBottom: '12px' }}>Import & Export</strong>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  className="btn" 
                  style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px' }}
                  onClick={() => storage.exportData()}
                >
                  <Download size={16} /> Export JSON
                </button>
                <button 
                  className="btn" 
                  style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={16} /> Import JSON
                </button>
                <input 
                  type="file" 
                  accept="application/json" 
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleImport}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
