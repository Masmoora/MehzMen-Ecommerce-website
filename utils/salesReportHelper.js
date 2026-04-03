// helpers/reportUtils.js
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

function formatDateTime(dateValue) {
  const date = dateValue ? new Date(dateValue) : new Date();
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function drawTableRow(doc, y, values, options = {}) {
  const tableStartX = 40;
  const colWidths = [35, 80, 110, 70, 65, 65, 65, 60];
  const colX = [];
  let runningX = tableStartX;
  for (let i = 0; i < colWidths.length; i += 1) {
    colX.push(runningX);
    runningX += colWidths[i];
  }
  const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
  const rowHeight = 24;
  const isHeader = options.isHeader || false;

  if (isHeader) {
    doc.rect(tableStartX, y, tableWidth, rowHeight).fillAndStroke('#333366', '#D4D4D4');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10);
  } else {
    doc.rect(tableStartX, y, tableWidth, rowHeight).stroke('#D4D4D4');
    doc.fillColor('#000000').font('Helvetica').fontSize(9);
  }

  for (let i = 0; i < colX.length; i += 1) {
    doc.moveTo(colX[i], y).lineTo(colX[i], y + rowHeight).stroke('#D4D4D4');
  }
  doc.moveTo(tableStartX + tableWidth, y).lineTo(tableStartX + tableWidth, y + rowHeight).stroke('#D4D4D4');

  doc.text(String(values.sl || ''), colX[0] + 3, y + 7, { width: colWidths[0] - 6, align: 'center' });
  doc.text(String(values.orderId || ''), colX[1] + 4, y + 7, { width: colWidths[1] - 8 });
  doc.text(String(values.user || ''), colX[2] + 4, y + 7, { width: colWidths[2] - 8 });
  doc.text(String(values.date || ''), colX[3] + 4, y + 7, { width: colWidths[3] - 8 });
  doc.text(String(values.amount || ''), colX[4] + 4, y + 7, { width: colWidths[4] - 8, align: 'right' });
  doc.text(String(values.discount || ''), colX[5] + 4, y + 7, { width: colWidths[5] - 8, align: 'right' });
  doc.text(String(values.offer || ''), colX[6] + 4, y + 7, { width: colWidths[6] - 8, align: 'right' });
  doc.text(String(values.payment || ''), colX[7] + 4, y + 7, { width: colWidths[7] - 8, align: 'center' });

  return y + rowHeight;
}

function drawTableHeader(doc, y) {
  return drawTableRow(
    doc,
    y,
    {
      sl: 'SL',
      orderId: 'Order ID',
      user: 'User',
      date: 'Date',
      amount: 'Amount',
      discount: 'Discount',
      offer: 'Offer',
      payment: 'Pay'
    },
    { isHeader: true }
  );
}

export function generatePdfReport(res, salesData, totals, meta = {}) {
  const { totalSale, totalAmount, totalDiscount, totalOffer } = totals;
  const websiteName = meta.websiteName || 'Website';
  const rangeLabel = meta.rangeLabel || 'Today';
  const generatedAt = formatDateTime(meta.generatedAt);

  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="sales_report.pdf"');

  doc.pipe(res);

  doc.fontSize(20).fillColor('#333366').font('Helvetica-Bold').text(websiteName, 40, 40);
  doc
    .fontSize(16)
    .fillColor('#000000')
    .font('Helvetica-Bold')
    .text('Sales Report', 40, 70);
  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#333333')
    .text(`Range: ${rangeLabel}`, 40, 95)
    .text(`Generated: ${generatedAt}`, 40, 110);

  let y = 140;
  y = drawTableHeader(doc, y);

  salesData.forEach((item, index) => {
    if (y > 760) {
      doc.addPage();
      doc.fontSize(11).fillColor('#333366').font('Helvetica-Bold').text(`${websiteName} - Sales Report`, 40, 40);
      doc.fontSize(9).fillColor('#333333').font('Helvetica').text(`Range: ${rangeLabel}`, 40, 58);
      y = 80;
      y = drawTableHeader(doc, y);
    }

    y = drawTableRow(doc, y, {
      sl: index + 1,
      orderId: String(item.orderId || '').slice(0, 12),
      user: String(item.user || '').slice(0, 18),
      date: item.date || '',
      amount: item.totalAmount ?? 0,
      discount: item.discount ?? 0,
      offer: item.offer ?? 0,
      payment: String(item.payment || 'N/A').slice(0, 3)
    });
  });

  y += 16;
  doc
    .fontSize(11)
    .fillColor('#000000')
    .font('Helvetica-Bold')
    .text(`Total Orders: ${totalSale}`, 50, y)
    .text(`Total Amount: INR ${totalAmount}`, 50, y + 18)
    .text(`Total Discount: INR ${totalDiscount}`, 50, y + 36)
    .text(`Total Offer: INR ${totalOffer}`, 50, y + 54);

  doc.end();
}

export async function generateExcelReport(res, salesData, totals, meta = {}) {
  const { totalAmount, totalDiscount, totalOffer } = totals;
  const websiteName = meta.websiteName || 'Website';
  const rangeLabel = meta.rangeLabel || 'Today';
  const generatedAt = formatDateTime(meta.generatedAt);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sales Report');

  worksheet.mergeCells('A1:H1');
  worksheet.getCell('A1').value = websiteName;
  worksheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF333366' } };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  worksheet.mergeCells('A2:H2');
  worksheet.getCell('A2').value = 'Sales Report';
  worksheet.getCell('A2').font = { bold: true, size: 12 };
  worksheet.getCell('A2').alignment = { horizontal: 'center' };

  worksheet.mergeCells('A3:H3');
  worksheet.getCell('A3').value = `Range: ${rangeLabel}`;
  worksheet.getCell('A3').alignment = { horizontal: 'left' };

  worksheet.mergeCells('A4:H4');
  worksheet.getCell('A4').value = `Generated: ${generatedAt}`;
  worksheet.getCell('A4').alignment = { horizontal: 'left' };

  worksheet.addRow([]);

  worksheet.columns = [
    { header: 'SL', key: 'sl', width: 6 },
    { header: 'Order ID', key: 'orderId', width: 20 },
    { header: 'User', key: 'user', width: 25 },
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Amount', key: 'totalAmount', width: 15 },
    { header: 'Discount', key: 'discount', width: 15 },
    { header: 'Offer', key: 'offer', width: 15 },
    { header: 'Payment', key: 'payment', width: 15 }
  ];

  const headerRowNumber = 6;
  const headerRow = worksheet.getRow(headerRowNumber);
  headerRow.values = ['SL', 'Order ID', 'User', 'Date', 'Amount', 'Discount', 'Offer', 'Payment'];

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF333366' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  salesData.forEach((row, index) => {
    const rowObj = worksheet.addRow({
      sl: index + 1,
      orderId: row.orderId,
      user: row.user,
      date: row.date,
      totalAmount: row.totalAmount,
      discount: row.discount,
      offer: row.offer,
      payment: row.payment
    });
    rowObj.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  worksheet.addRow([]);
  worksheet.addRow({
    user: 'TOTALS:',
    totalAmount,
    discount: totalDiscount,
    offer: totalOffer
  });

  const lastRow = worksheet.lastRow;
  if (lastRow) {
    lastRow.font = { bold: true };
    lastRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    });
  }

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', 'attachment; filename="sales_report.xlsx"');

  await workbook.xlsx.write(res);
  res.end();
}