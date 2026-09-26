import {
  Baby,
  Banknote,
  Bike,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Bus,
  Car,
  CircleDollarSign,
  Coffee,
  Dumbbell,
  FolderHeart,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Music2,
  PawPrint,
  PiggyBank,
  Plane,
  ReceiptText,
  Shirt,
  ShoppingBasket,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  Utensils,
  WalletCards,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

type CategoryVisualInput = {
  name?: string | null;
  type?: 'income' | 'expense' | string | null;
  icon?: string | null;
  color?: string | null;
};

const icons: Record<string, LucideIcon> = {
  tag: Tag,
  'folder-heart': FolderHeart,
  folderheart: FolderHeart,
  'shopping-basket': ShoppingBasket,
  shoppingbasket: ShoppingBasket,
  'shopping-cart': ShoppingCart,
  shoppingcart: ShoppingCart,
  utensils: Utensils,
  home: Home,
  car: Car,
  bus: Bus,
  bike: Bike,
  'heart-pulse': HeartPulse,
  heartpulse: HeartPulse,
  'graduation-cap': GraduationCap,
  graduationcap: GraduationCap,
  plane: Plane,
  gift: Gift,
  'briefcase-business': BriefcaseBusiness,
  briefcasebusiness: BriefcaseBusiness,
  banknote: Banknote,
  'circle-dollar-sign': CircleDollarSign,
  circledollarsign: CircleDollarSign,
  'wallet-cards': WalletCards,
  walletcards: WalletCards,
  coffee: Coffee,
  dumbbell: Dumbbell,
  gamepad: Gamepad2,
  'paw-print': PawPrint,
  pawprint: PawPrint,
  shirt: Shirt,
  smartphone: Smartphone,
  wrench: Wrench,
  baby: Baby,
  'book-open': BookOpen,
  bookopen: BookOpen,
  music: Music2,
  zap: Zap,
  'receipt-text': ReceiptText,
  receipttext: ReceiptText,
  building: Building2,
  'piggy-bank': PiggyBank,
  piggybank: PiggyBank,
  sparkles: Sparkles,
};

export const CATEGORY_ICON_OPTIONS: Array<{name:string;label:string;Icon:LucideIcon}> = [
  {name:'sparkles',label:'Geral',Icon:Sparkles},
  {name:'shopping-basket',label:'Mercado',Icon:ShoppingBasket},
  {name:'utensils',label:'Restaurante',Icon:Utensils},
  {name:'home',label:'Casa',Icon:Home},
  {name:'car',label:'Carro',Icon:Car},
  {name:'bus',label:'Transporte',Icon:Bus},
  {name:'heart-pulse',label:'Saúde',Icon:HeartPulse},
  {name:'graduation-cap',label:'Educação',Icon:GraduationCap},
  {name:'plane',label:'Viagem',Icon:Plane},
  {name:'gift',label:'Presente',Icon:Gift},
  {name:'briefcase-business',label:'Trabalho',Icon:BriefcaseBusiness},
  {name:'banknote',label:'Renda',Icon:Banknote},
  {name:'piggy-bank',label:'Reserva',Icon:PiggyBank},
  {name:'coffee',label:'Café',Icon:Coffee},
  {name:'dumbbell',label:'Academia',Icon:Dumbbell},
  {name:'gamepad',label:'Lazer',Icon:Gamepad2},
  {name:'paw-print',label:'Pet',Icon:PawPrint},
  {name:'shirt',label:'Roupas',Icon:Shirt},
  {name:'smartphone',label:'Tecnologia',Icon:Smartphone},
  {name:'wrench',label:'Manutenção',Icon:Wrench},
  {name:'baby',label:'Família',Icon:Baby},
  {name:'book-open',label:'Leitura',Icon:BookOpen},
  {name:'music',label:'Música',Icon:Music2},
  {name:'zap',label:'Energia',Icon:Zap},
  {name:'receipt-text',label:'Contas',Icon:ReceiptText},
  {name:'building',label:'Imóvel',Icon:Building2},
  {name:'circle-dollar-sign',label:'Financeiro',Icon:CircleDollarSign},
];

export const CATEGORY_COLOR_OPTIONS = [
  '#60a5fa',
  '#34d399',
  '#f472b6',
  '#fb7185',
  '#f59e0b',
  '#a78bfa',
  '#22d3ee',
  '#94a3b8',
] as const;

const inferredIconName = (category: CategoryVisualInput) => {
  const name=(category.name??'').toLocaleLowerCase('pt-BR');
  if(/mercado|supermerc|aliment|comida/.test(name))return 'shopping-basket';
  if(/restaurante|lanche|delivery/.test(name))return 'utensils';
  if(/moradia|casa|aluguel|condom/.test(name))return 'home';
  if(/carro|combust|transporte|uber|99/.test(name))return 'car';
  if(/saúde|saude|farm|méd|med/.test(name))return 'heart-pulse';
  if(/educa|curso|faculdade|escola|livro/.test(name))return 'graduation-cap';
  if(/viagem|férias|ferias|passagem/.test(name))return 'plane';
  if(/presente|gift/.test(name))return 'gift';
  if(/salário|salario|trabalho|freela|freelance/.test(name))return 'briefcase-business';
  if(/rendimento|juros|invest/.test(name))return 'banknote';
  if(/pet|cachorro|gato/.test(name))return 'paw-print';
  if(/academia|treino|esporte/.test(name))return 'dumbbell';
  if(/lazer|jogo|game/.test(name))return 'gamepad';
  if(/telefone|celular|internet|streaming/.test(name))return 'smartphone';
  if(/luz|energia|elétrica|eletrica/.test(name))return 'zap';
  return category.type==='income'?'folder-heart':'tag';
};

export function getCategoryVisual(category: CategoryVisualInput) {
  const stored=(category.icon??'').trim().toLocaleLowerCase('en-US');
  const iconName=stored && stored!=='tag' && icons[stored] ? stored : inferredIconName(category);
  const storedColor=category.color?.trim().toLocaleLowerCase('en-US')||'';
  return {
    Icon: icons[iconName]??(category.type==='income'?FolderHeart:Tag),
    iconName,
    color: storedColor && storedColor!=='#64748b' ? storedColor : null,
  };
}
