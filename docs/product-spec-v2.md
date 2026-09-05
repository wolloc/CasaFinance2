# Casa Finance — Product Spec v2

## Visão

Casa Finance é um sistema financeiro doméstico para uma Casa composta por **exatamente duas pessoas**. Seu objetivo não é somente registrar gastos: o produto explica onde o dinheiro está, de onde veio, para onde vai, o que já está comprometido, o que ainda deve entrar, quem comprou, quem deve assumir economicamente, quem efetivamente colocou ou colocará o recurso, quem deve acertar dinheiro com quem e como está a saúde financeira da Casa e de cada membro.

> **Princípio de UX:** “O usuário conta o que aconteceu; o Casa interpreta financeiramente o acontecimento.”

A interface usa linguagem amigável e evita expor nomes técnicos de banco.

## Navegação e ações globais

A navegação inferior oficial é:

1. **Casa**
2. **Gastos**
3. **Entradas**
4. **Ajustes**

**Faturas não é aba inferior** e **Lançamentos não é um conceito principal** da nova navegação. Faturas são acessadas contextualmente por Casa, cartões, detalhes e filtros de Gastos.

Todas as áreas oferecem três ações globais:

| Ação | Fluxo |
| --- | --- |
| `[ – ]` | Nova despesa |
| `[ + ]` | Nova entrada |
| `[ <> ]` | Novo acerto |

São três fluxos independentes, e não variações de um formulário genérico.

## Perspectiva

O seletor oferece **Nossa Casa**, **Wallace** e **Guilherme**.

> Filtrar por membro muda a perspectiva financeira, não simplesmente os ativos exibidos.

A perspectiva individual responde: “Considerando minha renda, compromissos e recursos que realmente posso usar, quanto consigo gastar ou movimentar sem retirar investimentos ou depender financeiramente do outro membro?”

Ela distingue:

- **Minha responsabilidade**;
- **Pode sair dos meus recursos**;
- **A receber do outro membro**.

Em conta conjunta, a visão Casa considera 100% do saldo e a perspectiva individual de liquidez considera 50% para cada membro. Essa regra 50/50 vale somente para liquidez individual: a responsabilidade econômica continua independente.

## Casa

A área Casa apresenta, nesta ordem:

1. **Como estamos?**
2. **Precisa de atenção**
3. **Este mês**
4. **Nosso dinheiro**
5. **Cartões**
6. **Acertos**
7. **Olhando pra frente**

### Como estamos?

**Saldo atual** inclui somente saldos realizados de contas transacionais e dinheiro físico. Pode ser negativo. Não inclui benefícios, reservas, investimentos, recebíveis, limite de cartão, LIS disponível ou entradas previstas.

**Deve sobrar** é sempre identificado como projeção:

```text
saldo atual
+ entradas verdadeiras confiáveis ainda esperadas
- compromissos restantes
- pendências anteriores em aberto
```

### Saúde

A saúde usa os conceitos **green**, **yellow** e **red**. A referência inicial do produto é:

- `>= 20%`: green;
- `>= 5% e < 20%`: yellow;
- `< 5%`: red;
- projeção negativa: red.

Esses thresholds são **calibráveis** e não são invariantes contábeis. Agravantes somente pioram a classificação:

- LIS usado limita a saúde a, no máximo, yellow;
- obrigação vencida;
- obrigação sem capacidade de pagamento;
- necessidade de retirar reserva/investimento para fechar a rotina;
- projeção negativa.

Saúde da Casa e confiança da projeção são conceitos diferentes.

### Confiança da projeção

A confiança é qualitativa, sem percentual artificial:

- **Projeção bem atualizada**;
- **Algumas previsões precisam de confirmação**;
- **Há informações importantes desatualizadas**.

### Precisa de atenção

Mostra somente situações acionáveis. Uma previsão futura normal não é alerta. Uma situação pode entrar quando:

