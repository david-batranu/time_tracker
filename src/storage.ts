import { TimeEntry, Project, Settings } from './types';
import LZString from 'lz-string';

const CHUNK_SIZE_CHARS = 3000; // 3000 UTF-16 chars = 6000 bytes, safely under 8192 bytes limit

// Generic debouncer
function encodeTime(start: Date, end: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yy = start.getFullYear() % 100;
  const MM = start.getMonth() + 1;
  const dd = start.getDate();
  const HH = start.getHours();
  const mm = start.getMinutes();
  const eHH = end.getHours();
  const emm = end.getMinutes();
  return `${pad(yy)}${pad(MM)}${pad(dd)}${pad(HH)}${pad(mm)}${pad(eHH)}${pad(emm)}`;
}

function decodeTime(tStr: string): { start: string; end: string } {
  if (!tStr || tStr.length !== 14) return { start: new Date().toISOString(), end: new Date().toISOString() };
  const yy = parseInt(tStr.slice(0, 2), 10);
  const year = yy + 2000;
  const MM = parseInt(tStr.slice(2, 4), 10) - 1;
  const dd = parseInt(tStr.slice(4, 6), 10);
  const HH = parseInt(tStr.slice(6, 8), 10);
  const mm = parseInt(tStr.slice(8, 10), 10);
  const eHH = parseInt(tStr.slice(10, 12), 10);
  const emm = parseInt(tStr.slice(12, 14), 10);

  const start = new Date(year, MM, dd, HH, mm);
  let end = new Date(year, MM, dd, eHH, emm);
  // Handle cross-midnight events
  if (end < start) {
    end = new Date(year, MM, dd + 1, eHH, emm);
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

// Convert a TimeEntry into minified payload
function compressEntry(e: TimeEntry): any {
  const minified: any = {
    i: e.id,
    l: e.title,
    t: encodeTime(e.start instanceof Date ? e.start : new Date(e.start), e.end instanceof Date ? e.end : new Date(e.end))
  };
  if (e.projectId) minified.p = e.projectId;
  if (e.description) minified.d = e.description;
  return minified;
}

// Convert minified payload back to TimeEntry JSON format (before Date parsing)
function decompressEntry(m: any): any {
  if (!m) return m;
  if (m.start) return m; // It's already decompressed or legacy
  const times = decodeTime(m.t);
  return {
    id: m.i?.toString(),
    title: m.l || '',
    start: times.start,
    end: times.end,
    projectId: m.p?.toString(),
    description: m.d
  };
}

// Project minification
function compressProject(p: Project): any {
  return { i: p.id, l: p.title, c: p.color };
}

function decompressProject(m: any): any {
  if (!m) return m;
  if (m.title) return m; // legacy
  return { id: m.i?.toString(), title: m.l || '', color: m.c || '#e0e7ff' };
}

// UUID to Integer Migration Maps
const eventIdMigrationMap = new Map<string, string>();
const projectIdMigrationMap = new Map<string, string>();

function migrateId(oldId: string | undefined, currentMax: { val: number }, map: Map<string, string>): string | undefined {
  if (!oldId) return undefined;
  // If it's already an integer string, update currentMax and return it
  if (/^\d+$/.test(oldId)) {
    currentMax.val = Math.max(currentMax.val, parseInt(oldId, 10));
    return oldId;
  }
  // Otherwise it's a UUID or string, assign a new integer ID
  if (!map.has(oldId)) {
    currentMax.val += 1;
    map.set(oldId, currentMax.val.toString());
  }
  return map.get(oldId);
}

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
async function syncSetCompressed(key: string, data: any[], lastUpdated: number): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) return;

  let finalData = data;
  let minSyncDate: string | undefined = undefined;

  let jsonStr = JSON.stringify(finalData);
  let compressedStr = LZString.compressToUTF16(jsonStr);
  
  // If payload is nearing limit (compressed length > 40000 UTF-16 chars ~ 80KB)
  if (key === 'events' && compressedStr.length > 40000) {
    let years = new Set<number>();
    data.forEach(e => {
       if (e.t) years.add(parseInt(e.t.slice(0, 2), 10) + 2000);
    });
    const sortedYears = Array.from(years).sort((a, b) => a - b);
    if (sortedYears.length > 1) {
       const oldestYear = sortedYears[0];
       finalData = data.filter(e => {
          if (!e.t) return true;
          return parseInt(e.t.slice(0, 2), 10) + 2000 > oldestYear;
       });
       minSyncDate = `${oldestYear + 1}-01-01T00:00:00.000Z`;
       jsonStr = JSON.stringify(finalData);
       compressedStr = LZString.compressToUTF16(jsonStr);
    }
  }

  // Split into chunks of CHUNK_SIZE_CHARS
  const chunks = compressedStr.match(new RegExp(`.{1,${CHUNK_SIZE_CHARS}}`, 'g')) || [];
  
  const dataToWrite: Record<string, any> = {
    [`${key}_meta`]: { lastUpdated, chunkCount: chunks.length, minSyncDate }
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
async function syncGetCompressed(key: string): Promise<{ data: any, lastUpdated: number, minSyncDate?: string } | null> {
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
          resolve({ data, lastUpdated: meta.lastUpdated, minSyncDate: meta.minSyncDate });
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
    let syncMinSyncDate: string | undefined = undefined;
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      const syncResult = await syncGetCompressed('events');
      if (syncResult) {
        syncData = syncResult.data;
        syncUpdated = syncResult.lastUpdated;
        syncMinSyncDate = syncResult.minSyncDate;
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
      if (syncMinSyncDate && localData) {
         const preservedLocal = localData.filter(e => {
            const dec = decompressEntry(e);
            return new Date(dec.start) < new Date(syncMinSyncDate!);
         });
         winnerData = [...preservedLocal, ...syncData];
      } else {
         winnerData = syncData;
      }
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

    let maxId = { val: 0 };
    // Pass 1: find highest integer id to continue incrementing safely
    winnerData.forEach((e: any) => {
      const dec = decompressEntry(e);
      if (/^\d+$/.test(dec.id)) maxId.val = Math.max(maxId.val, parseInt(dec.id, 10));
    });

    const finalEvents = winnerData.map((e: any) => {
      const dec = decompressEntry(e);
      const newId = migrateId(dec.id, maxId, eventIdMigrationMap);
      if (newId) dec.id = newId;
      
      // If projectId is still a UUID, we shouldn't use the event maxId.
      // We will just try to pull from projectIdMigrationMap, or if not found, we assign a fallback.
      if (dec.projectId && !/^\d+$/.test(dec.projectId)) {
        if (projectIdMigrationMap.has(dec.projectId)) {
          dec.projectId = projectIdMigrationMap.get(dec.projectId);
        } else {
          // Fallback for deleted projects or if projects haven't loaded yet
          const fallback = Math.floor(Math.random() * 10000) + 10000;
          projectIdMigrationMap.set(dec.projectId, fallback.toString());
          dec.projectId = fallback.toString();
        }
      }

      return {
        ...dec,
        start: new Date(dec.start),
        end: new Date(dec.end)
      } as TimeEntry;
    });
    
    // Auto-save migration back if anything migrated
    if (finalEvents.length > 0 && finalEvents.some((e, idx) => e.id !== decompressEntry(winnerData[idx])?.id)) {
        debouncedSyncSetEvents(finalEvents.map(compressEntry), Date.now());
    }

    return finalEvents;
  },
  
  set: async (entries: TimeEntry[]): Promise<void> => {
    const serialized = entries.map(compressEntry);
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

    let maxId = { val: 0 };
    winnerData.forEach((e: any) => {
      const dec = decompressProject(e);
      if (/^\d+$/.test(dec.id)) maxId.val = Math.max(maxId.val, parseInt(dec.id, 10));
    });

    const emittedIds = new Set<string>();
    const finalProjects = winnerData.map((e: any) => {
      const dec = decompressProject(e);
      let newId = migrateId(dec.id, maxId, projectIdMigrationMap);
      if (newId) {
        if (emittedIds.has(newId)) {
          maxId.val += 1;
          newId = maxId.val.toString();
        }
        emittedIds.add(newId);
        dec.id = newId;
      }
      return dec as Project;
    });

    if (finalProjects.length > 0 && finalProjects.some((p, idx) => p.id !== decompressProject(winnerData[idx])?.id)) {
      debouncedSyncSetProjects(finalProjects.map(compressProject), Date.now());
    }

    return finalProjects;
  },

  setProjects: async (projects: Project[]): Promise<void> => {
    const serialized = projects.map(compressProject);
    const updated = Date.now();
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ projects_cache: serialized, projects_updated: updated }, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve();
        });
      });
      debouncedSyncSetProjects(serialized, updated);
    } else {
      localStorage.setItem('projects', JSON.stringify(serialized));
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
  },

  exportData: async (): Promise<void> => {
    const events = await storage.get();
    const projects = await storage.getProjects();
    const settings = await storage.getSettings();
    const data = { events, projects, settings, version: 1 };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  importData: async (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const contents = e.target?.result as string;
          const data = JSON.parse(contents);
          
          if (data.settings) await storage.setSettings(data.settings);
          
          if (data.projects && Array.isArray(data.projects)) {
             const existing = await storage.getProjects();
             const merged = [...existing];
             data.projects.forEach((p: Project) => {
                if (!merged.find(ep => ep.id === p.id)) {
                   merged.push(p);
                }
             });
             await storage.setProjects(merged);
          }
          
          if (data.events && Array.isArray(data.events)) {
             const existing = await storage.get();
             const merged = [...existing];
             data.events.forEach((ev: any) => {
                if (!merged.find(ee => ee.id === ev.id)) {
                   merged.push({
                      ...ev,
                      start: new Date(ev.start),
                      end: new Date(ev.end)
                   });
                }
             });
             await storage.set(merged);
          }
          
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
};
