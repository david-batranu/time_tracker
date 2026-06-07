import { TimeEntry, Project, Settings } from './types';
import LZString from 'lz-string';

const CHUNK_SIZE_CHARS = 3000; // 3000 UTF-16 chars = 6000 bytes, safely under 8192 bytes limit

// Generic debouncer
function debounce<T extends (...args: any[]) => Promise<void>>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) & { flush: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let latestArgs: Parameters<T> | null = null;

  const debounced = (...args: Parameters<T>) => {
    latestArgs = args;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      if (latestArgs) {
        func(...latestArgs).catch(err => console.error('Debounced func error:', err));
        latestArgs = null;
      }
    }, wait);
  };

  debounced.flush = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (latestArgs) {
      func(...latestArgs).catch(err => console.error('Flush func error:', err));
      latestArgs = null;
    }
  };

  return debounced;
}

// Helper to write compressed and chunked data to sync storage
async function syncSetCompressed(key: string, data: any, lastUpdated: number): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) return;

  const jsonStr = JSON.stringify(data);
  const compressedStr = LZString.compressToUTF16(jsonStr);
  
  // Split into chunks of CHUNK_SIZE_CHARS
  const chunks = compressedStr.match(new RegExp(`.{1,${CHUNK_SIZE_CHARS}}`, 'g')) || [];
  
  const dataToWrite: Record<string, any> = {
    [`${key}_meta`]: { lastUpdated, chunkCount: chunks.length }
  };
  
  chunks.forEach((chunk, i) => {
    dataToWrite[`${key}_chunk_${i}`] = chunk;
  });

  return new Promise((resolve, reject) => {
    chrome.storage.sync.get([`${key}_meta`], (result) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      
      const prevMeta = result[`${key}_meta`];
      const prevCount = prevMeta?.chunkCount || 0;
      
      const keysToRemove: string[] = [];
      for (let i = chunks.length; i < prevCount; i++) {
        keysToRemove.push(`${key}_chunk_${i}`);
      }
      
      const proceed = () => {
        chrome.storage.sync.set(dataToWrite, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve();
        });
      };

      if (keysToRemove.length > 0) {
        chrome.storage.sync.remove(keysToRemove, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else proceed();
        });
      } else {
        proceed();
      }
    });
  });
}

// Helper to read compressed and chunked data from sync storage
async function syncGetCompressed(key: string): Promise<{ data: any, lastUpdated: number } | null> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) return null;

  return new Promise((resolve, reject) => {
    chrome.storage.sync.get([`${key}_meta`], (result) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);

      const meta = result[`${key}_meta`];
      if (!meta) {
        resolve(null);
        return;
      }
      
      const chunkKeys = Array.from({ length: meta.chunkCount }, (_, i) => `${key}_chunk_${i}`);
      chrome.storage.sync.get(chunkKeys, (chunksResult) => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);

        let compressedStr = '';
        for (let i = 0; i < meta.chunkCount; i++) {
          compressedStr += chunksResult[`${key}_chunk_${i}`] || '';
        }
        
        if (!compressedStr) {
          resolve(null);
          return;
        }

        try {
          const jsonStr = LZString.decompressFromUTF16(compressedStr);
          if (!jsonStr) { resolve(null); return; }
          const data = JSON.parse(jsonStr);
          resolve({ data, lastUpdated: meta.lastUpdated });
        } catch (e) {
          console.error(`Failed to decompress ${key}:`, e);
          resolve(null);
        }
      });
    });
  });
}

// --- Specific debounced sync setters ---
const debouncedSyncSetEvents = debounce(async (data: any[], lastUpdated: number) => {
  await syncSetCompressed('events', data, lastUpdated);
}, 2000);

const debouncedSyncSetProjects = debounce(async (data: any[], lastUpdated: number) => {
  await syncSetCompressed('projects', data, lastUpdated);
}, 2000);

// --- Migration / Legacy reading ---
async function readLegacyEvents(): Promise<any[] | null> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) return null;
  return new Promise((resolve) => {
    chrome.storage.sync.get(['te_chunk_count', 'timeEntries'], (result) => {
      const chunkCount = result.te_chunk_count as number | undefined;
      if (chunkCount !== undefined) {
        const chunkKeys = Array.from({ length: chunkCount }, (_, i) => `te_chunk_${i}`);
        chrome.storage.sync.get(chunkKeys, (chunksResult) => {
          const allEntries: any[] = [];
          for (let i = 0; i < chunkCount; i++) {
            const chunkStr = chunksResult[`te_chunk_${i}`];
            if (chunkStr) {
              try {
                allEntries.push(...JSON.parse(chunkStr));
              } catch (e) {}
            }
          }
          resolve(allEntries);
        });
      } else if (result.timeEntries && Array.isArray(result.timeEntries)) {
        resolve(result.timeEntries);
      } else {
        resolve(null);
      }
    });
  });
}

async function readLegacyProjects(): Promise<any[] | null> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) return null;
  return new Promise((resolve) => {
    chrome.storage.sync.get(['projects'], (result) => {
      resolve(result.projects && Array.isArray(result.projects) ? result.projects : null);
    });
  });
}

