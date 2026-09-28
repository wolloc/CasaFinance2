import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { GripVertical, Minus, Plus } from 'lucide-react';

export function GlobalActions({ onExpense, onIncome }: {
  onExpense: () => void;
  onIncome: () => void;
}) {
  const [position,setPosition]=useState<{left:number;top:number}|null>(null);
  const rootRef=useRef<HTMLDivElement|null>(null);
  const drag=useRef<{pointerId:number;offsetX:number;offsetY:number}|null>(null);

  const onDragStart=(event:ReactPointerEvent<HTMLSpanElement>)=>{
    if(event.button!==0||!rootRef.current)return;
    const rect=rootRef.current.getBoundingClientRect();
    drag.current={pointerId:event.pointerId,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top};
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const onDragMove=(event:ReactPointerEvent<HTMLSpanElement>)=>{
    const current=drag.current;
    const root=rootRef.current;
    if(!current||current.pointerId!==event.pointerId||!root)return;
    const maxLeft=Math.max(8,window.innerWidth-root.offsetWidth-8);
    const maxTop=Math.max(8,window.innerHeight-root.offsetHeight-88);
    const left=Math.min(maxLeft,Math.max(8,event.clientX-current.offsetX));
    const top=Math.min(maxTop,Math.max(8,event.clientY-current.offsetY));
    setPosition({left,top});
  };
  const onDragEnd=(event:ReactPointerEvent<HTMLSpanElement>)=>{
    if(drag.current?.pointerId!==event.pointerId)return;
    drag.current=null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return <div
    ref={rootRef}
    aria-label="Ações globais"
    style={position?{left:position.left,top:position.top,bottom:'auto',transform:'none'}:undefined}
    className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 select-none items-stretch overflow-hidden rounded-full border border-slate-700/80 bg-slate-900/94 shadow-xl shadow-black/45 ring-1 ring-white/5 backdrop-blur-xl"
  >
    <button type="button" aria-label="Nova despesa" onClick={onExpense} className="flex min-h-11 items-center justify-center gap-1.5 px-3 text-[12px] font-bold text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-400">
      <Minus className="h-4 w-4" />Gasto
    </button>
    <span
      aria-label="Arrastar ações"
      role="button"
      tabIndex={0}
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={()=>{drag.current=null;}}
      className="flex w-6 touch-none cursor-grab items-center justify-center border-x border-slate-700/70 text-slate-500 active:cursor-grabbing"
    ><GripVertical className="h-4 w-4"/></span>
    <button type="button" aria-label="Nova entrada" onClick={onIncome} className="flex min-h-11 items-center justify-center gap-1.5 px-3 text-[12px] font-bold text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400">
      <Plus className="h-4 w-4" />Entrada
    </button>
  </div>;
}
