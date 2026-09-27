# Casa Finance — Product Spec v2

## Visão

Casa Finance é um sistema financeiro doméstico para uma Casa composta por **uma ou duas pessoas ativas**. Casa é contexto de organização, colaboração, segurança e consolidação; não é proprietária de dinheiro, patrimônio, dívida, direito ou obrigação. Seu objetivo não é somente registrar gastos: o produto explica onde o dinheiro está, de onde veio, para onde vai, o que já está comprometido, o que ainda deve entrar, quem comprou, quem deve assumir economicamente, quem efetivamente colocou ou colocará o recurso, quem deve acertar dinheiro com quem e como está a saúde financeira da Casa e de cada membro.

> **Princípio de UX:** “O usuário conta o que aconteceu; o Casa interpreta financeiramente o acontecimento.”

**DEFINIDO — Roteador Financeiro do Casa:** a experiência parte de pessoas, recursos, origem/destino e do acontecimento real. O aplicativo deriva por trás o comando canônico adequado — caixa, funding, transferência, acerto, fatura, obrigação ou movimento patrimonial — sem pedir que o usuário escolha conceitos técnicos do motor.

A interface usa linguagem amigável e evita expor nomes técnicos de banco. Funding, settlement, obligation, allocation e comandos equivalentes pertencem ao motor; a UX prioriza ações como **Paguei**, **Recebi**, **Transferi**, **Aportei**, **Resgatei**, **Comprei** e **Devolvi**.

## Navegação e ações globais

A navegação inferior oficial é:

1. **Casa**
2. **Gastos**
3. **Entradas**
4. **Ajustes**

**Faturas não é aba inferior** e **Lançamentos não é um conceito principal** da nova navegação. Faturas são acessadas contextualmente por Casa, cartões, detalhes e filtros de Gastos.

As ações globais permanecem três fluxos independentes:

- Nova despesa;
- Nova entrada.

**DEFINIDO e IMPLEMENTADO:** as ações globais ficam restritas à criação de fatos cotidianos: **Despesa** e **Entrada**. **Novo acerto** deixa de existir como ação global. Transferências, pagamentos, recebimentos, faturas, investimentos, posições com pessoas e demais operações financeiras são expostos no contexto do recurso ou fato que resolvem.

## Perspectiva

**DEFINIDO:** o seletor oferece **Nossa Casa**, **Wallace** e **Guilherme** e funciona como contexto financeiro global. A perspectiva escolhida permanece ao navegar entre Casa, Gastos, Entradas e Faturas.

> Filtrar por membro muda a perspectiva financeira, não simplesmente os ativos exibidos.

A perspectiva individual responde: “Considerando minha renda, compromissos e recursos que realmente posso usar, como está a minha situação dentro da Casa?”

Ela distingue:

- **Minha responsabilidade**;
- **Pode sair dos meus recursos**;
- **Tenho a receber / Preciso acertar**;
- entradas cujo beneficiário é o membro;
- responsabilidade do membro nos cartões;
- contas e recursos atribuídos canonicamente ao membro;
- principais categorias pela responsabilidade econômica do membro.

**Comprador continua sendo um filtro independente.** Selecionar Wallace na perspectiva não significa filtrar compras feitas por Wallace; responsabilidade econômica, comprador e funding/pagador permanecem conceitos distintos.

Em conta conjunta, a visão Casa considera 100% do saldo e a perspectiva individual de liquidez considera 50% para cada membro. A responsabilidade econômica continua independente. **DEFINIDO:** quando uma saída realizada usa uma conta conjunta dos dois membros, o funding realizado é atribuído 50/50 entre eles.

## Casa / Dashboard

A Casa funciona como síntese financeira mensal e planejamento, não como duplicação da área Gastos.

### Hierarquia visual da Casa

**DEFINIDO:** a Casa deve priorizar compreensão rápida e reduzir texto contínuo. Ícones, números, barras, estados e frases curtas vêm antes de explicações longas; detalhes ficam em drill-down quando possível.

A linguagem visual deve evitar aparência de dashboard corporativo/BI: tipografia principal maior, menos bordas repetidas, cards com funções visuais distintas, contraste suficiente e progressive disclosure. Quando um estado saudável não exige ação — por exemplo, confiança da projeção bem atualizada — o sinal pode ser discreto em vez de ocupar espaço textual permanente.

A ordem conceitual é:

1. **Como estamos?** — síntese única do mês: saldo atual, entrou, ainda entra, já comprometido, ainda compromete e projeção de fechamento;
2. **Precisa de atenção** — link/área expansível com somente exceções acionáveis; fechado por padrão para preservar limpeza visual;
3. **Onde está nosso dinheiro** — recursos visíveis e compactos, agrupados em Contas, Dinheiro, Benefícios e Investimentos;
4. **Cartões** — fotografia por cartão, com fatura, vencimento, limite livre, crédito comprometido e compromissos futuros; detalhes e pagamento ficam no contexto do cartão;
5. **Próximos acontecimentos** — eventos dos próximos dias; permanece em avaliação de utilidade, sem duplicar o centro de atenção;
6. **Valores com pessoas** — posição entre membros e terceiros, deixando visualmente claro quem deve a quem;
7. **Olhando pra frente** — trajetória mensal agregada; permanece como visão futura enquanto sua utilidade é homologada.

