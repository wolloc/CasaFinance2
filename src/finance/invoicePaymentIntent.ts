export type InvoicePaymentIntent={invoiceId:string;suggestedAmount:number;};
const KEY='casa-finance:invoice-payment-intent';
export function setInvoicePaymentIntent(intent:InvoicePaymentIntent){sessionStorage.setItem(KEY,JSON.stringify(intent));}
export function consumeInvoicePaymentIntent():InvoicePaymentIntent|null{const raw=sessionStorage.getItem(KEY);if(!raw)return null;sessionStorage.removeItem(KEY);try{const parsed=JSON.parse(raw)as InvoicePaymentIntent;if(!parsed.invoiceId||!Number.isFinite(parsed.suggestedAmount)||parsed.suggestedAmount<=0)return null;return parsed;}catch{return null;}}
