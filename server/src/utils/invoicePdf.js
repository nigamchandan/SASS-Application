const PDFDocument = require('pdfkit');

const formatINR = (amount) =>
  `Rs. ${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (d) => {
  if (!d) return '-';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

function streamInvoicePdf({ invoice, customer, business }, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${invoice.invoiceNumber}.pdf"`
  );

  doc.pipe(res);

  doc
    .fontSize(22)
    .fillColor('#0f172a')
    .text('INVOICE', { align: 'right' });

  doc
    .fontSize(10)
    .fillColor('#64748b')
    .text(`# ${invoice.invoiceNumber}`, { align: 'right' });

  doc.moveDown(0.4);
  doc
    .fontSize(9)
    .fillColor('#475569')
    .text(`Status: ${invoice.status}`, { align: 'right' });

  doc.fillColor('#0f172a').fontSize(14).text(business.name || 'BizAutomate', 50, 50);
  if (business.email) {
    doc.fontSize(9).fillColor('#64748b').text(business.email, 50, 70);
  }

  doc.moveTo(50, 110).lineTo(545, 110).strokeColor('#e2e8f0').stroke();

  const metaY = 125;
  doc
    .fontSize(10)
    .fillColor('#0f172a')
    .text('Bill To', 50, metaY)
    .font('Helvetica-Bold')
    .text(customer.name, 50, metaY + 14);

  doc.font('Helvetica').fontSize(9).fillColor('#475569');
  let yCursor = metaY + 30;
  if (customer.phone) {
    doc.text(customer.phone, 50, yCursor);
    yCursor += 12;
  }
  if (customer.email) {
    doc.text(customer.email, 50, yCursor);
    yCursor += 12;
  }
  if (customer.address) {
    doc.text(customer.address, 50, yCursor, { width: 220 });
    yCursor += 24;
  }
  if (customer.gstNumber) {
    doc.text(`GSTIN: ${customer.gstNumber}`, 50, yCursor);
    yCursor += 12;
  }

  doc
    .fontSize(10)
    .fillColor('#0f172a')
    .text('Invoice Date', 360, metaY)
    .font('Helvetica-Bold')
    .text(formatDate(invoice.issueDate), 360, metaY + 14);

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#0f172a')
    .text('Due Date', 460, metaY)
    .font('Helvetica-Bold')
    .text(formatDate(invoice.dueDate), 460, metaY + 14);

  const tableTop = Math.max(yCursor + 20, 240);

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a');
  doc.text('Item', 50, tableTop);
  doc.text('Qty', 300, tableTop, { width: 40, align: 'right' });
  doc.text('Price', 350, tableTop, { width: 60, align: 'right' });
  doc.text('Tax %', 420, tableTop, { width: 40, align: 'right' });
  doc.text('Total', 470, tableTop, { width: 75, align: 'right' });

  doc
    .moveTo(50, tableTop + 14)
    .lineTo(545, tableTop + 14)
    .strokeColor('#cbd5e1')
    .stroke();

  doc.font('Helvetica').fontSize(9).fillColor('#0f172a');
  let rowY = tableTop + 22;

  invoice.items.forEach((item) => {
    if (rowY > 720) {
      doc.addPage();
      rowY = 50;
    }
    doc.text(item.itemName, 50, rowY, { width: 240 });
    doc.text(String(item.quantity), 300, rowY, { width: 40, align: 'right' });
    doc.text(formatINR(item.price), 350, rowY, { width: 60, align: 'right' });
    doc.text(`${item.tax}%`, 420, rowY, { width: 40, align: 'right' });
    doc.text(formatINR(item.total), 470, rowY, { width: 75, align: 'right' });
    rowY += 22;
  });

  doc
    .moveTo(50, rowY)
    .lineTo(545, rowY)
    .strokeColor('#e2e8f0')
    .stroke();

  rowY += 14;
  const labelX = 360;
  const valueX = 470;

  doc.fontSize(10).fillColor('#475569');
  doc.text('Subtotal', labelX, rowY, { width: 100, align: 'right' });
  doc
    .fillColor('#0f172a')
    .text(formatINR(invoice.subtotal), valueX, rowY, {
      width: 75,
      align: 'right',
    });

  rowY += 18;
  doc
    .fillColor('#475569')
    .text('Tax (GST)', labelX, rowY, { width: 100, align: 'right' });
  doc
    .fillColor('#0f172a')
    .text(formatINR(invoice.taxAmount), valueX, rowY, {
      width: 75,
      align: 'right',
    });

  rowY += 22;
  doc
    .moveTo(labelX, rowY - 6)
    .lineTo(545, rowY - 6)
    .strokeColor('#cbd5e1')
    .stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#0f172a')
    .text('Grand Total', labelX, rowY, { width: 100, align: 'right' });
  doc.text(formatINR(invoice.totalAmount), valueX, rowY, {
    width: 75,
    align: 'right',
  });

  if (invoice.notes) {
    doc
      .moveDown(2)
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#0f172a')
      .text('Notes', 50, rowY + 50);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#475569')
      .text(invoice.notes, 50, rowY + 66, { width: 495 });
  }

  doc.end();
}

module.exports = { streamInvoicePdf };
