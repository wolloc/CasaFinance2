type ProjectionInvoiceReviewIntent={invoiceId:string};
let pending:ProjectionInvoiceReviewIntent|null=null;
export function setProjectionInvoiceReviewIntent(intent:ProjectionInvoiceReviewIntent){pending=intent;}
export function consumeProjectionInvoiceReviewIntent(){const current=pending;pending=null;return current;}
