import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Building2, ChevronRight, CreditCard, HandCoins, Landmark, Settings, Tags, Users, Utensils, WalletCards } from 'lucide-react';
import type { Account, AccountType, Card, Category, User } from '../../types/index.js';
import { HouseholdCustomization } from '../household/HouseholdCustomization.js';
import { AccountsManager } from './AccountsManager.js';
import { CardsManager } from './CardsManager.js';
import { CategoriesManager } from './CategoriesManager.js';

interface Props { accounts: Account[]; cards: Card[]; categories: Category[]; householdId: string; currentUser: User; onRefresh: () => void; }
type Section = 'household'|'bank'|'cash'|'investment'|'benefit'|'cards'|'expense'|'income'|'preferences';
const sections: Array<{id: Section; label: string; description: string; icon: React.ComponentType<{className?: string}>}> = [
  {id:'household',label:'Casa e membros',description:'Nome, participantes e permissões',icon:Users},
  {id:'bank',label:'Contas bancárias',description:'Titular, instituição e identificação',icon:Landmark},
  {id:'cash',label:'Carteiras de dinheiro',description:'Carteiras físicas por titular',icon:WalletCards},
  {id:'investment',label:'Investimentos',description:'Instituição e tipo de investimento',icon:Building2},
  {id:'benefit',label:'VAs / benefícios',description:'Vales e benefícios por titular',icon:Utensils},
  {id:'cards',label:'Cartões de crédito',description:'Fechamento, vencimento e pagamento',icon:CreditCard},
  {id:'expense',label:'Categorias de despesas',description:'Classificações exclusivas de saída',icon:Tags},
  {id:'income',label:'Categorias de receitas',description:'Classificações exclusivas de entrada',icon:HandCoins},
  {id:'preferences',label:'Preferências gerais',description:'Moeda, fuso e comportamento do app',icon:Settings}
];
const accountConfig: Partial<Record<Section,{type:AccountType;title:string;description:string}>> = {
  bank:{type:'checking',title:'Contas bancárias',description:'Contas, Pix e débito identificados por titular.'}, cash:{type:'cash',title:'Carteiras de dinheiro',description:'Dinheiro em espécie, sem exibir valores.'}, investment:{type:'investment',title:'Investimentos',description:'Cadastros de investimento sem posição financeira.'}, benefit:{type:'meal_benefit',title:'VAs / benefícios',description:'Instrumentos de benefícios separados das contas.'}
};
export const SettingsAndHouseholdManager: React.FC<Props> = (props) => {
  const [active, setActive] = useState<Section | null>(null);
  const config = active ? accountConfig[active] : undefined;
  if (active) return <motion.div initial={{opacity:0,x:12}} animate={{opacity:1,x:0}} className="space-y-4 pb-20"><button onClick={()=>setActive(null)} className="min-h-11 text-sm font-bold text-blue-400">‹ Todos os ajustes</button><section className="rounded-3xl border border-slate-800 bg-slate-950 p-4">{active==='household'&&<HouseholdCustomization householdId={props.householdId} currentUser={props.currentUser} onRefresh={props.onRefresh}/>} {config&&<AccountsManager accounts={props.accounts} householdId={props.householdId} currentUser={props.currentUser} onRefresh={props.onRefresh} accountType={config.type} title={config.title} description={config.description}/>} {active==='cards'&&<CardsManager cards={props.cards} accounts={props.accounts} householdId={props.householdId} currentUser={props.currentUser} onRefresh={props.onRefresh}/>} {active==='expense'&&<CategoriesManager categories={props.categories} householdId={props.householdId} currentUser={props.currentUser} onRefresh={props.onRefresh} categoryType="expense"/>} {active==='income'&&<CategoriesManager categories={props.categories} householdId={props.householdId} currentUser={props.currentUser} onRefresh={props.onRefresh} categoryType="income"/>} {active==='preferences'&&<div><h2 className="font-bold">Preferências gerais</h2><p className="mt-2 text-sm text-slate-400">Moeda: Real brasileiro (BRL)</p><p className="text-sm text-slate-400">Fuso: America/Sao_Paulo</p></div>}</section></motion.div>;
  return <div id="settings-household-screen" className="space-y-5 pb-20"><header><h1 className="text-2xl font-black">Ajustes</h1><p className="text-xs text-slate-400">Cadastros e configurações da casa</p></header><aside className="rounded-2xl border border-blue-900/60 bg-blue-950/30 p-3 text-xs text-blue-200">Esta área não altera nem apresenta saldos, gastos, faturas ou totais. Valores financeiros ficam no Dashboard, Entradas e Despesas.</aside><nav aria-label="Catálogos financeiros" className="space-y-2">{sections.map(item=>{const Icon=item.icon;return <button key={item.id} onClick={()=>setActive(item.id)} className="w-full min-h-[68px] rounded-2xl border border-slate-800 bg-slate-900 p-3 flex items-center gap-3 text-left active:scale-[.99]"><span className="w-10 h-10 rounded-xl bg-slate-800 text-blue-400 flex items-center justify-center"><Icon className="w-5 h-5"/></span><span className="flex-1"><strong className="block text-sm">{item.label}</strong><small className="text-slate-400">{item.description}</small></span><ChevronRight className="w-4 h-4 text-slate-500"/></button>})}</nav></div>;
};
