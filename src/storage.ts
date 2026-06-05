import { TimeEntry, Project, Settings } from './types';

// Debounce helper for storage writes
function debounce<T extends (...args: any[]) => Promise<void>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        func(...args).then(resolve).catch(reject);
      }, wait);
    });
  };
}

const performSet = async (entries: TimeEntry[]): Promise<void> => {
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
          resolve();
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
      return new Promise((resolve) => {
        chrome.storage.sync.get(['timeEntries'], (result) => {
          if (result.timeEntries && Array.isArray(result.timeEntries)) {
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
        return JSON.parse(stored).map((e: any) => ({
          ...e,
          start: new Date(e.start),
          end: new Date(e.end),
        }));
      }
      return [];
    }
  },
  
  // Debounced version of set to prevent rate limits and race conditions
  set: debounce(performSet, 500),

  getSettings: async (): Promise<Settings> => {
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
      return Promise.resolve();
    }
  },

  getProjects: async (): Promise<Project[]> => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      return new Promise((resolve) => {
        chrome.storage.sync.get(['projects'], (result) => {
          resolve((result.projects as Project[]) || []);
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
  }
};
