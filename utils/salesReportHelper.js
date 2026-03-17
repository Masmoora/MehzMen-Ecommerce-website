// helpers/reportUtils.js
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

export function generatePdfReport(res, salesData, totals) {
  const { totalSale, totalAmount, totalDiscount, totalOffer } = totals;

  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="sales_report.pdf"');

  doc.pipe(res);

  doc.fontSize(22).fillColor('#333366').text('Sales Report', { align: 'center' }).moveDown(2);

  let y = doc.y;
  doc
    .fontSize(12)
    .fillColor('#000')
    .text('SL', 50, y)
    .text('Order ID', 90, y)
    .text('User', 200, y)
    .text('Date', 280, y)
    .text('Amount', 370, y)
    .text('Discount', 440, y)
    .text('Offer', 510, y);

  y += 20;
  doc.moveTo(50, y).lineTo(550, y).stroke();
  y += 10;

  salesData.forEach((item, index) => {
    doc
      .fontSize(10)
      .fillColor('#000')
      .text(String(index + 1), 50, y)
      .text(String(item.orderId).slice(0, 8), 90, y)
      .text(String(item.user), 200, y)
      .text(String(item.date), 280, y)
      .text(String(item.totalAmount), 370, y)
      .text(String(item.discount), 440, y)
      .text(String(item.offer), 510, y);

    y += 20;
    if (y > 750) {
      doc.addPage();
      y = 50;
    }
  });

  y += 20;
  doc
    .fontSize(12)
    .fillColor('#000')
    .text(`Total Orders: ${totalSale}`, 50, y)
    .text(`Total Amount: ₹${totalAmount}`, 50, y + 20)
    .text(`Total Discount: ₹${totalDiscount}`, 50, y + 40)
    .text(`Total Offer: ₹${totalOffer}`, 50, y + 60);

  doc.end();
}

export async function generateExcelReport(res, salesData, totals) {
  const { totalAmount, totalDiscount, totalOffer } = totals;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sales Report');

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

  salesData.forEach((row, index) => {
    worksheet.addRow({
      sl: index + 1,
      orderId: row.orderId,
      user: row.user,
      date: row.date,
      totalAmount: row.totalAmount,
      discount: row.discount,
      offer: row.offer,
      payment: row.payment
    });
  });

  // Header style
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF333366' }
  };
  headerRow.alignment = { horizontal: 'center' };

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

