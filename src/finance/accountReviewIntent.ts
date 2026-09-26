export type AccountReviewIntent={accountId:string;source:'overdraft'|'resource-edit'};
let pending:AccountReviewIntent|null=null;
export function setAccountReviewIntent(intent:AccountReviewIntent){pending=intent;}
export function consumeAccountReviewIntent(){const current=pending;pending=null;return current;}