**Patrimônio não é uma seção paralela obrigatória.** A Home mostra os recursos diretamente; reserva é atributo dentro de Investimentos, não uma categoria visual paralela.

**Próximos acontecimentos** e **Olhando pra frente** não são redundantes: o primeiro responde “o que vai acontecer em breve?” com eventos discretos; o segundo responde “como a posição pode evoluir nos próximos meses?” de forma agregada.


### Navegação mensal

Todo o Dashboard possui um período de referência navegável, por exemplo:

```text
‹ Agosto | Setembro | Outubro ›
```

Todos os componentes respondem ao mês selecionado:

- passado: fotografia histórica;
- atual: situação financeira corrente;
- futuro: projeção e planejamento.

### Como estamos?

**Saldo atual** inclui somente saldos realizados de contas transacionais e dinheiro físico. Pode ser negativo. Não inclui benefícios, reservas, investimentos, recebíveis, limite de cartão, LIS disponível ou entradas previstas.

**Deve sobrar** é sempre identificado como projeção:

```text
saldo atual
+ entradas verdadeiras confiáveis ainda esperadas
- compromissos restantes
- pendências anteriores em aberto
```

O Dashboard deve permitir entender, no mês selecionado, quanto é esperado/recebido, quanto já está comprometido, quanto ainda compromete e quanto tende a permanecer disponível.

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

**DEFINIDO:** aparece como área expansível, fechada por padrão, mostrando apenas o título e um indicador de quantidade/estado. Ao expandir, mostra somente situações acionáveis. Uma previsão futura normal não é alerta. Uma situação pode entrar quando:

- venceu sem confirmação;
- uma fatura tem risco de cobertura;
- um pagável venceu;
- um recebível venceu;
- renda esperada atrasou;
- acerto programado venceu;
- LIS está em uso;
- a projeção é negativa.

Alertas com a mesma causa são consolidados.

### Como estamos? — síntese mensal

**DEFINIDO:** o antigo bloco separado **Mês em resumo** foi fundido em **Como estamos?**. A Home não deve apresentar duas seções respondendo à mesma pergunta. O visual mantém o destaque próprio de Como estamos? e incorpora os quatro indicadores compactos:

- **Entrou**;
- **Ainda entra**;
- **Já comprometido/pago**;
- **Ainda compromete**.

O bloco também mantém saldo atual e projeção de fechamento do mês.

**Entrou** contém somente renda verdadeira recebida. Não inclui transferência, acerto, recebimento de recebível, empréstimo tomado, refund nem resgate de principal.

### Os três relógios

O produto distingue:

1. **data econômica** — quando o fato econômico aconteceu;
2. **mês financeiro** — quando o compromisso entra no planejamento;
3. **data de caixa** — quando o dinheiro efetivamente entra ou sai.

Exemplo:

```text
TV
R$ 2.400
comprada 20/09
Infinity
12x R$ 200
```

- evento econômico: setembro, R$ 2.400, uma única vez;
- compromissos financeiros: R$ 200 em cada fatura aplicável;
- caixa: quando as faturas forem liquidadas.

### Nosso dinheiro

**DEFINIDO:** a Home agrupa os recursos em:

- **Contas** — recursos com instituição financeira vinculada, como conta corrente, conta salário e poupança;
- **Dinheiro** — recursos sem instituição, como carteira/dinheiro físico e equivalentes;
- **Benefícios** — recursos restritos de benefício;
- **Investimentos** — investimentos e recursos explicitamente marcados como reserva.

"Dinheiro reservado" deixa de ser uma seção própria. Reserva continua sendo uma característica canônica do recurso e pode ser indicada discretamente dentro de Investimentos.

Essas classes nunca são apresentadas juntas como se todo o patrimônio fosse saldo disponível.

**DEFINIDO — comportamento financeiro por recurso:**

- conta corrente, carteira digital, dinheiro físico e poupança são recursos transacionais; pagamentos e transferências movimentam caixa sem criar renda/despesa por si só;
- poupança continua transacional e também pode participar de movimentos de guardar/retirar recursos com linguagem de aporte/resgate na UX, sem mudar a neutralidade financeira da transferência;
- investimento e reserva recebem aporte e resgate de principal como movimentos patrimoniais neutros; rendimento/perda permanecem fatos econômicos separados;
- benefício é recurso restrito: carga não é renda e seu uso financia a despesa compatível;
- cartão representa crédito: compra vai para fatura/compromissos e pagamento da fatura sai de uma conta escolhida sem criar nova despesa.

