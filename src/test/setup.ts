import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock chrome extension storage & runtime API
const mockStorage: Record<string, any> = {};

const chromeMock = {
  storage: {
    sync: {
      get: vi.fn((keys: string | string[] | Record<string, any> | null, callback: (result: Record<string, any>) => void) => {
        const result: Record<string, any> = {};
        if (keys === null) {
          Object.assign(result, mockStorage);
        } else if (typeof keys === 'string') {
          result[keys] = mockStorage[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach(k => {
            result[k] = mockStorage[k];
          });
        } else if (typeof keys === 'object') {
          Object.keys(keys).forEach(k => {
            result[k] = mockStorage[k] !== undefined ? mockStorage[k] : keys[k];
          });
        }
        callback(result);
      }),
      set: vi.fn((data: Record<string, any>, callback?: () => void) => {
        Object.assign(mockStorage, data);
        if (callback) callback();
      }),
      remove: vi.fn((keys: string | string[], callback?: () => void) => {
        if (typeof keys === 'string') {
          delete mockStorage[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach(k => delete mockStorage[k]);
        }
        if (callback) callback();
      }),
      getBytesInUse: vi.fn((keys: string | string[] | null, callback: (bytes: number) => void) => {
        let size = 0;
        if (keys === null) {
          size = JSON.stringify(mockStorage).length;
        } else if (typeof keys === 'string') {
          size = JSON.stringify(mockStorage[keys] || '').length;
        } else if (Array.isArray(keys)) {
          keys.forEach(k => {
            size += JSON.stringify(mockStorage[k] || '').length;
          });
        }
        callback(size);
      }),
      clear: vi.fn((callback?: () => void) => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        if (callback) callback();
      }),
    },
    local: {
      get: vi.fn((keys: string | string[] | Record<string, any> | null, callback: (result: Record<string, any>) => void) => {
        const result: Record<string, any> = {};
        if (keys === null) {
          Object.assign(result, mockStorage);
        } else if (typeof keys === 'string') {
          result[keys] = mockStorage[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach(k => {
            result[k] = mockStorage[k];
          });
        } else if (typeof keys === 'object') {
          Object.keys(keys).forEach(k => {
            result[k] = mockStorage[k] !== undefined ? mockStorage[k] : keys[k];
          });
        }
        callback(result);
      }),
      set: vi.fn((data: Record<string, any>, callback?: () => void) => {
        Object.assign(mockStorage, data);
        if (callback) callback();
      }),
      remove: vi.fn((keys: string | string[], callback?: () => void) => {
        if (typeof keys === 'string') {
          delete mockStorage[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach(k => delete mockStorage[k]);
        }
        if (callback) callback();
      }),
      clear: vi.fn((callback?: () => void) => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        if (callback) callback();
      }),
    }
  },
  runtime: {
    lastError: undefined as any,
  },
};

(globalThis as any).chrome = chromeMock as any;

// Stub getComputedStyle for jsdom environment if needed
if (typeof window !== 'undefined') {
  window.getComputedStyle = () => {
    return {
      getPropertyValue: (prop: string) => {
        if (prop === '--event-color-4') return '#e0e7ff';
        return '';
      }
    } as any;
  };
}

// Reset helper
export const resetMockStorage = () => {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  (chromeMock.runtime as any).lastError = undefined;
};
