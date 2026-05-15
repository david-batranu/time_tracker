import { useState, useCallback, useMemo, useEffect } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment/min/moment-with-locales';
import { v4 as uuidv4 } from 'uuid';
import { ChevronLeft, ChevronRight } from 'lucide-react';

declare var chrome: any;

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const userLocale = Intl.DateTimeFormat().resolvedOptions().locale;
moment.locale(userLocale);
const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

interface Project {
  id: string;
  title: string;
  color: string;
}

interface TimeEntry {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color?: string;
  projectId?: string;
  description?: string;
}

const COLORS = [
  '#fce7f3',
  '#dcfce7',
  '#fef08a',
  '#e0e7ff',
  '#ffedd5'
];

// Storage helper
const storage = {
  get: async (): Promise<TimeEntry[]> => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      return new Promise((resolve) => {
        chrome.storage.sync.get(['timeEntries'], (result: any) => {
          if (result.timeEntries && Array.isArray(result.timeEntries)) {
            const entries = result.timeEntries.map((e: any) => ({
              ...e,
              start: new Date(e.start),
              end: new Date(e.end),
            }));
            console.log('Loaded from chrome.storage:', entries);
            resolve(entries);
          } else {
            console.log('No entries found in chrome.storage');
            resolve([]);
          }
        });
      });
    } else {
      // Fallback for local development
      const stored = localStorage.getItem('timeEntries');
      if (stored) {
        const entries = JSON.parse(stored).map((e: any) => ({
          ...e,
          start: new Date(e.start),
          end: new Date(e.end),
        }));
        console.log('Loaded from localStorage:', entries);
        return entries;
      }
      return [];
    }
  },
  set: async (entries: TimeEntry[]) => {
    // Ensure dates are serialized to strings for storage
    const serializedEntries = entries.map(e => ({
      ...e,
      start: e.start instanceof Date ? e.start.toISOString() : e.start,
      end: e.end instanceof Date ? e.end.toISOString() : e.end,
    }));

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      return new Promise<void>((resolve, reject) => {
        chrome.storage.sync.set({ timeEntries: serializedEntries }, () => {
          if (chrome.runtime.lastError) {
            console.error('Storage set error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log('Saved to chrome.storage:', serializedEntries);
            resolve();
          }
        });
      });
    } else {
      localStorage.setItem('timeEntries', JSON.stringify(serializedEntries));
      console.log('Saved to localStorage:', serializedEntries);
    }
  },
  getSettings: async (): Promise<{ showWeekends: boolean }> => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      return new Promise((resolve) => {
        chrome.storage.sync.get(['settings'], (result: any) => {
          resolve(result.settings || { showWeekends: true });
        });
      });
    } else {
      const stored = localStorage.getItem('settings');
      return stored ? JSON.parse(stored) : { showWeekends: true };
    }
  },
  setSettings: async (settings: { showWeekends: boolean }) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ settings });
    } else {
      localStorage.setItem('settings', JSON.stringify(settings));
    }
  },
  getProjects: async (): Promise<Project[]> => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      return new Promise((resolve) => {
        chrome.storage.sync.get(['projects'], (result: any) => {
          resolve(result.projects || []);
        });
      });
    } else {
      const stored = localStorage.getItem('projects');
      return stored ? JSON.parse(stored) : [];
    }
  },
  setProjects: async (projects: Project[]) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ projects });
    } else {
      localStorage.setItem('projects', JSON.stringify(projects));
    }
  }
};

