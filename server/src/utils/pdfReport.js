const PDFDocument = require('pdfkit');

const PAGE_MARGIN = 40;
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89; // A4
const USABLE_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

const COLOR_PRIMARY = '#0f172a';
const COLOR_MUTED = '#64748b';
const COLOR_BORDER = '#e2e8f0';
const COLOR_TABLE_HEADER_BG = '#f1f5f9';
const COLOR_TABLE_ALT_ROW = '#f8fafc';
const COLOR_ACCENT = '#4f46e5';

const SAFE_NUM = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function fmtINR(amount) {
  return `Rs. ${SAFE_NUM(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(d) {
  if (!d) return '-';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtDateTime(d) {
  if (!d) return '-';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '-';
  return `${fmtDate(date)} ${date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function safeText(v) {
  if (v === null || v === undefined) return '-';
  return String(v);
}

/**
 * Draw the report header (title + meta + business badge).
 */
function drawHeader(doc, { title, subtitle, business }) {
  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor(COLOR_PRIMARY)
    .text(title, PAGE_MARGIN, PAGE_MARGIN, {
      width: USABLE_WIDTH * 0.65,
    });

  if (subtitle) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COLOR_MUTED)
      .text(subtitle, PAGE_MARGIN, doc.y + 2, {
        width: USABLE_WIDTH * 0.65,
      });
  }

  // Right-side business / generated meta
  const rightX = PAGE_MARGIN + USABLE_WIDTH * 0.55;
  const rightW = USABLE_WIDTH * 0.45;
  let rightY = PAGE_MARGIN;
  if (business?.name) {
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COLOR_PRIMARY)
      .text(business.name, rightX, rightY, { width: rightW, align: 'right' });
    rightY = doc.y + 1;
  }
  if (business?.email) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLOR_MUTED)
      .text(business.email, rightX, rightY, { width: rightW, align: 'right' });
    rightY = doc.y + 1;
  }
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLOR_MUTED)
    .text(
      `Generated ${fmtDateTime(new Date())}`,
      rightX,
      rightY,
      { width: rightW, align: 'right' }
    );

  // Divider
  const dividerY = Math.max(doc.y, rightY) + 12;
  doc
    .moveTo(PAGE_MARGIN, dividerY)
    .lineTo(PAGE_MARGIN + USABLE_WIDTH, dividerY)
    .strokeColor(COLOR_BORDER)
    .lineWidth(1)
    .stroke();
  doc.y = dividerY + 12;
}

/**
 * Draw the KPI strip (a row of label + value tiles).
 */
function drawKpis(doc, kpis) {
  if (!Array.isArray(kpis) || kpis.length === 0) return;
  const tileWidth = USABLE_WIDTH / kpis.length;
  const top = doc.y;
  const tileHeight = 48;

  kpis.forEach((kpi, i) => {
    const x = PAGE_MARGIN + i * tileWidth;
    doc
      .roundedRect(x + 2, top, tileWidth - 4, tileHeight, 6)
      .fillColor('#f8fafc')
      .strokeColor(COLOR_BORDER)
      .lineWidth(0.5)
      .fillAndStroke();

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLOR_MUTED)
      .text(kpi.label, x + 10, top + 8, {
        width: tileWidth - 20,
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor(COLOR_PRIMARY)
      .text(kpi.value, x + 10, top + 22, {
        width: tileWidth - 20,
      });
  });

  doc.y = top + tileHeight + 14;
}

/**
 * Draw a table with auto-paging. Columns spec:
 *   { key, label, width, align?, format? }
 * width values are weights (proportions). They're rescaled to USABLE_WIDTH.
 */
function drawTable(doc, columns, rows, opts = {}) {
  const { emptyMessage = 'No records found.' } = opts;

  // Normalize column widths to fill usable width
  const totalWeight = columns.reduce((s, c) => s + (c.width || 1), 0);
  const widths = columns.map((c) => ((c.width || 1) / totalWeight) * USABLE_WIDTH);

  const drawHeaderRow = () => {
    const headerY = doc.y;
    const headerHeight = 22;
    doc
      .rect(PAGE_MARGIN, headerY, USABLE_WIDTH, headerHeight)
      .fillColor(COLOR_TABLE_HEADER_BG)
      .fill();

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(COLOR_PRIMARY);

    let cx = PAGE_MARGIN;
    columns.forEach((col, i) => {
      doc.text(col.label, cx + 6, headerY + 7, {
        width: widths[i] - 12,
        align: col.align || 'left',
      });
      cx += widths[i];
    });
    doc.y = headerY + headerHeight;
  };

  drawHeaderRow();

  if (!rows || rows.length === 0) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COLOR_MUTED)
      .text(emptyMessage, PAGE_MARGIN, doc.y + 16, {
        width: USABLE_WIDTH,
        align: 'center',
      });
    return;
  }

  // Compute heights upfront: pdfkit's heightOfString respects width + font.
  doc.font('Helvetica').fontSize(9).fillColor(COLOR_PRIMARY);

  rows.forEach((row, rowIdx) => {
    // Pre-compute the cell strings + the row height
    const cellStrings = columns.map((col) => {
      const raw = col.format ? col.format(row[col.key], row) : row[col.key];
      return safeText(raw);
    });

    // Measure max height
    let rowHeight = 18;
    cellStrings.forEach((s, i) => {
      const h = doc.heightOfString(s, {
        width: widths[i] - 12,
        align: columns[i].align || 'left',
      });
      if (h + 10 > rowHeight) rowHeight = h + 10;
    });

    // Page break: leave room for footer (page number)
    const bottomLimit = PAGE_HEIGHT - PAGE_MARGIN - 24;
    if (doc.y + rowHeight > bottomLimit) {
      doc.addPage();
      doc.y = PAGE_MARGIN;
      drawHeaderRow();
    }

    // Alternating row background
    if (rowIdx % 2 === 1) {
      doc
        .rect(PAGE_MARGIN, doc.y, USABLE_WIDTH, rowHeight)
        .fillColor(COLOR_TABLE_ALT_ROW)
        .fill();
    }

    const rowTop = doc.y;
    let cx = PAGE_MARGIN;
    doc.font('Helvetica').fontSize(9).fillColor(COLOR_PRIMARY);
    cellStrings.forEach((s, i) => {
      doc.text(s, cx + 6, rowTop + 6, {
        width: widths[i] - 12,
        align: columns[i].align || 'left',
      });
      cx += widths[i];
    });

    // Bottom border
    doc
      .moveTo(PAGE_MARGIN, rowTop + rowHeight)
      .lineTo(PAGE_MARGIN + USABLE_WIDTH, rowTop + rowHeight)
      .strokeColor(COLOR_BORDER)
      .lineWidth(0.5)
      .stroke();

    doc.y = rowTop + rowHeight;
  });
}

