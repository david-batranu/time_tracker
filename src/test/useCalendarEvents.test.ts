import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { storage } from '../storage';
import { resetMockStorage } from './setup';

describe('useCalendarEvents Hook', () => {
  beforeEach(() => {
    resetMockStorage();
  });

  it('should initialize with settings and events', async () => {
    const { result } = renderHook(() => useCalendarEvents());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.events).toEqual([]);
      expect(result.current.showWeekends).toBe(true);
    });
  });

  it('should add, update, and delete events', async () => {
    const { result } = renderHook(() => useCalendarEvents());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    const start = new Date('2026-06-05T10:00:00');
    const end = new Date('2026-06-05T11:00:00');

    act(() => {
      result.current.addEvent({
        title: 'Meeting',
        start,
        end,
      });
    });

    expect(result.current.events.length).toBe(1);
    expect(result.current.events[0]?.title).toBe('Meeting');
    
    // Check lookup map (date format: yyyy-MM-dd)
    expect(result.current.eventsByDate.get('2026-06-05')?.length).toBe(1);

    const eventId = result.current.events[0]?.id || '';

    act(() => {
      result.current.updateEvent(eventId, { title: 'Lunch' });
    });

    expect(result.current.events[0]?.title).toBe('Lunch');

    act(() => {
      result.current.deleteEvent(eventId);
    });

    expect(result.current.events.length).toBe(0);
    expect(result.current.eventsByDate.get('2026-06-05')?.length || 0).toBe(0);
  });

  it('should handle functional updates to prevent stale closures', async () => {
    const { result } = renderHook(() => useCalendarEvents());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    // Simulate rapid concurrent updates
    act(() => {
      result.current.addEvent({ title: 'Task A', start: new Date(), end: new Date() });
      result.current.addEvent({ title: 'Task B', start: new Date(), end: new Date() });
    });

    expect(result.current.events.length).toBe(2);
    expect(result.current.events.map(e => e.title)).toContain('Task A');
    expect(result.current.events.map(e => e.title)).toContain('Task B');
  });

  it('should flush storage on window beforeunload', async () => {
    const { result } = renderHook(() => useCalendarEvents());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    const setSpy = vi.spyOn(storage, 'flush');

    // Trigger beforeunload event
    window.dispatchEvent(new Event('beforeunload'));

    expect(setSpy).toHaveBeenCalled();
  });

  it('should move an event using moveEvent callback', async () => {
    const { result } = renderHook(() => useCalendarEvents());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    const start = new Date('2026-06-05T10:00:00');
    const end = new Date('2026-06-05T11:00:00');

    act(() => {
      result.current.addEvent({
        title: 'Move Target',
        start,
        end,
      });
    });

    expect(result.current.events.length).toBe(1);
    const addedEvent = result.current.events[0];
    if (!addedEvent) throw new Error('Event not added');

    const newStart = new Date('2026-06-05T13:00:00');
    const newEnd = new Date('2026-06-05T14:30:00');

    act(() => {
      result.current.moveEvent({
        event: addedEvent,
        start: newStart,
        end: newEnd,
      });
    });

    expect(result.current.events[0]?.start.getTime()).toBe(newStart.getTime());
    expect(result.current.events[0]?.end.getTime()).toBe(newEnd.getTime());
  });

  it('should update showWeekends settings and save to storage', async () => {
    const { result } = renderHook(() => useCalendarEvents());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    const setSettingsSpy = vi.spyOn(storage, 'setSettings');

    act(() => {
      result.current.updateShowWeekends(false);
    });

    expect(result.current.showWeekends).toBe(false);
    expect(setSettingsSpy).toHaveBeenCalledWith({ showWeekends: false });
  });
});
