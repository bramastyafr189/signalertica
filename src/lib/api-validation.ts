export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readJsonRecord(request: Request) {
  const body = await request.json().catch(() => null);
  return isRecord(body) ? body : null;
}

export function cleanString(value: unknown, maxLength = 160) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export function optionalCleanString(value: unknown, maxLength = 160) {
  if (value === undefined || value === null || value === '') return null;
  return cleanString(value, maxLength);
}

export function parsePositiveInteger(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
}

export function parseNonNegativeInteger(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(numeric) || numeric < 0) return null;
  return numeric;
}

export function parseOptionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

export function parseOptionalDate(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' && !(value instanceof Date)) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}
