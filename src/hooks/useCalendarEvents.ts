import { useState, useEffect, useCallback, useMemo } from 'react';
import { TimeEntry } from '../types';
import { storage } from '../storage';
import { format } from 'date-fns';

export function useCalendarEvents() {
  const [events, setEvents] = useState<TimeEntry[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showWeekends, setShowWeekends] = useState(true);

  useEffect(() => {
    storage.get()
      .then((loadedEvents) => {
        setEvents(loadedEvents);
      })
      .catch((err) => console.error('Failed to load events:', err));

    storage.getSettings()
      .then((s) => {
        setShowWeekends(s.showWeekends);
        setIsInitialized(true);
      })
      .catch((err) => console.error('Failed to load settings:', err));
  }, []);

  const handleEventsChange = useCallback((updater: (prev: TimeEntry[]) => TimeEntry[]) => {
    setEvents((prev) => {
      const next = updater(prev);
      storage.set(next).catch((err) => console.error('Failed to save events:', err));
      return next;
    });
  }, []);

  // Flush debounced writes on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (typeof storage.flush === 'function') {
        storage.flush();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const addEvent = useCallback((data: Partial<TimeEntry>) => {
    handleEventsChange((prev) => {
      const nextId = (prev.reduce((max, e) => Math.max(max, parseInt(e.id) || 0), 0) + 1).toString();
      const newEvent: TimeEntry = {
        id: nextId,
        title: data.title || '',
        start: data.start!,
        end: data.end!,
        projectId: data.projectId,
        description: data.description
      };
      return [...prev, newEvent];
    });
  }, [handleEventsChange]);

  const updateEvent = useCallback((id: string, data: Partial<TimeEntry>) => {
    handleEventsChange((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...data } : e))
    );
  }, [handleEventsChange]);

  const deleteEvent = useCallback((id: string) => {
    handleEventsChange((prev) => prev.filter((e) => e.id !== id));
  }, [handleEventsChange]);

  const moveEvent = useCallback(({ event, start, end }: { event: TimeEntry; start: string | Date; end: string | Date }) => {
    handleEventsChange((prev) =>
      prev.map((e) =>
        e.id === event.id
          ? { ...e, start: new Date(start), end: new Date(end) }
          : e
      )
    );
  }, [handleEventsChange]);

  const updateShowWeekends = useCallback((checked: boolean) => {
    setShowWeekends(checked);
    if (isInitialized) {
      storage.setSettings({ showWeekends: checked }).catch((err) =>
        console.error('Failed to save settings:', err)
      );
    }
  }, [isInitialized]);

  // Pre-compute events grouped by date (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, TimeEntry[]>();
    for (const event of events) {
      if (event && event.start) {
        const dateKey = format(new Date(event.start), 'yyyy-MM-dd');
        let list = map.get(dateKey);
        if (!list) {
          list = [];
          map.set(dateKey, list);
        }
        list.push(event);
      }
    }
    return map;
  }, [events]);

  return {
    events,
    showWeekends,
    isInitialized,
    addEvent,
    updateEvent,
    deleteEvent,
    moveEvent,
    updateShowWeekends,
    eventsByDate,
  };
}
