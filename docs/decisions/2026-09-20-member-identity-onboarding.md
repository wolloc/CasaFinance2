# Decisão — identidade humana do membro no onboarding

**Data:** 2026-09-20  
**Estado:** DEFINIDO

## Contexto

Ao aceitar convite, o Casa podia usar automaticamente a parte anterior ao `@` do e-mail como `display_name`. Isso fazia um identificador técnico, como `w.luiz76`, aparecer em gastos, responsabilidades e acertos sem confirmação da pessoa.

## Decisão

- E-mail é credencial de acesso; não é identidade financeira/apresentação do membro.
- Quem cria a primeira Casa confirma seu nome no bootstrap já existente.
- Quem entra por convite deve confirmar como quer aparecer no Casa antes de acessar as superfícies financeiras.
- O nome confirmado continua sendo armazenado em `profiles.display_name` e reutilizado pelas relações canônicas existentes; não nasce uma segunda entidade de pessoa.
- O fallback derivado do e-mail pode existir apenas como valor provisório técnico antes da confirmação e não deve ser exposto como identidade financeira definitiva.
- A confirmação é persistida por `profiles.display_name_confirmed_at`.

## Impacto

Dashboard, Gastos, Entradas, Acertos e formulários que exibem membros continuam consumindo o mesmo `profiles.display_name`, agora confirmado pelo próprio membro antes da entrada no produto financeiro.

Esta decisão não altera comprador, responsabilidade econômica, funding, titularidade, caixa ou qualquer fato financeiro.