// --- Main API ---
export const storage = {
  get: async (): Promise<TimeEntry[]> => {
    let localData: any[] | null = null;
    let localUpdated = 0;
    
    // 1. Read from fast local cache
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const res = await new Promise<any>(resolve => chrome.storage.local.get(['events_cache', 'events_updated'], resolve));
      if (res.events_cache) {
        localData = res.events_cache;
        localUpdated = res.events_updated || 0;
      }
    } else {
      const stored = localStorage.getItem('timeEntries');
      if (stored) {
        try {
          localData = JSON.parse(stored);
          localUpdated = parseInt(localStorage.getItem('timeEntries_updated') || '0', 10);
        } catch (e) {}
      }
    }

    // 2. Read from sync storage
    let syncData: any[] | null = null;
    let syncUpdated = 0;
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      const syncResult = await syncGetCompressed('events');
      if (syncResult) {
        syncData = syncResult.data;
        syncUpdated = syncResult.lastUpdated;
      } else {
        // Fallback to old format
        const legacy = await readLegacyEvents();
        if (legacy) {
          syncData = legacy;
          syncUpdated = 1; // Give it a low timestamp so local overrides if newer, otherwise adopts it
        }
      }
    }

    // 3. Resolve conflict (highest timestamp wins)
    let winnerData: any[] = [];
    if (syncUpdated > localUpdated && syncData) {
      winnerData = syncData;
      // Mirror down to local
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ events_cache: winnerData, events_updated: syncUpdated });
      }
    } else if (localData) {
      winnerData = localData;
      // Sync up if sync is behind
      if (localUpdated > syncUpdated && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        debouncedSyncSetEvents(winnerData, localUpdated);
      }
    } else if (syncData) {
      winnerData = syncData;
    }

    return winnerData.map((e: any) => ({
      ...e,
      start: new Date(e.start),
      end: new Date(e.end),
    }));
  },
  
  set: async (entries: TimeEntry[]): Promise<void> => {
    const serialized = entries.map(e => ({
      ...e,
      start: e.start instanceof Date ? e.start.toISOString() : e.start,
      end: e.end instanceof Date ? e.end.toISOString() : e.end,
    }));
    const updated = Date.now();

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      // Immediate reliable write
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ events_cache: serialized, events_updated: updated }, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve();
        });
      });
      // Background sync write
      debouncedSyncSetEvents(serialized, updated);
    } else {
      localStorage.setItem('timeEntries', JSON.stringify(serialized));
      localStorage.setItem('timeEntries_updated', updated.toString());
    }
  },

  getProjects: async (): Promise<Project[]> => {
    let localData: any[] | null = null;
    let localUpdated = 0;
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const res = await new Promise<any>(resolve => chrome.storage.local.get(['projects_cache', 'projects_updated'], resolve));
      if (res.projects_cache) {
        localData = res.projects_cache;
        localUpdated = res.projects_updated || 0;
      }
    } else {
      const stored = localStorage.getItem('projects');
      if (stored) {
        try {
          localData = JSON.parse(stored);
          localUpdated = parseInt(localStorage.getItem('projects_updated') || '0', 10);
        } catch (e) {}
      }
    }

    let syncData: any[] | null = null;
    let syncUpdated = 0;
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      const syncResult = await syncGetCompressed('projects');
      if (syncResult) {
        syncData = syncResult.data;
        syncUpdated = syncResult.lastUpdated;
      } else {
        const legacy = await readLegacyProjects();
        if (legacy) {
          syncData = legacy;
          syncUpdated = 1;
        }
      }
    }

    let winnerData: any[] = [];
    if (syncUpdated > localUpdated && syncData) {
      winnerData = syncData;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ projects_cache: winnerData, projects_updated: syncUpdated });
      }
    } else if (localData) {
      winnerData = localData;
      if (localUpdated > syncUpdated && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        debouncedSyncSetProjects(winnerData, localUpdated);
      }
    } else if (syncData) {
      winnerData = syncData;
    }

    return winnerData;
  },

  setProjects: async (projects: Project[]): Promise<void> => {
    const updated = Date.now();
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ projects_cache: projects, projects_updated: updated }, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve();
        });
      });
      debouncedSyncSetProjects(projects, updated);
    } else {
      localStorage.setItem('projects', JSON.stringify(projects));
      localStorage.setItem('projects_updated', updated.toString());
    }
  },

  getSettings: async (): Promise<Settings> => {
    // Settings are small, standard sync storage is fine
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      return new Promise((resolve) => {
        chrome.storage.sync.get(['settings'], (result) => {
          resolve((result.settings as Settings) || { showWeekends: true });
        });
      });
    } else {
      const stored = localStorage.getItem('settings');
      return stored ? JSON.parse(stored) : { showWeekends: true };
    }
  },

  setSettings: async (settings: Settings): Promise<void> => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      return new Promise((resolve, reject) => {
        chrome.storage.sync.set({ settings }, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve();
        });
      });
    } else {
      localStorage.setItem('settings', JSON.stringify(settings));
    }
  },

  getQuotaUsage: async (): Promise<{ bytesUsed: number; limit: number; percentage: number }> => {
    const limit = 102400; // 100KB chrome.storage.sync.QUOTA_BYTES
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      return new Promise((resolve) => {
        chrome.storage.sync.getBytesInUse(null, (bytesUsed) => {
          if (chrome.runtime.lastError) {
            resolve({ bytesUsed: 0, limit, percentage: 0 });
          } else {
            resolve({
              bytesUsed,
              limit,
              percentage: (bytesUsed / limit) * 100,
            });
          }
        });
      });
    } else {
      let bytesUsed = 0;
      const keys = ['timeEntries', 'projects', 'settings'];
      for (const k of keys) {
        const val = localStorage.getItem(k);
        if (val) {
          bytesUsed += k.length + val.length;
        }
      }
      return {
        bytesUsed,
        limit,
        percentage: (bytesUsed / limit) * 100,
      };
    }
  },

  flush: (): void => {
    debouncedSyncSetEvents.flush();
    debouncedSyncSetProjects.flush();
  }
};
