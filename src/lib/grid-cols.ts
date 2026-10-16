import { useCallback, useEffect, useState } from 'react';

export type GridCols = 3 | 6 | 9;

const STORAGE_KEY = 'agora-grid-cols';
const CHANGE_EVENT = 'agora-grid-cols';

export function readGridCols(fallback: GridCols): GridCols {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === '3' || raw === '6' || raw === '9') return Number(raw) as GridCols;
  return fallback;
}

export function writeGridCols(cols: GridCols): void {
  window.localStorage.setItem(STORAGE_KEY, String(cols));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/** Last chosen 3 / 6 / 9 density, shared by every catalog that offers it. */
export function useGridCols(fallback: GridCols): [GridCols, (cols: GridCols) => void] {
  const [cols, setCols] = useState<GridCols>(fallback);

  useEffect(() => {
    const sync = () => setCols(readGridCols(fallback));
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, [fallback]);

  const update = useCallback((next: GridCols) => {
    setCols(next);
    writeGridCols(next);
  }, []);

  return [cols, update];
}
