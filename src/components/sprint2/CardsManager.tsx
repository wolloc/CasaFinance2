import React, { useState } from 'react';
import type { Card, User } from '../../types/index.js';
import { ApiService } from '../../services/api.js';
import { triggerHaptic } from '../../utils/haptics.js';
import { CreditCard, Plus, Calendar, Edit2, Trash2, Check, X, Shield, Sparkles, AlertTriangle } from 'lucide-react';

interface Props {
  cards: Card[];
  householdId: string;
  currentUser: User;
  onRefresh: () => void;
}

export const CardsManager: React.FC<Props> = ({ cards, householdId, currentUser, onRefresh }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [closingDay, setClosingDay] = useState('10');
  const [dueDay, setDueDay] = useState('17');
  const [color, setColor] = useState('#2563eb');
  const [ownerUserId, setOwnerUserId] = useState(currentUser.id);
  const [saving, setSaving] = useState(false);

  const openCreateModal = () => {
    setEditingCard(null);
    setName('');
    setInstitution('');
    setCreditLimit('');
    setClosingDay('10');
    setDueDay('17');
    setColor('#0284c7');
    setOwnerUserId(currentUser.id);
    setShowModal(true);
    triggerHaptic('impact-light');
  };

  const openEditModal = (card: Card) => {
    setEditingCard(card);
    setName(card.name);
    setInstitution(card.institution);
    setCreditLimit(card.credit_limit.toString());
    setClosingDay(card.closing_day.toString());
    setDueDay(card.due_day.toString());
    setColor(card.color || '#0284c7');
    setOwnerUserId(card.owner_user_id || currentUser.id);
    setShowModal(true);
    triggerHaptic('selection');
  };

  const handleDelete = async (cardId: string) => {
    try {
      setSaving(true);
      await ApiService.deleteCard(householdId, currentUser.id, cardId);
      triggerHaptic('success');
      setDeletingCardId(null);
      if (editingCard?.id === cardId) {
        setShowModal(false);
        setEditingCard(null);
      }
      onRefresh();
    } catch (err) {
      console.error('Erro ao excluir cartão:', err);
      triggerHaptic('error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !institution) return;
    try {
      setSaving(true);
      if (editingCard) {
        // Update existing card
        await ApiService.updateCard(householdId, currentUser.id, editingCard.id, {
          name,
          institution,
          credit_limit: parseFloat(creditLimit) || 1000,
          closing_day: parseInt(closingDay, 10),
          due_day: parseInt(dueDay, 10),
          color,
          owner_user_id: ownerUserId
        });
      } else {
        // Create new card
        await ApiService.createCard(householdId, currentUser.id, {
          name,
          institution,
          credit_limit: parseFloat(creditLimit) || 1000,
          closing_day: parseInt(closingDay, 10),
          due_day: parseInt(dueDay, 10),
          color,
          owner_user_id: ownerUserId
        });
      }
      triggerHaptic('success');
      setShowModal(false);
      setEditingCard(null);
      onRefresh();
    } catch (err) {
      console.error('Erro ao salvar cartão:', err);
      triggerHaptic('error');
    } finally {
      setSaving(false);
    }
  };

  const cardColorPresets = [
    { color: '#0284c7', label: 'Porto Blue' },
    { color: '#0f172a', label: 'Black / Grafite' },
    { color: '#dc2626', label: 'Santander Red' },
    { color: '#f97316', label: 'ITI Orange' },
    { color: '#7c3aed', label: 'Nubank Purple' },
    { color: '#059669', label: 'Emerald Green' },
    { color: '#d97706', label: 'Gold / Amber' },
    { color: '#be185d', label: 'Rose Pink' }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <span>Cartões de Crédito</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold">
              {cards.length}
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Limites, dias de fechamento, vencimento e titularidade
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo Cartão</span>
        </button>
      </div>

      {/* Visual Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {cards.map((card) => {
          const ownerName = card.owner_user_id === 'usr-wallace-001' ? 'Wallace' : card.owner_user_id === 'usr-guilherme-002' ? 'Guilherme' : 'Titular';
          return (
            <div
              key={card.id}
              className="p-4 rounded-2xl text-white relative overflow-hidden shadow-md flex flex-col justify-between h-40 group transition-all duration-200 hover:shadow-lg"
              style={{ backgroundColor: card.color || '#1e293b' }}
            >
              {/* Background ambient lighting */}
              <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/20 rounded-full blur-xl pointer-events-none" />

              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-white/80 block">
                    {card.institution}
                  </span>
                  <h4 className="text-base font-extrabold tracking-tight drop-shadow-xs">{card.name}</h4>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-black/35 backdrop-blur-md px-2 py-0.5 rounded-full font-semibold border border-white/20">
                    {ownerName}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditModal(card)}
                    className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition-all active:scale-90 border border-white/25 shadow-xs"
                    title="Editar Cartão"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingCardId(card.id)}
                    className="w-7 h-7 rounded-full bg-white/20 hover:bg-rose-500/80 backdrop-blur-md flex items-center justify-center text-white transition-all active:scale-90 border border-white/25 shadow-xs"
                    title="Excluir Cartão"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="relative z-10 pt-2.5 border-t border-white/20 flex items-end justify-between">
                <div>
                  <span className="text-[10px] text-white/75 block font-medium">Limite Total</span>
                  <span className="text-sm font-black tracking-tight">
                    R$ {card.credit_limit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-white/75 block flex items-center gap-1 justify-end font-medium">
                    <Calendar className="w-2.5 h-2.5" /> Corte / Venc.
                  </span>
                  <span className="text-xs font-bold tracking-wide">
                    Dia {card.closing_day} / {card.due_day}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingCardId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Excluir Cartão?</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Esta ação desativará o cartão de crédito do domicílio.</p>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCardId(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleDelete(deletingCardId)}
                className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
              >
                {saving ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar / Editar Cartão */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {editingCard ? 'Editar Cartão de Crédito' : 'Cadastrar Novo Cartão'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {editingCard ? 'Atualize as propriedades financeiras' : 'Adicione um novo meio de pagamento'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingCard(null);
                }}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Cartão
                </label>
                <input
                  type="text"
                  placeholder="Ex: Porto, Infinity, ITI, XP Visa Infinite"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Instituição / Banco
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Porto Bank, Itaú, Santander"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Titular Principal
                  </label>
                  <select
                    value={ownerUserId}
                    onChange={(e) => setOwnerUserId(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="usr-wallace-001">Wallace</option>
                    <option value="usr-guilherme-002">Guilherme</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Limite Total (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="8000.00"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Dia Fechamento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={closingDay}
                    onChange={(e) => setClosingDay(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Dia Vencimento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Cor do Cartão
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {cardColorPresets.map((preset) => (
                    <button
                      key={preset.color}
                      type="button"
                      onClick={() => setColor(preset.color)}
                      className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
                        color === preset.color
                          ? 'border-white ring-2 ring-blue-500 scale-110'
                          : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: preset.color }}
                      title={preset.label}
                    >
                      {color === preset.color && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                {editingCard && (
                  <button
                    type="button"
                    onClick={() => setDeletingCardId(editingCard.id)}
                    className="py-2.5 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl transition-colors flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCard(null);
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
                  {saving ? 'Salvando...' : editingCard ? 'Atualizar Cartão' : 'Salvar Cartão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
