export const DEFAULT_HOUSEHOLD_TIMEZONE = 'America/Sao_Paulo';

export function dateInTimeZone(timeZone:string,date:Date=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const year=parts.find(part=>part.type==='year')?.value??'';
  const month=parts.find(part=>part.type==='month')?.value??'';
  const day=parts.find(part=>part.type==='day')?.value??'';
  return `${year}-${month}-${day}`;
}

export function monthStartInTimeZone(timeZone:string,date:Date=new Date()){
  return `${dateInTimeZone(timeZone,date).slice(0,7)}-01`;
}
