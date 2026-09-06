-- Etapa 10AJ parte 1: permitir que uma perna apenas projetada seja encerrada sem apagá-la.
alter type public.money_movement_state add value if not exists 'cancelled';
