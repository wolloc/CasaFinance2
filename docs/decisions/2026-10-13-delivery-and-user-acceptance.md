# Processo de entrega e homologação pelo Product Owner

**Status:** DEFINIDO  
**Data:** 2026-10-13  
**Escopo:** fluxo de trabalho para entregas do Casa Finance.

## Princípio

O squad é responsável por entregar uma mudança integrada e tecnicamente validada antes de solicitar homologação. O Product Owner valida o produto sob a perspectiva de uso, clareza e aderência ao resultado esperado; não deve ser colocado na posição de descobrir falhas técnicas básicas ou testar uma implementação incompleta.

## Responsabilidades

### Squad de implementação

Antes da homologação, o squad deve:

- entender a implementação atual, as regras de domínio e as decisões documentadas;
- concluir o escopo combinado, incluindo código, integração entre componentes e feedbacks de interface;
- preservar os fluxos existentes que não fazem parte da mudança;
- adicionar ou atualizar testes automatizados proporcionais ao risco;
- corrigir falhas identificadas pela validação interna, sem transferir depuração técnica ao Product Owner;
- atualizar a documentação de domínio, arquitetura ou decisão quando a entrega alterar comportamento relevante.

### QA técnico e financeiro

A validação interna deve cobrir, conforme o risco da mudança:

- TypeScript, lint, testes unitários e de integração, build e gates de segurança;
- fluxos completos, não apenas testes isolados de funções ou verificações de texto-fonte;
- invariantes financeiros afetados, incluindo centavos, alocações, caixa, competência, projeções, liquidações e idempotência;
- isolamento entre casas, permissões e RLS nas mudanças de persistência;
- migrations reproduzidas em banco isolado e testes específicos de banco quando houver mudança de schema, RPC, trigger ou view.

Uma suíte geral verde não substitui os testes específicos dos novos comportamentos financeiros.

## Critérios para liberar a homologação

A entrega só deve ser apresentada ao Product Owner quando:

1. todo o escopo acordado para aquela entrega estiver implementado e integrado;
2. os fluxos envolvidos não dependerem de etapas técnicas ainda incompletas;
3. os testes pertinentes passarem, com evidências e falhas conhecidas explicitadas;
4. os cenários financeiros relevantes tiverem validação específica;
5. o ambiente de Staging/preview estiver atualizado, acessível e com dados de teste adequados;
6. houver um roteiro curto de homologação orientado a jornadas e resultados esperados.

Não é necessário esperar que todo o aplicativo esteja perfeito: a unidade de entrega é o escopo combinado, concluído de ponta a ponta.

## Homologação pelo Product Owner

Na homologação, o Product Owner avalia principalmente:

- se a jornada faz sentido para a pessoa usuária;
- se os textos, estados, valores e próximos passos são claros;
- se a interface reduz esforço e previne erros;
- se os resultados financeiros apresentados correspondem às regras acordadas;
- se a entrega resolve o problema que motivou o trabalho.

Se encontrar divergência, o squad deve classificar a causa — regra de produto, UX/UI, dados, integração ou implementação — e retornar com diagnóstico e correção, em vez de pedir ao Product Owner que investigue tecnicamente.

## Segurança de dados e Staging

- Não aplicar migrations financeiras em Staging ou produção antes da revisão e da validação isolada exigidas pelo risco.
- Não usar dados financeiros existentes como massa de teste destrutiva.
- Não criar, inferir, corrigir ou importar obrigações financeiras históricas sem origem canônica comprovada e plano de reconciliação.
- Informar explicitamente quando uma entrega exigir atualização de schema no Supabase e qual sequência segura deve ser seguida.
- Nenhuma homologação autoriza automaticamente o deploy em produção; publicação segue os gates e o processo de release do repositório.

## Checklist de handoff

A solicitação de homologação deve informar:

- **Escopo concluído:** o que foi entregue;
- **Regras preservadas:** principais invariantes aplicáveis;
- **Evidências:** testes executados e resultados;
- **Ambiente:** URL/branch/commit que contém a entrega;
- **Roteiro:** cenários de usuário e resultado esperado;
- **Pendências/riscos:** somente os que não bloqueiam a homologação, claramente identificados;
- **Banco:** migrations necessárias e status de aplicação, sem afirmar aplicação não confirmada.

## Definição de pronto

**Pronto para homologação** significa que o squad concluiu e integrou o escopo acordado, validou tecnicamente os fluxos e regras financeiras afetados, e preparou um ambiente seguro para avaliação do produto.

**Aprovado pelo Product Owner** significa que a experiência entregue corresponde às necessidades e regras de produto. Essa aprovação ocorre depois do handoff técnico e não substitui os gates de segurança, CI ou release.