**DEFINIDO e IMPLEMENTADO — navegação contextual por recurso:** tornar cada item de conta, carteira, benefício, reserva ou investimento clicável na Casa. O detalhe do recurso apresentaria somente ações compatíveis com sua natureza e usaria o saldo daquele recurso como contexto. Exemplos: transferir, pagar, depositar, aportar ou resgatar. A implementação deve reutilizar os comandos canônicos já existentes, sem criar um segundo motor financeiro.

#### LIS

Exemplo: saldo `-R$ 350`, LIS total `R$ 2.000`, LIS utilizado `R$ 350` e LIS disponível `R$ 1.650`. O saldo atual continua **-R$ 350**. LIS disponível nunca é somado ao dinheiro.

### Cartões no Dashboard


**DEFINIDO e IMPLEMENTADO — fatura contextual:** tocar em um cartão abre a fatura como contexto completo, com total, pago, valor em aberto, vencimento, compras/parcelas, limite total, limite livre, compromissos futuros e lançamentos canônicos daquela fatura. A ação **Pagar tudo ou parte** delega para o fluxo canônico de pagamento, que relê o saldo e permite confirmar pagamento total ou parcial. Pagamento de fatura movimenta caixa e funding, mas nunca reconhece novamente a despesa.


Cada cartão apresenta uma fotografia financeira, incluindo conceitualmente:

- valor da fatura do período;
- vencimento e situação;
- limite total;
- limite comprometido/usado;
- limite disponível;
- indicação de compromissos futuros vinculados ao cartão.

**Fatura atual** e **limite comprometido** são conceitos diferentes. Uma compra parcelada pode colocar apenas uma parcela na fatura corrente e, ao mesmo tempo, comprometer no limite a exposição remanescente conforme a lógica do emissor.

Na Casa, o cartão deve permanecer **compacto**. **DEFINIDO e IMPLEMENTADO — navegação contextual por cartão:** o próprio card do cartão é a entrada principal para seu detalhe contextual, sem CTA redundante “Todas as faturas” na Home. A jornada abre diretamente aquele cartão, navega entre fatura anterior/atual/próxima, lista os compromissos canônicos vinculados à fatura e oferece **Pagar fatura** dentro do contexto. O pagamento reutiliza o comando canônico existente, movimenta somente caixa/liquidação e não cria nova despesa. A visão consolidada de cartões/faturas continua disponível quando o acesso nasce de alertas e revisões globais.

### Valores entre membros


**DEFINIDO — posição contextual:** a Home apresenta a posição realizada e a tendência projetada entre membros como **Valores com pessoas**, sem botão genérico **Acertar agora**. A ação real nasce da movimentação entre recursos dos membros. Quando uma transferência entre contas de titulares diferentes for considerada parte da posição entre eles, o mesmo movimento de caixa altera a posição sem criar renda ou gasto.

**DEFINIDO — contas compatíveis no acerto:** ao liquidar uma posição entre membros, a conta de origem é filtrada pelos recursos transacionais vinculados a quem paga e a conta de destino pelos recursos transacionais vinculados a quem recebe. Contas conjuntas permanecem elegíveis para ambos quando a titularidade canônica assim indicar. Trocar pagador/recebedor limpa uma conta previamente selecionada se ela deixar de ser compatível. A filtragem é prevenção de erro de UX e não muda a natureza neutra do acerto.


A posição entre membros é uma conta-corrente contínua, sem reset mensal. Nasce da diferença entre responsabilidade econômica, funding e transferências explicitamente consideradas na posição. O objetivo de leitura é o equilíbrio próximo de zero, sem exigir fechamento mensal.

Exemplo: jantar de R$ 300 pago por Wallace com responsabilidade de R$ 150 para cada membro. Guilherme deve R$ 150 a Wallace.

Em compras financiadas por cartão, a posição projetada nasce na origem econômica e é distribuída pelos mesmos compromissos financeiros da compra. O pagamento posterior da fatura realiza funding. **Não cria nova despesa nem uma segunda posição.** A relação de uma transferência entre membros com a posição deve ser explícita na UX, podendo vir marcada por padrão quando origem e destino pertencem a membros diferentes e permitindo exceção pelo usuário.

**DEFINIDO e IMPLEMENTADO — histórico neutro:** acertos efetivamente realizados podem aparecer em uma timeline própria dentro do contexto de Acertos, com linguagem neutra e sem cores de renda/despesa. O item informa quem pagou, quem recebeu, data e valor. Ele reduz a posição entre membros, mas não altera resultado econômico.

### Terceiros

Responsabilidade econômica, funding e obrigação são conceitos independentes:

- **responsabilidade**: de quem é economicamente o gasto;
- **funding/pagador**: quem forneceu o recurso;
- **obrigação**: o que ainda precisa ser devolvido.

Exemplo: pneu de R$ 1.000, responsabilidade integral de um membro da Casa, pago por Robson. A despesa econômica é R$ 1.000; o caixa da Casa não sai no momento; Robson forneceu funding. Se houver devolução, nasce obrigação com Robson; se não houver, não nasce pagável.

