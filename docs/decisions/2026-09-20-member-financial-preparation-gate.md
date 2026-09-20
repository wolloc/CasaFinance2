# Decisão — gate de preparação financeira do membro

**Data:** 2026-09-20  
**Estado:** DEFINIDO

Um membro convidado não é levado diretamente a Dashboard, Gastos, Entradas ou Acertos.

Após confirmar seu nome, ele passa por uma preparação curta:
1. entende que entrou em uma Casa já existente;
2. pode cadastrar os recursos que deseja acompanhar;
3. pode declarar que não tem recursos novos para adicionar agora;
4. conclui explicitamente a preparação e então acessa o produto cotidiano.

A conclusão é uma marca de UX em `profiles.financial_onboarding_completed_at`; não é fato financeiro. Ela não cria saldos, movimentos, receitas, despesas ou obrigações.

Proprietários de Casas já existentes são preservados como concluídos na introdução deste gate, evitando bloquear usuários atuais.
