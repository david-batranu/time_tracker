import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { storage } from '../storage';
import { TimeEntry } from '../types';
import { resetMockStorage } from './setup';

describe('Storage Management', () => {
  beforeEach(() => {
    resetMockStorage();
    vi.useFakeTimers();
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
    vi.runAllTimers(); // Resolve debounce timeout
    await p;

    const loaded = await storage.get();
    expect(loaded.length).toBe(1);
    expect(loaded[0]?.title).toBe('Work Task');
    expect(loaded[0]?.start).toBeInstanceOf(Date);
  });

  it('should chunk time entries when they exceed the limit', async () => {
    // Generate many entries with long descriptions to force chunking (>6000 bytes)
    const largeEntries: TimeEntry[] = Array.from({ length: 50 }, (_, i) => ({
      id: `id-${i}`,
      title: `Task ${i}`,
      start: new Date(),
      end: new Date(),
      description: 'A'.repeat(200), // ~200 bytes per entry
    }));

    const p = storage.set(largeEntries);
    vi.runAllTimers();
    await p;

    // Verify chunking metadata is set
    return new Promise<void>((resolve) => {
      chrome.storage.sync.get(['te_chunk_count'], async (result) => {
        expect(result.te_chunk_count).toBeGreaterThan(1);
        
        // Load events through storage.get and check if all are preserved
        const loaded = await storage.get();
        expect(loaded.length).toBe(50);
        expect(loaded[49]?.title).toBe('Task 49');
        resolve();
      });
    });
  });

  it('should reject when chrome.runtime.lastError is present', async () => {
    (chrome.runtime as any).lastError = new Error('Test storage failure');
    await expect(storage.get()).rejects.toThrow('Test storage failure');
  });

  it('should support immediate flush of debounced writes', async () => {
    const mockEntries: TimeEntry[] = [
      {
        id: 'flush-test',
        title: 'Flush Title',
        start: new Date(),
        end: new Date(),
      },
    ];

    const p = storage.set(mockEntries);
    // Do not run timers, flush immediately
    storage.set.flush();
    await p;

    const loaded = await storage.get();
    expect(loaded.length).toBe(1);
    expect(loaded[0]?.title).toBe('Flush Title');
  });

  it('should get quota usage', async () => {
    // Mock getBytesInUse to return 5120 bytes
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
      // Simulate failure by having lastError set
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

  it('should reject when set exceeds overall storage quota', async () => {
    // Generate massive entries whose key + value length exceeds 100000 bytes
    const massiveEntries: TimeEntry[] = Array.from({ length: 200 }, (_, i) => ({
      id: `id-${i}`,
      title: `Task ${i}`,
      start: new Date(),
      end: new Date(),
      description: 'B'.repeat(500), // ~500 bytes per entry, 200 * 500 = 100KB
    }));

    const p = storage.set(massiveEntries);
    storage.set.flush(); // Flush the debounce so it executes immediately
    await expect(p).rejects.toThrow('Storage quota exceeded');
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
    
    // Inject directly into chrome mock storage
    await new Promise<void>((resolve) => {
      chrome.storage.sync.set({ timeEntries: mockLegacyEntries }, resolve);
    });

    const loaded = await storage.get();
    expect(loaded.length).toBe(1);
    expect(loaded[0]?.id).toBe('legacy-1');
    expect(loaded[0]?.title).toBe('Legacy Task');
    expect(loaded[0]?.start).toBeInstanceOf(Date);
  });

  it('should handle chunk parse failure gracefully', async () => {
    // Inject malformed JSON into a chunk
    await new Promise<void>((resolve) => {
      chrome.storage.sync.set({
        te_chunk_count: 1,
        te_chunk_0: 'invalid { json'
      }, resolve);
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loaded = await storage.get();
    expect(loaded).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to parse chunk:'), expect.any(Error));
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
      storage.set.flush();
      await p;

      const loaded = await storage.get();
      expect(loaded.length).toBe(1);
      expect(loaded[0]?.title).toBe('Local Storage Task');
      expect(loaded[0]?.start).toBeInstanceOf(Date);
    });

    it('should handle localStorage parse failure gracefully', async () => {
      localStorage.setItem('timeEntries', 'malformed { json');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const loaded = await storage.get();
      expect(loaded).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
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
      const loaded = await storage.getProjects();
      expect(loaded).toEqual(mockProjects);
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
