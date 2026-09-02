import React, { useState } from 'react';
import type { Category, User } from '../../types/index.js';
import { ApiService } from '../../services/api.js';
import { triggerHaptic } from '../../utils/haptics.js';
import {
  Tag,
  Plus,
  ShoppingCart,
  Utensils,
  Home,
  Zap,
  Car,
  Activity,
  Film,
  Plane,
  ShoppingBag,
  Smartphone,
  BookOpen,
  DollarSign,
  Coffee,
  HeartPulse,
  Tv,
  Gift,
  Briefcase,
  Edit2,
  X,
  Check,
  Sparkles
} from 'lucide-react';

interface Props {
  categories: Category[];
  householdId: string;
  currentUser: User;
  onRefresh: () => void;
}

export const CategoriesManager: React.FC<Props> = ({ categories, householdId, currentUser, onRefresh }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [color, setColor] = useState('#2563eb');
  const [icon, setIcon] = useState('tag');
  const [saving, setSaving] = useState(false);

  const openCreateModal = () => {
    setEditingCategory(null);
    setName('');
    setType('expense');
    setColor('#2563eb');
    setIcon('tag');
    setShowModal(true);
    triggerHaptic('impact-light');
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setType(cat.type);
    setColor(cat.color || '#2563eb');
    setIcon(cat.icon || 'tag');
    setShowModal(true);
    triggerHaptic('selection');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    try {
      setSaving(true);
      if (editingCategory) {
        await ApiService.updateCategory(householdId, currentUser.id, editingCategory.id, {
          name,
          type,
          color,
          icon
        });
      } else {
        await ApiService.createCategory(householdId, currentUser.id, {
          name,
          type,
          color,
          icon
        });
      }
      triggerHaptic('success');
      setShowModal(false);
      setEditingCategory(null);
      onRefresh();
    } catch (err) {
      console.error('Erro ao salvar categoria:', err);
      triggerHaptic('error');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'shopping-cart':
      case 'mercado':
        return <ShoppingCart className="w-4 h-4" />;
      case 'utensils':
      case 'restaurante':
      case 'alimentacao':
        return <Utensils className="w-4 h-4" />;
      case 'home':
      case 'casa':
      case 'moradia':
      case 'aluguel':
        return <Home className="w-4 h-4" />;
      case 'zap':
      case 'energia':
      case 'contas':
        return <Zap className="w-4 h-4" />;
      case 'car':
      case 'transporte':
      case 'uber':
        return <Car className="w-4 h-4" />;
      case 'activity':
      case 'saude':
      case 'farmacia':
        return <Activity className="w-4 h-4" />;
      case 'film':
      case 'lazer':
      case 'cinema':
        return <Film className="w-4 h-4" />;
      case 'plane':
      case 'viagem':
        return <Plane className="w-4 h-4" />;
      case 'shopping-bag':
      case 'compras':
        return <ShoppingBag className="w-4 h-4" />;
      case 'smartphone':
      case 'assinaturas':
        return <Smartphone className="w-4 h-4" />;
      case 'tv':
      case 'streaming':
        return <Tv className="w-4 h-4" />;
      case 'coffee':
        return <Coffee className="w-4 h-4" />;
      case 'gift':
        return <Gift className="w-4 h-4" />;
      case 'book':
      case 'educacao':
        return <BookOpen className="w-4 h-4" />;
      case 'dollar-sign':
      case 'salario':
        return <DollarSign className="w-4 h-4" />;
      case 'briefcase':
        return <Briefcase className="w-4 h-4" />;
      default:
        return <Tag className="w-4 h-4" />;
    }
  };

  const iconOptions = [
    { id: 'shopping-cart', label: 'Mercado' },
    { id: 'utensils', label: 'Alimentação' },
    { id: 'home', label: 'Moradia' },
    { id: 'zap', label: 'Contas Fixas' },
    { id: 'car', label: 'Transporte' },
    { id: 'activity', label: 'Saúde' },
    { id: 'film', label: 'Lazer' },
    { id: 'plane', label: 'Viagens' },
    { id: 'shopping-bag', label: 'Compras' },
    { id: 'smartphone', label: 'Assinaturas' },
    { id: 'coffee', label: 'Café & Lanches' },
    { id: 'gift', label: 'Presentes' },
    { id: 'book', label: 'Educação' },
    { id: 'dollar-sign', label: 'Renda' },
    { id: 'briefcase', label: 'Trabalho' },
    { id: 'tag', label: 'Geral' }
  ];

  const colorPresets = [
    '#2563eb', // Blue
    '#7c3aed', // Purple
    '#059669', // Emerald
    '#dc2626', // Red
    '#ea580c', // Orange
    '#d97706', // Amber
    '#db2777', // Pink
    '#4f46e5', // Indigo
    '#0d9488', // Teal
    '#64748b'  // Slate
  ];

  const filteredCategories = categories.filter((c) => {
    if (filterType === 'all') return true;
    return c.type === filterType;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <span>Categorias de Gastos e Receitas</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
              {categories.length}
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Organização contábil e categorização inteligente
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented Filter */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setFilterType('all');
                triggerHaptic('selection');
              }}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterType === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterType('expense');
                triggerHaptic('selection');
              }}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterType === 'expense'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Despesas
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterType('income');
                triggerHaptic('selection');
              }}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterType === 'income'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Receitas
            </button>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Categoria</span>
          </button>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {filteredCategories.map((cat) => (
          <div
            key={cat.id}
            className="bg-slate-50/80 dark:bg-slate-850/60 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 hover:border-blue-300 dark:hover:border-blue-800 transition-all group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                style={{ backgroundColor: cat.color || '#2563eb' }}
              >
                {getCategoryIcon(cat.icon || 'tag')}
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {cat.name}
                </h4>
                <span className="text-[10px] text-slate-400 font-medium block">
                  {cat.type === 'income' ? 'Receita' : 'Despesa'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openEditModal(cat)}
              className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center transition-all opacity-80 hover:opacity-100 shrink-0"
              title="Editar Categoria"
            >
              <Edit2 className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Modal Criar / Editar Categoria */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {editingCategory ? 'Editar Categoria' : 'Cadastrar Nova Categoria'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {editingCategory ? 'Modifique as propriedades visuais' : 'Classifique seus lançamentos'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingCategory(null);
                }}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome da Categoria
                </label>
                <input
                  type="text"
                  placeholder="Ex: Farmácia, Academia, Viagens, Freelance"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tipo Financeiro
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      type === 'expense'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      type === 'income'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Receita
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Ícone Representativo
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700">
                  {iconOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setIcon(opt.id)}
                      className={`p-2 rounded-xl flex flex-col items-center gap-1 text-[10px] font-medium transition-all ${
                        icon === opt.id
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {getCategoryIcon(opt.id)}
                      <span className="truncate w-full text-center text-[9px]">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Cor da Tag
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {colorPresets.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
                        color === c
                          ? 'border-white ring-2 ring-blue-500 scale-110'
                          : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCategory(null);
                  }}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 rounded-xl transition-all shadow-xs disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : editingCategory ? 'Atualizar Categoria' : 'Salvar Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