- venceu sem confirmação;
- uma fatura tem risco de cobertura;
- um pagável venceu;
- um recebível venceu;
- renda esperada atrasou;
- acerto programado venceu;
- LIS está em uso;
- a projeção é negativa.

Alertas com a mesma causa são consolidados.

### Este mês

Os indicadores seguem o **mês financeiro**, e não necessariamente a data da compra:

- **Entrou**;
- **Ainda entra**;
- **Já comprometido/pago**;
- **Ainda compromete**.

**Entrou** contém somente renda verdadeira recebida. Não inclui transferência, acerto, recebimento de recebível, empréstimo tomado, refund nem resgate de principal.

### Os três relógios e o mês financeiro

O produto distingue:

1. **data econômica** — quando o fato econômico aconteceu;
2. **mês financeiro** — quando o compromisso entra no planejamento;
3. **data de caixa** — quando o dinheiro efetivamente entra ou sai.

Exemplo oficial:

```text
TV
R$ 2.400
comprada 20/09
Infinity
12x R$ 200
```

- **Evento econômico:** setembro, R$ 2.400, uma única vez.
- **Mês financeiro:** setembro R$ 0; outubro R$ 200; novembro R$ 200; dezembro R$ 200; e assim por diante.
- **Caixa:** quando cada fatura for paga.

Gastos usa mês financeiro por padrão. O filtro avançado **Ver pela data da compra** permite analisar pela data econômica sem mudar o fato original.

### Nosso dinheiro

Exibir separadamente:

- contas + dinheiro físico;
- benefícios;
- reservas;
- investimentos.

Essas classes nunca são apresentadas juntas como se todo o patrimônio fosse saldo disponível.

#### LIS

Exemplo: saldo `-R$ 350`, LIS total `R$ 2.000`, LIS utilizado `R$ 350` e LIS disponível `R$ 1.650`. O saldo atual continua **-R$ 350**. LIS disponível nunca é somado ao dinheiro.

### Cartões

Cada cartão deve mostrar conceitualmente:

- fatura atual, pago, restante e vencimento;
- faturas futuras e parcelas futuras;
- limite contratado, limite calculado pelo Casa e limite disponível calculado;
- responsabilidade por membro;
- capacidade projetada;
- saúde.

Compra, parcela, fatura, limite usado e pagamento são representações diferentes do mesmo evento. Nunca são contabilizados como despesas distintas. Limite é crédito, não dinheiro.

### Acertos entre membros

O acerto é uma conta-corrente contínua, sem reset mensal. Nasce da diferença entre responsabilidade econômica e funding realizado ou projetado.

Exemplo: jantar de R$ 300 pago por Wallace com responsabilidade de R$ 150 para cada membro. Guilherme deve R$ 150 a Wallace.

#### Regra crítica de cartão

Em compras financiadas por cartão, o acerto projetado nasce na origem econômica e é distribuído pelos mesmos compromissos financeiros da compra.

Exemplo: TV de R$ 2.400, em 12 parcelas de R$ 200, no Infinity de Wallace, com responsabilidade 100% de Guilherme. O acerto projetado total é **Guilherme → Wallace, R$ 2.400**, distribuído em R$ 200 por mês financeiro.

O pagamento posterior da fatura realiza funding. **Não cria nova despesa e não cria novo acerto.** A liquidação do acerto deve ser explícita. Uma transferência maior que a dívida não cria dívida inversa silenciosamente.

### Terceiros

Exemplo: jantar com responsabilidade de Wallace R$ 150, Guilherme R$ 150 e Letícia R$ 150; Wallace paga R$ 450. O resultado é:

- saída bruta: R$ 450;
- despesa econômica da Casa: R$ 300;
- recebível de Letícia: R$ 150.

Quando Letícia paga, caixa aumenta R$ 150, recebível diminui R$ 150 e renda permanece zero.

Se um terceiro pagar uma despesa da Casa, o produto pergunta se é **presente** ou se haverá **reembolso**:

- presente: a despesa existe, caixa da Casa é zero e pagável é zero;
- reembolso: a despesa existe e há pagável ao terceiro.

