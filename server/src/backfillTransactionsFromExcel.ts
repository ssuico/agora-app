/**
 * One-off import of transactions that were tracked in a spreadsheet.
 *
 * Expected columns: Customer, Items, Quantity, Claiming, Payment.
 * Consecutive rows for the same customer are one order.
 * Prices, cost, and totals come from the matching product.
 * Creating the orders reduces that product's stock.
 * Every customer on the sheet is stored as a walk-in name.
 *
 * From server/:
 *   npm run backfill:transactions
 *   npm run backfill:transactions -- "../transactions.xlsx"
 *   npm run backfill:transactions -- --apply
 *   npm run backfill:transactions -- --store "Store name" --apply
 *
 * The first run only prints the price trace. Pass --apply to write.
 */
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { Product, REGULAR_PRODUCT_FILTER } from './models/Product.js';
import { Store } from './models/Store.js';
import { Transaction, type ClaimStatus, type PaymentStatus } from './models/Transaction.js';
import { TransactionItem } from './models/TransactionItem.js';

const php = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

interface CliOptions {
  apply: boolean;
  skipStock: boolean;
  storeName: string | null;
  fileArg: string | undefined;
}

interface SheetRow {
  rowNumber: number;
  customer: string;
  itemsRaw: string;
  quantityRaw: string;
  claimingRaw: string;
  paymentRaw: string;
}

interface ParsedLine {
  itemName: string;
  quantity: number;
}

interface ParsedRow {
  rowNumber: number;
  customer: string;
  claimRaw: string;
  paymentRaw: string;
  claimStatus: ClaimStatus;
  paymentStatus: PaymentStatus;
  partialAmount: number | null;
  lines: ParsedLine[];
}

interface ResolvedLine {
  rowNumber: number;
  itemName: string;
  quantity: number;
  productId: mongoose.Types.ObjectId;
  productName: string;
  sellingPrice: number;
  discountPrice: number | null;
  unitPrice: number;
  costPrice: number;
  subtotal: number;
  costSubtotal: number;
  matchNote: string;
}

interface OrderItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  quantity: number;
  subtotal: number;
  costSubtotal: number;
}

interface StockChange {
  productName: string;
  before: number;
  after: number;
}

