# Gestão de membros da Casa

Data: 2026-10-01

## DEFINIDO — retirar membro

O responsável da Casa pode retirar outro membro ativo.

Retirar não significa apagar histórico:
- o vínculo é desativado por `deactivated_at`;
- lançamentos, transferências, responsabilidades, empréstimos e demais referências históricas continuam ligados ao mesmo `household_member.id`;
- o membro retirado deixa de aparecer em novos lançamentos e perde o vínculo ativo com a Casa;
- o owner não pode retirar a si mesmo por essa ação.

## DEFINIDO — incluir outro membro

Com menos de dois membros ativos, a Casa volta a permitir a criação de convite.

O novo membro entra pelo fluxo canônico de convite e conta própria.

Se uma pessoa anteriormente retirada for convidada novamente para a mesma Casa:
- o vínculo histórico anterior é reativado;
- não é criada uma segunda identidade de membro;
- o histórico permanece contínuo.

## DEFINIDO — perspectiva financeira

Se a perspectiva atual estiver apontando para um membro que acabou de ser retirado, o app volta automaticamente para **Nossa Casa**.

## IMPLEMENTADO — candidato de homologação

Em **Ajustes → Casa e membros**:
- owner vê ação de retirar no outro membro;
- confirmação explica que o histórico será preservado;
- após retirar, a lista de membros é atualizada;
- o bloco de convite volta a aparecer automaticamente;
- nenhum membro é removido fisicamente do banco.

## PENDENTE

Antes de uma futura operação de troca em uma Casa com uso financeiro real intenso, vale evoluir a UX para destacar posições abertas do membro que está saindo — por exemplo, saldos entre moradores ou responsabilidades futuras — sem bloquear a retirada nem reescrever o histórico.
