export type ExpenseRecurrenceFrequency='weekly'|'monthly'|'yearly';

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

function anchoredOccurrence(start:DateParts,frequency:ExpenseRecurrenceFrequency,intervalCount:number,occurrence:number){
  if(frequency==='weekly'){
    const date=utcDate(start);
    date.setUTCDate(date.getUTCDate()+7*intervalCount*occurrence);
    return date;
  }
  if(frequency==='monthly'){
    const targetMonthIndex=start.month-1+intervalCount*occurrence;
    const targetYear=start.year+Math.floor(targetMonthIndex/12);
    const targetMonth=((targetMonthIndex%12)+12)%12+1;
    const lastDay=new Date(Date.UTC(targetYear,targetMonth,0)).getUTCDate();
    return new Date(Date.UTC(targetYear,targetMonth-1,Math.min(start.day,lastDay)));
  }
  const targetYear=start.year+intervalCount*occurrence;
  const lastDay=new Date(Date.UTC(targetYear,start.month,0)).getUTCDate();
  return new Date(Date.UTC(targetYear,start.month-1,Math.min(start.day,lastDay)));
}

export function minimumRecurringStartDate(transactionDate:string,today:string){
  const transaction=utcDate(parseIsoDate(transactionDate));
  const current=utcDate(parseIsoDate(today));
  const threshold=transaction>current?transaction:current;
  const minimum=new Date(threshold);
  minimum.setUTCDate(minimum.getUTCDate()+1);
  return formatUtcDate(minimum);
}

function nextOccurrenceIndex(start:DateParts,threshold:Date,frequency:ExpenseRecurrenceFrequency,intervalCount:number){
  const origin=utcDate(start);
  if(frequency==='weekly'){
    const elapsedDays=Math.floor((threshold.getTime()-origin.getTime())/(24*60*60*1000));
    return Math.max(1,Math.ceil(elapsedDays/(7*intervalCount)));
  }
  if(frequency==='monthly'){
    const elapsedMonths=(threshold.getUTCFullYear()-start.year)*12+(threshold.getUTCMonth()+1-start.month);
    return Math.max(1,Math.ceil(elapsedMonths/intervalCount));
  }
  const elapsedYears=threshold.getUTCFullYear()-start.year;
  return Math.max(1,Math.ceil(elapsedYears/intervalCount));
}

export function suggestRecurringStartDate(transactionDate:string,today:string,frequency:ExpenseRecurrenceFrequency,intervalCount:number){
  if(!Number.isInteger(intervalCount)||intervalCount<1)throw new Error('Intervalo de recorrência inválido.');
  const start=parseIsoDate(transactionDate);
  const threshold=utcDate(parseIsoDate(minimumRecurringStartDate(transactionDate,today)));
  const occurrence=nextOccurrenceIndex(start,threshold,frequency,intervalCount);
  const candidate=anchoredOccurrence(start,frequency,intervalCount,occurrence);
  return formatUtcDate(candidate>=threshold?candidate:anchoredOccurrence(start,frequency,intervalCount,occurrence+1));
}