const formatMs = (ms: number) => {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const pad = (num: number) => num.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}`;
  }
  return `${minutes}m`;
};

const formatDuration = (start: Date, end: Date) => {
  return formatMs(end.getTime() - start.getTime());
};

const CustomToolbar = ({ toolbar, showWeekends, setShowWeekends }: any) => {
  const goToBack = () => {
    toolbar.onNavigate('PREV');
  };

  const goToNext = () => {
    toolbar.onNavigate('NEXT');
  };

  const goToCurrent = () => {
    toolbar.onNavigate('TODAY');
  };

  const label = () => {
    const date = moment(toolbar.date);
    return (
      <span className="toolbar-title">
        {date.format('MMMM YYYY')}
      </span>
    );
  };

  return (
    <div className="toolbar-container">
      <div className="toolbar-buttons">
        <button className="btn" onClick={goToBack}>
          <ChevronLeft size={18} />
        </button>
        <button className="btn" onClick={goToCurrent}>
          Today
        </button>
        <button className="btn" onClick={goToNext}>
          <ChevronRight size={18} />
        </button>
        <button className="btn" onClick={() => toolbar.onManageProjects && toolbar.onManageProjects()}>
          Projects
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div>{label()}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500 }}>
          <span>Weekends</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={showWeekends}
              onChange={(e) => {
                const checked = e.target.checked;
                setShowWeekends(checked);
                if (!checked && toolbar.view === 'week') {
                  toolbar.onView(Views.WORK_WEEK);
                } else if (checked && toolbar.view === 'work_week') {
                  toolbar.onView(Views.WEEK);
                }
              }}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      <div className="toolbar-buttons">
        <button
          className={`btn ${toolbar.view === 'month' ? 'primary' : ''}`}
          onClick={() => toolbar.onView('month')}
        >
          Month
        </button>
        <button
          className={`btn ${(toolbar.view === 'week' || toolbar.view === 'work_week') ? 'primary' : ''}`}
          onClick={() => toolbar.onView(showWeekends ? Views.WEEK : Views.WORK_WEEK)}
        >
          Week
        </button>
        <button
          className={`btn ${toolbar.view === 'day' ? 'primary' : ''}`}
          onClick={() => toolbar.onView('day')}
        >
          Day
        </button>
      </div>
    </div>
  );
};

const EventModal = ({
  isOpen,
  mode,
  initialData,
  slot,
  projects,
  onClose,
  onSave,
  onDelete,
  onAddProject
}: any) => {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [description, setDescription] = useState('');
  const [newProjectMode, setNewProjectMode] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [baseDate, setBaseDate] = useState<Date | null>(null);

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
      let bDate = new Date();
      if (initialData?.start) {
        bDate = new Date(initialData.start);
        setStart(formatTimeForInput(new Date(initialData.start)));
      } else if (slot?.start) {
        bDate = new Date(slot.start);
        setStart(formatTimeForInput(new Date(slot.start)));
      } else {
        setStart('');
      }
      setBaseDate(bDate);

      if (initialData?.end) {
        setEnd(formatTimeForInput(new Date(initialData.end)));
      } else if (slot?.end) {
        setEnd(formatTimeForInput(new Date(slot.end)));
      } else {
        setEnd('');
      }
    }
  }, [isOpen, initialData, slot]);

  if (!isOpen) return null;

  const handleSave = () => {
    let startDate = baseDate ? new Date(baseDate) : new Date();
    let endDate = baseDate ? new Date(baseDate) : new Date();

    if (start) {
      const [h, m] = start.split(':').map(Number);
      startDate.setHours(h, m, 0, 0);
    }
    if (end) {
      const [h, m] = end.split(':').map(Number);
      endDate.setHours(h, m, 0, 0);
    }

    if (endDate < startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }
    if (newProjectMode && newProjectTitle.trim()) {
      const newProj = onAddProject(newProjectTitle.trim());
      onSave({
        title,
        projectId: newProj.id,
        description,
        start: startDate,
        end: endDate
      });
    } else {
      onSave({
        title,
        projectId,
        description,
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
          <input value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Start</label>
            <input type="time" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>End</label>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>Project</label>
          {!newProjectMode ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">No Project</option>
                {projects.map((p: any) => (
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
                style={{ flex: 1 }}
              />
              <button type="button" className="btn" onClick={() => setNewProjectMode(false)}>Cancel</button>
            </div>
          )}
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} />
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

const ProjectItem = ({ project, hasEvents, onSave, onDelete }: any) => {
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
    onSave({ ...project, title, color });
    setIsEditing(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
      {isEditing ? (
        <>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ padding: 0, border: 'none', background: 'none', width: '24px', height: '24px', cursor: 'pointer' }} />
          <input value={title} onChange={e => setTitle(e.target.value)} style={{ flex: 1, padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: '4px' }} autoFocus />
          <button className="btn primary" onClick={handleSave} style={{ padding: '4px 8px' }}>Save</button>
          <button className="btn" onClick={() => { setIsEditing(false); setTitle(project.title); setColor(project.color); }} style={{ padding: '4px 8px' }}>Cancel</button>
        </>
      ) : (
        <>
          <div style={{ width: '20px', height: '20px', backgroundColor: project.color, borderRadius: '50%' }} />
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
};

const ProjectsModal = ({
  isOpen,
  projects,
  events,
  onClose,
  onSaveProject,
  onDeleteProject,
  onAddProject
}: any) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    if (newTitle.trim()) {
      onAddProject(newTitle.trim());
      setNewTitle('');
      setIsAdding(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '500px' }}>
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
          {projects.map((p: any) => {
            const hasEvents = events.some((e: any) => e.projectId === p.id);
            return <ProjectItem key={p.id} project={p} hasEvents={hasEvents} onSave={onSaveProject} onDelete={onDeleteProject} />
          })}
          {projects.length === 0 && !isAdding && <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No projects found.</div>}
        </div>
      </div>
    </div>
  );
};

function App() {
  const [events, setEvents] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<any>(Views.WEEK);
  const [date, setDate] = useState(new Date());
  const [showWeekends, setShowWeekends] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    event?: any;
    slot?: any;
  }>({ isOpen: false, mode: 'create' });
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      console.warn('Chrome storage API not available. Using localStorage fallback.');
    }
    storage.get().then(setEvents);
    storage.getProjects().then(setProjects);
    storage.getSettings().then(s => {
      setShowWeekends(s.showWeekends);
      setIsInitialized(true);
    });
  }, []);

  useEffect(() => {
    if (isInitialized) {
      storage.setSettings({ showWeekends });
    }

    // If we hide weekends while in week view, switch to work_week
    if (!showWeekends && view === Views.WEEK) {
      setView(Views.WORK_WEEK);
    }
    // If we show weekends while in work_week view, switch back to week
    else if (showWeekends && view === Views.WORK_WEEK) {
      setView(Views.WEEK);
    }
  }, [showWeekends, view, isInitialized]);

  const handleEventsChange = useCallback((newEvents: TimeEntry[]) => {
    if (view === Views.MONTH) return;
    setEvents(newEvents);
    storage.set(newEvents);
  }, [view]);

  const onEventResize = useCallback(
    ({ event, start, end }: any) => {
      if (view === Views.MONTH) return;
      const nextEvents = events.map((existingEvent) => {
        return existingEvent.id === event.id
          ? { ...existingEvent, start, end }
          : existingEvent;
      });

      handleEventsChange(nextEvents);
    },
    [events, handleEventsChange, view]
  );

  const onEventDrop = useCallback(
    ({ event, start, end }: any) => {
      if (view === Views.MONTH) return;
      const nextEvents = events.map((existingEvent) => {
        return existingEvent.id === event.id
          ? { ...existingEvent, start, end }
          : existingEvent;
      });

      handleEventsChange(nextEvents);
    },
    [events, handleEventsChange, view]
  );

  const handleSelectSlot = useCallback(
    ({ start, end }: { start: Date; end: Date }) => {
      if (view === Views.MONTH) {
        setDate(start);
        setView(Views.WEEK);
        return;
      }
      setModalState({ isOpen: true, mode: 'create', slot: { start, end } });
    },
    [view]
  );

  const handleSelectEvent = useCallback(
    (event: any) => {
      if (!event || view === Views.MONTH) {
        if (event && view === Views.MONTH) {
          setDate(event.start);
          setView(Views.WEEK);
        }
        return;
      }
      setModalState({ isOpen: true, mode: 'edit', event });
    },
    [view]
  );

  const handleAddProject = (title: string) => {
    const newProj: Project = {
      id: uuidv4(),
      title,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    };
    const newProjects = [...projects, newProj];
    setProjects(newProjects);
    storage.setProjects(newProjects);
    return newProj;
  };

  const handleModalSave = (data: any) => {
    if (modalState.mode === 'create') {
      const newEvent: TimeEntry = {
        id: uuidv4(),
        title: data.title,
        start: data.start,
        end: data.end,
        projectId: data.projectId,
        description: data.description,
        color: COLORS[Math.floor(Math.random() * COLORS.length)] // Legacy
      };
      handleEventsChange([...events, newEvent]);
    } else {
      const nextEvents = events.map(e =>
        e.id === modalState.event.id ? { ...e, ...data } : e
      );
      handleEventsChange(nextEvents);
    }
    setModalState({ isOpen: false, mode: 'create' });
  };

  const handleModalDelete = () => {
    if (modalState.mode === 'edit') {
      const nextEvents = events.filter((e) => e.id !== modalState.event.id);
      handleEventsChange(nextEvents);
    }
    setModalState({ isOpen: false, mode: 'create' });
  };

  const handleUpdateProject = (updatedProj: Project) => {
    const newProjects = projects.map(p => p.id === updatedProj.id ? updatedProj : p);
    setProjects(newProjects);
    storage.setProjects(newProjects);
  };

  const handleDeleteProject = (projectId: string) => {
    const newProjects = projects.filter(p => p.id !== projectId);
    setProjects(newProjects);
    storage.setProjects(newProjects);
  };

  const { defaultDate, scrollToTime } = useMemo(
    () => ({
      defaultDate: new Date(),
      scrollToTime: new Date(1970, 1, 1, 8),
    }),
    []
  );

  const dayPropGetter = useCallback(
    (date: Date) => {
      if (!date) return {};
      const day = date.getDay();
      if (day === 0 || day === 6) {
        return {
          className: 'rbc-weekend',
        };
      }
      return {};
    },
    []
  );

  const eventPropGetter = useCallback(
    (event: any) => {
      if (!event) return {};
      const proj = projects.find(p => p.id === event.projectId);
      const color = proj ? proj.color : (event.color || 'var(--event-color-4)');
      return {
        style: {
          backgroundColor: color,
          color: 'var(--text-primary)', // Dark text for pastel colors
        },
      };
    },
    [projects]
  );

  const components = useMemo(() => {
    const CustomEvent = ({ event }: any) => {
      if (!event) return null;
      const duration = formatDuration(event.start, event.end);
      const proj = projects.find(p => p.id === event.projectId);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
          {proj && (
            <div style={{ position: 'absolute', top: 0, right: 0 }}>
              <span className="project-pill" style={{ fontSize: '9px', padding: '1px 5px', opacity: 0.9, backgroundColor: 'rgba(255,255,255,0.3)' }}>
                {proj.title}
              </span>
            </div>
          )}
          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: proj ? '45px' : '0' }}>{event.title || 'Untitled'}</div>
          <div style={{ fontSize: '0.85em', opacity: 0.8 }}>{duration}</div>
          {event.description && (
            <div style={{
              fontSize: '0.75em',
              opacity: 0.7,
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              whiteSpace: 'pre-wrap'
            }}>
              {event.description}
            </div>
          )}
        </div>
      );
    };

    const CustomHeader = ({ date, label }: any) => {
      if (!date) return <div>{label}</div>;
      const dayEvents = events.filter((e) => e && e.start && moment(e.start).isSame(date, 'day'));
      const totalMs = dayEvents.reduce((acc, e) => {
        if (!e.start || !e.end) return acc;
        return acc + (e.end.getTime() - e.start.getTime());
      }, 0);

      const durationStr = totalMs > 0 ? formatMs(totalMs) : '';

      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
          <div>{label}</div>
          {durationStr && <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', fontWeight: 'normal', marginTop: '4px' }}>{durationStr}</div>}
        </div>
      );
    };

    const CustomDateHeader = ({ label, date }: any) => {
      if (!date) return <span>{label}</span>;
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const dayEvents = events.filter((e) => e && e.start && moment(e.start).isSame(date, 'day'));
      const totalMs = dayEvents.reduce((acc, e) => {
        if (!e.start || !e.end) return acc;
        return acc + (e.end.getTime() - e.start.getTime());
      }, 0);

      const durationStr = totalMs > 0 ? formatMs(totalMs) : '';

      return (
        <div className={`month-day-container ${isWeekend ? 'is-weekend-date' : ''}`}>
          <div className="rbc-button-link month-day-header">
            <span className="month-total-duration">
              {durationStr}
            </span>
            <span className="month-day-label">{label}</span>
          </div>
          <div className="month-events-wrapper">
            {dayEvents.map(e => {
              if (!e) return null;
              const proj = projects.find(p => p.id === e.projectId);
              return (
                <div
                  key={e.id}
                  className="month-event-tag"
                  style={{ backgroundColor: proj?.color || e.color || 'var(--event-color-4)' }}
                >
                  {formatDuration(e.start, e.end)}
                  <div className="event-tooltip">
                    <div className="tooltip-header">
                      {proj && <span className="project-pill" style={{ backgroundColor: proj.color }}>{proj.title}</span>}
                      <span className="event-title">{e.title || 'Untitled'}</span>
                    </div>
                    {e.description && <div className="tooltip-description">{e.description}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return {
      toolbar: (props: any) => <CustomToolbar toolbar={{ ...props, onManageProjects: () => setIsProjectsModalOpen(true) }} showWeekends={showWeekends} setShowWeekends={setShowWeekends} />,
      event: CustomEvent,
      header: CustomHeader,
      month: {
        dateHeader: CustomDateHeader
      }
    };
  }, [events, showWeekends, projects]);

  const formats = useMemo(() => ({
    timeGutterFormat: 'HH:mm',
    eventTimeRangeFormat: ({ start, end }: any, culture: any, localizer: any) =>
      localizer.format(start, 'HH:mm', culture) + ' – ' + localizer.format(end, 'HH:mm', culture),
    selectRangeFormat: ({ start, end }: any, culture: any, localizer: any) =>
      localizer.format(start, 'HH:mm', culture) + ' – ' + localizer.format(end, 'HH:mm', culture),
  }), []);

  const slotPropGetter = useCallback(
    (date: Date) => {
      const hour = date.getHours();
      const minutes = date.getMinutes();
      const time = hour * 60 + minutes;
      const day = date.getDay();
      const isWeekend = day === 0 || day === 6;

      const classes = [];
      if (isWeekend) classes.push('rbc-weekend');

      // 10:00 (600 mins) to 18:30 (1110 mins)
      if (time >= 600 && time < 1110) {
        classes.push('workday-slot');
      }

      return {
        className: classes.join(' '),
      };
    },
    []
  );

  return (
    <div className="app-container">
      <div className={`calendar-container ${!showWeekends ? 'hide-weekends' : ''}`}>
        <DnDCalendar
          date={date}
          onNavigate={(newDate) => setDate(newDate)}
          view={view}
          onView={(newView) => setView(newView)}
          defaultDate={defaultDate}
          events={events}
          localizer={localizer}
          onEventDrop={onEventDrop}
          onEventResize={onEventResize}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          onDrillDown={(clickedDate, _view) => {
            setDate(clickedDate);
            setView(Views.WEEK);
          }}
          resizable={view !== Views.MONTH}
          selectable={true}
          scrollToTime={scrollToTime}
          step={15}
          timeslots={4}
          formats={formats}
          components={components}
          eventPropGetter={eventPropGetter}
          dayPropGetter={dayPropGetter}
          slotPropGetter={slotPropGetter}
          views={[Views.MONTH, Views.WEEK, Views.WORK_WEEK, Views.DAY]}
        />
      </div>
      <EventModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        initialData={modalState.mode === 'edit' ? modalState.event : undefined}
        slot={modalState.mode === 'create' ? modalState.slot : undefined}
        projects={projects}
        onClose={() => setModalState({ isOpen: false, mode: 'create' })}
        onSave={handleModalSave}
        onDelete={handleModalDelete}
        onAddProject={handleAddProject}
      />
      <ProjectsModal
        isOpen={isProjectsModalOpen}
        projects={projects}
        events={events}
        onClose={() => setIsProjectsModalOpen(false)}
        onSaveProject={handleUpdateProject}
        onDeleteProject={handleDeleteProject}
        onAddProject={handleAddProject}
      />
    </div>
  );
}

export default App;
