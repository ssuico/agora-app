import { evaluateFormula, type FormulaColumn, type FormulaRow, type FormulaValue } from '@/lib/sheet-formula';

export interface ExportColumn {
  label: string;
  kind: 'text' | 'number' | 'date';
}

export type ExportCell = string | number | null;

export interface ExportSheet {
  name: string;
  columns: ExportColumn[];
  rows: ExportCell[][];
  totals: ExportCell[] | null;
}

interface SourceSheet {
  name: string;
  columns: FormulaColumn[];
  rows: FormulaRow[];
}

function columnKind(type: string): ExportColumn['kind'] {
  if (type === 'number' || type === 'formula') return 'number';
  if (type === 'date') return 'date';
  return 'text';
}

function formulaResults(sheet: SourceSheet): Map<string, FormulaValue[]> {
  const results = new Map<string, FormulaValue[]>();
  for (const column of sheet.columns) {
    if (column.type !== 'formula') continue;
    results.set(
      column.id,
      sheet.rows.map((row, index) => {
        const raw = (row.cells[column.id] ?? '').trim();
        if (raw.startsWith('=')) return evaluateFormula(raw, sheet.columns, sheet.rows, index, column.id);
        return evaluateFormula(column.formula, sheet.columns, sheet.rows, index, column.id);
      })
    );
  }
  return results;
}

function cellValue(
  column: FormulaColumn,
  sheet: SourceSheet,
  row: FormulaRow,
  index: number,
  formulaResult?: FormulaValue
): ExportCell {
  const raw = row.cells[column.id] ?? '';
  const trimmed = raw.trim();
  if (trimmed.startsWith('=') || column.type === 'formula') {
    const result = trimmed.startsWith('=')
      ? evaluateFormula(trimmed, sheet.columns, sheet.rows, index, column.id)
      : (formulaResult ?? { kind: 'blank' });
    if (result.kind === 'number') return result.value;
    if (result.kind === 'error') return result.message;
    return null;
  }
  if (!trimmed) return null;
  if (column.type === 'number') {
    const cleaned = trimmed.replace(/,/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return trimmed;
    const value = Number(cleaned);
    return Number.isFinite(value) ? value : trimmed;
  }
  return trimmed;
}

function footerValue(column: FormulaColumn, sheet: SourceSheet, values: ExportCell[]): number | null {
  if (column.type === 'formula' && column.formula?.includes(':')) {
    const aggregate = evaluateFormula(column.formula, sheet.columns, sheet.rows, 0, column.id);
    return aggregate.kind === 'number' ? aggregate.value : null;
  }
  let sum = 0;
  let any = false;
  for (const value of values) {
    if (typeof value !== 'number') continue;
    sum += value;
    any = true;
  }
  return any ? Math.round(sum * 100) / 100 : null;
}

export function sheetForExport(sheet: SourceSheet): ExportSheet {
  const results = formulaResults(sheet);
  const rows = sheet.rows.map((row, index) =>
    sheet.columns.map((column) => cellValue(column, sheet, row, index, results.get(column.id)?.[index]))
  );
  const totals = sheet.columns.map((column, index) => {
    const columnValues = rows.map((row) => row[index] ?? null);
    const total = footerValue(column, sheet, columnValues);
    if (total != null) return total;
    if (index === 0) return 'Total';
    return null;
  });
  const hasNumber = totals.some((value) => typeof value === 'number');
  return {
    name: sheet.name,
    columns: sheet.columns.map((column) => ({ label: column.label, kind: columnKind(column.type) })),
    rows,
    totals: hasNumber ? totals : null,
  };
}

export function exportFileName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'sheet'}.xlsx`;
}
