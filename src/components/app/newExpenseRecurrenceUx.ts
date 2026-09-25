type DateParts={year:number;month:number;day:number};

function parseIsoDate(value:string):DateParts{
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if(!match)throw new Error('Data de recorrência inválida.');
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();
  if(month<1||month>12||day<1||day>lastDay)throw new Error('Data de recorrência inválida.');
  return{year,month,day};
}

function formatUtcDate(date:Date){
  return date.toISOString().slice(0,10);
}

function utcDate(parts:DateParts){
  return new Date(Date.UTC(parts.year,parts.month-1,parts.day));
}

function anchoredMonthlyOccurrence(start:DateParts,occurrence:number){
  const targetMonthIndex=start.month-1+occurrence;
  const targetYear=start.year+Math.floor(targetMonthIndex/12);
  const targetMonth=((targetMonthIndex%12)+12)%12+1;
  const lastDay=new Date(Date.UTC(targetYear,targetMonth,0)).getUTCDate();
  return new Date(Date.UTC(targetYear,targetMonth-1,Math.min(start.day,lastDay)));
}

export function minimumRecurringStartDate(transactionDate:string,today:string){
  const transaction=utcDate(parseIsoDate(transactionDate));
  const current=utcDate(parseIsoDate(today));
  const threshold=transaction>current?transaction:current;
  const minimum=new Date(threshold);
  minimum.setUTCDate(minimum.getUTCDate()+1);
  return formatUtcDate(minimum);
}

function nextMonthlyOccurrenceIndex(start:DateParts,threshold:Date){
  const elapsedMonths=(threshold.getUTCFullYear()-start.year)*12+(threshold.getUTCMonth()+1-start.month);
  return Math.max(1,elapsedMonths);
}

export function suggestRecurringStartDate(transactionDate:string,today:string){
  const start=parseIsoDate(transactionDate);
  const threshold=utcDate(parseIsoDate(minimumRecurringStartDate(transactionDate,today)));
  const occurrence=nextMonthlyOccurrenceIndex(start,threshold);
  const candidate=anchoredMonthlyOccurrence(start,occurrence);
  return formatUtcDate(candidate>=threshold?candidate:anchoredMonthlyOccurrence(start,occurrence+1));
}
