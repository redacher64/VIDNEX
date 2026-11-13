export type AdminTheme = 'light' | 'dark';

export const ADMIN_THEME_STORAGE_KEY = 'vidnex_admin_theme';

export interface AdminThemeRootLike {
  classList: {
    add: (...tokens: string[]) => void;
    remove: (...tokens: string[]) => void;
  };
  setAttribute: (name: string, value: string) => void;
}

export interface AdminThemeDocumentLike {
  documentElement?: AdminThemeRootLike | null;
}

export function resolveInitialAdminTheme(
  storage?: Pick<Storage, 'getItem'> | null,
  matchMediaFn?: ((query: string) => { matches: boolean } | boolean) | null
): AdminTheme {
  try {
    const store =
      storage !== undefined
        ? storage
        : typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : null;
    if (store) {
      const saved =
        store.getItem(ADMIN_THEME_STORAGE_KEY) ||
        store.getItem('admin_theme') ||
        store.getItem('vidnex-admin-theme');
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    }
  } catch {
    // Ignore storage access errors
  }

  try {
    const matcher =
      matchMediaFn !== undefined
        ? matchMediaFn
        : typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia.bind(window)
        : null;
    if (matcher) {
      const res = matcher('(prefers-color-scheme: dark)');
      const matches = typeof res === 'boolean' ? res : Boolean(res && res.matches);
      return matches ? 'dark' : 'light';
    }
  } catch {
    // Ignore matchMedia errors
  }

  return 'dark';
}

export function applyAdminThemeToDocument(
  theme: AdminTheme,
  doc: AdminThemeDocumentLike | null = typeof document !== 'undefined' ? document : null,
  storage: Pick<Storage, 'setItem'> | null = typeof window !== 'undefined' && window.localStorage
    ? window.localStorage
    : null,
  persist = true
): void {
  if (doc && doc.documentElement) {
    const root = doc.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    root.setAttribute('data-admin-theme', theme);
  }
  if (persist && storage) {
    try {
      storage.setItem(ADMIN_THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage quota / privacy errors
    }
  }
}

