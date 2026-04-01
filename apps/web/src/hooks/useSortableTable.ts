'use client';

import { useState, useCallback, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  sortColumn: string | null;
  sortDirection: SortDirection;
}

type Accessor<T> = (item: T) => unknown;

export function useSortableTable<T>(defaultColumn?: string, defaultDirection?: SortDirection) {
  const [sortState, setSortState] = useState<SortState>({
    sortColumn: defaultColumn ?? null,
    sortDirection: defaultDirection ?? null,
  });

  const handleSort = useCallback((column: string) => {
    setSortState((prev) => {
      if (prev.sortColumn !== column) {
        return { sortColumn: column, sortDirection: 'asc' };
      }
      if (prev.sortDirection === 'asc') {
        return { sortColumn: column, sortDirection: 'desc' };
      }
      if (prev.sortDirection === 'desc') {
        return { sortColumn: null, sortDirection: null };
      }
      return { sortColumn: column, sortDirection: 'asc' };
    });
  }, []);

  const sortData = useCallback(
    (data: T[], accessors: Record<string, Accessor<T>>): T[] => {
      const { sortColumn, sortDirection } = sortState;

      if (!sortColumn || !sortDirection || !accessors[sortColumn]) {
        return data;
      }

      const accessor = accessors[sortColumn];

      return [...data].sort((a, b) => {
        const aVal = accessor(a);
        const bVal = accessor(b);

        // Null/undefined always sort last regardless of direction
        const aIsNull = aVal === null || aVal === undefined || aVal === '';
        const bIsNull = bVal === null || bVal === undefined || bVal === '';

        if (aIsNull && bIsNull) return 0;
        if (aIsNull) return 1;
        if (bIsNull) return -1;

        let comparison = 0;

        if (aVal instanceof Date && bVal instanceof Date) {
          comparison = aVal.getTime() - bVal.getTime();
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else if (typeof aVal === 'string' && typeof bVal === 'string') {
          // Try date parsing
          const aDate = Date.parse(aVal);
          const bDate = Date.parse(bVal);
          if (!isNaN(aDate) && !isNaN(bDate)) {
            comparison = aDate - bDate;
          } else {
            comparison = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
          }
        } else {
          comparison = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: 'base' });
        }

        return sortDirection === 'desc' ? -comparison : comparison;
      });
    },
    [sortState]
  );

  return {
    sortColumn: sortState.sortColumn,
    sortDirection: sortState.sortDirection,
    handleSort,
    sortData,
  };
}
