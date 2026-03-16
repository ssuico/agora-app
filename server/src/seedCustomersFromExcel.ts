import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import 'dotenv/config';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { User } from './models/User.js';
import { UserRole } from './types/index.js';

const DEFAULT_PASSWORD = 'password123';

/** Path to the customer list Excel file (project root by default). */
function getExcelPath(): string {
  const envPath = process.env.CUSTOMER_LIST_XLSX;
  if (envPath) return path.resolve(envPath);
  // Default: project root "agora customer list.xlsx" (when run from server/)
  return path.resolve(process.cwd(), '..', 'agora customer list.xlsx');
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

async function loadCustomersFromExcel(filePath: string): Promise<{ name: string; email: string }[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Excel file has no worksheets.');

  const rows: ExcelJS.Row[] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => rows.push(row));

  if (rows.length < 2) {
    console.log('No data rows found (need at least a header row and one data row).');
    return [];
  }

  const headerRow = rows[0];
  // row.values is 1-based indexed; index 0 is unused
  const headerValues = headerRow.values as unknown[];
  const headers = (headerValues ?? []).slice(1).map((v) => normalizeHeader(v));

  let nameCol = headers.findIndex((h) => h === 'name' || h === 'customer name' || h === 'full name');
  let emailCol = headers.findIndex((h) => h === 'email' || h === 'email address');

  if (nameCol < 0) nameCol = 0;
  if (emailCol < 0) emailCol = 1;

  const customers: { name: string; email: string }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const values = row.values as unknown[];
    const nameVal = values?.[nameCol + 1];
    const emailVal = values?.[emailCol + 1];

    const name = String(nameVal ?? '').trim();
    const email = String(emailVal ?? '').trim().toLowerCase();

    if (!email) continue;
    if (!name) continue;

    customers.push({ name, email });
  }

  return customers;
}

async function seedCustomersFromExcel() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined');

  const filePath = getExcelPath();
  console.log(`Reading customer list from: ${filePath}\n`);

  const customers = await loadCustomersFromExcel(filePath);
  console.log(`Found ${customers.length} customer(s) in Excel.\n`);

  if (customers.length === 0) {
    console.log('Nothing to seed.');
    return;
  }

  await mongoose.connect(uri);
  console.log('MongoDB connected\n');
  console.log('Seeding customers...\n');

  let created = 0;
  let skipped = 0;

  for (const customer of customers) {
    const existing = await User.findOne({ email: customer.email });
    if (existing) {
      console.log(`  SKIP: "${customer.email}" already exists`);
      skipped++;
      continue;
    }

    const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 12);
    await User.create({
      name: customer.name,
      email: customer.email,
      password: hashed,
      role: UserRole.CUSTOMER,
    });
    console.log(`  CREATED: ${customer.name} (${customer.email})`);
    created++;
  }

  console.log(`\nDone — ${created} created, ${skipped} skipped.`);
  await mongoose.disconnect();
}

seedCustomersFromExcel().catch((err) => {
  console.error('Customer seed from Excel failed:', err);
  process.exit(1);
});
