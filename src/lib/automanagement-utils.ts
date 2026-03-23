// Safe number parser: handles strings, nulls, empty strings from Lovable migration
export function safeNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(num) ? null : num;
}

export function formatPrice(value: number | string | null | undefined): string {
  const num = safeNum(value);
  if (num === null) return '-';
  const abs = Math.abs(num);
  if (abs >= 10000) return num.toFixed(1);
  if (abs >= 1000) return num.toFixed(1);
  if (abs >= 100) return num.toFixed(2);
  if (abs >= 1) return num.toFixed(4);
  return num.toFixed(6);
}

export function formatCloseReason(reason: string | null | undefined): string {
  if (!reason) return '';
  switch (reason) {
    case 'BREAKEVEN': return 'Voltou ao Breakeven';
    case 'TP3': return 'Alvo TP3 atingido';
    case 'SL': return 'Stop Loss atingido';
    case 'MANUAL': return 'Fechamento manual';
    default: return reason;
  }
}
