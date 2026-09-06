export type CoverageActionKind = 'transfer' | 'reserve' | 'loan';

export type CoverageActionIntent = {
  kind: CoverageActionKind;
  suggestedAmount: number;
};

// Ephemeral navigation intent only. It never represents a financial fact.
let pendingIntent: CoverageActionIntent | null = null;

export function setCoverageActionIntent(intent: CoverageActionIntent) {
  pendingIntent = intent;
}

export function consumeCoverageActionIntent() {
  const intent = pendingIntent;
  pendingIntent = null;
  return intent;
}
