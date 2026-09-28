'use strict';

// Sem worker: não roda single.js original (síncrono/recursivo) dentro do
// processo do servidor porque travaria o event loop inteiro (nenhuma
// mensagem WS sai até terminar). Enumera o mesmo espaço de busca, na mesma
// ordem (comprimento 1 completo, depois 2, ...), cedendo o event loop
// periodicamente para poder reportar progresso.

function numeroParaSenha(numero, alfabeto, tamanho) {
  const base = alfabeto.length;
  let senha = '';
  for (let i = 0; i < tamanho; i++) {
    const resto = numero % base;
    senha = alfabeto[resto] + senha;
    numero = Math.floor(numero / base);
  }
  return senha;
}

const REPORT_A_CADA = 20000;

function iniciar({ senhaAlvo, alfabeto, tamanhoMax }, emitter) {
  const inicioTempo = process.hrtime.bigint();
  let cancelado = false;
  let tentativasTotais = 0;

  emitter.emit('iniciado', { numThreads: 1, workers: [{ workerId: 0 }] });

  (async () => {
    emitter.emit('thread_estado', { workerId: 0, estado: 'rodando', tentativas: 0 });

    let encontrada = null;

    for (let tamanho = 1; tamanho <= tamanhoMax && !encontrada && !cancelado; tamanho++) {
      const total = Math.pow(alfabeto.length, tamanho);
      emitter.emit('rodada', { comprimento: tamanho, totalRodada: total });

      let tentativasRodada = 0;
      for (let i = 0; i < total; i++) {
        if (cancelado) break;
        tentativasRodada++;
        tentativasTotais++;

        const candidata = numeroParaSenha(i, alfabeto, tamanho);
        if (candidata === senhaAlvo) {
          encontrada = candidata;
          break;
        }

        if (tentativasRodada % REPORT_A_CADA === 0) {
          emitter.emit('progresso', {
            workerId: 0,
            tentativas: tentativasRodada,
            tentativasTotais,
            comprimento: tamanho,
          });
          await new Promise((resolve) => setImmediate(resolve));
        }
      }
    }

    emitter.emit('thread_estado', {
      workerId: 0,
      estado: encontrada ? 'encontrou' : 'esgotada',
      tentativas: tentativasTotais,
    });

    const fimTempo = process.hrtime.bigint();
    const tempoMs = Number(fimTempo - inicioTempo) / 1e6;

    emitter.emit('concluido', {
      encontrada,
      tempoMs: Number(tempoMs.toFixed(3)),
      tentativas: tentativasTotais,
      cancelado,
    });
  })();

  return {
    cancelar() {
      cancelado = true;
    },
  };
}

module.exports = { iniciar };
