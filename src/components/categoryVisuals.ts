import {
  Banknote,
  BriefcaseBusiness,
  Car,
  CircleDollarSign,
  FolderHeart,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Plane,
  ShoppingBasket,
  ShoppingCart,
  Tag,
  Utensils,
  WalletCards,
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
};

const inferredIconName = (category: CategoryVisualInput) => {
  const name=(category.name??'').toLocaleLowerCase('pt-BR');
  if(/mercado|supermerc|aliment|comida/.test(name))return 'shopping-basket';
  if(/restaurante|lanche|delivery/.test(name))return 'utensils';
  if(/moradia|casa|aluguel|condom/.test(name))return 'home';
  if(/carro|combust|transporte|uber|99/.test(name))return 'car';
  if(/saúde|saude|farm|méd|med/.test(name))return 'heart-pulse';
  if(/educa|curso|faculdade|escola/.test(name))return 'graduation-cap';
  if(/viagem|férias|ferias|passagem/.test(name))return 'plane';
  if(/presente|gift/.test(name))return 'gift';
  if(/salário|salario|trabalho|freela|freelance/.test(name))return 'briefcase-business';
  if(/rendimento|juros|invest/.test(name))return 'banknote';
  return category.type==='income'?'folder-heart':'tag';
};

export function getCategoryVisual(category: CategoryVisualInput) {
  const stored=(category.icon??'').trim().toLocaleLowerCase('en-US');
  const iconName=stored && stored!=='tag' && icons[stored] ? stored : inferredIconName(category);
  return {
    Icon: icons[iconName]??(category.type==='income'?FolderHeart:Tag),
    iconName,
    color: category.color?.trim()||null,
  };
}
