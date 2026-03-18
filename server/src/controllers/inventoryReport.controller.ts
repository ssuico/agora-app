import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { InventoryRecord } from '../models/InventoryRecord.js';
import { InventoryReport } from '../models/InventoryReport.js';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { TransactionItem } from '../models/TransactionItem.js';
import { localDayRange } from '../config/timezone.js';

type ReportProduct = {
  productId: string;
  productName: string;
  isPerishable: boolean;
  costPrice: number;
  sellingPrice: number;
  discountPrice: number | null;
  sellerName: string;
  notes: string;
  initialStock: number;
  restock: number;
  displayInitialStock: number;
  sold: number;
  currentStock: number;
};

async function buildReportData(storeId: string, dateStr: string): Promise<ReportProduct[]> {
  const dateUTC = new Date(dateStr);
  dateUTC.setUTCHours(0, 0, 0, 0);

  const products = await Product.find({ storeId }).lean();
  if (products.length === 0) return [];

  const productIds = products.map((p) => p._id);
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const records = await InventoryRecord.find({
    productId: { $in: productIds },
    date: dateUTC,
  }).lean();

  const { dayStart, dayEnd } = localDayRange(dateUTC);

  const activeTxs = await Transaction.find({
    storeId,
    orderStatus: { $ne: 'cancelled' },
    createdAt: { $gte: dayStart, $lte: dayEnd },
  })
    .select('_id')
    .lean();

  const txIds = activeTxs.map((t) => t._id);

  const soldAgg =
    txIds.length > 0
      ? await TransactionItem.aggregate([
          { $match: { transactionId: { $in: txIds }, productId: { $in: productIds } } },
          { $group: { _id: '$productId', totalSold: { $sum: '$quantity' } } },
        ])
      : [];

  const soldMap = new Map<string, number>(
    soldAgg.map((s: { _id: unknown; totalSold: number }) => [String(s._id), s.totalSold])
  );

  return records.map((rec) => {
    const product = productMap.get(String(rec.productId));
    const sold = soldMap.get(String(rec.productId)) ?? 0;
    const displayInitialStock = rec.initialStock + rec.restock;
    const currentStock = Math.max(0, displayInitialStock - sold);

    return {
      productId: String(rec.productId),
      productName: product?.name ?? 'Unknown',
      isPerishable: product?.isPerishable ?? false,
      costPrice: product?.costPrice ?? 0,
      sellingPrice: product?.sellingPrice ?? 0,
      discountPrice: product?.discountPrice ?? null,
      sellerName: product?.sellerName ?? '',
      notes: product?.notes ?? '',
      initialStock: rec.initialStock,
      restock: rec.restock,
      displayInitialStock,
      sold,
      currentStock,
    };
  });
}

async function buildExcelBuffer(dateStr: string, products: ReportProduct[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Agora POS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Inventory Report');

  sheet.columns = [
    { header: 'Product', key: 'productName', width: 24 },
    { header: 'Seller', key: 'sellerName', width: 20 },
    { header: 'Notes', key: 'notes', width: 30 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Cost', key: 'costPrice', width: 12 },
    { header: 'Selling', key: 'sellingPrice', width: 12 },
    { header: 'Discount', key: 'discountPrice', width: 12 },
    { header: 'Initial', key: 'displayInitialStock', width: 10 },
    { header: 'Restock', key: 'restock', width: 10 },
    { header: 'Sold', key: 'sold', width: 10 },
    { header: 'Current', key: 'currentStock', width: 10 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  for (const p of products) {
    sheet.addRow({
      productName: p.productName,
      sellerName: p.sellerName || '',
      notes: p.notes || '',
      type: p.isPerishable ? 'Perishable' : 'Non-perishable',
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      discountPrice: p.discountPrice,
      displayInitialStock: p.displayInitialStock,
      restock: p.restock,
      sold: p.sold,
      currentStock: p.currentStock,
    });
  }

  const numFmt = '#,##0.00';
  sheet.getColumn('costPrice').numFmt = numFmt;
  sheet.getColumn('sellingPrice').numFmt = numFmt;
  sheet.getColumn('discountPrice').numFmt = numFmt;

  if (products.length > 0) {
    const totalRow = sheet.addRow({
      productName: 'Total',
      sellerName: '',
      notes: '',
      type: '',
      costPrice: 0,
      sellingPrice: 0,
      discountPrice: 0,
      displayInitialStock: products.reduce((s, x) => s + x.displayInitialStock, 0),
      restock: products.reduce((s, x) => s + x.restock, 0),
      sold: products.reduce((s, x) => s + x.sold, 0),
      currentStock: products.reduce((s, x) => s + x.currentStock, 0),
    });
    totalRow.font = { bold: true };
  }

  sheet.eachRow((row, rowNum) => {
    if (rowNum > 1) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        };
      });
    }
  });

  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
}

export const generateReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, date: dateStr } = req.query as { storeId?: string; date?: string };
    if (!storeId || !dateStr) {
      res.status(400).json({ message: 'storeId and date are required' });
      return;
    }

    const products = await buildReportData(storeId, dateStr);
    const buffer = await buildExcelBuffer(dateStr, products);
    const fileName = `inventory_report_${dateStr}.xlsx`;

    const report = await InventoryReport.findOneAndUpdate(
      { storeId, reportDate: dateStr },
      {
        storeId,
        generatedBy: req.user!.userId,
        reportDate: dateStr,
        fileName,
        fileData: buffer,
      },
      { upsert: true, new: true }
    );

    const populated = await InventoryReport.findById(report._id)
      .select('-fileData')
      .populate('generatedBy', 'name')
      .lean();

    res.status(201).json(populated);
  } catch (err) {
    console.error('Generate inventory report error:', err);
    res.status(500).json({ message: 'Failed to generate report', error: String(err) });
  }
};

export const getReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.query as { storeId?: string };
    if (!storeId) {
      res.status(400).json({ message: 'storeId is required' });
      return;
    }

    const reports = await InventoryReport.find({ storeId })
      .select('-fileData')
      .populate('generatedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const downloadReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const report = await InventoryReport.findById(req.params.id);
    if (!report) {
      res.status(404).json({ message: 'Report not found' });
      return;
    }

    res.setHeader('Content-Type', report.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
    res.send(report.fileData);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

/** Generate Excel on the fly for a given storeId and date (no save). */
export const exportReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, date: dateStr } = req.query as { storeId?: string; date?: string };
    if (!storeId || !dateStr) {
      res.status(400).json({ message: 'storeId and date are required' });
      return;
    }

    const products = await buildReportData(storeId, dateStr);
    const buffer = await buildExcelBuffer(dateStr, products);
    const fileName = `inventory_report_${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Export inventory report error:', err);
    res.status(500).json({ message: 'Failed to export report', error: String(err) });
  }
};

export const deleteReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const report = await InventoryReport.findByIdAndDelete(req.params.id);
    if (!report) {
      res.status(404).json({ message: 'Report not found' });
      return;
    }
    res.json({ message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
