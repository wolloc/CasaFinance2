export type ProjectionIncomeReviewIntent={moneyMovementId:string};
let pending:ProjectionIncomeReviewIntent|null=null;
export function setProjectionIncomeReviewIntent(intent:ProjectionIncomeReviewIntent){pending=intent;}
export function consumeProjectionIncomeReviewIntent(){const current=pending;pending=null;return current;}
