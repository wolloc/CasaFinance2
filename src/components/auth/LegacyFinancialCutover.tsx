import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { reconcileExistingHouseholdAccounts, type AccountOwnership, type HouseholdAccount, type HouseholdAccountType } from '../../finance/householdFinancialAccounts.js';
import { supabase } from '../../lib/supabase.js';

type Member = { id: string; display_name: string };
type AccountDraft = { balance: string; ownerChoice: string };

const accountLabels: Record<HouseholdAccountType, string> = {
  cash: 'Dinheiro',
  checking: 'Conta corrente',
  savings: 'Poupança',
  investment: 'Investimento',
  meal_benefit: 'Vale/benefício',
  digital_wallet: 'Carteira digital',
};
const financialToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
};
const sharedOwnerChoice = '__shared__';

export function LegacyFinancialCutover({
  householdId,
  accounts,
  members,
  accountOwnerships,
  defaultMemberId,
  onSaved,
}: {
  householdId: string;
  accounts: HouseholdAccount[];
  members: Member[];
  accountOwnerships: AccountOwnership[];
  defaultMemberId: string;
  onSaved: (message: string) => Promise<void>;
}) {
  const [startedOn, setStartedOn] = useState(financialToday());
  const [drafts, setDrafts] = useState<Record<string, AccountDraft>>(() => Object.fromEntries(accounts.map((account) => {
    const canonicalOwners = accountOwnerships.filter((ownership) => ownership.account_id === account.id).map((ownership) => ownership.member_id);
    const legacyOwnerIsActive = members.some((member) => member.id === account.owner_member_id);
    const ownerChoice = canonicalOwners.length === 2 && members.length === 2
      ? sharedOwnerChoice
      : canonicalOwners[0] ?? (legacyOwnerIsActive ? account.owner_member_id : null) ?? defaultMemberId ?? members[0]?.id ?? '';
    return [account.id, { balance: '', ownerChoice }];
  })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || saving) return;
    const missingBalance = accounts.some((account) => !drafts[account.id]?.balance.trim());
    if (missingBalance) {
      setError('Informe o saldo de todas as contas. Use 0 quando não havia saldo.');
      return;
    }
    if (!startedOn) {
      setError('Informe a data de início do controle financeiro.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await reconcileExistingHouseholdAccounts(supabase, householdId, {
        startedOn,
        accounts: accounts.map((account) => {
          const draft = drafts[account.id];
          const ownerMemberIds = draft.ownerChoice === sharedOwnerChoice
            ? members.slice(0, 2).map((member) => member.id)
            : [draft.ownerChoice];
          return { accountId: account.id, openingAmount: draft.balance, ownerMemberIds };
        }),
      });
      await onSaved('Posição inicial confirmada. O Casa passou a considerar essa data como o início do controle, sem transformar saldos anteriores em renda ou despesa nova.');
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : '';
      setError(message.startsWith('Não foi possível confirmar a resposta do Casa')
        ? 'Não foi possível confirmar a resposta do Casa. Mantenha os mesmos valores e tente novamente; o Casa reutilizará a mesma operação para evitar duplicidade.'
        : 'Não foi possível confirmar a posição inicial. Nenhum saldo deve ser recadastrado em outra conta; confira os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return <section className="rounded-2xl border border-amber-700 bg-amber-950/20 p-4 text-slate-100">
    <div className="flex items-start gap-3">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
      <div>
        <h2 className="font-bold">Confirme o ponto de partida das suas contas</h2>
        <p className="mt-1 text-sm leading-6 text-slate-300">Estas contas já existiam no Casa antes da nova posição inicial. Para continuar sem transformar o passado em renda ou gasto novo, confirme quanto havia em cada uma no início da data escolhida e quem é titular.</p>
      </div>
    </div>
    <form onSubmit={submit} className="mt-4 space-y-4">
      <label className="block text-sm text-slate-300">A partir de que data o Casa passa a valer como seu controle financeiro?
        <input required type="date" value={startedOn} max={financialToday()} onChange={(event) => setStartedOn(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-900 p-3" />
      </label>
      <p className="rounded-xl bg-slate-950/70 p-3 text-xs leading-5 text-slate-400">O saldo informado abaixo é o saldo no início desse dia. Movimentos registrados nessa data e depois dela continuam valendo normalmente.</p>
      <div className="space-y-3">
        {accounts.map((account) => {
          const draft = drafts[account.id] ?? { balance: '', ownerChoice: defaultMemberId };
          return <article key={account.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h3 className="font-bold">{account.name}</h3>
            <p className="mt-1 text-xs text-slate-500">{accountLabels[account.type]}{account.institution ? ` · ${account.institution}` : ''}</p>
            <label className="mt-3 block text-sm text-slate-300">Quanto havia nesta conta no início desse dia?
              <input required type="number" step="0.01" value={draft.balance} onChange={(event) => setDrafts((current) => ({ ...current, [account.id]: { ...draft, balance: event.target.value } }))} placeholder="0,00" className="mt-1 min-h-11 w-full rounded-xl bg-slate-950 p-3" />
            </label>
            <label className="mt-3 block text-sm text-slate-300">De quem é esta conta?
              <select required value={draft.ownerChoice} onChange={(event) => setDrafts((current) => ({ ...current, [account.id]: { ...draft, ownerChoice: event.target.value } }))} className="mt-1 min-h-11 w-full rounded-xl bg-slate-950 p-3">
                {members.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}
                {members.length === 2 && <option value={sharedOwnerChoice}>Compartilhada entre {members[0].display_name} e {members[1].display_name}</option>}
              </select>
            </label>
          </article>;
        })}
      </div>
      <p className="rounded-xl bg-slate-950/70 p-3 text-xs leading-5 text-slate-400">O Casa não copiará automaticamente o saldo antigo cadastrado. Os valores acima viram apenas a posição inicial auditável; não criam salário, renda, despesa, pagamento ou movimentação de caixa.</p>
      {error && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p>}
      <button type="submit" disabled={saving || members.length === 0} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 font-bold text-white disabled:opacity-60">
        {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
        Confirmar posição inicial
      </button>
    </form>
  </section>;
}
