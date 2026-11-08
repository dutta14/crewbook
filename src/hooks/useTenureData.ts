import { useCallback, useMemo, useState } from 'react';
import { listMembers } from '../data/members';
import type { TenureBar, TenureScale, TenureSortField } from '../types/tenure';
import {
  averageTenure,
  buildTenureBars,
  buildTenureScale,
  isTenureSortField,
  sortTenureBars,
} from '../utils/tenure';
import { useEncryptedStorage } from './useEncryptedStorage';

export interface UseTenureData {
  /** Sorted by `sortField`. Members whose start date cannot be read are left out. */
  bars: TenureBar[];
  averageTenure: { months: number; label: string };
  sortField: TenureSortField;
  /** Anything that is not a known sort field is ignored. */
  setSortField: (field: TenureSortField) => void;
  timeScale: TenureScale;
  /** Today at the time the page opened, so every bar and the marker agree. */
  today: Date;
}

/** Tenure is worked out from the roster in memory. The sort order is never stored. */
export function useTenureData(): UseTenureData {
  const storage = useEncryptedStorage();
  const [today] = useState(() => new Date());
  const [sortField, setSortFieldState] = useState<TenureSortField>('startDate');

  const members = useMemo(() => listMembers(storage), [storage]);
  const unsorted = useMemo(() => buildTenureBars(members, today), [members, today]);
  const bars = useMemo(() => sortTenureBars(unsorted, sortField), [unsorted, sortField]);
  const average = useMemo(() => averageTenure(unsorted), [unsorted]);
  const timeScale = useMemo(() => buildTenureScale(unsorted, today), [unsorted, today]);

  const setSortField = useCallback((field: TenureSortField) => {
    if (isTenureSortField(field)) setSortFieldState(field);
  }, []);

  return { bars, averageTenure: average, sortField, setSortField, timeScale, today };
}
