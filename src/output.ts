export type OutputFormat = 'json' | 'jsonl' | 'table';

interface Envelope {
  data: unknown;
  next_page: unknown;
}

export function renderOutput(envelope: Envelope, format: OutputFormat): string {
  if (format === 'json') return JSON.stringify(envelope);
  const rows = Array.isArray(envelope.data) ? envelope.data : [envelope.data];
  if (format === 'jsonl')
    return rows.map((row) => JSON.stringify(row)).join('\n');
  if (rows.length === 0) return '';
  const records = rows as Array<Record<string, unknown>>;
  const columns = [...new Set(records.flatMap((row) => Object.keys(row)))];
  const widths = columns.map((column) =>
    Math.max(
      column.length,
      ...records.map((row) => String(row[column] ?? '').length),
    ),
  );
  const line = (row: Record<string, unknown>) =>
    columns
      .map((column, index) =>
        String(row[column] ?? '').padEnd(widths[index] ?? 0),
      )
      .join('  ')
      .trimEnd();
  return [
    line(Object.fromEntries(columns.map((column) => [column, column]))),
    ...records.map(line),
  ].join('\n');
}
