import { PatrolLastOrder } from '../types/entities';

export type LastOrderAgeClass = 'normal' | 'warning' | 'danger';

/**
 * Classify last order age based on issuedAt timestamp.
 * - normal: <= 7 days
 * - warning: > 7 days and <= 30 days
 * - danger: > 30 days
 */
export function classifyLastOrderAge(
  lastOrder: Pick<PatrolLastOrder, 'issuedAt'>
): LastOrderAgeClass {
  const now = Date.now();
  const ageMs = now - lastOrder.issuedAt;
  const dayMs = 24 * 60 * 60 * 1000;
  if (ageMs > 30 * dayMs) return 'danger';
  if (ageMs > 7 * dayMs) return 'warning';
  return 'normal';
}
