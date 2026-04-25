function escapeCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Build a CSV string from headers + rows.
 * @param {string[]} headers - column titles
 * @param {Array<Array<*>>} rows - 2D array of values; each inner array length === headers.length
 * @returns {string}
 */
function buildCsv(headers, rows) {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  // Excel-friendly: prepend BOM so Indian rupee + non-ASCII render correctly
  return '\ufeff' + lines.join('\n');
}

/**
 * Send a CSV download response.
 */
function sendCsv(res, filename, headers, rows) {
  const body = buildCsv(headers, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename.replace(/[^\w.-]+/g, '_')}"`
  );
  res.send(body);
}

function isoDate(d) {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}

function isoDateTime(d) {
  if (!d) return '';
  return new Date(d).toISOString();
}

module.exports = { escapeCell, buildCsv, sendCsv, isoDate, isoDateTime };