Se um terceiro também assumir parte da despesa, somente a parcela econômica que cabe à Casa pode gerar obrigação da Casa com esse terceiro.

Recebíveis não melhoram o **Deve sobrar** principal antes do recebimento; pagáveis entram na projeção. Uma posição líquida pode ser mostrada, mas nunca compensa automaticamente obrigações brutas.

### Olhando pra frente


**DEFINIDO — horizonte padrão:** a Casa mostra o mês de referência + os próximos 3 meses. Horizontes maiores continuam navegáveis por mês, mas não são somados em um total de “riqueza futura”.

**DEFINIDO — estados da leitura futura:** cada mês separa:
- **Realizado** — entradas e saídas que já aconteceram;
- **Comprometido** — obrigações concretas ainda abertas, inclusive pendências anteriores carregadas;
- **Planejado** — entradas confiáveis ainda esperadas e recorrências futuras ainda não materializadas.

Entradas planejadas participam apenas da projeção do mês em que são esperadas. Não aumentam saldo atual, patrimônio atual nem um acumulado de renda futura.


A visão é cumulativa por mês financeiro:

```text
projected_end(M)
= projected_start(M)
+ reliable inflows
- commitments
```

O saldo final de um mês é o início do mês seguinte.

## Gastos

Gastos possui duas lentes complementares sobre os mesmos fatos financeiros.

**PROPOSTO — em homologação:** o seletor de período pode oferecer, além do mês inteiro, um intervalo personalizado. O mesmo intervalo não deve ser aplicado como um filtro genérico: em **Gastos realizados**, ele consulta a `transaction_date` do fato econômico; em **Compromissos**, consulta a `financial_date` do read model canônico. Assim, um intervalo atravessando meses continua respeitando as duas lentes e não recalcula competência, fatura ou responsabilidade no frontend.

### Gastos realizados

**DEFINIDO:** a navegação cotidiana entre meses prioriza setas anterior/próximo, com o mês atual no centro. O seletor de mês continua disponível para saltos maiores, mas não é a interação principal.

**DEFINIDO:** a lista é a superfície principal. Tocar num lançamento abre seu detalhe contextual; histórico, correções, estornos e outras ações válidas pertencem ao lançamento selecionado e não a um bloco operacional global no fim da tela.

Responde: **“Com o que gastamos neste mês?”**

Usa a data econômica do fato. Uma compra de R$ 1.000 realizada em outubro e parcelada em 10 vezes aparece como R$ 1.000 em Gastos realizados de outubro, uma única vez.

A área permite filtros por pessoa/comprador, responsabilidade, categoria e **Meio de pagamento**. Meio de pagamento é um único filtro que lista recursos/instrumentos concretos, como Conta Itaú, Carteira, Infinity e VA; não existe necessidade de separar “Meio de pagamento” de “Cartão/Conta”.

Categorias devem ter destaque visual. Uma seção expansível pode mostrar valores por categoria e permitir tocar numa categoria para filtrar a lista abaixo. Categoria de despesa é opcional no cadastro e pode ser atribuída posteriormente.

### Compromissos do mês

Responde: **“O que impactou ou ainda deve impactar financeiramente este mês?”**

Usa o período do impacto financeiro realizado ou esperado. Inclui, conforme a natureza:

- gastos imediatos em conta, carteira ou benefício ocorridos no mês;
- parcelas de compras em cartão vinculadas às faturas do período;
- obrigações com terceiros;
- ocorrências recorrentes esperadas;
- outros compromissos financeiros projetados.

Uma compra imediata de R$ 200 em conta no mesmo mês aparece tanto como R$ 200 em Gastos realizados quanto como R$ 200 em Compromissos. São duas lentes do mesmo fato e não dois gastos.

**Pagamento de fatura não aparece como item em Gastos > Compromissos.** Ele é uma liquidação/acerto financeiro. Em Compromissos aparecem as despesas/parcelas vinculadas à fatura. A ação de pagar a fatura altera a situação financeira desses compromissos sem criar novo gasto.

Pagamento parcial de fatura ou obrigação liquida somente a parte efetivamente paga; o restante continua aberto. A liquidação nunca reconhece novamente a despesa econômica.

### Estado visual dos compromissos

Não é necessário exibir a palavra “Previsto” em cada item.

- borda coral/laranja: impacto esperado ainda não liquidado/ocorrido;
- sem borda coral: impacto já ocorrido/liquidado conforme a natureza.

A cor exata pertence ao design system e permanece decisão de UI; o significado semântico do estado é definido.

### Recorrências em Compromissos

Para cartão, cada ocorrência futura é uma compra independente projetada na fatura correspondente. Ela não reduz limite real nem cria caixa antes da cobrança. Ao confirmar a cobrança, a própria ocorrência passa a ser a compra realizada, entra na fatura e passa a consumir limite; depois é liquidada somente pelo pagamento da fatura. Isso não é parcelamento: parcelamento distribui uma única compra econômica já contratada, enquanto recorrência cria uma compra nova a cada período.

