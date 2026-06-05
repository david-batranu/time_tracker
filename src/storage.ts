import { TimeEntry, Project, Settings } from './types';

function debounce<T extends (...args: any[]) => Promise<void>>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => Promise<void>) & { flush: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let latestArgs: Parameters<T> | null = null;
  let currentResolve: (() => void) | null = null;
  let currentReject: ((err: any) => void) | null = null;

  const debounced = (...args: Parameters<T>): Promise<void> => {
    latestArgs = args;
    if (timeout) clearTimeout(timeout);
    
    // Resolve the superseded promise to avoid leaks/hangs
    if (currentResolve) {
      currentResolve();
    }

    return new Promise((resolve, reject) => {
      currentResolve = resolve;
      currentReject = reject;

      timeout = setTimeout(() => {
        const resolveRef = currentResolve;
        const rejectRef = currentReject;
        currentResolve = null;
        currentReject = null;

        func(...args)
          .then(() => {
            if (resolveRef) resolveRef();
          })
          .catch((err) => {
            if (rejectRef) rejectRef(err);
          });
        latestArgs = null;
      }, wait);
    });
  };

  debounced.flush = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (latestArgs) {
      const resolveRef = currentResolve;
      const rejectRef = currentReject;
      currentResolve = null;
      currentReject = null;

      func(...latestArgs)
        .then(() => {
          if (resolveRef) resolveRef();
        })
        .catch((err) => {
          if (rejectRef) rejectRef(err);
        });
      latestArgs = null;
    } else if (currentResolve) {
      currentResolve();
      currentResolve = null;
      currentReject = null;
    }
  };

  return debounced;
}

const CHUNK_SIZE_LIMIT = 6000; // Safe threshold under 8,192 bytes
const CHUNK_PREFIX = 'te_chunk_';

const performSet = async (entries: TimeEntry[]): Promise<void> => {
  const serializedEntries = entries.map(e => ({
    ...e,
    start: e.start instanceof Date ? e.start.toISOString() : e.start,
    end: e.end instanceof Date ? e.end.toISOString() : e.end,
  }));

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    // Determine chunking
    const chunks: string[] = [];
    let currentChunk: any[] = [];
    for (const entry of serializedEntries) {
      const tempChunk = [...currentChunk, entry];
      if (JSON.stringify(tempChunk).length > CHUNK_SIZE_LIMIT) {
        if (currentChunk.length === 0) {
          chunks.push(JSON.stringify([entry]));
        } else {
          chunks.push(JSON.stringify(currentChunk));
          currentChunk = [entry];
        }
      } else {
        currentChunk.push(entry);
      }
    }
    if (currentChunk.length > 0) {
      chunks.push(JSON.stringify(currentChunk));
    }

    // Check overall quota limit (100KB)
    let totalBytes = 0;
    const dataToWrite: Record<string, any> = {};
    
    // Chunk keys
    chunks.forEach((chunkStr, i) => {
      const key = `${CHUNK_PREFIX}${i}`;
      dataToWrite[key] = chunkStr;
      totalBytes += key.length + chunkStr.length;
    });
    
    dataToWrite['te_chunk_count'] = chunks.length;
    totalBytes += 'te_chunk_count'.length + String(chunks.length).length;

    // Check if the total size exceeds sync quota (102,400 bytes)
    if (totalBytes > 100000) { // Keep a buffer of 2.4KB
      throw new Error(`Storage quota exceeded. Please clean up old events.`);
    }

    return new Promise<void>((resolve, reject) => {
      chrome.storage.sync.get(['te_chunk_count'], (result: any) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        const prevCount = result.te_chunk_count || 0;
        
        // Remove keys that are no longer needed
        const keysToRemove: string[] = [];
        for (let i = chunks.length; i < prevCount; i++) {
          keysToRemove.push(`${CHUNK_PREFIX}${i}`);
        }
        
        // Clean up legacy key as well
        keysToRemove.push('timeEntries');

        const proceedWithSet = () => {
          chrome.storage.sync.set(dataToWrite, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        };

        if (keysToRemove.length > 0) {
          chrome.storage.sync.remove(keysToRemove, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              proceedWithSet();
            }
          });
        } else {
          proceedWithSet();
        }
      });
    });
  } else {
    localStorage.setItem('timeEntries', JSON.stringify(serializedEntries));
    return Promise.resolve();
  }
};

export const storage = {
  get: async (): Promise<TimeEntry[]> => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['te_chunk_count', 'timeEntries'], (result: any) => {
          if (chrome.runtime.lastError) {
            console.error('Storage get error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }

          const chunkCount = result.te_chunk_count as number | undefined;
          
          if (chunkCount !== undefined) {
            // Read all chunks
            const chunkKeys = Array.from({ length: chunkCount }, (_, i) => `${CHUNK_PREFIX}${i}`) as string[];
            chrome.storage.sync.get(chunkKeys, (chunksResult: any) => {
              if (chrome.runtime.lastError) {
                console.error('Storage get chunks error:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
                return;
              }
              
              const allEntries: any[] = [];
              for (let i = 0; i < (chunkCount as number); i++) {
                const chunkStr = chunksResult[`${CHUNK_PREFIX}${i}`];
                if (chunkStr) {
                  try {
                    allEntries.push(...JSON.parse(chunkStr));
                  } catch (e) {
                    console.error('Failed to parse chunk:', e);
                  }
                }
              }
              
              const entries = allEntries.map((e: any) => ({
                ...e,
                start: new Date(e.start),
                end: new Date(e.end),
              }));
              resolve(entries);
            });
          } else if (result.timeEntries && Array.isArray(result.timeEntries)) {
            // Legacy format fallback
            const entries = result.timeEntries.map((e: any) => ({
              ...e,
              start: new Date(e.start),
              end: new Date(e.end),
            }));
            resolve(entries);
          } else {
            resolve([]);
          }
        });
      });
    } else {
      const stored = localStorage.getItem('timeEntries');
      if (stored) {
        try {
          return JSON.parse(stored).map((e: any) => ({
            ...e,
            start: new Date(e.start),
            end: new Date(e.end),
          }));
        } catch (e) {
          console.error('Failed to parse localStorage entries:', e);
          return [];
        }
      }
      return [];
    }
  },
  
  // Debounced version of set to prevent rate limits and race conditions
  set: debounce(performSet, 500),

  getSettings: async (): Promise<Settings> => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['settings'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('Storage getSettings error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve((result.settings as Settings) || { showWeekends: true });
          }
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
      return Promise.resolve();
    }
  },

  getProjects: async (): Promise<Project[]> => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['projects'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('Storage getProjects error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve((result.projects as Project[]) || []);
          }
        });
      });
    } else {
      const stored = localStorage.getItem('projects');
      return stored ? JSON.parse(stored) : [];
    }
  },

  setProjects: async (projects: Project[]): Promise<void> => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      return new Promise((resolve, reject) => {
        chrome.storage.sync.set({ projects }, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve();
        });
      });
    } else {
      localStorage.setItem('projects', JSON.stringify(projects));
      return Promise.resolve();
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
  }
};
