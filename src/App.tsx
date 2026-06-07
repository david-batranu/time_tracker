import { useState, useCallback, useMemo, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, Views, View, EventProps, HeaderProps, DateHeaderProps, SlotInfo } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';

import { useCalendarEvents } from './hooks/useCalendarEvents';
import { useProjects } from './hooks/useProjects';
import { TimeEntry, ModalState, formatDuration, formatMs } from './types';
import { EventModal } from './components/EventModal';
import { SettingsModal } from './components/SettingsModal';
import { CustomToolbar } from './components/CustomToolbar';
import { storage } from './storage';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const getWeekStartsOn = (): 0 | 1 | 2 | 3 | 4 | 5 | 6 => {
  try {
    const localeId = Intl.DateTimeFormat().resolvedOptions().locale;
    const locale = new Intl.Locale(localeId) as any;
    if (locale.weekInfo && typeof locale.weekInfo.firstDay === 'number') {
      const firstDay = locale.weekInfo.firstDay;
      return (firstDay === 7 ? 0 : firstDay) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    }
  } catch (e) {
    console.error('Failed to detect week start day:', e);
  }
  const lang = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  if (lang.startsWith('en-us') || lang.startsWith('en-ca')) {
    return 0; // Sunday
  }
  return 1; // Monday
};

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: any, options: any) => startOfWeek(date, { ...options, weekStartsOn: getWeekStartsOn() }),
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop<TimeEntry>(Calendar as any);

function App() {
  const {
    events,
    showWeekends,
    isInitialized,
    addEvent,
    updateEvent,
    deleteEvent,
    moveEvent,
    updateShowWeekends,
    eventsByDate,
  } = useCalendarEvents();

  const {
    projects,
    addProject,
    updateProject,
    deleteProject,
    projectMap,
  } = useProjects();

  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(new Date());
  
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false });
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [viewInitialized, setViewInitialized] = useState(false);
  const [quotaUsage, setQuotaUsage] = useState({ percentage: 0 });

  useEffect(() => {
    storage.getQuotaUsage().then(usage => setQuotaUsage({ percentage: usage.percentage }));
  }, [events, projects]);

  if (isInitialized && !viewInitialized) {
    setView(showWeekends ? Views.WEEK : Views.WORK_WEEK);
    setViewInitialized(true);
  }

  const handleShowWeekendsChange = useCallback((checked: boolean) => {
    updateShowWeekends(checked);
    setView((prevView) => {
      if (!checked && prevView === Views.WEEK) return Views.WORK_WEEK;
      if (checked && prevView === Views.WORK_WEEK) return Views.WEEK;
      return prevView;
    });
  }, [updateShowWeekends]);

  const handleSelectSlot = useCallback(
    (slotInfo: SlotInfo) => {
      if (view === Views.MONTH) {
        setDate(slotInfo.start);
        setView(Views.WEEK);
        return;
      }
      setModalState({ isOpen: true, mode: 'create', slot: { start: slotInfo.start, end: slotInfo.end }, selectedDate: slotInfo.start });
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
      setModalState({ isOpen: true, mode: 'edit', event, selectedDate: event.start });
    },
    [view]
  );

  const handleModalSave = useCallback((data: Partial<TimeEntry>) => {
    if (!modalState.isOpen) return;

    if (modalState.mode === 'create') {
      addEvent(data);
    } else if (modalState.mode === 'edit') {
      updateEvent(modalState.event.id, data);
    }
    setModalState({ isOpen: false });
  }, [modalState, addEvent, updateEvent]);

  const handleModalDelete = useCallback(() => {
    if (modalState.isOpen && modalState.mode === 'edit') {
      deleteEvent(modalState.event.id);
    }
    setModalState({ isOpen: false });
  }, [modalState, deleteEvent]);

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
      const proj = projectMap.get(event.projectId || '');
      const color = proj ? proj.color : 'var(--event-color-4)';
      return {
        style: {
          backgroundColor: color,
          color: 'var(--text-primary)',
        },
      };
    },
    [projectMap]
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

  // Stable component definitions
  const CustomEvent = useCallback(({ event }: EventProps<TimeEntry>) => {
    if (!event) return null;
    const duration = formatDuration(event.start, event.end);
    const proj = projectMap.get(event.projectId || '');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px' }}>
          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{event.title || 'Untitled'}</div>
          {proj && (
            <span className="project-pill" style={{ fontSize: '9px', padding: '1px 4px', opacity: 0.9, backgroundColor: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {proj.title}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.85em', opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{duration}</div>
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
  }, [projectMap]);

  const CustomHeader = useCallback(({ date: d, label }: HeaderProps) => {
    if (!d) return <div>{label}</div>;
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const dateKey = format(d, 'yyyy-MM-dd');
    const dayEvents = eventsByDate.get(dateKey) || [];
    const totalMs = dayEvents.reduce((acc, e) => {
      if (!e.start || !e.end) return acc;
      return acc + (e.end.getTime() - e.start.getTime());
    }, 0);

    const durationStr = totalMs > 0 ? formatMs(totalMs) : '';

    return (
      <div className={isWeekend ? 'is-weekend-header' : ''} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
        <div>{label}</div>
        {durationStr && <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', fontWeight: 'normal', marginTop: '4px' }}>{durationStr}</div>}
      </div>
    );
  }, [eventsByDate]);

  const CustomDateHeader = useCallback(({ label, date: d }: DateHeaderProps) => {
    if (!d) return <span>{label}</span>;
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const dateKey = format(d, 'yyyy-MM-dd');
    const dayEvents = eventsByDate.get(dateKey) || [];
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
            const proj = projectMap.get(e.projectId || '');
            return (
              <div
                key={e.id}
                className="month-event-tag"
                style={{ backgroundColor: proj?.color || 'var(--event-color-4)' }}
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
  }, [eventsByDate, projectMap]);

  const components = useMemo(() => ({
    toolbar: (props: any) => (
      <CustomToolbar 
        {...props} 
        onManageSettings={() => setIsSettingsModalOpen(true)} 
        quotaUsage={quotaUsage}
      />
    ),
    event: CustomEvent,
    header: CustomHeader,
    month: {
      dateHeader: CustomDateHeader
    }
  }), [CustomEvent, CustomHeader, CustomDateHeader, quotaUsage]);

  if (!isInitialized) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)' }}>
        Loading Time Tracker...
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className={`calendar-container ${!showWeekends ? 'hide-weekends' : ''}`}>
        <DnDCalendar
          date={date}
          onNavigate={(newDate: Date) => setDate(newDate)}
          view={view}
          onView={(newView: View) => setView(newView)}
          defaultDate={defaultDate}
          events={events}
          localizer={localizer}
          onEventDrop={moveEvent}
          onEventResize={moveEvent}
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
        mode={modalState.isOpen ? modalState.mode : 'create'}
        initialData={modalState.isOpen && modalState.mode === 'edit' ? modalState.event : undefined}
        slot={modalState.isOpen && modalState.mode === 'create' ? modalState.slot : undefined}
        selectedDate={modalState.isOpen ? modalState.selectedDate : undefined}
        projects={projects}
        onClose={() => setModalState({ isOpen: false })}
        onSave={handleModalSave}
        onDelete={handleModalDelete}
        onAddProject={addProject}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        projects={projects}
        events={events}
        showWeekends={showWeekends}
        quotaUsage={quotaUsage}
        onClose={() => setIsSettingsModalOpen(false)}
        onSaveProject={updateProject}
        onDeleteProject={deleteProject}
        onAddProject={addProject}
        setShowWeekends={handleShowWeekendsChange}
      />
    </div>
  );
}

export default App;
