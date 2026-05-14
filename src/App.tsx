import { useState, useCallback, useMemo, useEffect } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { ChevronLeft, ChevronRight } from 'lucide-react';

declare var chrome: any;

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

interface TimeEntry {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color?: string;
}

const COLORS = [
  'var(--event-color-1)',
  'var(--event-color-2)',
  'var(--event-color-3)',
  'var(--event-color-4)',
  'var(--event-color-5)'
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
  }
};

const formatDuration = (start: Date, end: Date) => {
  const durationMs = end.getTime() - start.getTime();
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
  const pad = (num: number) => num.toString().padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
};

const CustomToolbar = (toolbar: any) => {
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
        {date.format('MMMM YYYY')} &bull; W{date.format('ww')}
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
      </div>
      <div>{label()}</div>
      <div className="toolbar-buttons">
        <button className="btn primary" onClick={() => toolbar.onView('week')}>
          Week
        </button>
        <button className="btn" onClick={() => toolbar.onView('day')}>
          Day
        </button>
      </div>
    </div>
  );
};

function App() {
  const [events, setEvents] = useState<TimeEntry[]>([]);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      console.warn('Chrome storage API not available. Using localStorage fallback.');
    }
    storage.get().then(setEvents);
  }, []);

  const handleEventsChange = useCallback((newEvents: TimeEntry[]) => {
    setEvents(newEvents);
    storage.set(newEvents);
  }, []);

  const onEventResize = useCallback(
    ({ event, start, end }: any) => {
      const nextEvents = events.map((existingEvent) => {
        return existingEvent.id === event.id
          ? { ...existingEvent, start, end }
          : existingEvent;
      });

      handleEventsChange(nextEvents);
    },
    [events]
  );

  const onEventDrop = useCallback(
    ({ event, start, end }: any) => {
      const nextEvents = events.map((existingEvent) => {
        return existingEvent.id === event.id
          ? { ...existingEvent, start, end }
          : existingEvent;
      });

      handleEventsChange(nextEvents);
    },
    [events]
  );

  const handleSelectSlot = useCallback(
    ({ start, end }: { start: Date; end: Date }) => {
      const title = window.prompt('New Event Name');
      if (title) {
        const newEvent: TimeEntry = {
          id: uuidv4(),
          title,
          start,
          end,
          color: COLORS[Math.floor(Math.random() * COLORS.length)]
        };
        handleEventsChange([...events, newEvent]);
      }
    },
    [events]
  );

  const handleSelectEvent = useCallback(
    (event: any) => {
      const title = window.prompt('Update Event Name', event.title);
      if (title === "") {
        // Delete
        const nextEvents = events.filter((e) => e.id !== event.id);
        handleEventsChange(nextEvents);
      } else if (title) {
        const nextEvents = events.map((e) =>
          e.id === event.id ? { ...e, title } : e
        );
        handleEventsChange(nextEvents);
      }
    },
    [events]
  );

  const { defaultDate, scrollToTime } = useMemo(
    () => ({
      defaultDate: new Date(),
      scrollToTime: new Date(1970, 1, 1, 8),
    }),
    []
  );

  const eventPropGetter = useCallback(
    (event: any) => ({
      style: {
        backgroundColor: event.color,
        color: 'var(--text-primary)', // Dark text for pastel colors
      },
    }),
    []
  );

  const components = useMemo(() => {
    const CustomEvent = ({ event }: any) => {
      const duration = formatDuration(event.start, event.end);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ fontWeight: 600 }}>{event.title}</div>
          <div style={{ fontSize: '0.85em', opacity: 0.8 }}>{duration}</div>
        </div>
      );
    };

    const CustomHeader = ({ date, label }: any) => {
      const dayEvents = events.filter((e) => moment(e.start).isSame(date, 'day'));
      const totalMs = dayEvents.reduce((acc, e) => acc + (e.end.getTime() - e.start.getTime()), 0);
      
      let durationStr = '';
      if (totalMs > 0) {
        const hours = Math.floor(totalMs / (1000 * 60 * 60));
        const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);
        const pad = (num: number) => num.toString().padStart(2, '0');
        if (hours > 0) {
          durationStr = `${hours}:${pad(minutes)}:${pad(seconds)}`;
        } else {
          durationStr = `${minutes}:${pad(seconds)}`;
        }
      }

      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
          <div>{label}</div>
          {durationStr && <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', fontWeight: 'normal', marginTop: '4px' }}>{durationStr}</div>}
        </div>
      );
    };

    return {
      toolbar: CustomToolbar,
      event: CustomEvent,
      header: CustomHeader
    };
  }, [events]);

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
      
      // 10:00 (600 mins) to 18:30 (1110 mins)
      if (time >= 600 && time < 1110) {
        return {
          className: 'workday-slot',
        };
      }
      return {};
    },
    []
  );

  return (
    <div className="app-container">
      <div className="calendar-container">
        <DnDCalendar
          defaultDate={defaultDate}
          defaultView={Views.WEEK}
          events={events}
          localizer={localizer}
          onEventDrop={onEventDrop}
          onEventResize={onEventResize}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          resizable
          selectable
          scrollToTime={scrollToTime}
          step={15}
          timeslots={4}
          formats={formats}
          components={components}
          eventPropGetter={eventPropGetter}
          slotPropGetter={slotPropGetter}
        />
      </div>
    </div>
  );
}

export default App;
