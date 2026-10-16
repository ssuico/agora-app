import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { exportFileName, sheetForExport } from '@/lib/sheet-export';
import { columnLetter, evaluateFormula, type FormulaValue } from '@/lib/sheet-formula';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  MoreHorizontal,
  Plus,
  Sheet,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

type ColumnType = 'text' | 'number' | 'date' | 'formula';
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';
type SheetTemplate = 'blank' | 'capital' | 'expenses';

interface SheetColumn {
  id: string;
  label: string;
  type: ColumnType;
  formula?: string;
}

interface SheetRow {
  id: string;
  cells: Record<string, string>;
}

interface StoreSheet {
  _id: string;
  storeId: string;
  name: string;
  order: number;
  columns: SheetColumn[];
  rows: SheetRow[];
  version: number;
}

const SAVE_DELAY_MS = 800;
const amountFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function newId(): string {
  return crypto.randomUUID();
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function formatAmount(value: number): string {
  return amountFormat.format(Math.round(value * 100) / 100);
}

function canonicalAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

function normalizeSheet(raw: StoreSheet): StoreSheet {
  return {
    _id: raw._id,
    storeId: String(raw.storeId),
    name: raw.name,
    order: raw.order ?? 0,
    version: raw.version,
    columns: (raw.columns ?? []).map((column) => ({
      id: column.id,
      label: column.label,
      type:
        column.type === 'number' || column.type === 'date' || column.type === 'formula'
          ? column.type
          : 'text',
      ...(column.formula ? { formula: column.formula } : {}),
    })),
    rows: (raw.rows ?? []).map((row) => ({
      id: row.id,
      cells: { ...(row.cells ?? {}) },
    })),
  };
}

function gridKey(sheet: StoreSheet): string {
  return JSON.stringify({
    name: sheet.name,
    order: sheet.order,
    columns: sheet.columns,
    rows: sheet.rows,
  });
}

function blankRow(columns: SheetColumn[]): SheetRow {
  return {
    id: newId(),
    cells: Object.fromEntries(columns.map((column) => [column.id, ''])),
  };
}

function rowAmount(
  column: SheetColumn,
  columns: SheetColumn[],
  rows: SheetRow[],
  row: SheetRow,
  index: number,
  formulaResult?: FormulaValue
): number | null {
  const raw = (row.cells[column.id] ?? '').trim();
  if (raw.startsWith('=')) {
    const result = evaluateFormula(raw, columns, rows, index, column.id);
    return result.kind === 'number' ? result.value : null;
  }
  if (column.type === 'formula') return formulaResult?.kind === 'number' ? formulaResult.value : null;
  if (column.type === 'number') return parseAmount(raw);
  return null;
}

function footerTotal(
  column: SheetColumn,
  columns: SheetColumn[],
  rows: SheetRow[],
  results?: FormulaValue[]
): number | null {
  if (column.type === 'formula' && column.formula?.includes(':')) {
    const aggregate = evaluateFormula(column.formula, columns, rows, 0, column.id);
    return aggregate.kind === 'number' ? aggregate.value : null;
  }
  let sum = 0;
  let any = false;
  rows.forEach((row, index) => {
    const value = rowAmount(column, columns, rows, row, index, results?.[index]);
    if (value == null) return;
    sum += value;
    any = true;
  });
  return any ? Math.round(sum * 100) / 100 : null;
}

function focusCell(rowIndex: number, colIndex: number) {
  window.setTimeout(() => {
    const cell = document.querySelector<HTMLElement>(`[data-sheet-cell="${rowIndex}-${colIndex}"]`);
    cell?.focus();
  }, 0);
}

function moveCell(
  event: React.KeyboardEvent<HTMLElement>,
  rowIndex: number,
  colIndex: number,
  rowCount: number,
  colCount: number,
  horizontal: 'edge' | 'always'
) {
  const key = event.key;
  const vertical = key === 'ArrowUp' || key === 'ArrowDown';
  const sideways = key === 'ArrowLeft' || key === 'ArrowRight';
  if (!vertical && !sideways) return false;
  if (sideways && horizontal === 'edge' && event.currentTarget instanceof HTMLInputElement) {
    const input = event.currentTarget;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const atStart = start === 0 && end === 0;
    const atEnd = start === input.value.length && end === input.value.length;
    const selectedAll = input.value.length > 0 && start === 0 && end === input.value.length;
    if (key === 'ArrowLeft' && !atStart && !selectedAll) return false;
    if (key === 'ArrowRight' && !atEnd && !selectedAll) return false;
  }
  const nextRow = rowIndex + (key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0);
  const nextCol = colIndex + (key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0);
  event.preventDefault();
  if (nextRow < 0 || nextCol < 0 || nextRow >= rowCount || nextCol >= colCount) return true;
  focusCell(nextRow, nextCol);
  return true;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface CellEditorProps {
  value: string;
  type: 'text' | 'number' | 'date';
  rowIndex: number;
  colIndex: number;
  rowCount: number;
  colCount: number;
  label: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  onStartFormula?: (seed: string) => void;
}

function CellEditor({
  value,
  type,
  rowIndex,
  colIndex,
  rowCount,
  colCount,
  label,
  onChange,
  onEnter,
  onStartFormula,
}: CellEditorProps) {
  const [focused, setFocused] = useState(false);
  const invalid = type === 'number' && value.trim() !== '' && parseAmount(value) == null;
  const shown =
    type === 'date'
      ? ISO_DATE.test(value)
        ? value
        : ''
      : !focused && type === 'number' && !invalid && value.trim() !== ''
        ? formatAmount(parseAmount(value) as number)
        : value;

  return (
    <input
      data-sheet-cell={`${rowIndex}-${colIndex}`}
      type={type === 'date' ? 'date' : 'text'}
      value={shown}
      maxLength={type === 'date' ? undefined : 500}
      aria-label={`${label}, row ${rowIndex + 1}`}
      aria-invalid={invalid || undefined}
      inputMode={type === 'number' ? 'decimal' : type === 'date' ? undefined : 'text'}
      className={cn(
        'h-9 w-full min-w-36 bg-transparent px-2 text-sm outline-none dark:[color-scheme:dark]',
        'focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        type === 'number' && 'text-right tabular-nums',
        type === 'date' && 'min-w-40',
        invalid && 'text-destructive'
      )}
      onFocus={(event) => {
        setFocused(true);
        if (type !== 'date') event.currentTarget.select();
      }}
      onBlur={() => {
        setFocused(false);
        if (type !== 'number') return;
        const parsed = parseAmount(value);
        if (parsed != null) onChange(canonicalAmount(parsed));
      }}
      onChange={(event) => {
        const next = event.target.value;
        if (type !== 'date' && next.trimStart().startsWith('=') && !value.trimStart().startsWith('=')) {
          onStartFormula?.(next.trim());
          return;
        }
        onChange(next);
      }}
      onKeyDown={(event) => {
        if (moveCell(event, rowIndex, colIndex, rowCount, colCount, type === 'date' ? 'always' : 'edge')) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          onEnter();
        } else if (event.key === 'Escape') {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function FormulaCell({
  result,
  formula,
  rowIndex,
  colIndex,
  rowCount,
  colCount,
  label,
  onEnter,
  onEdit,
}: {
  result: FormulaValue;
  formula?: string;
  rowIndex: number;
  colIndex: number;
  rowCount: number;
  colCount: number;
  label: string;
  onEnter: () => void;
  onEdit?: () => void;
}) {
  const message = result.kind === 'error' ? result.message : formula || 'No formula yet';
  const shown = result.kind === 'number' ? formatAmount(result.value) : '';
  return (
    <input
      readOnly
      data-sheet-cell={`${rowIndex}-${colIndex}`}
      value={shown}
      placeholder={result.kind === 'error' ? 'Error' : ''}
      title={message}
      aria-label={`${label}, row ${rowIndex + 1}`}
      className={cn(
        'h-9 w-full min-w-36 cursor-default bg-muted/40 px-2 text-right text-sm tabular-nums outline-none',
        'focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        result.kind === 'error' && 'text-destructive placeholder:text-destructive'
      )}
      onDoubleClick={() => onEdit?.()}
      onKeyDown={(event) => {
        if (event.key === '=' || event.key === 'F2') {
          event.preventDefault();
          onEdit?.();
          return;
        }
        if (moveCell(event, rowIndex, colIndex, rowCount, colCount, 'always')) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          onEnter();
        }
      }}
    />
  );
}

interface StoreSheetManagerProps {
  storeId: string;
}

export function StoreSheetManager({ storeId }: StoreSheetManagerProps) {
  const [sheets, setSheets] = useState<StoreSheet[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StoreSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTemplate, setNewTemplate] = useState<SheetTemplate>('blank');

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [columnLabel, setColumnLabel] = useState('');
  const [columnToDelete, setColumnToDelete] = useState<SheetColumn | null>(null);
  const [rowToDelete, setRowToDelete] = useState<SheetRow | null>(null);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [formulaColumnId, setFormulaColumnId] = useState<string | null>(null);
  const [formulaRowIndex, setFormulaRowIndex] = useState<number | null>(null);
  const [formulaText, setFormulaText] = useState('');
  const formulaInputRef = useRef<HTMLInputElement>(null);
  const skipColumnLabelCommit = useRef(false);

  const draftRef = useRef<StoreSheet | null>(null);
  const sheetsRef = useRef<StoreSheet[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const runningRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    sheetsRef.current = sheets;
  }, [sheets]);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const replaceSheet = useCallback((next: StoreSheet) => {
    sheetsRef.current = sheetsRef.current.map((sheet) => (sheet._id === next._id ? next : sheet));
    setSheets(sheetsRef.current);
  }, []);

  const showDraft = useCallback((next: StoreSheet) => {
    const copy = normalizeSheet(next);
    draftRef.current = copy;
    activeIdRef.current = copy._id;
    dirtyRef.current = false;
    setDraft(copy);
    setActiveId(copy._id);
    setStatus('saved');
    replaceSheet(copy);
  }, [replaceSheet]);

  const persist = useCallback(async (): Promise<boolean> => {
    if (runningRef.current) {
      const finished = await runningRef.current;
      if (dirtyRef.current) return persist();
      return finished;
    }

    const run = (async () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const snapshot = draftRef.current;
      if (!snapshot || !dirtyRef.current) return true;

      const sentKey = gridKey(snapshot);
      dirtyRef.current = false;
      setStatus('saving');

      try {
        const res = await fetch(`/api/store-sheets/${snapshot._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: snapshot.name,
            columns: snapshot.columns,
            rows: snapshot.rows,
            order: snapshot.order,
            version: snapshot.version,
          }),
        });

        if (res.status === 409) {
          const data = (await res.json().catch(() => ({}))) as { current?: StoreSheet | null };
          if (data.current) showDraft(data.current);
          else {
            dirtyRef.current = false;
            setStatus('saved');
          }
          toast.error('This sheet was changed elsewhere and has been reloaded.');
          return false;
        }

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { message?: string };
          dirtyRef.current = true;
          setStatus('error');
          toast.error(data.message ?? 'Could not save the sheet.');
          return false;
        }

        const saved = normalizeSheet((await res.json()) as StoreSheet);
        const latest = draftRef.current;
        if (latest && latest._id === snapshot._id && gridKey(latest) !== sentKey) {
          const merged = { ...latest, version: saved.version };
          draftRef.current = merged;
          setDraft(merged);
          replaceSheet(merged);
          dirtyRef.current = true;
          setStatus('unsaved');
          return true;
        }
        if (!latest || latest._id === saved._id) {
          draftRef.current = saved;
          setDraft(saved);
          setStatus('saved');
        }
        replaceSheet(saved);
        return true;
      } catch {
        dirtyRef.current = true;
        setStatus('error');
        toast.error('Could not save the sheet.');
        return false;
      }
    })();

    runningRef.current = run;
    try {
      return await run;
    } finally {
      if (runningRef.current === run) runningRef.current = null;
      if (dirtyRef.current) void persist();
    }
  }, [replaceSheet, showDraft]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    setStatus('unsaved');
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void persist();
    }, SAVE_DELAY_MS);
  }, [persist]);

  const commitDraft = useCallback((next: StoreSheet) => {
    draftRef.current = next;
    setDraft(next);
    replaceSheet(next);
    scheduleSave();
  }, [replaceSheet, scheduleSave]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const res = await fetch(`/api/store-sheets/store/${storeId}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (!cancelled) setLoadError((data as { message?: string } | null)?.message ?? 'Could not load sheets.');
          return;
        }
        if (cancelled) return;
        const list = (data as StoreSheet[]).map(normalizeSheet);
        sheetsRef.current = list;
        setSheets(list);
        if (list[0]) showDraft(list[0]);
        else {
          setDraft(null);
          setActiveId(null);
        }
      } catch {
        if (!cancelled) setLoadError('Could not load sheets.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [storeId, showDraft]);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && !runningRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden' && dirtyRef.current) {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        void persist();
      }
    };
    window.addEventListener('beforeunload', onLeave);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      document.removeEventListener('visibilitychange', onHide);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [persist]);

  const selectSheet = async (id: string) => {
    if (id === activeIdRef.current) return;
    const ok = await persist();
    if (!ok) return;
    const next = sheetsRef.current.find((sheet) => sheet._id === id);
    if (next) showDraft(next);
  };

  const createSheet = async (template: SheetTemplate, name: string) => {
    setCreating(true);
    try {
      const ok = await persist();
      if (!ok) return null;
      const payload: { name?: string; template?: 'capital' | 'expenses' } = {};
      const trimmed = name.trim();
      if (trimmed) payload.name = trimmed;
      if (template !== 'blank') payload.template = template;
      const res = await fetch(`/api/store-sheets/store/${storeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { message?: string }).message ?? 'Could not create the sheet.');
        return null;
      }
      const sheet = normalizeSheet(data as StoreSheet);
      sheetsRef.current = [...sheetsRef.current, sheet];
      setSheets(sheetsRef.current);
      showDraft(sheet);
      toast.success('Sheet added.');
      return sheet;
    } finally {
      setCreating(false);
    }
  };

  const startTemplates = async () => {
    setCreating(true);
    try {
      const created: StoreSheet[] = [];
      for (const template of ['capital', 'expenses'] as const) {
        const res = await fetch(`/api/store-sheets/store/${storeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error((data as { message?: string }).message ?? 'Could not create the sheets.');
          break;
        }
        created.push(normalizeSheet(data as StoreSheet));
      }
      if (created.length === 0) return;
      sheetsRef.current = [...sheetsRef.current, ...created];
      setSheets(sheetsRef.current);
      showDraft(created[0]);
      toast.success('Capital and Expenses sheets added.');
    } finally {
      setCreating(false);
    }
  };

  const submitNewSheet = async (event: React.FormEvent) => {
    event.preventDefault();
    const sheet = await createSheet(newTemplate, newName);
    if (!sheet) return;
    setNewOpen(false);
    setNewName('');
    setNewTemplate('blank');
  };

  const submitRename = (event: React.FormEvent) => {
    event.preventDefault();
    const current = draftRef.current;
    if (!current) return;
    const name = renameValue.trim();
    if (!name) return;
    if (name !== current.name) commitDraft({ ...current, name });
    setRenameOpen(false);
  };

  const confirmDeleteSheet = async () => {
    const current = draftRef.current;
    if (!current) return;
    setDeleting(true);
    try {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      dirtyRef.current = false;
      const res = await fetch(`/api/store-sheets/${current._id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Could not delete the sheet.');
        return;
      }
      const remaining = sheetsRef.current.filter((sheet) => sheet._id !== current._id);
      sheetsRef.current = remaining;
      setSheets(remaining);
      setDeleteOpen(false);
      toast.success('Sheet deleted.');
      if (remaining[0]) showDraft(remaining[0]);
      else {
        draftRef.current = null;
        activeIdRef.current = null;
        setDraft(null);
        setActiveId(null);
        setStatus('saved');
      }
    } finally {
      setDeleting(false);
    }
  };

  const updateCell = (rowId: string, columnId: string, value: string) => {
    if (!draftRef.current) return;
    commitDraft({
      ...draftRef.current,
      rows: draftRef.current.rows.map((row) =>
        row.id === rowId ? { ...row, cells: { ...row.cells, [columnId]: value } } : row
      ),
    });
  };

  const addRow = (afterIndex?: number) => {
    const current = draftRef.current;
    if (!current) return;
    const row = blankRow(current.columns);
    const rows = [...current.rows];
    const index = afterIndex == null ? rows.length : afterIndex + 1;
    rows.splice(index, 0, row);
    commitDraft({ ...current, rows });
    return index;
  };

  const enterFromCell = (rowIndex: number, colIndex: number) => {
    if (!draftRef.current) return;
    const last = rowIndex >= draftRef.current.rows.length - 1;
    if (last) {
      const row = blankRow(draftRef.current.columns);
      commitDraft({ ...draftRef.current, rows: [...draftRef.current.rows, row] });
      focusCell(rowIndex + 1, colIndex);
      return;
    }
    focusCell(rowIndex + 1, colIndex);
  };

  const removeRow = (rowId: string) => {
    const current = draftRef.current;
    if (!current) return;
    commitDraft({ ...current, rows: current.rows.filter((row) => row.id !== rowId) });
    setRowToDelete(null);
  };

  const requestRemoveRow = (row: SheetRow) => {
    const filled = Object.values(row.cells).some((value) => value.trim() !== '');
    if (filled) setRowToDelete(row);
    else removeRow(row.id);
  };

  const insertColumn = (index: number) => {
    const current = draftRef.current;
    if (!current) return;
    if (current.columns.length >= 50) {
      toast.error('A sheet can have at most 50 columns.');
      return;
    }
    const column: SheetColumn = { id: newId(), label: `Column ${current.columns.length + 1}`, type: 'text' };
    const columns = [...current.columns];
    columns.splice(index, 0, column);
    commitDraft({
      ...current,
      columns,
      rows: current.rows.map((row) => ({ ...row, cells: { ...row.cells, [column.id]: '' } })),
    });
    setEditingColumnId(column.id);
    setColumnLabel(column.label);
  };

  const commitColumnLabel = () => {
    if (skipColumnLabelCommit.current) {
      skipColumnLabelCommit.current = false;
      setEditingColumnId(null);
      return;
    }
    const currentDraft = draftRef.current;
    const columnId = editingColumnId;
    if (!currentDraft || !columnId) return;
    const label = columnLabel.trim();
    const current = currentDraft.columns.find((column) => column.id === columnId);
    setEditingColumnId(null);
    if (!current || !label || label === current.label) return;
    commitDraft({
      ...currentDraft,
      columns: currentDraft.columns.map((column) =>
        column.id === columnId ? { ...column, label: label.slice(0, 80) } : column
      ),
    });
  };

  const setColumnType = (columnId: string, type: Exclude<ColumnType, 'formula'>) => {
    const current = draftRef.current;
    if (!current) return;
    commitDraft({
      ...current,
      columns: current.columns.map((column) => (column.id === columnId ? { ...column, type } : column)),
    });
  };

  const openFormula = (column: SheetColumn) => {
    setFormulaColumnId(column.id);
    setFormulaRowIndex(null);
    setFormulaText(column.formula ?? '');
    setFormulaOpen(true);
  };

  const openCellFormula = (rowIndex: number, column: SheetColumn, seed: string) => {
    const text = seed.trim();
    setFormulaColumnId(column.id);
    setFormulaRowIndex(rowIndex);
    setFormulaText(text.startsWith('=') ? text : `=${text}`);
    setFormulaOpen(true);
  };

  const insertFormula = (snippet: string) => {
    const input = formulaInputRef.current;
    const start = input?.selectionStart ?? formulaText.length;
    const end = input?.selectionEnd ?? formulaText.length;
    const next = `${formulaText.slice(0, start)}${snippet}${formulaText.slice(end)}`;
    setFormulaText(next);
    window.setTimeout(() => {
      input?.focus();
      const caret = start + snippet.length;
      input?.setSelectionRange(caret, caret);
    }, 0);
  };

  const saveFormula = () => {
    const current = draftRef.current;
    if (!current || !formulaColumnId) return;
    const formula = formulaText.trim();
    if (formulaRowIndex != null) {
      const row = current.rows[formulaRowIndex];
      if (!row) return;
      const stored = formula === '' || formula === '=' ? '' : formula.startsWith('=') ? formula : `=${formula}`;
      updateCell(row.id, formulaColumnId, stored);
    } else {
      commitDraft({
        ...current,
        columns: current.columns.map((column) =>
          column.id === formulaColumnId ? { ...column, type: 'formula', formula } : column
        ),
      });
    }
    setFormulaOpen(false);
  };

  const moveColumn = (index: number, direction: -1 | 1) => {
    const current = draftRef.current;
    if (!current) return;
    const target = index + direction;
    if (target < 0 || target >= current.columns.length) return;
    const columns = [...current.columns];
    const [moved] = columns.splice(index, 1);
    columns.splice(target, 0, moved);
    commitDraft({ ...current, columns });
  };

  const removeColumn = (columnId: string) => {
    const current = draftRef.current;
    if (!current || current.columns.length <= 1) return;
    commitDraft({
      ...current,
      columns: current.columns.filter((column) => column.id !== columnId),
      rows: current.rows.map((row) => {
        const cells = { ...row.cells };
        delete cells[columnId];
        return { ...row, cells };
      }),
    });
    setColumnToDelete(null);
  };

  const requestRemoveColumn = (column: SheetColumn) => {
    const current = draftRef.current;
    if (!current || current.columns.length <= 1) return;
    const filled = current.rows.some((row) => (row.cells[column.id] ?? '').trim() !== '');
    if (filled) setColumnToDelete(column);
    else removeColumn(column.id);
  };

  const exportWorkbook = async (scope: 'sheet' | 'all') => {
    const current = draftRef.current;
    if (!current || exporting) return;
    const source =
      scope === 'sheet'
        ? [current]
        : sheetsRef.current
            .map((sheet) => (sheet._id === current._id ? current : sheet))
            .sort((a, b) => a.order - b.order);
    const fileName = scope === 'sheet' ? exportFileName(current.name) : 'capital-expenses.xlsx';
    setExporting(true);
    try {
      const res = await fetch(`/api/store-sheets/export/store/${storeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, sheets: source.map(sheetForExport) }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        toast.error(data?.message ?? 'Export failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(scope === 'sheet' ? 'Sheet downloaded' : 'Workbook downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const hasCellFormula =
    draft?.rows.some((row) => Object.values(row.cells).some((value) => value.trim().startsWith('='))) ?? false;
  const hasTotalColumn =
    hasCellFormula || (draft?.columns.some((column) => column.type === 'number' || column.type === 'formula') ?? false);
  const formulaResults = new Map<string, FormulaValue[]>();
  if (draft) {
    for (const column of draft.columns) {
      if (column.type !== 'formula') continue;
      formulaResults.set(
        column.id,
        draft.rows.map((row, index) => {
          const raw = (row.cells[column.id] ?? '').trim();
          if (raw.startsWith('=')) return evaluateFormula(raw, draft.columns, draft.rows, index, column.id);
          return evaluateFormula(column.formula, draft.columns, draft.rows, index, column.id);
        })
      );
    }
  }
  const formulaColumn = draft?.columns.find((column) => column.id === formulaColumnId) ?? null;
  const formulaPreview = (() => {
    if (!draft || !formulaColumn) return null;
    if (formulaRowIndex != null) {
      const text = formulaText.trim();
      const stored = text === '' || text === '=' ? '' : text.startsWith('=') ? text : `=${text}`;
      const rows = draft.rows.map((row, index) =>
        index === formulaRowIndex
          ? { ...row, cells: { ...row.cells, [formulaColumn.id]: stored } }
          : row
      );
      return evaluateFormula(stored, draft.columns, rows, formulaRowIndex, formulaColumn.id);
    }
    return evaluateFormula(
      formulaText,
      draft.columns.map((column) =>
        column.id === formulaColumn.id ? { ...column, type: 'formula', formula: formulaText } : column
      ),
      draft.rows,
      0,
      formulaColumn.id
    );
  })();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Capital & Expenses</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Free-form notes for capital contributions and expenses. Not included in dashboard totals.
          </p>
        </div>
        {draft && <StatusPill status={status} />}
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : sheets.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Sheet />
            </EmptyMedia>
            <EmptyTitle>No sheets yet</EmptyTitle>
            <EmptyDescription>
              Start a blank sheet, or add Capital and Expenses sheets with the columns this store already uses.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => void createSheet('blank', '')} disabled={creating}>
              {creating && <Spinner data-icon="inline-start" />}
              <Plus data-icon="inline-start" />
              Create blank sheet
            </Button>
            <Button variant="outline" onClick={() => void startTemplates()} disabled={creating}>
              {creating && <Spinner data-icon="inline-start" />}
              Start with Capital & Expenses
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1">
              {sheets.map((sheet) => {
                const selected = sheet._id === activeId;
                return (
                  <div
                    key={sheet._id}
                    className={cn(
                      'flex shrink-0 items-center rounded-md',
                      selected ? 'bg-background shadow-sm' : 'hover:bg-background/70'
                    )}
                  >
                    <button
                      type="button"
                      className={cn(
                        'max-w-48 truncate px-3 py-1 text-sm',
                        selected ? 'font-semibold text-foreground' : 'text-muted-foreground'
                      )}
                      onClick={() => void selectSheet(sheet._id)}
                    >
                      {sheet.name}
                    </button>
                    {selected && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-xs" className="mr-0.5" aria-label={`Options for ${sheet.name}`}>
                            <ChevronDown />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem
                            onClick={() => {
                              setRenameValue(sheet.name);
                              setRenameOpen(true);
                            }}
                          >
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={exporting} onClick={() => void exportWorkbook('sheet')}>
                            <Download />
                            Export
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exporting} aria-label="Export sheets">
                  {exporting ? <Spinner data-icon="inline-start" /> : <Download data-icon="inline-start" />}
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={exporting} onClick={() => void exportWorkbook('sheet')}>
                  This sheet
                </DropdownMenuItem>
                <DropdownMenuItem disabled={exporting} onClick={() => void exportWorkbook('all')}>
                  All sheets
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => setNewOpen(true)} disabled={creating}>
              <Plus data-icon="inline-start" />
              New sheet
            </Button>
          </div>

          {draft && (
            <div className="flex flex-col gap-3">
              <div className="max-h-[calc(100vh-18rem)] overflow-auto rounded-xl border border-border/60">
                <table className="w-max min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-20 bg-muted">
                    <tr>
                      <th className="sticky left-0 z-30 w-12 border-b border-r border-border/60 bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                        #
                      </th>
                      {draft.columns.map((column, index) => (
                        <th
                          key={column.id}
                          className="min-w-40 border-b border-r border-border/60 px-1 py-1 text-left font-medium"
                        >
                          <div className="flex items-center gap-1">
                            {editingColumnId === column.id ? (
                              <input
                                autoFocus
                                value={columnLabel}
                                maxLength={80}
                                aria-label="Column name"
                                className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onChange={(event) => setColumnLabel(event.target.value)}
                                onBlur={commitColumnLabel}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    event.currentTarget.blur();
                                  } else if (event.key === 'Escape') {
                                    skipColumnLabelCommit.current = true;
                                    setEditingColumnId(null);
                                  }
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 flex-col px-1 py-1 text-left"
                                onClick={() => {
                                  setEditingColumnId(column.id);
                                  setColumnLabel(column.label);
                                }}
                              >
                                <span className="flex min-w-0 items-center gap-1 text-sm font-medium">
                                  <span className="text-xs font-normal text-muted-foreground">{columnLetter(index)}</span>
                                  <span className="truncate">{column.label}</span>
                                </span>
                                {column.type === 'formula' && (
                                  <span className="truncate text-[10px] font-normal text-muted-foreground">
                                    {column.formula?.trim() || 'No formula'}
                                  </span>
                                )}
                              </button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-xs" aria-label={`Column options for ${column.label}`}>
                                  <MoreHorizontal />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setColumnType(column.id, 'text')}>
                                  Text
                                  {column.type === 'text' && <Check className="ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setColumnType(column.id, 'number')}>
                                  Number
                                  {column.type === 'number' && <Check className="ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setColumnType(column.id, 'date')}>
                                  Date
                                  {column.type === 'date' && <Check className="ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openFormula(column)}>
                                  Formula
                                  {column.type === 'formula' && <Check className="ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  disabled={draft.columns.length >= 50}
                                  onClick={() => insertColumn(index)}
                                >
                                  Insert left
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={draft.columns.length >= 50}
                                  onClick={() => insertColumn(index + 1)}
                                >
                                  Insert right
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem disabled={index === 0} onClick={() => moveColumn(index, -1)}>
                                  <ArrowLeft />
                                  Move left
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={index === draft.columns.length - 1}
                                  onClick={() => moveColumn(index, 1)}
                                >
                                  <ArrowRight />
                                  Move right
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={draft.columns.length <= 1}
                                  onClick={() => requestRemoveColumn(column)}
                                >
                                  <Trash2 />
                                  Delete column
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </th>
                      ))}
                      <th className="sticky right-0 z-30 border-b border-border/60 bg-muted px-2 py-1">
                        <Button variant="ghost" size="sm" onClick={() => draft && insertColumn(draft.columns.length)}>
                          <Plus data-icon="inline-start" />
                          Column
                        </Button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.rows.map((row, rowIndex) => (
                      <tr key={row.id} className="group">
                        <td className="sticky left-0 z-10 border-b border-r border-border/60 bg-background px-1 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <span className="w-4 text-xs text-muted-foreground tabular-nums">
                              {rowIndex + 1}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={`Delete row ${rowIndex + 1}`}
                              onClick={() => requestRemoveRow(row)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </td>
                        {draft.columns.map((column, colIndex) => (
                          <td key={column.id} className="border-b border-r border-border/60 p-0">
                            {column.type === 'formula' || (row.cells[column.id] ?? '').trim().startsWith('=') ? (
                              <FormulaCell
                                result={
                                  (row.cells[column.id] ?? '').trim().startsWith('=')
                                    ? evaluateFormula(
                                        row.cells[column.id],
                                        draft.columns,
                                        draft.rows,
                                        rowIndex,
                                        column.id
                                      )
                                    : (formulaResults.get(column.id)?.[rowIndex] ?? { kind: 'blank' })
                                }
                                formula={
                                  (row.cells[column.id] ?? '').trim().startsWith('=')
                                    ? row.cells[column.id].trim()
                                    : column.formula
                                }
                                rowIndex={rowIndex}
                                colIndex={colIndex}
                                rowCount={draft.rows.length}
                                colCount={draft.columns.length}
                                label={column.label}
                                onEnter={() => enterFromCell(rowIndex, colIndex)}
                                onEdit={() =>
                                  openCellFormula(
                                    rowIndex,
                                    column,
                                    (row.cells[column.id] ?? '').trim().startsWith('=')
                                      ? (row.cells[column.id] ?? '')
                                      : '='
                                  )
                                }
                              />
                            ) : (
                              <CellEditor
                                value={row.cells[column.id] ?? ''}
                                type={column.type}
                                rowIndex={rowIndex}
                                colIndex={colIndex}
                                rowCount={draft.rows.length}
                                colCount={draft.columns.length}
                                label={column.label}
                                onChange={(value) => updateCell(row.id, column.id, value)}
                                onEnter={() => enterFromCell(rowIndex, colIndex)}
                                onStartFormula={(seed) => openCellFormula(rowIndex, column, seed)}
                              />
                            )}
                          </td>
                        ))}
                        <td className="border-b border-border/60" />
                      </tr>
                    ))}
                  </tbody>
                  {hasTotalColumn && (
                    <tfoot className="sticky bottom-0 z-10 bg-muted">
                      <tr>
                        <td className="sticky left-0 z-20 border-r border-border/60 bg-muted px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
                          Σ
                        </td>
                        {draft.columns.map((column) => {
                          const total = footerTotal(column, draft.columns, draft.rows, formulaResults.get(column.id));
                          const aligned =
                            column.type === 'number' ||
                            column.type === 'formula' ||
                            draft.rows.some((row) => (row.cells[column.id] ?? '').trim().startsWith('='));
                          return (
                            <td
                              key={column.id}
                              className={cn(
                                'border-r border-border/60 px-2 py-2 font-semibold tabular-nums',
                                aligned && 'text-right'
                              )}
                            >
                              {aligned ? (total == null ? '—' : formatAmount(total)) : ''}
                            </td>
                          );
                        })}
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const index = addRow();
                    if (index != null) focusCell(index, 0);
                  }}
                >
                  <Plus data-icon="inline-start" />
                  Row
                </Button>
                <p className="text-xs text-muted-foreground">
                  Type = in a cell for a formula on that cell. Arrow keys move between cells. Enter adds a row from the last line.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog
        open={newOpen}
        onOpenChange={(open) => {
          setNewOpen(open);
          if (!open) {
            setNewName('');
            setNewTemplate('blank');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New sheet</DialogTitle>
            <DialogDescription>
              Blank sheets start with Item, Amount, and Notes. Templates match the capital and expense lists.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void submitNewSheet(event)}>
            <FieldGroup className="gap-4">
              <Field className="gap-2">
                <FieldLabel htmlFor="sheet-name">Name</FieldLabel>
                <Input
                  id="sheet-name"
                  placeholder={newTemplate === 'capital' ? 'Capital' : newTemplate === 'expenses' ? 'Expenses' : 'Untitled sheet'}
                  value={newName}
                  maxLength={80}
                  onChange={(event) => setNewName(event.target.value)}
                />
              </Field>
              <Field className="gap-2">
                <FieldLabel htmlFor="sheet-template">Template</FieldLabel>
                <Select value={newTemplate} onValueChange={(value) => setNewTemplate(value as SheetTemplate)}>
                  <SelectTrigger id="sheet-template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="blank">Blank</SelectItem>
                      <SelectItem value="capital">Capital — contributor and amount</SelectItem>
                      <SelectItem value="expenses">Expenses — item, amount, paid by</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating && <Spinner data-icon="inline-start" />}
                  Create sheet
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={formulaOpen}
        onOpenChange={(open) => {
          setFormulaOpen(open);
          if (!open) setFormulaRowIndex(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {formulaRowIndex == null
                ? `Formula for ${formulaColumn?.label ?? 'column'}`
                : `Formula for ${formulaColumn?.label ?? 'cell'}, row ${formulaRowIndex + 1}`}
            </DialogTitle>
            <DialogDescription>
              {formulaRowIndex == null
                ? 'The formula runs on every row. [Amount] or a letter such as B uses that column on the same row. B2 uses row 2. SUM(B:B) adds the whole column. This total stays on the sheet.'
                : 'This formula applies only to this cell. [Amount] or a letter such as B uses that column on the same row. B2 uses row 2. Clear the formula to leave the cell empty.'}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveFormula();
            }}
          >
            <FieldGroup className="gap-4">
              <Field className="gap-2">
                <FieldLabel htmlFor="column-formula">Formula</FieldLabel>
                <Input
                  ref={formulaInputRef}
                  id="column-formula"
                  autoFocus
                  value={formulaText}
                  maxLength={500}
                  placeholder="[Amount] * [Qty]"
                  onChange={(event) => setFormulaText(event.target.value)}
                />
              </Field>
              {draft && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {draft.columns.map((column, index) =>
                      (formulaRowIndex == null && column.id === formulaColumnId) ||
                      (column.type !== 'number' && column.type !== 'formula')
                        ? null
                        : (
                        <Button
                          key={column.id}
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() =>
                            insertFormula(column.label.includes(']') ? columnLetter(index) : `[${column.label}]`)
                          }
                        >
                          {columnLetter(index)} {column.label}
                        </Button>
                      )
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[' + ', ' - ', ' * ', ' / ', '(', ')', 'SUM(', 'AVERAGE(', 'MIN(', 'MAX(', 'ROUND('].map((snippet) => (
                      <Button key={snippet} type="button" variant="secondary" size="xs" onClick={() => insertFormula(snippet)}>
                        {snippet.trim() || snippet}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {formulaPreview && (
                <p className={cn('text-sm', formulaPreview.kind === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
                  {formulaPreview.kind === 'number'
                    ? `Row ${formulaRowIndex == null ? 1 : formulaRowIndex + 1} result: ${formatAmount(formulaPreview.value)}`
                    : formulaPreview.kind === 'error'
                      ? formulaPreview.message
                      : `Row ${formulaRowIndex == null ? 1 : formulaRowIndex + 1} is blank`}
                </p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setFormulaOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save formula</Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename sheet</DialogTitle>
            <DialogDescription>This only changes the sheet name.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRename}>
            <Field className="gap-2">
              <FieldLabel htmlFor="rename-sheet">Name</FieldLabel>
              <Input
                id="rename-sheet"
                value={renameValue}
                maxLength={80}
                required
                onChange={(event) => setRenameValue(event.target.value)}
              />
            </Field>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save name</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sheet</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{draft?.name}</strong> and everything on it? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void confirmDeleteSheet();
              }}
            >
              {deleting && <Spinner data-icon="inline-start" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={columnToDelete != null} onOpenChange={(open) => !open && setColumnToDelete(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete column</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{columnToDelete?.label}</strong>? Cells in this column will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                if (columnToDelete) removeColumn(columnToDelete.id);
              }}
            >
              Delete column
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rowToDelete != null} onOpenChange={(open) => !open && setRowToDelete(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete row</AlertDialogTitle>
            <AlertDialogDescription>This row has notes in it. Delete it anyway?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                if (rowToDelete) removeRow(rowToDelete.id);
              }}
            >
              Delete row
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusPill({ status }: { status: SaveStatus }) {
  if (status === 'saving') return <Badge variant="secondary">Saving…</Badge>;
  if (status === 'unsaved') return <Badge variant="warning">Unsaved</Badge>;
  if (status === 'error') return <Badge variant="error">Not saved</Badge>;
  return <Badge variant="success">Saved</Badge>;
}
