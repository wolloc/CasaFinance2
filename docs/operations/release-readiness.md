# Homologação, backup e recuperação

## Promoção de ambientes

Cada ambiente deve usar projeto Supabase e credenciais próprios. `development` pode rodar localmente; `staging` recebe migrations e o artefato aprovado pela CI; `production` só recebe o mesmo artefato após homologação de Wallace e Guilherme e evidência de backup/restore.

## O que a CI já prova

O Marco 3 elevou significativamente o gate automático. Hoje a CI executa, em runner descartável:

- replay de todas as migrations desde banco vazio;
- pgTAP dinâmico de RLS;
- Auth real, JWT e PostgREST;
- convite/aceite e Casa compartilhada;
- relogin/continuidade de sessão cobertos pelo fluxo de produto;
- despesa direta real pela API do Supabase;
- comprador, responsabilidade econômica e funder independentes;
- um único movimento de caixa para a liquidação direta testada;
- isolamento financeiro de uma pessoa externa em outra Casa;
- TypeScript, testes, Playwright, scan de segredos, `npm audit` e build.

Essas evidências eliminam os antigos bloqueadores que diziam que RLS era apenas estática, que não havia JWT real ou que o app principal ainda dependia de Maps/identidade simulada.

## Roteiro funcional obrigatório de staging

- [ ] Criar projeto Supabase de staging separado de produção.
- [ ] Aplicar todas as migrations desde zero e comparar com a CI.
- [ ] Criar Casa e convidar o segundo membro.
- [ ] Sair e entrar novamente com os dois usuários.
- [ ] Cadastrar contas e cartões reais de homologação.
- [ ] Registrar salário recebido.
- [ ] Registrar despesa direta compartilhada e conferir comprador, responsável e pagador.
- [ ] Transferir entre contas e confirmar resultado econômico inalterado.
- [ ] Registrar compra no cartão parcelada sem débito bancário imediato.
- [ ] Pagar fatura e confirmar ausência de despesa duplicada.
- [ ] Reconhecer juros/tarifas/multa de empréstimo sem caixa e depois efetuar pagamento composto único.
- [ ] Conferir acerto realizado e projetado do casal.
- [ ] Validar investimento/aporte/resgate sem classificar transferência de patrimônio como renda/despesa.
- [ ] Tentar acessar a Casa com pessoa externa e confirmar bloqueio.
- [ ] Conferir comportamento em iPhone real de Wallace e Guilherme.

## Backup e recuperação

Antes de qualquer produção, staging deve provar o procedimento completo de backup e restore. Não basta ter o comando documentado.

Fluxo mínimo:

1. gerar dump verificável do banco de staging;
2. restaurar em projeto isolado;
3. aplicar migrations pendentes de forma controlada;
4. comparar contagens e posições financeiras relevantes;
5. executar os gates de RLS/Auth/financeiro contra a restauração;
6. registrar duração, artefatos e responsável pela validação.

Migrations financeiras devem continuar preferencialmente aditivas/forward-only. Evitar rollback destrutivo e `DROP CASCADE` em produção.

## Gate atual de publicação

**Decisão atual: NÃO PUBLICAR AINDA.**

A razão agora não é mais falta de persistência real ou de autenticação/RLS dinâmica. Esses pontos já têm cobertura no Marco 3. O bloqueio restante é operacional e de homologação.

| Severidade | Pendência | Saída exigida |
|---|---|---|
| Alto | Ainda não há evidência registrada de staging separado com a configuração real de release. | Criar/configurar staging e executar o roteiro funcional completo. |
| Alto | Backup/restore ainda não foi comprovado em ambiente de staging. | Restaurar dump em projeto isolado e reconciliar posições financeiras. |
| Alto | Wallace e Guilherme ainda não homologaram juntos o ciclo mensal em dispositivos reais. | Executar roteiro de aceite nos dois logins e registrar bloqueadores. |
| Médio | `server/` e OCR legados continuam no repositório. | Garantir que não entrem no caminho de produção; remover ou isolar explicitamente. |
| Médio | Distribuição iOS/App Store ainda não foi preparada. | Definir wrapper/build/distribuição somente após staging aprovado. |

Nenhuma publicação é autorizada enquanto houver item **Alto** aberto.

## Critério para liberar beta

Um beta privado pode ser preparado quando:

- staging estiver configurado e estável;
- backup/restore tiver evidência reproduzível;
- os dois usuários conseguirem operar a mesma Casa sem intervenção manual em Supabase/Codespaces;
- nenhum fluxo financeiro crítico produzir duplicidade de despesa/receita/caixa;
- isolamento entre Casas permanecer verde;
- CI do head exato do release estiver totalmente verde.

## Depois do beta

Somente após o beta funcional devem entrar em prioridade: empacotamento iOS, assinatura, distribuição, App Store/TestFlight e polimento específico de publicação. Isso evita gastar energia de release sobre uma base que ainda não foi homologada operacionalmente.
