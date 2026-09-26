export type CardReviewIntent={cardId:string;source:'home-card'|'attention'};
let pending:CardReviewIntent|null=null;
export function setCardReviewIntent(intent:CardReviewIntent){pending=intent;}
export function consumeCardReviewIntent(){const current=pending;pending=null;return current;}
