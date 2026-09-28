import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { GripVertical, Minus, Plus } from 'lucide-react';

export function GlobalActions({ onExpense, onIncome }: {
  onExpense: () => void;
  onIncome: () => void;
}) {
  const [position,setPosition]=useState<{left:number;top:number}|null>(null);
  const drag=useRef<{pointerId:number;offsetX:number;offsetY:number;moved:boolean}|null>(null);
  const suppressClick=useRef(false);

  const onPointerDown=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(event.button!==0)return;
    const rect=event.currentTarget.getBoundingClientRect();
    drag.current={pointerId:event.pointerId,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,moved:false};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const current=drag.current;
    if(!current||current.pointerId!==event.pointerId)return;
    const maxLeft=Math.max(8,window.innerWidth-event.currentTarget.offsetWidth-8);
    const maxTop=Math.max(8,window.innerHeight-event.currentTarget.offsetHeight-88);
    const left=Math.min(maxLeft,Math.max(8,event.clientX-current.offsetX));
    const top=Math.min(maxTop,Math.max(8,event.clientY-current.offsetY));
    if(Math.abs(event.movementX)+Math.abs(event.movementY)>2)current.moved=true;
    setPosition({left,top});
  };
  const onPointerUp=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(drag.current?.pointerId!==event.pointerId)return;
    suppressClick.current=Boolean(drag.current.moved);
    drag.current=null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    window.setTimeout(()=>{suppressClick.current=false;},0);
  };
  const invoke=(callback:()=>void)=>{if(!suppressClick.current)callback();};

  return <div
    aria-label="Ações globais"
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={()=>{drag.current=null;}}
    style={position?{left:position.left,top:position.top,bottom:'auto',transform:'none'}:undefined}
    className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 touch-none select-none items-stretch overflow-hidden rounded-full border border-slate-700/80 bg-slate-900/94 shadow-xl shadow-black/45 ring-1 ring-white/5 backdrop-blur-xl"
  >
    <button type="button" aria-label="Nova despesa" onClick={()=>invoke(onExpense)} className="flex min-h-11 items-center justify-center gap-1.5 px-3 text-[12px] font-bold text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-400">
      <Minus className="h-4 w-4" />Gasto
    </button>
    <span aria-hidden="true" className="flex w-5 items-center justify-center border-x border-slate-700/70 text-slate-500"><GripVertical className="h-4 w-4"/></span>
    <button type="button" aria-label="Nova entrada" onClick={()=>invoke(onIncome)} className="flex min-h-11 items-center justify-center gap-1.5 px-3 text-[12px] font-bold text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400">
      <Plus className="h-4 w-4" />Entrada
    </button>
  </div>;
}
