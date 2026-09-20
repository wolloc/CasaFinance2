import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props={children:ReactNode;screenName:string;onRetry?:()=>void};
type State={failed:boolean};

export class ScreenErrorBoundary extends Component<Props,State>{
  state:State={failed:false};
  static getDerivedStateFromError():State{return{failed:true};}
  componentDidCatch(error:Error,info:ErrorInfo){console.error(`Casa Finance: falha ao renderizar ${this.props.screenName}`,error,info);}
  componentDidUpdate(previous:Props){if(this.state.failed&&previous.children!==this.props.children)this.setState({failed:false});}
  private retry=()=>{this.setState({failed:false});this.props.onRetry?.();};
  render(){
    if(!this.state.failed)return this.props.children;
    return <section role="alert" className="rounded-2xl border border-rose-900 bg-rose-950/20 p-5 text-slate-100">
      <h1 className="font-bold">Não foi possível mostrar {this.props.screenName} agora</h1>
      <p className="mt-2 text-sm text-rose-200">Seus dados não foram apagados. O Casa interrompeu apenas esta tela para não mostrar uma situação incompleta.</p>
      <button type="button" onClick={this.retry} className="mt-4 min-h-11 rounded-xl border border-rose-800 px-4 text-sm font-bold text-rose-200">Tentar novamente</button>
    </section>;
  }
}