Recebíveis não melhoram o **Deve sobrar** principal antes do recebimento; pagáveis entram na projeção. Uma posição líquida pode ser mostrada, mas nunca compensa automaticamente obrigações brutas.

### Olhando pra frente

A visão inicial cobre três meses e é cumulativa por mês financeiro:

```text
projected_end(M)
= projected_start(M)
+ reliable inflows
- commitments
```

O saldo final de um mês é o início do mês seguinte.

## Nova despesa

### Etapa 1 — o acontecimento

- Com o que está gastando?
- Onde? (opcional)
- Quanto?
- Quando?
- Categoria
- Natureza sempre visível: **Um gasto** ou **Um empréstimo — vão me devolver**

Empréstimo não contamina analytics de gastos.

### Etapa 2 — como foi financiado

- Cartão
- Conta / PIX / débito
- Dinheiro
- Benefício
- Outra pessoa pagou
- Crédito / financiamento

Evitar uma opção genérica “Outro”.

### Etapa 3 — pessoas e responsabilidade

- Quem comprou?
- Quem deve assumir? **Só Wallace**, **Só Guilherme**, **50/50**, **Personalizar** ou **Outra pessoa envolvida**.

Titular, comprador e responsável são independentes.

A recorrência opcional registra se é fixa ou variável, estimativa, frequência, início e fim opcional. Estados seguem a prioridade conceitual **Realizado > Confirmado > Previsto**. A passagem da data não realiza automaticamente; previsão vencida vira pendência anterior até resolução.

## Entradas

Renda verdadeira inclui salário, aluguel, freelance, bônus, presente e juros/rendimento.

Nova entrada permite recorrência: **Não**, **Todo mês**, **Toda semana** ou **Personalizar**. Ao alterar: **Só este mês** ou **Atualizar daqui pra frente**.

Não são renda: transferência, refund, recebimento de recebível, empréstimo tomado, resgate de principal e acerto.

## Novo acerto

O fluxo oferece intenções explícitas:

- Transferência entre recursos;
- Acerto entre nós;
- Acerto com outra pessoa;
- Pagamento de fatura;
- Investimento / reserva;
- Empréstimos.

Regras:

- transferência patrimonial: receita zero e despesa zero;
- pagamento de fatura: nova despesa zero;
- investimento: aporte/resgate de principal neutros, rendimento/perda separados;
- benefício: carga não é salário e uso gera despesa econômica;
- dinheiro físico: saque/depósito são transferências e gasto em dinheiro é despesa.

## Refund

Refund não é renda comum, mantém vínculo com a compra e pode ser integral ou parcial. Em cartão, pode aparecer na mesma fatura, em fatura futura, em conta ou como pendente. O Casa não infere silenciosamente a rota quando faltarem dados.

## Correções

Antes de produzir efeitos financeiros dependentes, um registro pode ser editado. Depois de produzir parcelas, faturas, funding, acertos ou obrigações, a correção preserva histórico e recalcula o futuro atomicamente. `DELETE` financeiro não é fluxo normal.

## Ajustes

- Nossa Casa
- Membros
- Contas e dinheiro
- Cartões
- Categorias
- Pessoas e terceiros
- Recorrências
- Preferências
- Minha conta

A Casa possui exatamente dois membros ativos. Não existe percentual permanente de responsabilidade por membro.

## Regra final de produto

O Casa deve sempre conseguir responder:

- Quanto temos hoje? Quanto está realmente disponível?
- Quanto está comprometido? Quanto ainda vai sair?
- Quanto ainda deve entrar? Quanto provavelmente sobra?
- Como ficam os próximos meses?
- Quanto Wallace deve assumir? Quanto Guilherme deve assumir?
- Quem comprou? Quem pagou?
- De onde saiu? De onde deverá sair?
- Quem deve quem?
- O que temos a receber? O que temos a pagar?
- Estamos saudáveis? A projeção está confiável?
