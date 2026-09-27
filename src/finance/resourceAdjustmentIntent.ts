export type ResourceAdjustmentIntent={kind:'transfer'|'reserve'|'loan';accountId:string};
let pending:ResourceAdjustmentIntent|null=null;

// Ephemeral navigation context only. It never records or mutates a financial fact.
export function setResourceAdjustmentIntent(intent:ResourceAdjustmentIntent){pending=intent;}
export function consumeResourceAdjustmentIntent(){const current=pending;pending=null;return current;}
