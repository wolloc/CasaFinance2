export type AllocationTarget = { memberId?: string; partyId?: string };
export type AllocationInput = AllocationTarget & { value: string };
export type EconomicAllocation = AllocationTarget & { amount: string; percentage: string };

function amountToCents(value: string): number {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Informe valores com no máximo duas casas decimais.');
  return Math.round(Number(normalized) * 100);
}

export function allocateEqually(total: string, targets: AllocationTarget[]): EconomicAllocation[] {
  const cents = amountToCents(total);
  if (cents <= 0 || targets.length === 0) throw new Error('Informe um valor e pelo menos um responsável.');
  const base = Math.floor(cents / targets.length);
  return allocationsFromCents(cents, targets.map((target, index) => ({ ...target, cents: base + (index < cents % targets.length ? 1 : 0) })));
}

export function allocateCustomAmounts(total: string, inputs: AllocationInput[]): EconomicAllocation[] {
  const totalCents = amountToCents(total);
  const allocated = inputs.map((input) => ({ ...input, cents: amountToCents(input.value) })).filter((input) => input.cents > 0);
  if (allocated.reduce((sum, input) => sum + input.cents, 0) !== totalCents) throw new Error('A divisão precisa fechar exatamente o valor do lançamento.');
  if (allocated.length === 0) throw new Error('Informe pelo menos um responsável.');
  return allocationsFromCents(totalCents, allocated);
}

function allocationsFromCents(totalCents: number, allocations: Array<AllocationTarget & { cents: number }>): EconomicAllocation[] {
  let assignedPercentage = 0;
  return allocations.map(({ cents, ...target }, index) => {
    const percentage = index === allocations.length - 1 ? 100 - assignedPercentage : Number(((cents * 100) / totalCents).toFixed(4));
    assignedPercentage += percentage;
    return { ...target, amount: (cents / 100).toFixed(2), percentage: percentage.toFixed(4) };
  });
}

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
