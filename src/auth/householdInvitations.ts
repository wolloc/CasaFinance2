import type { Session, SupabaseClient } from '@supabase/supabase-js';

export type HouseholdInvitation = {
  invitationId: string;
  householdId: string;
  token: string;
  expiresAt: string;
};

export type AcceptInvitationResult = {
  status: 'accepted' | 'already_member';
  householdId: string;
};

export type HouseholdInvitationPreview = {
  householdName: string;
  expiresAt: string;
};

type RpcRow = Record<string, string>;

export function normalizeInvitationToken(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return url.searchParams.get('invitation')?.trim()
      ?? url.searchParams.get('invite')?.trim()
      ?? trimmed;
  } catch {
    return trimmed;
  }
}

export function invitationTokenFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  return params.get('invitation')?.trim() ?? params.get('invite')?.trim() ?? '';
}

export async function previewHouseholdInvitation(
  client: SupabaseClient,
  session: Session | null,
  token: string,
): Promise<HouseholdInvitationPreview> {
  if (!session?.user.id) throw new Error('Sessão expirada. Entre novamente para continuar.');
  const response = await client.rpc('preview_household_invitation', {
    invitation_token: normalizeInvitationToken(token),
  }) as { data: RpcRow | RpcRow[] | null; error: Error | null };
  if (response.error) throw response.error;
  const row = firstRow(response.data);
  if (!row?.household_name || !row.expires_at) throw new Error('invitation is invalid');
  return { householdName: row.household_name, expiresAt: row.expires_at };
}

function firstRow(data: RpcRow | RpcRow[] | null): RpcRow | null {
  return Array.isArray(data) ? data[0] ?? null : data;
}

export async function createHouseholdInvitation(
  client: SupabaseClient,
  session: Session | null,
  invitedEmail?: string,
): Promise<HouseholdInvitation> {
  if (!session?.user.id) throw new Error('Sessão expirada. Entre novamente para continuar.');
  const response = await client.rpc('create_household_invitation', {
    invited_email: invitedEmail?.trim() || null,
  }) as { data: RpcRow | RpcRow[] | null; error: Error | null };
  if (response.error) throw response.error;
  const row = firstRow(response.data);
  if (!row) throw new Error('O convite não pôde ser criado.');
  return {
    invitationId: row.invitation_id,
    householdId: row.household_id,
    token: row.token,
    expiresAt: row.expires_at,
  };
}

export async function acceptHouseholdInvitation(
  client: SupabaseClient,
  session: Session | null,
  token: string,
): Promise<AcceptInvitationResult> {
  if (!session?.user.id) throw new Error('Sessão expirada. Entre novamente para continuar.');
  const response = await client.rpc('accept_household_invitation', {
    invitation_token: normalizeInvitationToken(token),
  }) as { data: RpcRow | RpcRow[] | null; error: Error | null };
  if (response.error) throw response.error;
  const row = firstRow(response.data);
  if (!row || !['accepted', 'already_member'].includes(row.status)) {
    throw new Error('O convite não pôde ser confirmado.');
  }
  return { status: row.status as AcceptInvitationResult['status'], householdId: row.household_id };
}

export function friendlyInvitationError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('expired')) return 'Este convite expirou. Peça um novo convite ao proprietário.';
  if (message.includes('already been used')) return 'Este convite já foi utilizado.';
  if (message.includes('another household')) return 'Você já pertence a outra Casa.';
  if (message.includes('email does not match')) return 'O convite foi destinado a outro e-mail.';
  if (message.includes('member limit')) return 'Esta Casa já atingiu o limite de dois membros.';
  if (message.includes('only an active household owner')) return 'Somente o proprietário pode gerar convites.';
  if (message.includes('authentication required') || message.includes('sessão')) return 'Sua sessão expirou. Entre novamente.';
  if (message.includes('invalid')) return 'Convite inválido. Confira o código ou link enviado.';
  return 'Não foi possível processar o convite agora. Tente novamente.';
}
