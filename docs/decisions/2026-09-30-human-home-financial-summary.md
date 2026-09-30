# Casa — leitura financeira humana

Data: 2026-09-30

## PROPOSTO — em homologação
A Home deve traduzir o motor financeiro em uma leitura de vida financeira antes de expor a composição técnica.

A primeira camada responde, nesta ordem:

1. **Como estamos?** — mensagem humana sobre a situação do mês.
2. **Quanto temos hoje?** — liquidez disponível agora.
3. **O que ainda acontece?** — entradas e saídas ainda esperadas.
4. **Como devemos terminar?** — fechamento projetado do mês.

Exemplos de linguagem:
- **Estamos tranquilos neste mês**;
- **O mês fecha, contando com o que ainda entra**;
- **Vamos precisar mexer em outros recursos**;
- **Precisamos nos organizar neste mês**.

A composição detalhada continua disponível, mas em segundo nível, fechada por padrão em **Entender essa previsão**.

## PROPOSTO — meses futuros
A leitura futura deve priorizar:
- se o mês tende a fechar positivo ou negativo;
- quanto ainda deve entrar;
- quanto ainda deve sair;
- fechamento projetado.

Termos internos como **Realizado / Comprometido / Planejado** permanecem no motor e na documentação de domínio, mas deixam de ser a linguagem dominante da Home.

## DEFINIDO — guardrails preservados
Esta proposta não altera:
- saldo real;
- reconhecimento de receita ou despesa;
- regras de projeção;
- separação entre caixa, reserva e investimento;
- perspectiva individual;
- valores entre moradores;
- atenção financeira;
- cronogramas de empréstimos.

## IMPLEMENTADO — candidato de homologação
A branch de homologação:
- humaniza o resumo do mês atual;
- fecha a composição detalhada por padrão;
- simplifica a leitura dos meses futuros;
- mantém todas as fontes canônicas e valores existentes.

A aprovação final da linguagem e hierarquia visual depende do teste do PM.
