# Recuperação segura de falha parcial na recorrência

**Status: DEFINIDO**

Quando a despesa atual for persistida com sucesso, mas a criação da regra recorrente ou do horizonte futuro falhar, o produto deve tratar a despesa como **já registrada**.

Nesse estado:

- o Casa não deve criar outra despesa ao tentar concluir a recorrência;
- os campos do gasto já persistido não devem continuar editáveis como se ainda fossem parte de um novo cadastro;
- o produto deve informar explicitamente que a despesa já existe e que falta apenas concluir a recorrência;
- a referência do fato econômico persistido deve sobreviver ao fechamento e reabertura do fluxo no mesmo dispositivo;
- antes de criar uma nova regra no recovery, o cliente deve reconciliar se uma regra compatível já foi persistida;
- somente após regra e horizonte estarem confirmados o estado de recuperação pode ser descartado.

Essa regra existe para preservar a invariante de que uma despesa econômica é reconhecida exatamente uma vez.
