import crypto from 'node:crypto';
import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { Store } from '../models/Store.js';
import { StoreSheet, type IStoreSheet, type SheetColumnType } from '../models/StoreSheet.js';
import { UserRole } from '../types/index.js';

const MAX_SHEETS = 50;
const MAX_COLUMNS = 50;
const MAX_ROWS = 2000;
const MAX_CELL = 500;
const MAX_FORMULA = 500;
const MAX_NAME = 80;
const MAX_PAYLOAD = 1_500_000;
const STARTER_ROWS = 5;

type ColumnInput = { id: string; label: string; type: SheetColumnType; formula?: string };
type RowInput = { id: string; cells: Record<string, string> };

interface TemplateSpec {
  name: string;
  columns: { label: string; type: SheetColumnType }[];
}

const TEMPLATES: Record<string, TemplateSpec> = {
  capital: {
    name: 'Capital',
    columns: [
      { label: 'Contributor', type: 'text' },
      { label: 'Amount', type: 'number' },
      { label: 'Date', type: 'date' },
      { label: 'Notes', type: 'text' },
    ],
  },
  expenses: {
    name: 'Expenses',
    columns: [
      { label: 'Item', type: 'text' },
      { label: 'Amount', type: 'number' },
      { label: 'Date', type: 'date' },
      { label: 'Paid by', type: 'text' },
      { label: 'Notes', type: 'text' },
    ],
  },
};

const DEFAULT_COLUMNS: { label: string; type: SheetColumnType }[] = [
  { label: 'Item', type: 'text' },
  { label: 'Amount', type: 'number' },
  { label: 'Notes', type: 'text' },
];

function newId(): string {
  return crypto.randomUUID();
}

function blankRows(columns: ColumnInput[], count: number): RowInput[] {
  return Array.from({ length: count }, () => ({
    id: newId(),
    cells: Object.fromEntries(columns.map((column) => [column.id, ''])),
  }));
}

function withIds(columns: { label: string; type: SheetColumnType }[]): ColumnInput[] {
  return columns.map((column) => ({ id: newId(), label: column.label, type: column.type }));
}

function fail(res: Response, status: number, message: string): null {
  res.status(status).json({ message });
  return null;
}

function parseColumns(raw: unknown): ColumnInput[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return 'A sheet needs at least one column';
  if (raw.length > MAX_COLUMNS) return `A sheet can have at most ${MAX_COLUMNS} columns`;
  const seen = new Set<string>();
  const columns: ColumnInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return 'Invalid column';
    const source = item as { id?: unknown; label?: unknown; type?: unknown; formula?: unknown };
    const id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : newId();
    if (id.length > 64 || seen.has(id)) return 'Invalid column';
    seen.add(id);
    const label = typeof source.label === 'string' ? source.label.trim() : '';
    if (!label || label.length > MAX_NAME) return 'Column names must be 1–80 characters';
    if (source.type !== 'text' && source.type !== 'number' && source.type !== 'date' && source.type !== 'formula') {
      return 'Column type must be text, number, date, or formula';
    }
    let formula: string | undefined;
    if (typeof source.formula === 'string' && source.formula.trim()) {
      formula = source.formula.trim();
      if (formula.length > MAX_FORMULA) return `A formula must be ${MAX_FORMULA} characters or less`;
    }
    columns.push({ id, label, type: source.type, ...(formula ? { formula } : {}) });
  }
  return columns;
}

function cellsRecord(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return {};
  if (raw instanceof Map) return Object.fromEntries(raw);
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return null;
}

function parseRows(raw: unknown, columnIds: Set<string>): RowInput[] | string {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return 'Invalid rows';
  if (raw.length > MAX_ROWS) return `A sheet can have at most ${MAX_ROWS} rows`;
  const seen = new Set<string>();
  const rows: RowInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return 'Invalid row';
    const source = item as { id?: unknown; cells?: unknown };
    const id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : newId();
    if (id.length > 64 || seen.has(id)) return 'Invalid row';
    seen.add(id);
    const record = cellsRecord(source.cells);
    if (!record) return 'Invalid cells';
    const cells: Record<string, string> = {};
    for (const [key, value] of Object.entries(record)) {
      if (!columnIds.has(key) || value == null) continue;
      const text = String(value);
      if (text.length > MAX_CELL) return `A cell exceeds ${MAX_CELL} characters`;
      cells[key] = text;
    }
    rows.push({ id, cells });
  }
  return rows;
}

function parseName(raw: unknown, fallback: string): string | null {
  const name = typeof raw === 'string' && raw.trim() ? raw.trim() : fallback;
  if (!name || name.length > MAX_NAME) return null;
  return name;
}

function payloadTooLarge(columns: ColumnInput[], rows: RowInput[]): boolean {
  return JSON.stringify({ columns, rows }).length > MAX_PAYLOAD;
}

