# Thread Breaker

Demonstração prática do poder de threads aplicadas a um problema de força bruta.
O projeto quebra senhas por tentativa e erro e mede como o uso de múltiplas
threads afeta o tempo de execução, evidenciando os ganhos e os limites do
paralelismo.

> Projeto acadêmico desenvolvido para a disciplina de Sistemas Operacionais
> do curso de Engenharia de Software do INATEL.

## Objetivo

Mostrar, com medições reais, que threads aceleram um problema paralelizável
(força bruta), mas que esse ganho é limitado pelo número de núcleos do
processador e não acompanha o crescimento exponencial do espaço de busca
conforme a senha aumenta.

## Estratégias

O projeto compara quatro estratégias de concorrência, cada uma implementada
de forma independente:

- **Single-thread** — busca sequencial em uma única thread (base de comparação).
- **Divisão estática** — o espaço de busca é dividido em fatias iguais entre N workers.
- **Fila dinâmica** — os workers puxam trabalho de uma fila conforme terminam (balanceamento de carga).
- **Memória compartilhada** — divisão estática com parada coordenada: quando um worker encontra a senha, os demais são interrompidos via flag em memória compartilhada com acesso atômico.

## Tecnologias

- Node.js (Worker Threads)
- SharedArrayBuffer e Atomics para memória compartilhada e sincronização

## Como executar

Requer Node.js 18 ou superior. Não há dependências externas.

## Integrantes

- Kaik Freitas
- André Augusto
- Arthur Rabelo
- Pedro Souza