Uma ocorrência recorrente futura é projeção, não despesa econômica já realizada. Ao tocar numa ocorrência esperada, o produto deve permitir conceitualmente:

- confirmar ocorrência;
- editar somente esta ocorrência;
- editar a recorrência daqui para frente;
- encerrar recorrência.

Confirmar uma ocorrência transforma/vincula a previsão ao fato efetivo sem deixar projeção e fato realizado duplicados.

## Nova despesa

Nova Despesa registra um fato que já aconteceu. **Não aceita data futura.** Planejamento futuro nasce de recorrências, compromissos e outros fluxos de previsão, e não de uma compra ficticiamente realizada amanhã.

### Etapa 1 — O que aconteceu?

Campos:

- **Quem fez esse gasto?** — obrigatório; usuário atual por padrão, podendo selecionar o outro membro ativo da Casa. Representa o comprador/autor do gasto, independentemente de pagador, titular do instrumento ou responsável econômico.
- **Quando?** — obrigatório; hoje por padrão; somente data, sem horário; permite hoje e datas passadas, nunca futuras.
- **Com o que gastou?** — obrigatório.
- **Onde/com quem?** — opcional.
- **Categoria** — opcional e atribuível posteriormente.

Um lançamento retroativo deve ser processado pelas regras correspondentes à data informada: data econômica, ciclo/fatura aplicável, parcelas, compromissos, caixa e demais consequências. Cadastrar hoje uma compra antiga não altera silenciosamente a data do fato para hoje.

### Etapa 2 — Sobre o valor

- **Quanto?** — obrigatório.
- **Quem assume esse gasto?** — obrigatório.
- **Como foi pago?** — obrigatório.

#### Quem assume esse gasto?

A interface não precisa expor percentuais quando a responsabilidade é integral. Conceitualmente oferece:

- primeiro membro da Casa;
- segundo membro da Casa;
- **Dividir**;
- **Outra pessoa envolvida**.

Selecionar somente um membro significa que o gasto é integralmente responsabilidade dele. **Dividir** abre os campos necessários para distribuir a responsabilidade. A alocação não pode ultrapassar o valor da despesa e, para concluir o lançamento, a responsabilidade econômica deve fechar o valor total.

**Outra pessoa envolvida** permite selecionar terceiro já cadastrado ou cadastrar uma nova pessoa sem abandonar o fluxo. O mesmo componente contextual de busca/cadastro deve ser reutilizado sempre que o produto precisar selecionar um terceiro.

#### De onde saiu ou será cobrado?

**DEFINIDO — seleção orientada pelo recurso real:** em vez de pedir primeiro uma categoria abstrata de pagamento, a Nova Despesa mostra os recursos financeiros já cadastrados — contas, poupança, carteira/dinheiro, benefícios e cartões — com identificação e titularidade suficientes para a pessoa reconhecer o recurso correto. **Outra pessoa pagou** permanece como alternativa explícita.

Ao selecionar uma conta, poupança, carteira ou benefício, o Casa deriva a rota de conta compatível sem perguntar novamente o tipo do recurso. Pix/débito podem ser tratados como detalhe da conta quando necessário, sem criar outro fato financeiro.

Ao selecionar um cartão, o fluxo abre somente as possibilidades daquele cartão:

- compra à vista;
- compra parcelada;
- Pix com este cartão.

Se o Pix por cartão tiver parcelamento, essa característica continua disponível dentro do contexto do próprio cartão. Principal e encargos permanecem separados no motor.

O usuário informa o acontecimento e o recurso utilizado; o Casa determina funding, caixa, compromisso e obrigação. Conta, carteira ou benefício efetivamente usados reduzem imediatamente o saldo do recurso correspondente. Compra ou Pix financiado no cartão não reduz conta bancária no momento da operação.

### Etapa 3 — somente quando necessária

Não existe uma terceira tela obrigatória. Campos adicionais aparecem conforme as escolhas da Etapa 2.

#### Cartão de crédito

Selecionar cartão cadastrado e informar:

- à vista ou parcelado;
- se parcelado, quantidade de parcelas.

A compra reconhece uma única despesa econômica pelo valor total. As parcelas distribuem o compromisso financeiro pelas faturas. A soma das parcelas deve fechar exatamente o total; diferenças de arredondamento são tratadas automaticamente. Parcelamento não é recorrência.

O cartão já conhece titular, fechamento e vencimento; esses dados não devem ser perguntados novamente. A compra é associada à fatura aplicável segundo as regras do cartão. Casos limítrofes no dia do fechamento devem permitir correção posterior sem duplicar o fato.

#### Pix por cartão de crédito

Após selecionar o cartão:

- informar à vista ou parcelado;
- se parcelado, quantidade de parcelas;
- informar encargos financeiros.

