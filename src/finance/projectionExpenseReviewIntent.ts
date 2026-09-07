export type ProjectionExpenseReviewIntent={commitmentKey:string};
let pending:ProjectionExpenseReviewIntent|null=null;
export function setProjectionExpenseReviewIntent(intent:ProjectionExpenseReviewIntent){pending=intent;}
export function consumeProjectionExpenseReviewIntent(){const current=pending;pending=null;return current;}
