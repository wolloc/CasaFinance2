import { LoaderCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { recordOpeningCardBalance, recordOpeningCardPurchase, type HouseholdCard } from '../../finance/householdFinancialAccounts.js';
import { supabase } from '../../lib/supabase.js';

type Member = { id: string; display_name: string };

export function OpeningCardCommitmentsModal({
  householdId, card, members, trackingStartedOn, defaultMemberId, onClose, onSaved,
}: {
  householdId: string;
  card: HouseholdCard;
  members: Member[];
  trackingStartedOn: string | null;
  defaultMemberId: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<'detailed' | 'aggregate'>('detailed');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestKey] = useState(() => crypto.randomUUID());
  const [detailed, setDetailed] = useState({
    description: '', originalPurchaseDate: '', amount: '', buyerMemberId: defaultMemberId,
    responsibleMemberId: defaultMemberId, installmentCount: '1', paidInstallmentCount: '0',
  });
  const [aggregate, setAggregate] = useState({ description: 'Compromissos anteriores ao início do controle', amount: '' });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    if (!trackingStartedOn) {
      setError('Primeiro informe a data em que você começou a acompanhar a vida financeira da Casa ao cadastrar uma conta, carteira, benefício ou investimento.');
      return;
    }
    setSaving(true); setError(null);
    try {
      if (mode === 'aggregate') {
        await recordOpeningCardBalance(supabase, householdId, {
          cardId: card.id, amount: aggregate.amount, description: aggregate.description, requestKey,
        });
        await onSaved('O valor em aberto foi registrado como posição inicial do cartão. Ele não virou uma nova despesa.');
      } else {
        if (detailed.originalPurchaseDate >= trackingStartedOn) {
          throw new Error('A data da compra precisa ser anterior ao início do controle financeiro.');
        }
        if (Number(detailed.paidInstallmentCount) >= Number(detailed.installmentCount)) {
          throw new Error('Informe apenas compras que ainda tenham pelo menos uma parcela em aberto.');
        }
        await recordOpeningCardPurchase(supabase, householdId, {
          cardId: card.id,
          description: detailed.description,
          originalPurchaseDate: detailed.originalPurchaseDate,
          amount: detailed.amount,
          buyerMemberId: detailed.buyerMemberId,
          responsibleMemberId: detailed.responsibleMemberId,
          installmentCount: Number(detailed.installmentCount),
          paidInstallmentCount: Number(detailed.paidInstallmentCount),
          requestKey,
        });
        await onSaved('A compra anterior foi registrada uma única vez. Só as parcelas ainda abertas passam a aparecer nas faturas.');
      }
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Não foi possível registrar os compromissos anteriores. Confira os dados e tente novamente.');
    } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/70 p-4 sm:items-center">
    <form onSubmit={submit} className="max-h-[92dvh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100">
      <div><h2 className="text-lg font-bold">Compras que já existiam no {card.name}</h2><p className="mt-1 text-sm text-slate-400">Isso registra a situação encontrada quando você começou a usar o Casa. Não é uma compra nem um pagamento novo.</p></div>
      <fieldset className="grid grid-cols-2 gap-2"><label className={`rounded-xl border p-3 text-sm ${mode==='detailed'?'border-blue-500 bg-blue-950/30':'border-slate-700'}`}><input className="mr-2" type="radio" checked={mode==='detailed'} onChange={() => setMode('detailed')} />Detalhar compra</label><label className={`rounded-xl border p-3 text-sm ${mode==='aggregate'?'border-blue-500 bg-blue-950/30':'border-slate-700'}`}><input className="mr-2" type="radio" checked={mode==='aggregate'} onChange={() => setMode('aggregate')} />Só valor em aberto</label></fieldset>
      {mode==='aggregate' ? <><Field label="Descrição" value={aggregate.description} onChange={(value) => setAggregate({ ...aggregate, description: value })} required /><Field label="Quanto está em aberto neste cartão?" value={aggregate.amount} onChange={(value) => setAggregate({ ...aggregate, amount: value })} type="number" min="0.01" step="0.01" required /><p className="rounded-xl bg-slate-950 p-3 text-xs text-slate-400">Use esta opção se não conseguir detalhar as compras antigas. O Casa não inventará quem comprou, categoria ou responsabilidade.</p></> : <><Field label="Descrição da compra" value={detailed.description} onChange={(value) => setDetailed({ ...detailed, description: value })} required /><Field label="Data original da compra" value={detailed.originalPurchaseDate} onChange={(value) => setDetailed({ ...detailed, originalPurchaseDate: value })} type="date" max={trackingStartedOn ?? undefined} required /><Field label="Valor original da compra" value={detailed.amount} onChange={(value) => setDetailed({ ...detailed, amount: value })} type="number" min="0.01" step="0.01" required /><MemberSelect label="Quem fez a compra?" value={detailed.buyerMemberId} members={members} onChange={(value) => setDetailed({ ...detailed, buyerMemberId: value })} /><MemberSelect label="Quem fica responsável economicamente?" value={detailed.responsibleMemberId} members={members} onChange={(value) => setDetailed({ ...detailed, responsibleMemberId: value })} /><div className="grid grid-cols-2 gap-3"><Field label="Parcelas no total" value={detailed.installmentCount} onChange={(value) => setDetailed({ ...detailed, installmentCount: value })} type="number" min="1" step="1" required /><Field label="Já pagas antes" value={detailed.paidInstallmentCount} onChange={(value) => setDetailed({ ...detailed, paidInstallmentCount: value })} type="number" min="0" step="1" required /></div><p className="rounded-xl bg-slate-950 p-3 text-xs text-slate-400">A categoria é opcional e pode ser organizada depois. A compra é histórica: o Casa mostrará somente as parcelas que ainda faltam, sem registrar uma nova despesa hoje.</p></>}
      {error && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p>}
      <div className="flex gap-3 pt-2"><button type="button" onClick={onClose} disabled={saving} className="min-h-11 flex-1 rounded-xl border border-slate-700 font-semibold">Cancelar</button><button type="submit" disabled={saving || !trackingStartedOn} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold disabled:opacity-60">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}Salvar posição inicial</button></div>
    </form>
  </div>;
}

function Field({ label, value, onChange, ...props }: { label: string; value: string; onChange: (value: string) => void; [key: string]: unknown }) { return <label className="block text-sm text-slate-300">{label}<input {...props} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3" /></label>; }
function MemberSelect({ label, value, members, onChange }: { label: string; value: string; members: Member[]; onChange: (value: string) => void }) { return <label className="block text-sm text-slate-300">{label}<select required value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3">{members.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>; }
