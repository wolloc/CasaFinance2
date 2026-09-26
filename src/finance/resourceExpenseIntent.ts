export type ResourceExpenseIntent={accountId:string};
let pending:ResourceExpenseIntent|null=null;

// Ephemeral navigation context only. The expense is created only after explicit confirmation.
export function setResourceExpenseIntent(intent:ResourceExpenseIntent){pending=intent;}
export function consumeResourceExpenseIntent(){const current=pending;pending=null;return current;}
