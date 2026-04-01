'use client';

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;

interface SortableTableHeadProps {
  column: string;
  label: string;
  sortColumn: string | null;
  sortDirection: SortDirection;
  onSort: (column: string) => void;
  className?: string;
}

export function SortableTableHead({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
  className,
}: SortableTableHeadProps) {
  const isActive = sortColumn === column;

  return (
    <TableHead
      className={cn(
        'text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors',
        className
      )}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        {isActive && sortDirection === 'asc' ? (
          <ArrowUp className="w-3.5 h-3.5 text-foreground" />
        ) : isActive && sortDirection === 'desc' ? (
          <ArrowDown className="w-3.5 h-3.5 text-foreground" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />
        )}
      </div>
    </TableHead>
  );
}
