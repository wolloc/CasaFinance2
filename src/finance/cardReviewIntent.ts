type CardReviewIntent={cardId:string};
let pending:CardReviewIntent|null=null;
export function setCardReviewIntent(intent:CardReviewIntent){pending=intent;}
export function consumeCardReviewIntent(){const current=pending;pending=null;return current;}
