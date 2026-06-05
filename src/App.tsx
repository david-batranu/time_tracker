import { useState, useCallback, useMemo, useEffect } from 'react';
import { Calendar, momentLocalizer, Views, View, EventProps, HeaderProps, DateHeaderProps, SlotInfo } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment/min/moment-with-locales';
import { v4 as uuidv4 } from 'uuid';

import { storage } from './storage';
import { TimeEntry, Project, ModalState, COLORS, formatDuration, formatMs } from './types';
import { EventModal } from './components/EventModal';
import { ProjectsModal } from './components/ProjectsModal';
import { CustomToolbar } from './components/CustomToolbar';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const userLocale = Intl.DateTimeFormat().resolvedOptions().locale;
moment.locale(userLocale);
const localizer = momentLocalizer(moment);

const DnDCalendar = withDragAndDrop<TimeEntry>(Calendar as any);

function App() {
  const [events, setEvents] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(new Date());
  const [showWeekends, setShowWeekends] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, mode: 'create' });
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);

  useEffect(() => {
    storage.get().then(setEvents);
    storage.getProjects().then(setProjects);
    storage.getSettings().then(s => {
      setShowWeekends(s.showWeekends);
      setIsInitialized(true);
    });
  }, []);

  const handleShowWeekendsChange = useCallback((checked: boolean) => {
    setShowWeekends(checked);
    if (isInitialized) {
      storage.setSettings({ showWeekends: checked });
    }
    setView((prevView) => {
      if (!checked && prevView === Views.WEEK) return Views.WORK_WEEK;
      if (checked && prevView === Views.WORK_WEEK) return Views.WEEK;
      return prevView;
    });
  }, [isInitialized]);

  const handleEventsChange = useCallback((newEvents: TimeEntry[]) => {
    setEvents(newEvents);
    storage.set(newEvents);
  }, []);

  const onEventResize = useCallback(
    ({ event, start, end }: any) => {
      if (view === Views.MONTH) return;
      const nextEvents = events.map((existingEvent) => {
        return existingEvent.id === event.id
          ? { ...existingEvent, start: new Date(start), end: new Date(end) }
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
          ? { ...existingEvent, start: new Date(start), end: new Date(end) }
          : existingEvent;
      });
      handleEventsChange(nextEvents);
    },
    [events, handleEventsChange, view]
  );

  const handleSelectSlot = useCallback(
    (slotInfo: SlotInfo) => {
      if (view === Views.MONTH) {
        setDate(slotInfo.start);
        setView(Views.WEEK);
        return;
      }
      setModalState({ isOpen: true, mode: 'create', slot: { start: slotInfo.start, end: slotInfo.end } });
    },
    [view]
  );

  const handleSelectEvent = useCallback(
    (event: TimeEntry) => {
      if (!event) return;
      if (view === Views.MONTH) {
        setDate(event.start);
        setView(Views.WEEK);
      }
      setModalState({ isOpen: true, mode: 'edit', event });
    },
    [view]
  );

  const handleAddProject = useCallback((title: string): Project => {
    const newColor = COLORS[projects.length % COLORS.length];
    const newProj: Project = {
      id: uuidv4(),
      title,
      color: newColor
    };
    const newProjects = [...projects, newProj];
    setProjects(newProjects);
    storage.setProjects(newProjects);
    return newProj;
  }, [projects]);

  const handleModalSave = useCallback((data: Partial<TimeEntry>) => {
    if (modalState.mode === 'create') {
      const newColor = COLORS[events.length % COLORS.length];
      const newEvent: TimeEntry = {
        id: uuidv4(),
        title: data.title || '',
        start: data.start!,
        end: data.end!,
        projectId: data.projectId,
        description: data.description,
        color: newColor // Legacy fallback
      };
      handleEventsChange([...events, newEvent]);
    } else if (modalState.event) {
      const nextEvents = events.map(e =>
        e.id === modalState.event!.id ? { ...e, ...data } : e
      );
      handleEventsChange(nextEvents);
    }
    setModalState({ isOpen: false, mode: 'create' });
  }, [events, handleEventsChange, modalState]);

  const handleModalDelete = useCallback(() => {
    if (modalState.mode === 'edit' && modalState.event) {
      const nextEvents = events.filter((e) => e.id !== modalState.event!.id);
      handleEventsChange(nextEvents);
    }
    setModalState({ isOpen: false, mode: 'create' });
  }, [events, handleEventsChange, modalState]);

  const handleUpdateProject = useCallback((updatedProj: Project) => {
    const newProjects = projects.map(p => p.id === updatedProj.id ? updatedProj : p);
    setProjects(newProjects);
    storage.setProjects(newProjects);
  }, [projects]);

  const handleDeleteProject = useCallback((projectId: string) => {
    const newProjects = projects.filter(p => p.id !== projectId);
    setProjects(newProjects);
    storage.setProjects(newProjects);
  }, [projects]);

  const { defaultDate, scrollToTime } = useMemo(
    () => ({
      defaultDate: new Date(),
      scrollToTime: new Date(1970, 1, 1, 8),
    }),
    []
  );

  const dayPropGetter = useCallback(
    (d: Date) => {
      if (!d) return {};
      const day = d.getDay();
      if (day === 0 || day === 6) {
        return { className: 'rbc-weekend' };
      }
      return {};
    },
    []
  );

  const eventPropGetter = useCallback(
    (event: TimeEntry) => {
      if (!event) return {};
      const proj = projects.find(p => p.id === event.projectId);
      const color = proj ? proj.color : (event.color || 'var(--event-color-4)');
      return {
        style: {
          backgroundColor: color,
          color: 'var(--text-primary)',
        },
      };
    },
    [projects]
  );

  const slotPropGetter = useCallback(
    (d: Date) => {
      const hour = d.getHours();
      const minutes = d.getMinutes();
      const time = hour * 60 + minutes;
      const day = d.getDay();
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

  const formats = useMemo(() => ({
    timeGutterFormat: 'HH:mm',
    eventTimeRangeFormat: ({ start, end }: any, culture: any, loc: any) =>
      loc.format(start, 'HH:mm', culture) + ' – ' + loc.format(end, 'HH:mm', culture),
    selectRangeFormat: ({ start, end }: any, culture: any, loc: any) =>
      loc.format(start, 'HH:mm', culture) + ' – ' + loc.format(end, 'HH:mm', culture),
  }), []);

  // Stable component definitions to prevent unmounting inside useMemo
  const CustomEvent = useCallback(({ event }: EventProps<TimeEntry>) => {
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
  }, [projects]);

  const CustomHeader = useCallback(({ date: d, label }: HeaderProps) => {
    if (!d) return <div>{label}</div>;
    const dayEvents = events.filter((e) => e && e.start && moment(e.start).isSame(d, 'day'));
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
  }, [events]);

  const CustomDateHeader = useCallback(({ label, date: d }: DateHeaderProps) => {
    if (!d) return <span>{label}</span>;
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const dayEvents = events.filter((e) => e && e.start && moment(e.start).isSame(d, 'day'));
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
  }, [events, projects]);

  const components = useMemo(() => ({
    toolbar: (props: any) => <CustomToolbar {...props} showWeekends={showWeekends} setShowWeekends={handleShowWeekendsChange} onManageProjects={() => setIsProjectsModalOpen(true)} />,
    event: CustomEvent,
    header: CustomHeader,
    month: {
      dateHeader: CustomDateHeader
    }
  }), [showWeekends, handleShowWeekendsChange, CustomEvent, CustomHeader, CustomDateHeader]);

  return (
    <div className="app-container">
      <div className={`calendar-container ${!showWeekends ? 'hide-weekends' : ''}`}>
        <DnDCalendar
          date={date}
          onNavigate={(newDate: Date) => setDate(newDate)}
          view={view}
          onView={(newView: View) => setView(newView)}
          dayLayoutAlgorithm="no-overlap"
          defaultDate={defaultDate}
          events={events}
          localizer={localizer}
          onEventDrop={onEventDrop}
          onEventResize={onEventResize}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          onDrillDown={(clickedDate: Date) => {
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