async function loadOwned(req: Request, res: Response): Promise<IStoreSheet | null> {
  if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Invalid sheet id');
  const sheet = await StoreSheet.findById(req.params.id);
  if (!sheet) return fail(res, 404, 'Sheet not found');
  const user = req.user;
  if (!user) return fail(res, 401, 'Unauthorized');
  if (user.role !== UserRole.ADMIN && !user.storeIds?.includes(String(sheet.storeId))) {
    return fail(res, 403, 'Forbidden: you are not assigned to this store');
  }
  return sheet;
}

export const listSheets = async (req: Request, res: Response): Promise<void> => {
  try {
    const sheets = await StoreSheet.find({ storeId: req.params.storeId }).sort({ order: 1, createdAt: 1 });
    res.json(sheets);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const createSheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    if (!mongoose.isValidObjectId(storeId)) {
      res.status(400).json({ message: 'Invalid store id' });
      return;
    }
    const store = await Store.findById(storeId).select('_id');
    if (!store) {
      res.status(404).json({ message: 'Store not found' });
      return;
    }
    const count = await StoreSheet.countDocuments({ storeId });
    if (count >= MAX_SHEETS) {
      res.status(400).json({ message: `A store can have at most ${MAX_SHEETS} sheets` });
      return;
    }

    const templateKey = typeof req.body?.template === 'string' ? req.body.template : '';
    const template = TEMPLATES[templateKey];
    if (templateKey && !template) {
      res.status(400).json({ message: 'Unknown sheet template' });
      return;
    }

    const name = parseName(req.body?.name, template?.name ?? 'Untitled sheet');
    if (!name) {
      res.status(400).json({ message: `Sheet name must be 1–${MAX_NAME} characters` });
      return;
    }

    let columns: ColumnInput[];
    if (Array.isArray(req.body?.columns)) {
      const parsed = parseColumns(req.body.columns);
      if (typeof parsed === 'string') {
        res.status(400).json({ message: parsed });
        return;
      }
      columns = parsed;
    } else {
      columns = withIds(template?.columns ?? DEFAULT_COLUMNS);
    }

    let rows: RowInput[];
    if (Array.isArray(req.body?.rows)) {
      const parsed = parseRows(req.body.rows, new Set(columns.map((column) => column.id)));
      if (typeof parsed === 'string') {
        res.status(400).json({ message: parsed });
        return;
      }
      rows = parsed;
    } else {
      rows = blankRows(columns, STARTER_ROWS);
    }

    if (payloadTooLarge(columns, rows)) {
      res.status(400).json({ message: 'Sheet is too large' });
      return;
    }

    const last = await StoreSheet.findOne({ storeId }).sort({ order: -1 }).select('order');
    const sheet = await StoreSheet.create({
      storeId,
      name,
      order: (last?.order ?? -1) + 1,
      columns,
      rows,
      version: 1,
      updatedBy: req.user?.userId,
    });
    res.status(201).json(sheet);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const updateSheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const sheet = await loadOwned(req, res);
    if (!sheet) return;

    const version = req.body?.version;
    if (typeof version !== 'number' || !Number.isInteger(version)) {
      res.status(400).json({ message: 'version is required' });
      return;
    }

    const name = parseName(req.body?.name, sheet.name);
    if (!name) {
      res.status(400).json({ message: `Sheet name must be 1–${MAX_NAME} characters` });
      return;
    }

    const columns = parseColumns(req.body?.columns ?? sheet.columns);
    if (typeof columns === 'string') {
      res.status(400).json({ message: columns });
      return;
    }
    const rows = parseRows(
      req.body?.rows === undefined ? sheet.rows : req.body.rows,
      new Set(columns.map((column) => column.id))
    );
    if (typeof rows === 'string') {
      res.status(400).json({ message: rows });
      return;
    }
    if (payloadTooLarge(columns, rows)) {
      res.status(400).json({ message: 'Sheet is too large' });
      return;
    }

    const order =
      typeof req.body?.order === 'number' && Number.isFinite(req.body.order) ? req.body.order : sheet.order;

    const updated = await StoreSheet.findOneAndUpdate(
      { _id: sheet._id, version },
      {
        $set: {
          name,
          columns,
          rows,
          order,
          updatedBy: req.user?.userId,
        },
        $inc: { version: 1 },
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      const current = await StoreSheet.findById(sheet._id);
      res.status(409).json({
        message: 'This sheet was updated elsewhere.',
        current,
      });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

type ExportKind = 'text' | 'number' | 'date';
type ExportCell = string | number | null;

interface ExportSheetInput {
  name: string;
  columns: { label: string; kind: ExportKind }[];
  rows: ExportCell[][];
  totals: ExportCell[] | null;
}

function worksheetName(name: string, used: Set<string>): string {
  const cleaned = name.replace(/[\\/*?:[\]]/g, ' ').replace(/\s+/g, ' ').trim() || 'Sheet';
  const base = (cleaned.toLowerCase() === 'history' ? 'History sheet' : cleaned).slice(0, 31);
  let candidate = base;
  let suffixNumber = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${suffixNumber})`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    suffixNumber += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function exportFileName(raw: unknown): string {
  const source = typeof raw === 'string' ? raw : 'capital-expenses.xlsx';
  const cleaned = source.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const base = (cleaned || 'capital-expenses').slice(0, 80);
  return base.toLowerCase().endsWith('.xlsx') ? base : `${base}.xlsx`;
}

function parseExportCell(value: unknown): { ok: true; value: ExportCell } | { ok: false; message: string } {
  if (value == null || value === '') return { ok: true, value: null };
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { ok: true, value } : { ok: false, message: 'Invalid number' };
  }
  if (typeof value === 'string') {
    if (value.length > MAX_CELL) return { ok: false, message: `A cell can be at most ${MAX_CELL} characters` };
    return { ok: true, value };
  }
  return { ok: false, message: 'Invalid cell' };
}

function parseExportSheets(body: unknown): ExportSheetInput[] | string {
  if (!body || typeof body !== 'object') return 'Invalid export';
  const sheets = (body as { sheets?: unknown }).sheets;
  if (!Array.isArray(sheets) || sheets.length === 0) return 'Nothing to export';
  if (sheets.length > MAX_SHEETS) return `A store can export at most ${MAX_SHEETS} sheets`;
  const parsed: ExportSheetInput[] = [];
  for (const item of sheets) {
    if (!item || typeof item !== 'object') return 'Invalid sheet';
    const source = item as { name?: unknown; columns?: unknown; rows?: unknown; totals?: unknown };
    const name = typeof source.name === 'string' ? source.name.trim().slice(0, MAX_NAME) : '';
    if (!name) return 'Each sheet needs a name';
    if (!Array.isArray(source.columns) || source.columns.length === 0) return 'A sheet needs at least one column';
    if (source.columns.length > MAX_COLUMNS) return `A sheet can have at most ${MAX_COLUMNS} columns`;
    const columns: { label: string; kind: ExportKind }[] = [];
    for (const column of source.columns) {
      if (!column || typeof column !== 'object') return 'Invalid column';
      const label = typeof (column as { label?: unknown }).label === 'string' ? (column as { label: string }).label.trim() : '';
      const kind = (column as { kind?: unknown }).kind;
      if (!label) return 'Each column needs a name';
      if (kind !== 'text' && kind !== 'number' && kind !== 'date') return 'Invalid column type';
      columns.push({ label: label.slice(0, 80), kind });
    }
    if (!Array.isArray(source.rows)) return 'Invalid rows';
    if (source.rows.length > MAX_ROWS) return `A sheet can have at most ${MAX_ROWS} rows`;
    const rows: ExportCell[][] = [];
    for (const row of source.rows) {
      if (!Array.isArray(row)) return 'Invalid row';
      const cells: ExportCell[] = [];
      for (let index = 0; index < columns.length; index += 1) {
        const cell = parseExportCell(row[index]);
        if (!cell.ok) return cell.message;
        cells.push(cell.value);
      }
      rows.push(cells);
    }
    let totals: ExportCell[] | null = null;
    if (source.totals != null) {
      if (!Array.isArray(source.totals)) return 'Invalid totals';
      totals = [];
      for (let index = 0; index < columns.length; index += 1) {
        const cell = parseExportCell(source.totals[index]);
        if (!cell.ok) return cell.message;
        totals.push(cell.value);
      }
    }
    parsed.push({ name, columns, rows, totals });
  }
  return parsed;
}

function writeExportCell(cell: ExcelJS.Cell, value: ExportCell): void {
  if (value == null) return;
  if (typeof value === 'number') {
    cell.value = value;
    cell.numFmt = '#,##0.##';
    return;
  }
  cell.value = value;
}

export async function buildSheetWorkbook(sheets: ExportSheetInput[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Agora';
  const used = new Set<string>();
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(worksheetName(sheet.name, used));
    worksheet.addRow(sheet.columns.map((column) => column.label));
    const header = worksheet.getRow(1);
    header.font = { bold: true };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    sheet.columns.forEach((column, index) => {
      const width = Math.min(40, Math.max(12, column.label.length + 4));
      worksheet.getColumn(index + 1).width = width;
    });
    for (const row of sheet.rows) {
      const excelRow = worksheet.addRow([]);
      row.forEach((value, index) => writeExportCell(excelRow.getCell(index + 1), value));
    }
    if (sheet.totals) {
      const totalRow = worksheet.addRow([]);
      totalRow.font = { bold: true };
      sheet.totals.forEach((value, index) =>
        writeExportCell(totalRow.getCell(index + 1), value)
      );
    }
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  }
  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
}

export const exportSheets = async (req: Request, res: Response): Promise<void> => {
  try {
    const store = await Store.findById(req.params.storeId).select('_id');
    if (!store) {
      res.status(404).json({ message: 'Store not found' });
      return;
    }
    const sheets = parseExportSheets(req.body);
    if (typeof sheets === 'string') {
      res.status(400).json({ message: sheets });
      return;
    }
    const buffer = await buildSheetWorkbook(sheets);
    const fileName = exportFileName((req.body as { fileName?: unknown })?.fileName);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const deleteSheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const sheet = await loadOwned(req, res);
    if (!sheet) return;
    await sheet.deleteOne();
    res.json({ message: 'Sheet deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
