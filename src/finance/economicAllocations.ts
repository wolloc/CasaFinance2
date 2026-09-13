undefined
export function allocateProportionally(total: string, source: EconomicAllocation[]): EconomicAllocation[] {
  const totalCents = amountToCents(total);
  if (totalCents <= 0) return [];
  const weights = source.map((allocation, index) => ({ allocation, index, cents: amountToCents(allocation.amount) })).filter((row) => row.cents > 0);
  const weightTotal = weights.reduce((sum, row) => sum + row.cents, 0);
  if (weightTotal <= 0) throw new Error('Informe pelo menos uma responsabilidade econômica positiva.');
  const raw = weights.map((row) => {
    const exact = totalCents * row.cents / weightTotal;
    const base = Math.floor(exact);
    return { ...row, base, fraction: exact - base };
  });
  let remainder = totalCents - raw.reduce((sum, row) => sum + row.base, 0);
  const priority = [...raw].sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  const assigned = new Map(raw.map((row) => [row.index, row.base]));
  for (let index = 0; remainder > 0; index += 1) {
    const row = priority[index % priority.length];
    assigned.set(row.index, (assigned.get(row.index) ?? 0) + 1);
    remainder -= 1;
  }
  return allocationsFromCents(totalCents, raw
    .map((row) => ({ ...row.allocation, cents: assigned.get(row.index) ?? 0 }))
    .filter((row) => row.cents > 0));
}