interface ResolvedOrder {
  rowStart: number;
  rowEnd: number;
  customerName: string;
  claimRaw: string;
  claimStatus: ClaimStatus;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  lines: ResolvedLine[];
  items: OrderItem[];
  stockChanges: StockChange[];
  totalAmount: number;
  totalCost: number;
  grossProfit: number;
  note: string;
  alreadyImported: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
    skipStock: false,
    storeName: null,
    fileArg: undefined,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--skip-stock') {
      options.skipStock = true;
    } else if (arg === '--store') {
      const name = argv[++i];
      if (!name) throw new Error('--store needs the store name.');
      options.storeName = name;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option "${arg}".`);
    } else if (!options.fileArg) {
      options.fileArg = arg;
    } else {
      throw new Error(`Unexpected argument "${arg}".`);
    }
  }

  return options;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function cellText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value);
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.richText)) {
      return record.richText
        .map((part) => cellText((part as { text?: unknown }).text))
        .join('')
        .trim();
    }
    if ('result' in record) return cellText(record.result);
    if (typeof record.text === 'string') return record.text.trim();
  }
  return String(value).trim();
}

function findExcelPath(fileArg: string | undefined): string {
  if (fileArg) return path.resolve(fileArg);
  if (process.env.TRANSACTION_BACKFILL_XLSX) {
    return path.resolve(process.env.TRANSACTION_BACKFILL_XLSX);
  }

  const roots = [path.resolve(process.cwd(), '..'), process.cwd()];
  const seen = new Set<string>();
  const files: string[] = [];
  for (const root of roots) {
    let names: string[] = [];
    try {
      names = readdirSync(root);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!/\.xlsx$/i.test(name)) continue;
      if (/customer list/i.test(name)) continue;
      const full = path.resolve(root, name);
      if (seen.has(full)) continue;
      try {
        if (!statSync(full).isFile()) continue;
      } catch {
        continue;
      }
      seen.add(full);
      files.push(full);
    }
  }

  const named = files.filter((file) => /transaction/i.test(path.basename(file)));
  const pool = named.length > 0 ? named : files;
  if (pool.length === 1) return pool[0]!;
  if (pool.length === 0) {
    throw new Error(
      'No spreadsheet found. Put the Excel file in the project folder, or pass its path:\n' +
        '  npm run backfill:transactions -- "../your-file.xlsx"'
    );
  }
  throw new Error(
    'More than one spreadsheet is in the project folder. Pass the file to import:\n' +
      pool.map((file) => `  ${file}`).join('\n')
  );
}

function columnIndex(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const index = headers.findIndex((header) => header === alias);
    if (index >= 0) return index;
  }
  return -1;
}

async function loadSheetRows(filePath: string): Promise<SheetRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Excel file has no worksheets.');

  const rows: ExcelJS.Row[] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => rows.push(row));

  let headerIndex = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const candidate = ((rows[i]?.values as unknown[]) ?? []).slice(1).map((value) => normalizeHeader(cellText(value)));
    const hasCustomer = columnIndex(candidate, ['customer', 'customer name', 'names', 'name']) >= 0;
    const hasItems = columnIndex(candidate, ['items', 'item', 'product', 'products']) >= 0;
    const hasQuantity = columnIndex(candidate, ['quantity', 'qty', 'quantities']) >= 0;
    if (hasCustomer && hasItems && hasQuantity) {
      headerIndex = i;
      headers = candidate;
      break;
    }
  }

  if (headerIndex < 0) {
    throw new Error(
      `Could not find a header row with Customer, Items, and Quantity. Sheet "${sheet.name}" starts with: ` +
        cellText((rows[0]?.values as unknown[])?.[1])
    );
  }

  const customerCol = columnIndex(headers, ['customer', 'customer name', 'names', 'name']);
  const itemsCol = columnIndex(headers, ['items', 'item', 'product', 'products']);
  const quantityCol = columnIndex(headers, ['quantity', 'qty', 'quantities']);
  const claimingCol = columnIndex(headers, ['claiming', 'claim', 'claim status', 'claimed']);
  const paymentCol = columnIndex(headers, ['payment', 'payment status', 'paid']);
  const missing = [
    claimingCol < 0 ? 'Claiming' : null,
    paymentCol < 0 ? 'Payment' : null,
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`Missing column(s): ${missing.join(', ')}. Found headers: ${headers.filter(Boolean).join(', ')}`);
  }

  const parsed: SheetRow[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const values = row.values as unknown[];
    const customer = cellText(values?.[customerCol + 1]);
    const itemsRaw = cellText(values?.[itemsCol + 1]);
    const quantityRaw = cellText(values?.[quantityCol + 1]);
    const claimingRaw = cellText(values?.[claimingCol + 1]);
    const paymentRaw = cellText(values?.[paymentCol + 1]);
    if (!customer && !itemsRaw && !quantityRaw && !claimingRaw && !paymentRaw) continue;
    parsed.push({
      rowNumber: row.number,
      customer,
      itemsRaw,
      quantityRaw,
      claimingRaw,
      paymentRaw,
    });
  }

  console.log(`Sheet "${sheet.name}": ${parsed.length} data row(s).\n`);
  return parsed;
}

function splitItems(raw: string): string[] {
  if (/[\n;]/.test(raw)) {
    return raw.split(/\n|;/).map((part) => part.trim()).filter(Boolean);
  }
  return raw.trim() ? [raw.trim()] : [];
}

function parseLines(itemsRaw: string, quantityRaw: string): { lines: ParsedLine[] } | { error: string } {
  let itemNames = splitItems(itemsRaw);
  let quantityParts = quantityRaw.split(/[\n;]/).map((part) => part.trim()).filter(Boolean);

  if (itemNames.length === 1 && quantityParts.length === 1 && quantityParts[0]?.includes(',')) {
    const qtyPieces = quantityParts[0].split(',').map((part) => part.trim()).filter(Boolean);
    const itemPieces = itemNames[0]!.split(',').map((part) => part.trim()).filter(Boolean);
    if (qtyPieces.length > 1 && qtyPieces.length === itemPieces.length) {
      itemNames = itemPieces;
      quantityParts = qtyPieces;
    }
  }

  if (itemNames.length === 0) return { error: 'Items is empty.' };
  if (quantityParts.length === 0) return { error: 'Quantity is empty.' };
  if (itemNames.length !== quantityParts.length) {
    return {
      error:
        `Items (${itemNames.length}) and Quantity (${quantityParts.length}) do not match. ` +
        'Use one item per row, or separate several items with ";" and list quantities in the same order.',
    };
  }

  const lines: ParsedLine[] = [];
  for (let i = 0; i < itemNames.length; i++) {
    const quantity = Number(quantityParts[i]);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { error: `Quantity "${quantityParts[i]}" for "${itemNames[i]}" must be a whole number of at least 1.` };
    }
    lines.push({ itemName: itemNames[i]!, quantity });
  }
  return { lines };
}

function parseClaim(raw: string): ClaimStatus | null {
  const value = normalizeName(raw);
  if (['claimed', 'claim', 'yes', 'y', 'done', 'collected'].includes(value)) return 'claimed';
  if (['unclaimed', 'unclaim', 'not claimed', 'reserved', 'reserve', 'no', 'n', 'pending'].includes(value)) return 'unclaimed';
  return null;
}

function parsePayment(raw: string): { status: PaymentStatus; amount: number | null } | { error: string } {
  const value = normalizeName(raw);
  if (['paid', 'yes', 'y', 'cash'].includes(value)) return { status: 'paid', amount: null };
  if (['unpaid', 'not paid', 'no', 'n', 'pending'].includes(value)) return { status: 'unpaid', amount: null };

  const partial = value.match(/^partial(?:\s*[: ]\s*(\d+(?:\.\d+)?))?$/);
  if (!partial) {
    return { error: `Payment "${raw}" is not recognized. Use paid, unpaid, or partial with an amount (partial 150).` };
  }
  if (!partial[1]) {
    return { error: 'Partial payment needs an amount, for example "partial 150".' };
  }
  const amount = Number(partial[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: `Partial amount "${partial[1]}" must be greater than 0.` };
  }
  return { status: 'partial', amount };
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let corner = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const upper = prev[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(upper + 1, prev[j - 1]! + 1, corner + cost);
      corner = upper;
    }
  }
  return prev[b.length]!;
}

function closeNames(query: string, candidates: string[]): string[] {
  const needle = normalizeName(query);
  if (needle.length < 4) return [];
  const matches = candidates.filter((candidate) => {
    const name = normalizeName(candidate);
    if (name === needle) return false;
    const contains =
      (name.includes(needle) || needle.includes(name)) && Math.abs(name.length - needle.length) <= 4;
    return contains || editDistance(needle, name) <= 2;
  });
  return [...new Set(matches)].slice(0, 3);
}

function matchKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bcoockies\b/g, 'cookies')
    .replace(/\bcookies\b/g, 'cookie')
    .replace(/\biced\b/g, 'ice')
    .replace(/\s+/g, ' ')
    .trim();
}

function fingerprintFor(rows: ParsedRow[]): string {
  const source = rows
    .map((row) =>
      [
        row.customer,
        row.lines.map((line) => `${line.itemName}x${line.quantity}`).join(','),
        row.claimRaw,
        row.paymentRaw,
      ].join('|')
    )
    .join('\n');
  return createHash('sha256').update(normalizeName(source)).digest('hex').slice(0, 12);
}

function noteFor(rowStart: number, rowEnd: number, fingerprint: string): string {
  return `Spreadsheet backfill rows ${rowStart}-${rowEnd} [${fingerprint}]`;
}

function unitPriceOf(product: { sellingPrice: number; discountPrice?: number | null }): number {
  if (typeof product.discountPrice === 'number' && product.discountPrice >= 0) {
    return Math.min(product.discountPrice, product.sellingPrice);
  }
  return product.sellingPrice;
}

interface CatalogProduct {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  name: string;
  sellingPrice: number;
  discountPrice?: number | null;
  costPrice: number;
  stockQuantity: number;
}

interface StoreRef {
  _id: mongoose.Types.ObjectId;
  name: string;
}

interface ItemDemand {
  label: string;
  quantity: number;
}

function parseSheet(sheetRows: SheetRow[]): { rows: Array<ParsedRow | 'break'>; errors: string[] } {
  const rows: Array<ParsedRow | 'break'> = [];
  const errors: string[] = [];

  for (const sheetRow of sheetRows) {
    const rowErrors: string[] = [];
    if (!sheetRow.customer) rowErrors.push('Customer is empty.');
    const parsedLines = parseLines(sheetRow.itemsRaw, sheetRow.quantityRaw);
    if ('error' in parsedLines) rowErrors.push(parsedLines.error);
    const claimStatus = parseClaim(sheetRow.claimingRaw);
    if (!claimStatus) {
      rowErrors.push(
        `Claiming "${sheetRow.claimingRaw || '(blank)'}" is not recognized. Use claimed, unclaimed, or reserved.`
      );
    }
    const payment = parsePayment(sheetRow.paymentRaw);
    if ('error' in payment) rowErrors.push(payment.error);

    if (rowErrors.length > 0 || !claimStatus || 'error' in parsedLines || 'error' in payment) {
      for (const message of rowErrors) errors.push(`Row ${sheetRow.rowNumber}: ${message}`);
      rows.push('break');
      continue;
    }

    rows.push({
      rowNumber: sheetRow.rowNumber,
      customer: sheetRow.customer,
      claimRaw: sheetRow.claimingRaw,
      paymentRaw: sheetRow.paymentRaw,
      claimStatus,
      paymentStatus: payment.status,
      partialAmount: payment.amount,
      lines: parsedLines.lines,
    });
  }

  return { rows, errors };
}

function groupOrders(sequence: Array<ParsedRow | 'break'>): ParsedRow[][] {
  const groups: ParsedRow[][] = [];
  let current: ParsedRow[] | null = null;

  for (const entry of sequence) {
    if (entry === 'break') {
      current = null;
      continue;
    }
    if (current && normalizeName(current[0]!.customer) === normalizeName(entry.customer)) {
      current.push(entry);
    } else {
      current = [entry];
      groups.push(current);
    }
  }

  return groups;
}

function itemDemands(groups: ParsedRow[][]): Map<string, ItemDemand> {
  const demands = new Map<string, ItemDemand>();
  for (const group of groups) {
    for (const row of group) {
      for (const line of row.lines) {
        const key = matchKey(line.itemName);
        const current = demands.get(key);
        if (current) current.quantity += line.quantity;
        else demands.set(key, { label: line.itemName, quantity: line.quantity });
      }
    }
  }
  return demands;
}

function resolveProduct(
  products: CatalogProduct[],
  itemName: string,
  demand: number
): { product: CatalogProduct; matchNote: string } | { error: string } {
  const key = matchKey(itemName);
  let pool = products.filter((product) => matchKey(product.name) === key);
  let matchNote = `matched "${products.find((product) => matchKey(product.name) === key)?.name ?? itemName}"`;

  if (pool.length === 0 && key.length >= 4) {
    pool = products.filter((product) => matchKey(product.name).startsWith(`${key} `));
    if (pool.length === 1) {
      matchNote = `sheet says "${itemName}", matched longer name "${pool[0]!.name}"`;
    }
  }

  if (pool.length === 0) {
    const suggestions = closeNames(itemName, products.map((product) => product.name));
    const hint = suggestions.length > 0 ? ` Did you mean ${suggestions.map((name) => `"${name}"`).join(', ')}?` : '';
    return { error: `no product named "${itemName}".${hint}` };
  }

  if (pool.length > 1) {
    const enough = pool.filter((product) => product.stockQuantity >= demand);
    if (enough.length === 1) {
      pool = enough;
      matchNote = `matched "${pool[0]!.name}" — it is the only "${itemName}" with enough stock for the ${demand} on this sheet`;
    }
  }

  if (pool.length > 1) {
    const detail = pool
      .map((product) => `"${product.name}" ${php.format(unitPriceOf(product))} (${product.stockQuantity} in stock)`)
      .join(', ');
    return { error: `${pool.length} products match "${itemName}" (${detail}).` };
  }

  const product = pool[0]!;
  if (matchKey(product.name) === key) matchNote = `matched "${product.name}"`;
  return { product, matchNote };
}

function unresolvedItems(products: CatalogProduct[], demands: Map<string, ItemDemand>): string[] {
  const missing: string[] = [];
  for (const demand of demands.values()) {
    const found = resolveProduct(products, demand.label, demand.quantity);
    if ('error' in found) missing.push(`${demand.label}: ${found.error}`);
  }
  return missing;
}

function productsForStore(products: CatalogProduct[], storeId: mongoose.Types.ObjectId): CatalogProduct[] {
  return products.filter((product) => String(product.storeId) === String(storeId));
}

function chooseStore(
  stores: StoreRef[],
  products: CatalogProduct[],
  demands: Map<string, ItemDemand>,
  requestedName: string | null
): { store: StoreRef; products: CatalogProduct[]; reason: string } {
  let pool = stores;
  if (requestedName) {
    const key = normalizeName(requestedName);
    pool = stores.filter(
      (store) =>
        normalizeName(store.name) === key ||
        String(store._id) === requestedName ||
        String(store._id).startsWith(requestedName)
    );
    if (pool.length === 0) {
      throw new Error(`No store named "${requestedName}". Stores: ${stores.map((store) => store.name).join(', ')}`);
    }
  }

  const fitting = pool.filter((store) => unresolvedItems(productsForStore(products, store._id), demands).length === 0);
  if (fitting.length === 1) {
    const store = fitting[0]!;
    const reason = requestedName
      ? `Using ${store.name}.`
      : `Using ${store.name} — it is the only store with a product for every item on the sheet.`;
    return { store, products: productsForStore(products, store._id), reason };
  }

  if (requestedName && pool.length === 1) {
    const store = pool[0]!;
    return {
      store,
      products: productsForStore(products, store._id),
      reason: `Using ${store.name}.`,
    };
  }

  if (fitting.length > 1) {
    throw new Error(
      `More than one store matches every item. Pass --store with one of: ${fitting.map((store) => store.name).join(', ')}`
    );
  }

  const lines = pool.map((store) => {
    const missing = unresolvedItems(productsForStore(products, store._id), demands);
    return `${store.name}: ${missing.length === 0 ? 'ok' : missing.slice(0, 4).join('; ')}`;
  });
  throw new Error(`No single store has a product for every item.\n${lines.join('\n')}`);
}

function resolveOrders(
  groups: ParsedRow[][],
  products: CatalogProduct[],
  demands: Map<string, ItemDemand>,
  existingNotes: Map<string, string>,
  skipStock: boolean
): { orders: ResolvedOrder[]; errors: string[] } {
  const errors: string[] = [];
  const orders: ResolvedOrder[] = [];
  const stockLeft = new Map<string, number>();
  for (const product of products) stockLeft.set(String(product._id), product.stockQuantity);

  for (const group of groups) {
    const first = group[0]!;
    const last = group[group.length - 1]!;
    const span = first.rowNumber === last.rowNumber ? `Row ${first.rowNumber}` : `Rows ${first.rowNumber}-${last.rowNumber}`;
    const mixed = group.some(
      (row) =>
        row.claimStatus !== first.claimStatus ||
        row.paymentStatus !== first.paymentStatus ||
        row.partialAmount !== first.partialAmount
    );
    if (mixed) {
      errors.push(`${span}: ${first.customer} has different Claiming or Payment on consecutive rows, so they cannot be one order.`);
      continue;
    }

    const fingerprint = fingerprintFor(group);
    const note = noteFor(first.rowNumber, last.rowNumber, fingerprint);
    const previous = existingNotes.get(`${first.rowNumber}-${last.rowNumber}`);
    if (previous && previous !== note) {
      errors.push(`${span}: this order was already imported with different values. Delete that transaction before importing it again.`);
      continue;
    }
    const alreadyImported = previous === note;

    const lines: ResolvedLine[] = [];
    let blocked = false;
    for (const row of group) {
      for (const line of row.lines) {
        const demand = demands.get(matchKey(line.itemName))?.quantity ?? line.quantity;
        const found = resolveProduct(products, line.itemName, demand);
        if ('error' in found) {
          errors.push(`Row ${row.rowNumber}: ${found.error}`);
          blocked = true;
          continue;
        }
        const unitPrice = unitPriceOf(found.product);
        lines.push({
          rowNumber: row.rowNumber,
          itemName: line.itemName,
          quantity: line.quantity,
          productId: found.product._id,
          productName: found.product.name,
          sellingPrice: found.product.sellingPrice,
          discountPrice: typeof found.product.discountPrice === 'number' ? found.product.discountPrice : null,
          unitPrice,
          costPrice: found.product.costPrice,
          subtotal: unitPrice * line.quantity,
          costSubtotal: found.product.costPrice * line.quantity,
          matchNote: found.matchNote,
        });
      }
    }
    if (blocked) continue;

    const items: OrderItem[] = [];
    for (const line of lines) {
      const existing = items.find((item) => String(item.productId) === String(line.productId));
      if (existing) {
        existing.quantity += line.quantity;
        existing.subtotal += line.subtotal;
        existing.costSubtotal += line.costSubtotal;
      } else {
        items.push({
          productId: line.productId,
          productName: line.productName,
          quantity: line.quantity,
          subtotal: line.subtotal,
          costSubtotal: line.costSubtotal,
        });
      }
    }

    const stockChanges: StockChange[] = [];
    let stockBlocked = false;
    for (const item of items) {
      const available = stockLeft.get(String(item.productId)) ?? 0;
      const product = products.find((entry) => String(entry._id) === String(item.productId));
      const sheetNeed = demands.get(matchKey(item.productName))?.quantity;
      if (!skipStock && !alreadyImported && available < item.quantity) {
        errors.push(
          `${span}: "${item.productName}" needs ${item.quantity} but only ${available} ` +
            `${available === product?.stockQuantity ? 'are in stock' : 'remain after earlier orders in this file'}` +
            `${sheetNeed != null ? ` (${sheetNeed} on the whole sheet, ${product?.stockQuantity ?? 0} on hand before import)` : ''}.`
        );
        stockBlocked = true;
        continue;
      }
      if (!skipStock && !alreadyImported) {
        stockChanges.push({ productName: item.productName, before: available, after: available - item.quantity });
      }
    }
    if (stockBlocked) continue;

    const totalAmount = lines.reduce((sum, line) => sum + line.subtotal, 0);
    const totalCost = lines.reduce((sum, line) => sum + line.costSubtotal, 0);
    let amountPaid = 0;
    if (first.paymentStatus === 'paid') amountPaid = totalAmount;
    else if (first.paymentStatus === 'partial') {
      amountPaid = first.partialAmount ?? 0;
      if (amountPaid >= totalAmount) {
        errors.push(
          `${span}: partial amount ${php.format(amountPaid)} is not below the order total ${php.format(totalAmount)}. Mark it paid instead.`
        );
        continue;
      }
    }

    if (!skipStock && !alreadyImported) {
      for (const item of items) {
        const key = String(item.productId);
        stockLeft.set(key, (stockLeft.get(key) ?? 0) - item.quantity);
      }
    }

    orders.push({
      rowStart: first.rowNumber,
      rowEnd: last.rowNumber,
      customerName: first.customer,
      claimRaw: first.claimRaw,
      claimStatus: first.claimStatus,
      paymentStatus: first.paymentStatus,
      amountPaid,
      lines,
      items,
      stockChanges,
      totalAmount,
      totalCost,
      grossProfit: totalAmount - totalCost,
      note,
      alreadyImported,
    });
  }

  return { orders, errors };
}

function claimLabel(order: ResolvedOrder): string {
  if (order.claimStatus === 'unclaimed' && normalizeName(order.claimRaw) === 'reserved') {
    return 'unclaimed (sheet says reserved)';
  }
  return order.claimStatus;
}

function printReport(orders: ResolvedOrder[]): void {
  for (const order of orders) {
    const span = order.rowStart === order.rowEnd ? `Row ${order.rowStart}` : `Rows ${order.rowStart}-${order.rowEnd}`;
    const who = `${order.customerName} (walk-in)`;
    const state = order.alreadyImported ? 'already imported, will skip' : 'ready';
    console.log(`${span} — ${who} — ${claimLabel(order)}, ${order.paymentStatus} — ${state}`);
    for (const line of order.lines) {
      const discount = line.discountPrice == null ? 'no discount' : `discount ${php.format(line.discountPrice)}`;
      console.log(
        `  Row ${line.rowNumber} ${line.itemName} → ${line.productName} × ${line.quantity}\n` +
          `    ${line.matchNote}\n` +
          `    selling ${php.format(line.sellingPrice)}, ${discount} → ${php.format(line.unitPrice)} each\n` +
          `    ${line.quantity} × ${php.format(line.unitPrice)} = ${php.format(line.subtotal)}, ` +
          `cost ${line.quantity} × ${php.format(line.costPrice)} = ${php.format(line.costSubtotal)}`
      );
    }
    for (const change of order.stockChanges) {
      console.log(`  stock ${change.productName}: ${change.before} → ${change.after}`);
    }
    const paid = order.paymentStatus === 'partial' ? `, paid ${php.format(order.amountPaid)}` : '';
    console.log(
      `  order total ${php.format(order.totalAmount)}, cost ${php.format(order.totalCost)}, profit ${php.format(order.grossProfit)}${paid}\n`
    );
  }
}

async function applyOrders(storeId: mongoose.Types.ObjectId, orders: ResolvedOrder[], skipStock: boolean): Promise<number> {
  const pending = orders.filter((order) => !order.alreadyImported);
  if (pending.length === 0) return 0;

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const now = new Date();
    for (const order of pending) {
      const [transaction] = await Transaction.create(
        [
          {
            storeId,
            customerId: null,
            walkInCustomerName: order.customerName,
            totalAmount: order.totalAmount,
            totalCost: order.totalCost,
            grossProfit: order.grossProfit,
            claimStatus: order.claimStatus,
            paymentStatus: order.paymentStatus,
            amountPaid: order.amountPaid,
            paymentMethod: order.paymentStatus === 'paid' ? 'cash' : null,
            orderStatus: 'active',
            orderType: 'walk-in',
            paidAt: order.paymentStatus === 'paid' ? now : null,
            claimedAt: order.claimStatus === 'claimed' ? now : null,
            notes: order.note,
          },
        ],
        { session }
      );

      await TransactionItem.insertMany(
        order.items.map((item) => ({
          transactionId: transaction!._id,
          productId: item.productId,
          quantity: item.quantity,
          subtotal: item.subtotal,
          costSubtotal: item.costSubtotal,
        })),
        { session }
      );

      if (!skipStock) {
        for (const item of order.items) {
          const updated = await Product.updateOne(
            { _id: item.productId, stockQuantity: { $gte: item.quantity } },
            { $inc: { stockQuantity: -item.quantity } },
            { session }
          );
          if (updated.modifiedCount !== 1) {
            throw new Error(`Stock changed for "${item.productName}" before the import could finish. Run the script again.`);
          }
        }
      }
    }
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  return pending.length;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const filePath = findExcelPath(options.fileArg);
  console.log(`Reading ${filePath}`);
  console.log(
    options.apply
      ? 'Mode: apply (orders will be created and stock will be reduced)\n'
      : 'Mode: check only (nothing will be written)\n'
  );

  const sheetRows = await loadSheetRows(filePath);
  if (sheetRows.length === 0) {
    console.log('Nothing to import.');
    return;
  }

  const parsed = parseSheet(sheetRows);
  const groups = groupOrders(parsed.rows);
  console.log(`${groups.length} order(s) from consecutive customer rows.\n`);

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined');
  await mongoose.connect(uri);
  console.log('MongoDB connected\n');

  const stores = await Store.find().select('name').lean();
  if (stores.length === 0) throw new Error('No store exists yet.');
  const products = await Product.find(REGULAR_PRODUCT_FILTER)
    .select('name sellingPrice discountPrice costPrice stockQuantity storeId')
    .lean();
  const demands = itemDemands(groups);
  const chosen = chooseStore(stores, products, demands, options.storeName);
  console.log(`${chosen.reason}\n`);

  const existing = await Transaction.find({
    storeId: chosen.store._id,
    notes: { $regex: /^Spreadsheet backfill rows \d+-\d+ \[/ },
  })
    .select('notes')
    .lean();
  const existingNotes = new Map<string, string>();
  for (const transaction of existing) {
    const match = transaction.notes?.match(/^Spreadsheet backfill rows (\d+-\d+) \[/);
    if (match?.[1] && transaction.notes) existingNotes.set(match[1], transaction.notes);
  }

  const { orders, errors } = resolveOrders(groups, chosen.products, demands, existingNotes, options.skipStock);
  const allErrors = [...parsed.errors, ...errors];
  if (orders.length > 0) printReport(orders);

  if (allErrors.length > 0) {
    console.log('Problems:');
    for (const error of allErrors) console.log(`  ${error}`);
    console.log(`\n${allErrors.length} problem(s). Nothing was written.`);
    process.exitCode = 1;
    return;
  }

  const fresh = orders.filter((order) => !order.alreadyImported);
  const skipped = orders.length - fresh.length;
  const totalAmount = fresh.reduce((sum, order) => sum + order.totalAmount, 0);
  const totalCost = fresh.reduce((sum, order) => sum + order.totalCost, 0);
  console.log(
    `Ready: ${fresh.length} order(s), ${php.format(totalAmount)} sales, ${php.format(totalCost)} cost, ` +
      `${php.format(totalAmount - totalCost)} profit. Stock will be reduced.` +
      (skipped > 0 ? ` ${skipped} already imported.` : '')
  );

  if (!options.apply) {
    console.log('\nCheck only. Re-run with --apply to create these orders and deduct stock.');
    return;
  }

  const created = await applyOrders(chosen.store._id, orders, options.skipStock);
  console.log(`\nCreated ${created} order(s) and updated stock.`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nBackfill failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
