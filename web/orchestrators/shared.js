'use strict';

const { Worker } = require('worker_threads');
const path = require('path');

const WORKER_PATH = path.join(__dirname, '..', '..', 'shared-worker.js');

/**
 * Uma rodada = um comprimento de senha, igual a buscarNoTamanho() em
 * shared.js (raiz, inalterado). Reaproveita shared-worker.js. Cada worker só
 * manda UMA mensagem final (limitação do próprio shared-worker.js) — não há
 * progresso intermediário real aqui, só estado inicial/final por thread.
 */
function buscarNoTamanho({ senhaAlvo, alfabeto, tamanho, numThreads, emitter, contador, cancelState }) {
  return new Promise((resolve) => {
    const total = Math.pow(alfabeto.length, tamanho);
    emitter.emit('rodada', { comprimento: tamanho, totalRodada: total });

    const tamanhoFatia = Math.ceil(total / numThreads);
    const bufferCompartilhado = new SharedArrayBuffer(4);

    let encontrada = null;
    let tentativasRodada = 0;
    let workersVivos = numThreads;
    const workers = [];
    const finalizados = new Set();

    cancelState.workers = workers;

    function contabilizarFinalizacao(workerId) {
      if (finalizados.has(workerId)) return;
      finalizados.add(workerId);
      workersVivos--;
      if (workersVivos === 0) {
        resolve({ encontrada, tentativas: tentativasRodada });
      }
    }

    for (let i = 0; i < numThreads; i++) {
      const workerId = i;
      const inicio = i * tamanhoFatia;
      const fim = Math.min((i + 1) * tamanhoFatia, total);

      const worker = new Worker(WORKER_PATH, {
        workerData: { senhaAlvo, alfabeto, tamanho, inicio, fim, bufferCompartilhado },
      });
      workers.push(worker);

      emitter.emit('thread_estado', { workerId, estado: 'rodando', tentativas: 0 });

      worker.on('message', (resultado) => {
        tentativasRodada += resultado.tentativas;
        contador.total += resultado.tentativas;
        if (resultado.encontrada) {
          encontrada = resultado.encontrada;
        }
        emitter.emit('progresso', {
          workerId,
          tentativas: resultado.tentativas,
          tentativasTotais: contador.total,
          comprimento: tamanho,
        });
        emitter.emit('thread_estado', {
          workerId,
          estado: resultado.encontrada ? 'encontrou' : 'esgotada',
          tentativas: resultado.tentativas,
        });
        worker.terminate().catch(() => {});
      });

      worker.on('exit', () => contabilizarFinalizacao(workerId));
    }
  });
}

function iniciar({ senhaAlvo, alfabeto, tamanhoMax, numThreads }, emitter) {
  const inicioTempo = process.hrtime.bigint();
  const contador = { total: 0 };
  const cancelState = { cancelado: false, workers: [] };

  emitter.emit('iniciado', {
    numThreads,
    workers: Array.from({ length: numThreads }, (_, workerId) => ({ workerId })),
  });

  (async () => {
    let encontrada = null;

    for (let tamanho = 1; tamanho <= tamanhoMax && !cancelState.cancelado; tamanho++) {
      const resultado = await buscarNoTamanho({
        senhaAlvo, alfabeto, tamanho, numThreads, emitter, contador, cancelState,
      });

      if (resultado.encontrada) {
        encontrada = resultado.encontrada;
        break;
      }
    }

    const fimTempo = process.hrtime.bigint();
    const tempoMs = Number(fimTempo - inicioTempo) / 1e6;

    emitter.emit('concluido', {
      encontrada,
      tempoMs: Number(tempoMs.toFixed(3)),
      tentativas: contador.total,
      cancelado: cancelState.cancelado,
    });
  })();

  return {
    cancelar() {
      cancelState.cancelado = true;
      for (const w of cancelState.workers) {
        w.terminate().catch(() => {});
      }
    },
  };
}

module.exports = { iniciar };
