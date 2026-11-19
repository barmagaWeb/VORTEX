/**
 * Storage utility that wraps localStorage with graceful fallback to memory.
 */
class LocalStorageAdapter {
  private memStore: Record<string, string> = {};

  get<T>(key: string, defaultValue: T): T {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem(key);
        if (item !== null) {
          return JSON.parse(item) as T;
        }
      }
    } catch {
      // ignore
    }
    if (this.memStore[key]) {
      try {
        return JSON.parse(this.memStore[key]) as T;
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  }

  set<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, serialized);
      }
      this.memStore[key] = serialized;
    } catch {
      // ignore
    }
  }

  remove(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
    delete this.memStore[key];
  }
}

export const storage = new LocalStorageAdapter();
