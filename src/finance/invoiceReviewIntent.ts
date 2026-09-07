export type InvoiceReviewIntent = { invoiceId: string };
let pendingIntent: InvoiceReviewIntent | null = null;
export function setInvoiceReviewIntent(intent: InvoiceReviewIntent){ pendingIntent=intent; }
export function consumeInvoiceReviewIntent(){ const intent=pendingIntent; pendingIntent=null; return intent; }