O valor principal é a despesa original. Tarifas/juros são encargo financeiro separado. Principal + encargos formam o compromisso total no cartão. Não há saída imediata de conta bancária. O compromisso passa a se comportar como lançamento de cartão e segue faturas/parcelas sem duplicar a despesa original.

#### Outra pessoa pagou

O campo de terceiro permite buscar pessoa cadastrada ou cadastrá-la contextualmente.

Depois, o Casa pergunta se o valor precisa ser devolvido:

- **Não**: existe despesa econômica da Casa, funding do terceiro e nenhuma saída imediata da Casa nem obrigação de devolução;
- **Sim**: nasce obrigação com o terceiro, sem nova despesa.

Quando houver devolução, perguntar **Como pretende devolver?**:

- uma vez; ou
- parcelado.

Capturar somente os dados necessários de planejamento, como data, quantidade de parcelas quando aplicável e meio previsto de pagamento. As devoluções futuras são liquidações projetadas da mesma obrigação, não despesas recorrentes.

Uma obrigação projetada deve permitir posteriormente pagamento total, pagamento parcial ou replanejamento. Pagamento parcial reduz recurso e obrigação somente pelo valor efetivamente liquidado; o saldo continua aberto.

### Finalização e recorrência

**DEFINIDO:** o caminho feliz termina com **Registrar despesa** como ação principal. A recorrência é opcional, fica desligada por padrão e aparece como ação secundária **Repetir este gasto → Adicionar**.

Ao ativar recorrência de despesa na Release 1, o Casa trabalha somente com repetição **mensal**. A primeira repetição é derivada automaticamente do gasto atual e a pessoa escolhe **por quanto tempo** quer repetir — por exemplo 3, 6 ou 12 próximas ocorrências, outro número de meses ou até encerrar manualmente; frequência e intervalo não são escolhas da interface. O Casa sugere a próxima repetição preservando o dia-base econômico do gasto. Em meses sem esse dia, usa o último dia válido do mês e volta ao dia-base original nos meses seguintes. A sugestão pode ser ajustada pelo usuário, mas nunca transforma a despesa atual em fato futuro.

Se houver recorrência, o produto coleta apenas os dados necessários da regra. A despesa atual é registrada uma única vez; ocorrências futuras são projeções e não novas despesas realizadas antecipadamente. Um período de 12 meses corresponde a **12 ocorrências mensais**, contando a primeira repetição. Em conta, feriado nacional ou fim de semana mantém a data econômica da ocorrência e desloca somente a data financeira prevista para o próximo dia útil. Semanal, quinzenal, anual e intervalos customizados de **despesa** ficam fora da Release 1. Quando a combinação de pagamento ou responsabilidade ainda não possui suporte canônico seguro para uma série, a recorrência fica indisponível com explicação contextual.

Se a despesa for salva e a criação da regra recorrente falhar depois, o produto preserva a referência do fato já criado e permite concluir somente a recorrência, sem cadastrar a despesa novamente.

### Fora de Nova Despesa

**Empréstimo é um fluxo separado.** A antiga opção “Um gasto / Um empréstimo — vão me devolver” dentro de Nova Despesa está **DEPRECADA**.

Também está **DEPRECADA** a organização anterior que colocava valor na primeira etapa e tornava pessoas/responsabilidade uma terceira etapa obrigatória.

## Regras de datas projetadas

Para compromissos e recebimentos projetados:

- despesa/obrigação prevista em dia não útil é movida para o **próximo dia útil**;
- receita/recebível previsto em dia não útil é antecipado para o **dia útil anterior**;
- sábado, domingo e feriados são dias não úteis.

**DEFINIDO e IMPLEMENTADO na Release 1:** o calendário usa exclusivamente os feriados **nacionais brasileiros**, mantidos como referência legal versionada no banco, de 2000 até **2030**. Entram Confraternização Universal, Tiradentes, Dia Mundial do Trabalho, Independência, Nossa Senhora Aparecida, Finados, Proclamação da República, Consciência Negra e Natal. Não entram feriados estaduais, municipais ou pontos facultativos.

A cobertura termina em 2030: uma projeção que exija data fora desse intervalo falha explicitamente até que o calendário seja ampliado por migração futura; o Casa não aplica uma regra incompleta em silêncio.

A data econômica/âncora da ocorrência é preservada. Para recorrência em conta, somente a data projetada de liquidação é movida para o próximo dia útil; para entrada recorrente, somente a data projetada de recebimento é antecipada ao dia útil anterior. Isso não cria despesa, renda, movimento de caixa, funding ou liquidação. O ciclo de fechamento e a data de compra no fechamento de cartão continuam **PENDENTES por emissor** na issue #272.

## Entradas

**DEFINIDO:** a aba **Entradas** abre como leitura/lista das entradas da perspectiva atual. O formulário não fica permanentemente exposto. A ação global **Entrada** abre uma captura rápida contextual e, após salvar, a pessoa retorna para a leitura atualizada.

