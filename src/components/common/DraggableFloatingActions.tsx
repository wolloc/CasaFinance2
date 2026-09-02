import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics.js';

interface DraggableFloatingActionsProps {
  onOpenNewTransaction: () => void;
  onOpenQuickAdd?: () => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export const DraggableFloatingActions: React.FC<DraggableFloatingActionsProps> = ({
  onOpenNewTransaction,
  containerRef
}) => {
  const isDraggingRef = useRef(false);

  const handleClick = () => {
    if (isDraggingRef.current) return;
    triggerHaptic('impact-medium');
    onOpenNewTransaction();
  };

  return (
    <motion.div
      drag
      dragConstraints={containerRef || { top: -500, bottom: 10, left: -250, right: 10 }}
      dragElastic={0.12}
      dragMomentum={false}
      onDragStart={() => {
        isDraggingRef.current = true;
      }}
      onDragEnd={() => {
        // Pequeno atraso para não disparar o clique ao soltar o arrasto
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 120);
      }}
      initial={{ opacity: 0, scale: 0.85, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="absolute bottom-22 right-4 sm:right-6 z-35 select-none touch-none"
      id="floating-quick-actions"
    >
      {/* Botão Único Circular Azul com Ícone '+' para Nova Despesa */}
      <motion.button
        id="btn-floating-new-expense"
        type="button"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.92 }}
        onClick={handleClick}
        className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white flex items-center justify-center shadow-xl shadow-blue-900/50 border border-blue-400/40 cursor-grab active:cursor-grabbing transition-colors focus:outline-none focus:ring-4 focus:ring-blue-500/30"
        title="Nova Despesa (+)"
        aria-label="Adicionar nova despesa"
      >
        <Plus className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.75]" />
      </motion.button>
    </motion.div>
  );
};
