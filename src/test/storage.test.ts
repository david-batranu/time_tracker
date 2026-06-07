import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { storage } from '../storage';
import { TimeEntry } from '../types';
import { resetMockStorage } from './setup';
import LZString from 'lz-string';

describe('Storage Management', () => {
  beforeEach(() => {
    resetMockStorage();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return an empty array when no events are stored', async () => {
    const entries = await storage.get();
    expect(entries).toEqual([]);
  });

  it('should save and retrieve simple time entries', async () => {
    const mockEntries: TimeEntry[] = [
      {
        id: '1',
        title: 'Work Task',
        start: new Date('2026-06-05T10:00:00Z'),
        end: new Date('2026-06-05T12:00:00Z'),
      },
    ];

    const p = storage.set(mockEntries);
    await vi.runAllTimersAsync(); // Resolve debounce timeout
    await p;

    const loaded = await storage.get();
    expect(loaded.length).toBe(1);
    expect(loaded[0]?.title).toBe('Work Task');
    expect(loaded[0]?.start).toBeInstanceOf(Date);
  });

  it('should compress and chunk time entries in sync storage', async () => {
    // Generate many entries with long descriptions to force chunking 
    const largeEntries: TimeEntry[] = Array.from({ length: 150 }, (_, i) => ({
      id: `id-${i}`,
      title: `Task ${i}`,
      start: new Date(),
      end: new Date(),
      description: 'A'.repeat(200),
    }));

    const p = storage.set(largeEntries);
    await vi.runAllTimersAsync();
    await p;

    // Verify chunking metadata is set
    return new Promise<void>((resolve) => {
      chrome.storage.sync.get(['events_meta'], async (result) => {
        expect(result.events_meta).toBeDefined();
        expect(result.events_meta.chunkCount).toBeGreaterThan(0);
        
        // Load events through storage.get and check if all are preserved
        const loaded = await storage.get();
        expect(loaded.length).toBe(150);
        expect(loaded[149]?.title).toBe('Task 149');
        resolve();
      });
    });
  });

  it('should sync up local storage to sync storage on set', async () => {
    const mockEntries: TimeEntry[] = [
      {
        id: 'flush-test',
        title: 'Flush Title',
        start: new Date(),
        end: new Date(),
      },
    ];

    const p = storage.set(mockEntries);
    // run timers to trigger debounced sync write
    await vi.runAllTimersAsync();
    await p;

    const loaded = await storage.get();
    expect(loaded.length).toBe(1);
    expect(loaded[0]?.title).toBe('Flush Title');
  });

  it('should get quota usage', async () => {
    vi.spyOn(chrome.storage.sync, 'getBytesInUse').mockImplementationOnce((_keys, cb) => {
      cb(5120);
    });
    const usage = await storage.getQuotaUsage();
    expect(usage.bytesUsed).toBe(5120);
    expect(usage.limit).toBe(102400);
    expect(usage.percentage).toBe(5);
  });

  it('should handle lastError in getQuotaUsage and return zero usage', async () => {
    const originalLastError = (chrome.runtime as any).lastError;
    (chrome.runtime as any).lastError = new Error('Bytes check failure');
    vi.spyOn(chrome.storage.sync, 'getBytesInUse').mockImplementationOnce((_keys, cb) => {
      cb(0);
    });
    
    const usage = await storage.getQuotaUsage();
    expect(usage.bytesUsed).toBe(0);
    expect(usage.percentage).toBe(0);
    
    (chrome.runtime as any).lastError = originalLastError;
  });

  it('should save and get settings', async () => {
    const mockSettings = { showWeekends: false };
    await storage.setSettings(mockSettings);
    const loadedSettings = await storage.getSettings();
    expect(loadedSettings).toEqual(mockSettings);
  });

  it('should return default settings when none are stored', async () => {
    const loadedSettings = await storage.getSettings();
    expect(loadedSettings).toEqual({ showWeekends: true });
  });

  it('should fallback to legacy timeEntries when no chunk count is present', async () => {
    const mockLegacyEntries = [
      {
        id: 'legacy-1',
        title: 'Legacy Task',
        start: '2026-06-05T10:00:00.000Z',
        end: '2026-06-05T12:00:00.000Z',
      },
    ];
    
    // Inject directly into chrome mock sync storage
    await new Promise<void>((resolve) => {
      chrome.storage.sync.set({ timeEntries: mockLegacyEntries }, resolve);
    });

    const loaded = await storage.get();
    expect(loaded.length).toBe(1);
    expect(loaded[0]?.id).toBe('1');
    expect(loaded[0]?.title).toBe('Legacy Task');
    expect(loaded[0]?.start).toBeInstanceOf(Date);
  });

  it('should handle compression parse failure gracefully', async () => {
    // Inject malformed LZString into a chunk
    await new Promise<void>((resolve) => {
      chrome.storage.sync.set({
        events_meta: { lastUpdated: 1, chunkCount: 1 },
        events_chunk_0: 'invalid_lz_string'
      }, resolve);
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loaded = await storage.get();
    expect(loaded).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to decompress events:'), expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  describe('localStorage Fallbacks (chrome API unavailable)', () => {
    let originalChrome: any;
    let store: Record<string, string>;

    beforeEach(() => {
      originalChrome = (globalThis as any).chrome;
      (globalThis as any).chrome = undefined;
      
      store = {};
      const mockLocalStorage = {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => { store[key] = String(value); }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
        length: 0,
        key: vi.fn((index: number) => Object.keys(store)[index] || null)
      };

      vi.stubGlobal('localStorage', mockLocalStorage);
    });

    afterEach(() => {
      (globalThis as any).chrome = originalChrome;
      vi.unstubAllGlobals();
    });

    it('should save and get time entries from localStorage', async () => {
      const mockEntries: TimeEntry[] = [
        {
          id: 'local-1',
          title: 'Local Storage Task',
          start: new Date('2026-06-05T10:00:00Z'),
          end: new Date('2026-06-05T12:00:00Z'),
        },
      ];

      const p = storage.set(mockEntries);
      await vi.runAllTimersAsync();
      await p;

      const loaded = await storage.get();
      expect(loaded.length).toBe(1);
      expect(loaded[0]?.title).toBe('Local Storage Task');
      expect(loaded[0]?.start).toBeInstanceOf(Date);
    });

    it('should handle localStorage parse failure gracefully', async () => {
      localStorage.setItem('timeEntries', 'malformed { json');
      
      const loaded = await storage.get();
      expect(loaded).toEqual([]);
    });

    it('should save and get settings from localStorage', async () => {
      const mockSettings = { showWeekends: false };
      await storage.setSettings(mockSettings);
      const loaded = await storage.getSettings();
      expect(loaded).toEqual(mockSettings);
    });

    it('should save and get projects from localStorage', async () => {
      const mockProjects = [{ id: 'p1', title: 'Local Proj', color: '#fff' }];
      await storage.setProjects(mockProjects);
      await vi.runAllTimersAsync();
      const loaded = await storage.getProjects();
      expect(loaded).toEqual([{ id: '1', title: 'Local Proj', color: '#fff' }]);
    });

    it('should calculate quota usage from localStorage sizes', async () => {
      localStorage.setItem('settings', JSON.stringify({ showWeekends: true }));
      localStorage.setItem('projects', JSON.stringify([{ id: '1' }]));
      const usage = await storage.getQuotaUsage();
      expect(usage.bytesUsed).toBeGreaterThan(0);
      expect(usage.limit).toBe(102400);
      expect(usage.percentage).toBeGreaterThan(0);
    });
  });
});
