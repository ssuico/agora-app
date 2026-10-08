import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { Transaction, getDisplayOrderStatus, getPreOrderDisplayStatus } from '../models/Transaction.js';
import { TransactionItem } from '../models/TransactionItem.js';
import { TransactionReport } from '../models/TransactionReport.js';
import { APP_TIMEZONE, toLocalDateStr, localDayRange, localDayRangeFromDateString } from '../config/timezone.js';

const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;

const findReportMeta = (filter: Record<string, unknown>) =>
  TransactionReport.findOne(filter).select('-fileData').populate('generatedBy', 'name').lean();

const slugify = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

const orderTypeLabel = (orderType?: string | null): string => {
  if (orderType === 'preorder') return 'Pre-Order';
  if (orderType === 'walk-in') return 'Walk-in';
  return 'Regular';
};

const statusLabel = (value?: string | null): string =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : '';

type ReportProduct = {
  name: string;
  sellingPrice: number;
  costPrice: number;
  preOrderStatus?: 'pending' | 'ready' | null;
};

const reportStatuses = (
  tx: {
    orderStatus?: 'active' | 'cancelled' | null;
    claimStatus?: 'unclaimed' | 'claimed' | null;
    paymentStatus?: 'unpaid' | 'paid' | 'partial' | null;
    orderType?: string | null;
    amountPaid?: number | null;
  },
  product?: { preOrderStatus?: 'pending' | 'ready' | null } | null,
) => ({
  orderStatus: statusLabel(getDisplayOrderStatus(tx)),
  orderType: orderTypeLabel(tx.orderType),
  claimStatus: statusLabel(tx.claimStatus),
  paymentStatus: statusLabel(tx.paymentStatus),
  amountPaid: tx.amountPaid ?? 0,
  preOrderStatus: tx.orderType === 'preorder' ? statusLabel(getPreOrderDisplayStatus(tx, product)) : '',
});

export const generateReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, dateFrom, dateTo, overwrite: overwriteParam } = req.query as {
      storeId?: string;
      dateFrom?: string;
      dateTo?: string;
      overwrite?: string;
    };
    if (!storeId) {
      res.status(400).json({ message: 'storeId is required' });
      return;
    }
    const overwrite = overwriteParam === 'true';

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

    // Identity comes from the verified token only, never from the request.
    const userId = req.user!.userId;
    const reportKey = { generatedBy: userId, storeId, transactionDate: dateStr };

    const respondExists = (report: unknown) =>
      res.status(409).json({
        code: 'REPORT_EXISTS',
        message: 'You already generated a report for this date.',
        report,
      });

    if (!overwrite) {
      const existing = await findReportMeta(reportKey);
      if (existing) {
        respondExists(existing);
        return;
      }
    }

    const transactions = await Transaction.find({
      storeId,
      createdAt: { $gte: dayStart, $lte: dayEnd },
    })
      .populate('customerId', 'name email')
      .sort({ createdAt: 1 })
      .lean();

    const txIds = transactions.map((t) => t._id);
    const allItems = await TransactionItem.find({ transactionId: { $in: txIds } })
      .populate('productId', 'name sellingPrice costPrice preOrderStatus')
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
      { header: 'Order Type', key: 'orderType', width: 14 },
      { header: 'Claim Status', key: 'claimStatus', width: 14 },
      { header: 'Payment Status', key: 'paymentStatus', width: 16 },
      { header: 'Amount Paid', key: 'amountPaid', width: 14 },
      { header: 'Pre-Order Status', key: 'preOrderStatus', width: 18 },
      { header: 'Date Claimed', key: 'claimedAt', width: 20 },
      { header: 'Date Paid', key: 'paidAt', width: 20 },
      { header: 'Store Notes', key: 'storeNotes', width: 36 },
    ];

    const fmtDateTime = (d?: Date | null) =>
      d ? new Date(d).toLocaleString('en-US', { timeZone: APP_TIMEZONE }) : '';

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
      const firstProduct = items
        .map((item) =>
          item.productId && typeof item.productId === 'object'
            ? (item.productId as unknown as ReportProduct)
            : null
        )
        .find((product) => product != null) ?? null;
      const statuses = reportStatuses(tx, firstProduct);
      const blankStatuses = {
        orderStatus: '',
        orderType: '',
        claimStatus: '',
        paymentStatus: '',
        amountPaid: '',
        preOrderStatus: '',
      };

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
          ...statuses,
          claimedAt: fmtDateTime(tx.claimedAt),
          paidAt: fmtDateTime(tx.paidAt),
          storeNotes: tx.notes?.trim() ?? '',
        });
      } else {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const prod =
            item.productId && typeof item.productId === 'object'
              ? (item.productId as unknown as ReportProduct)
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
            ...(i === 0 ? statuses : blankStatuses),
            claimedAt: i === 0 ? fmtDateTime(tx.claimedAt) : '',
            paidAt: i === 0 ? fmtDateTime(tx.paidAt) : '',
            storeNotes: i === 0 ? (tx.notes?.trim() ?? '') : '',
          });
        }
      }
    }

    const currencyCols = ['unitPrice', 'subtotal', 'costSubtotal', 'totalAmount', 'totalCost', 'grossProfit', 'amountPaid'];
    for (const key of currencyCols) {
      const col = sheet.getColumn(key);
      col.numFmt = '#,##0.00';
    }
    sheet.getColumn('storeNotes').alignment = { wrapText: true, vertical: 'top' };

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
    const userSlug = slugify(req.user!.name ?? '');
    const fileName = `transactions_${dateStr.replace(/_/g, '-')}${userSlug ? `_${userSlug}` : ''}.xlsx`;
    const fileData = Buffer.from(buffer as ArrayBuffer);

    let reportId: unknown;
    if (overwrite) {
      const upsert = () =>
        TransactionReport.findOneAndUpdate(
          reportKey,
          { $set: { fileName, fileData, generatedAt: new Date() } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      let saved;
      try {
        saved = await upsert();
      } catch (err) {
        // Two concurrent upserts can both try to insert; the loser retries as an update.
        if (!isDuplicateKeyError(err)) throw err;
        saved = await upsert();
      }
      reportId = saved?._id;
    } else {
      try {
        const created = await TransactionReport.create({ ...reportKey, fileName, fileData, generatedAt: new Date() });
        reportId = created._id;
      } catch (err) {
        if (!isDuplicateKeyError(err)) throw err;
        respondExists(await findReportMeta(reportKey));
        return;
      }
    }

    const populated = await findReportMeta({ _id: reportId });
    res.status(overwrite ? 200 : 201).json(populated);
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
      .sort({ generatedAt: -1 })
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
