import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { Transaction } from '../models/Transaction.js';
import { TransactionItem } from '../models/TransactionItem.js';
import { TransactionReport } from '../models/TransactionReport.js';
import { APP_TIMEZONE, toLocalDateStr, localDayRange, localDayRangeFromDateString } from '../config/timezone.js';

export const generateReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, dateFrom, dateTo } = req.query as { storeId?: string; dateFrom?: string; dateTo?: string };
    if (!storeId) {
      res.status(400).json({ message: 'storeId is required' });
      return;
    }

    let dayStart: Date;
    let dayEnd: Date;
    let dateStr: string;

    const fromOk = dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom);
    const toOk = dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo);

    if (fromOk && toOk) {
      const fromRange = localDayRangeFromDateString(dateFrom);
      const toRange = localDayRangeFromDateString(dateTo);
      dayStart = fromRange.dayStart;
      dayEnd = toRange.dayEnd;
      dateStr = dateFrom === dateTo ? dateFrom : `${dateFrom}_to_${dateTo}`;
    } else {
      const now = new Date();
      dateStr = toLocalDateStr(now);
      const todayMidnightUtc = new Date(`${dateStr}T00:00:00Z`);
      const range = localDayRange(todayMidnightUtc);
      dayStart = range.dayStart;
      dayEnd = range.dayEnd;
    }

    const transactions = await Transaction.find({
      storeId,
      createdAt: { $gte: dayStart, $lte: dayEnd },
      orderStatus: { $ne: 'cancelled' },
    })
      .populate('customerId', 'name email')
      .sort({ createdAt: 1 })
      .lean();

    const txIds = transactions.map((t) => t._id);
    const allItems = await TransactionItem.find({ transactionId: { $in: txIds } })
      .populate('productId', 'name sellingPrice costPrice')
      .lean();

    const itemsByTx = new Map<string, typeof allItems>();
    for (const item of allItems) {
      const key = String(item.transactionId);
      if (!itemsByTx.has(key)) itemsByTx.set(key, []);
      itemsByTx.get(key)!.push(item);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Agora POS';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Transactions');

    sheet.columns = [
      { header: 'Transaction ID', key: 'id', width: 28 },
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Customer', key: 'customer', width: 22 },
      { header: 'Customer Email', key: 'email', width: 26 },
      { header: 'Product', key: 'product', width: 24 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Unit Price', key: 'unitPrice', width: 14 },
      { header: 'Subtotal', key: 'subtotal', width: 14 },
      { header: 'Cost Subtotal', key: 'costSubtotal', width: 14 },
      { header: 'Total Amount', key: 'totalAmount', width: 14 },
      { header: 'Total Cost', key: 'totalCost', width: 14 },
      { header: 'Gross Profit', key: 'grossProfit', width: 14 },
      { header: 'Order Status', key: 'orderStatus', width: 14 },
      { header: 'Claim Status', key: 'claimStatus', width: 14 },
      { header: 'Payment Status', key: 'paymentStatus', width: 14 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    for (const tx of transactions) {
      const customer =
        tx.customerId && typeof tx.customerId === 'object'
          ? (tx.customerId as unknown as { name: string; email: string })
          : null;
      const customerName = customer?.name ?? tx.walkInCustomerName ?? 'Walk-in';
      const items = itemsByTx.get(String(tx._id)) || [];

      if (items.length === 0) {
        sheet.addRow({
          id: String(tx._id),
          date: new Date(tx.createdAt).toLocaleString('en-US', { timeZone: APP_TIMEZONE }),
          customer: customerName,
          email: customer?.email ?? '',
          product: '',
          quantity: '',
          unitPrice: '',
          subtotal: '',
          costSubtotal: '',
          totalAmount: tx.totalAmount,
          totalCost: tx.totalCost,
          grossProfit: tx.grossProfit,
          orderStatus: tx.orderStatus,
          claimStatus: tx.claimStatus,
          paymentStatus: tx.paymentStatus,
        });
      } else {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const prod =
            item.productId && typeof item.productId === 'object'
              ? (item.productId as unknown as { name: string; sellingPrice: number; costPrice: number })
              : null;

          sheet.addRow({
            id: i === 0 ? String(tx._id) : '',
            date: i === 0 ? new Date(tx.createdAt).toLocaleString('en-US', { timeZone: APP_TIMEZONE }) : '',
            customer: i === 0 ? customerName : '',
            email: i === 0 ? (customer?.email ?? '') : '',
            product: prod?.name ?? 'Deleted product',
            quantity: item.quantity,
            unitPrice: prod?.sellingPrice ?? 0,
            subtotal: item.subtotal,
            costSubtotal: item.costSubtotal,
            totalAmount: i === 0 ? tx.totalAmount : '',
            totalCost: i === 0 ? tx.totalCost : '',
            grossProfit: i === 0 ? tx.grossProfit : '',
            orderStatus: i === 0 ? tx.orderStatus : '',
            claimStatus: i === 0 ? tx.claimStatus : '',
            paymentStatus: i === 0 ? tx.paymentStatus : '',
          });
        }
      }
    }

    const currencyCols = ['unitPrice', 'subtotal', 'costSubtotal', 'totalAmount', 'totalCost', 'grossProfit'];
    for (const key of currencyCols) {
      const col = sheet.getColumn(key);
      col.numFmt = '#,##0.00';
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

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `transactions_${dateStr.replace(/_/g, '-')}.xlsx`;

    const report = await TransactionReport.findOneAndUpdate(
      { storeId, transactionDate: dateStr },
      {
        storeId,
        generatedBy: req.user!.userId,
        transactionDate: dateStr,
        fileName,
        fileData: Buffer.from(buffer as ArrayBuffer),
      },
      { upsert: true, new: true }
    );

    const populated = await TransactionReport.findById(report._id)
      .select('-fileData')
      .populate('generatedBy', 'name')
      .lean();

    res.status(201).json(populated);
  } catch (err) {
    console.error('Generate report error:', err);
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

    const reports = await TransactionReport.find({ storeId })
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
    const report = await TransactionReport.findById(req.params.id);
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

export const deleteReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const report = await TransactionReport.findByIdAndDelete(req.params.id);
    if (!report) {
      res.status(404).json({ message: 'Report not found' });
      return;
    }
    res.json({ message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