Renda verdadeira inclui salário, aluguel, freelance, bônus, presente e juros/rendimento.

Categorias de despesa têm prioridade analítica maior na experiência. Entradas podem se apoiar principalmente em natureza, sem remover a capacidade de categorização de receitas para usuários que precisem dela. A categoria não deve ser obrigatória no registro e pode ser atribuída posteriormente.

**DEFINIDO e IMPLEMENTADO — Nova Entrada owner-first:** a captura começa escolhendo de quem é a entrada. Somente contas transacionais cuja titularidade inclui a pessoa escolhida aparecem como destino; conta conjunta aparece para ambos os titulares e exibe a titularidade junto do nome. Os destinos são apresentados como **cards de recursos**, seguindo a mesma linguagem visual resource-first da Nova Despesa. Uma entrada atual/conhecida começa no estado canônico `confirmed`, mas a interface usa linguagem humana: **“Sim, já sei que vou receber”** versus **“Ainda é uma expectativa”**. Isso nunca significa recebimento: o saldo só muda quando o recebimento real é registrado.

**DEFINIDO — recorrência dentro de Nova Entrada:** o fluxo owner-first permite transformar a própria entrada em uma série sem abrir uma ação paralela. O contrato existente de renda recorrente é preservado: **Todo mês** ou **Todo ano**. A pessoa escolhe a duração em linguagem humana (atalhos de duração, outro número de ocorrências ou até encerrar). A primeira ocorrência é a própria entrada informada; as seguintes são projeções independentes e nenhuma altera saldo antes do recebimento real. A gestão posterior continua pelo detalhe da ocorrência, preservando histórico.

**PENDENTE — entrada futura avulsa:** a simplificação de uma entrada futura isolada continua separada da decisão de recorrência.

Não são renda: transferência, refund, recebimento de recebível, empréstimo tomado, resgate de principal e acerto.

## Novo acerto

**DEFINIDO:** na Home, Acertos é principalmente uma leitura de posição e não deve usar “Resolver agora” como CTA dominante. A liquidação continua explícita por uma jornada de acerto. Uma transferência comum entre recursos não quita silenciosamente um acerto apenas por coincidência de valor/data.

O fluxo oferece intenções explícitas:

- Transferência entre recursos;
- Acerto entre nós;
- Acerto com outra pessoa;
- Pagamento de fatura;
- Investimento / reserva;
- Empréstimos.

Regras:

- transferência patrimonial: receita zero e despesa zero;
- pagamento de fatura: nova despesa zero; é liquidação/acerto financeiro e não item de Gastos > Compromissos;
- investimento: aporte/resgate de principal neutros, rendimento/perda separados;
- benefício: carga não é salário e uso gera despesa econômica;
- dinheiro físico: saque/depósito são transferências e gasto em dinheiro é despesa.

### Pagamento de fatura

O usuário pode confirmar itens individualmente quando necessário ou efetuar o pagamento da fatura como uma única ação operacional. O pagamento da fatura:

1. registra a saída de caixa do recurso utilizado;
2. liquida a obrigação da fatura na extensão efetivamente paga;
3. atualiza a situação dos compromissos abrangidos;
4. atualiza cartão/limite conforme aplicável;
5. não cria nova despesa econômica.

## Refund

Refund não é renda comum, mantém vínculo com a compra e pode ser integral ou parcial. Em cartão, pode aparecer na mesma fatura, em fatura futura, em conta ou como pendente. O Casa não infere silenciosamente a rota quando faltarem dados.

## Correções

Antes de produzir efeitos financeiros dependentes, um registro pode ser editado. Depois de produzir parcelas, faturas, funding, acertos ou obrigações, a correção preserva histórico e recalcula o futuro atomicamente. `DELETE` financeiro não é fluxo normal.

## Ajustes

**DEFINIDO:** Ajustes usa navegação curta, com ícone, título e no máximo uma linha de apoio. Explicações longas aparecem somente dentro da jornada correspondente.

**DEFINIDO:** o nome exibido de um membro pode ser personalizado no contexto da própria Casa, sem alterar silenciosamente sua identidade global de perfil. O membro pode editar seu próprio nome local; o responsável/owner da Casa pode editar o nome local dos membros ativos. Essa personalização deve refletir filtros, perspectivas e labels da Casa.

- Nossa Casa
- Membros
- Contas e dinheiro
- Cartões
- Categorias;
- Pessoas e terceiros;
- Preferências;
- Minha conta.

A Casa possui exatamente dois membros ativos. Não existe percentual permanente de responsabilidade por membro.

## Regra final de produto

O Casa deve sempre conseguir responder:

- Quanto temos hoje? Quanto está realmente disponível?
- Quanto está comprometido? Quanto ainda vai sair?
- Quanto ainda deve entrar? Quanto provavelmente sobra?
- Como ficam os próximos meses?
- Quanto cada membro deve assumir?
- Quem fez/comprou? Quem pagou?
- De onde saiu? De onde deverá sair?
- Quem deve quem?
- O que temos a receber? O que temos a pagar?
- Estamos saudáveis? A projeção está confiável?


