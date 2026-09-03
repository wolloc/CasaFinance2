import type { Session, SupabaseClient } from '@supabase/supabase-js';

export type BootstrapHouseholdResult = {
  householdId: string;
  householdName: string;
  alreadyExisted: boolean;
};

type HouseholdRow = { id: string; name: string };
type MembershipRow = { household_id: string; profile_id: string };

export async function findExistingHousehold(client: SupabaseClient, session: Session) {
  const userId = session.user.id;
  const membershipResponse = await client.from('household_members')
    .select('household_id, profile_id').eq('profile_id', userId).is('deactivated_at', null).limit(1).maybeSingle();
  if (membershipResponse.error) throw membershipResponse.error;
  if (!membershipResponse.data) return null;
  if ((membershipResponse.data as MembershipRow).profile_id !== userId) throw new Error('A associação retornada não pertence à sessão atual.');

  const householdResponse = await client.from('households')
    .select('id, name').eq('id', membershipResponse.data.household_id).maybeSingle();
  if (householdResponse.error) throw householdResponse.error;
  return householdResponse.data as HouseholdRow | null;
}

export async function bootstrapHousehold(
  client: SupabaseClient,
  session: Session | null,
  householdName: string,
  displayName: string,
): Promise<BootstrapHouseholdResult> {
  if (!session?.user.id) throw new Error('Sessão expirada. Entre novamente para continuar.');

  const existingHousehold = await findExistingHousehold(client, session);
  if (existingHousehold) return { householdId: existingHousehold.id, householdName: existingHousehold.name, alreadyExisted: true };

  const profileResponse = await client.from('profiles').update({ display_name: displayName.trim() }).eq('id', session.user.id);
  if (profileResponse.error) throw profileResponse.error;

  const rpcResponse = await client.rpc('bootstrap_household', {
    household_name: householdName.trim(), household_currency: 'BRL', household_timezone: 'America/Sao_Paulo',
  }) as { data: HouseholdRow | HouseholdRow[] | null; error: Error | null };

  if (rpcResponse.error) {
    const householdAfterError = await findExistingHousehold(client, session);
    if (householdAfterError) return { householdId: householdAfterError.id, householdName: householdAfterError.name, alreadyExisted: true };
    throw rpcResponse.error;
  }

  const rpcHousehold = Array.isArray(rpcResponse.data) ? rpcResponse.data[0] : rpcResponse.data;
  const confirmedHousehold = await findExistingHousehold(client, session);
  if (!confirmedHousehold || !rpcHousehold) throw new Error('A Casa foi criada, mas a associação não pôde ser confirmada.');
  return { householdId: confirmedHousehold.id, householdName: confirmedHousehold.name, alreadyExisted: false };
}