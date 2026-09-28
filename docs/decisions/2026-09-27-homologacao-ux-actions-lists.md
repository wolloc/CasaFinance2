# Homologação UX — Ajustes, ações e listas

Data: 2026-09-27

## DEFINIDO

### Ajustes
Os quatro recursos principais de configuração devem compartilhar o mesmo padrão de entrada em lista:
- Casa e membros;
- Pessoas;
- Contas e cartões;
- Categorias.

Cada item abre sua área dedicada. Não misturar uma seção expandida com links de navegação no mesmo nível visual.

### Criação de fatos econômicos
**Nova despesa / novo gasto** e **Nova entrada** ficam concentrados no controle global flutuante.
Ações contextuais de um recurso não oferecem mais “Registrar despesa”.

O controle global:
- permanece disponível nas telas principais;
- apresenta Gasto e Entrada como duas metades do mesmo controle;
- pode ser reposicionado por arraste;
- não expõe Acerto como novo fato econômico.

### Transferência por recurso
Quando a transferência nasce de um recurso selecionado:
- a origem permanece fixa no recurso escolhido;
- o destino é escolhido entre outros recursos compatíveis por cards;
- não perguntar novamente a origem;
- transferência permanece patrimonialmente neutra e reutiliza comandos canônicos.

### Lista de Gastos
Não exibir ao usuário estados técnicos como **Confirmado** ou **Pago/realizado** na leitura cotidiana.

Priorizar no card:
1. data econômica/da compra;
2. descrição;
3. categoria;
4. comprador, quando existir;
5. recurso usado na compra;
6. valor em bloco inferior para melhorar leitura mobile.

Para compromissos, a data exibida no card é a data econômica do fato/ocorrência. Datas financeiras continuam preservadas no motor para fatura, vencimento e projeções.

## IMPLEMENTADO neste pacote
- padronização da raiz de Ajustes;
- FAB unido e arrastável;
- retirada de criação de despesa das ações do recurso;
- transferência contextual com destino em cards;
- remoção de estados técnicos da lista;
- recurso financeiro identificado nos cards de Gastos;
- valor reposicionado na base do card;
- remoção do aviso âmbar vazio na jornada contextual de empréstimo.

## Guardrails preservados
- transferência não cria renda ou despesa;
- pagamento não cria novo fato econômico;
- empréstimo principal não é renda/despesa;
- projeção não vira realizado;
- nenhuma migration nova.