## Decisões de roteamento financeiro — 2026-09-25

**DEFINIDO:**

- em Nova Entrada, a pessoa beneficiária é escolhida antes do destino; contas individuais exibidas como destino pertencem à pessoa escolhida;
- conta conjunta aparece como destino para qualquer um dos dois titulares, mas não muda quem é beneficiário econômico da renda;
- transferência realizada entre recursos exclusivos de membros diferentes reduz primeiro o acerto realizado existente no mesmo sentido;
- se houver excedente, o Casa pergunta de forma discreta se ele deve permanecer a favor do remetente ou se não precisa ser devolvido; nenhuma opção transforma automaticamente o excedente em renda;
- conta conjunta é 50/50 para liquidez e para funding realizado de saídas feitas por ela;
- investimento/reserva usam aporte/resgate de principal; poupança permanece também apta a pagamentos e transferências;
- complexidade do motor deve permanecer oculta quando o contexto permitir derivação segura.

**IMPLEMENTADO:**

- cartão na Casa abre diretamente seu contexto de fatura, com navegação temporal, itens da fatura e pagamento canônico;
- recursos exibidos em “Onde está nosso dinheiro” e “Meus recursos” abrem somente ações compatíveis com sua natureza e reutilizam os fluxos canônicos de despesa, transferência, investimento/reserva e edição.

**PROPOSTO:**

- reduzir a importância visual da ação global “Acerto”, deslocando sua liquidação para transferências e contextos onde a posição entre pessoas realmente existe;


### Refinamento da Casa — 2026-09-27

**DEFINIDO:** **O que mais pesou** deixa de fazer parte da Home. A leitura por categoria pertence a **Gastos** e **Entradas**, onde existe contexto e exploração detalhada. **Próximos acontecimentos** e **Olhando pra frente** permanecem em homologação de utilidade; não devem ganhar novas responsabilidades até nova decisão.


## Refinamento visual da Home e cartões — 2026-09-27

**DEFINIDO:**

- recursos em **Onde está nosso dinheiro** são cards visuais individuais, ordenados do maior saldo para o menor dentro de cada grupo;
- grupo e total funcionam como cabeçalho leve, sem container pesado envolvendo toda a lista;
- **Valores com pessoas** vem antes de **Próximos acontecimentos**;
- relação entre os membros da Casa tem maior destaque visual;
- terceiro mostra a responsabilidade econômica comprovável do fato de origem; não inferir 50/50 quando não houver evidência;
- tocar em cartão na Home abre diretamente as **Faturas** daquele cartão, com navegação entre faturas e pagamento contextual;
- em Nova Despesa, **Outra pessoa pagou** usa texto compacto para caber no seletor de três colunas.


## Refinamento visual e empréstimos — 2026-09-27

**DEFINIDO:**

- em **Onde está nosso dinheiro**, os cards de recursos usam **três colunas no mobile** como padrão, preservando nome, instituição/titularidade e valor;
- os ícones dos recursos devem ser semânticos: conta/banco, poupança/reserva, benefício, carteira/dinheiro e investimento não compartilham o mesmo pictograma genérico;
- os ícones podem usar acentos de cor discretos para melhorar varredura visual, sem transformar saldo ou natureza do recurso em estado de alerta;
- **Como estamos?** usa um container mais neutro/discreto; a cor fica concentrada nos indicadores financeiros (entrada, saída, expectativa/compromisso), e não em um grande fundo azul;
- em **Valores com pessoas**, empréstimos começam pelas intenções humanas **Peguei emprestado** e **Emprestei dinheiro**;
- quando **Pegar dinheiro emprestado** nasce de uma conta específica com instituição cadastrada, a instituição é o credor contextual e a conta selecionada é o destino do principal; o formulário não pergunta novamente o que já é conhecido;
- empréstimo com terceiro continua usando a pessoa como contraparte e pergunta somente o recurso de entrada/saída necessário;
- descrição e observação genéricas não fazem parte da captura principal de empréstimo; a descrição técnica é derivada pelo Casa;
- principal de empréstimo continua neutro economicamente: entrada de caixa não é renda e saída de caixa não é despesa;
- juros e tarifas contratuais são fatos econômicos separados;
- multa somente nasce quando houver atraso real.

**PENDENTE — cronograma canônico do principal:**

O modelo canônico atual de novos empréstimos usa `financial_obligations` e ainda não possui cronograma parcelado de principal. As estruturas legadas `loan_installments` / `loan_payment_schedule` não devem ser reativadas como solução paralela. Antes de oferecer **parcelado** na UX, criar um cronograma canônico compatível com obrigações, pagamentos parciais, juros/tarifas e histórico. Até lá, o formulário não deve simular parcelas apenas no frontend.