/**
 * Draw a totals row aligned to the right side of the table.
 */
function drawTotals(doc, totals) {
  if (!Array.isArray(totals) || totals.length === 0) return;
  doc.y += 10;
  const labelW = 160;
  const valueW = 140;
  const startX = PAGE_MARGIN + USABLE_WIDTH - labelW - valueW;

  totals.forEach((t, i) => {
    const isLast = i === totals.length - 1;
    const top = doc.y;
    if (isLast) {
      doc
        .moveTo(startX, top)
        .lineTo(startX + labelW + valueW, top)
        .strokeColor(COLOR_BORDER)
        .lineWidth(0.5)
        .stroke();
      doc.y = top + 4;
    }
    doc
      .font(isLast ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isLast ? 11 : 10)
      .fillColor(isLast ? COLOR_PRIMARY : COLOR_MUTED)
      .text(t.label, startX, doc.y, { width: labelW, align: 'right' });
    doc
      .font(isLast ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isLast ? 11 : 10)
      .fillColor(COLOR_PRIMARY)
      .text(t.value, startX + labelW, doc.y - (isLast ? 14 : 12), {
        width: valueW,
        align: 'right',
      });
    doc.y += 6;
  });
}

/**
 * After all content is written, paginate buffered pages and add page numbers.
 */
function paginateFooter(doc) {
  const range = doc.bufferedPageRange(); // { start, count }
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLOR_MUTED)
      .text(
        `Page ${i - range.start + 1} of ${range.count} · BizAutomate`,
        PAGE_MARGIN,
        PAGE_HEIGHT - PAGE_MARGIN + 10,
        { width: USABLE_WIDTH, align: 'center' }
      );
  }
}

/**
 * Stream a generic "tabular report" PDF.
 */
function streamPdfReport(res, opts) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: PAGE_MARGIN,
    bufferPages: true,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${(opts.filename || 'report.pdf').replace(
      /[^\w.-]+/g,
      '_'
    )}"`
  );

  doc.pipe(res);

  drawHeader(doc, opts);
  if (opts.kpis) drawKpis(doc, opts.kpis);
  drawTable(doc, opts.columns, opts.rows, { emptyMessage: opts.emptyMessage });
  if (opts.totals) drawTotals(doc, opts.totals);
  paginateFooter(doc);

  doc.end();
}

module.exports = {
  streamPdfReport,
  fmtINR,
  fmtDate,
  fmtDateTime,
  COLOR_PRIMARY,
  COLOR_MUTED,
  COLOR_BORDER,
  COLOR_ACCENT,
};
