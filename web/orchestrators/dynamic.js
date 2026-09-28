'use strict';

const { Worker } = require('worker_threads');
const path = require('path');

const WORKER_PATH = path.join(__dirname, '..', '..', 'dynamic-worker.js');
const TAMANHO_BLOCO = 100000;

/**
 * Uma rodada = um comprimento de senha, igual a buscarNoTamanho() em
 * dynamic.js (raiz, inalterado). Reaproveita dynamic-worker.js e forwarda
 * progresso a cada bloco concluído.
 */
function buscarNoTamanho({ senhaAlvo, alfabeto, tamanho, numThreads, emitter, contador, cancelState }) {
  return new Promise((resolve) => {
    const total = Math.pow(alfabeto.length, tamanho);
    emitter.emit('rodada', { comprimento: tamanho, totalRodada: total });

    let proximoIndice = 0;
    let encontrada = null;
    let encontradaPorWorkerId = null;
    let tentativasRodada = 0;
    let workersVivos = numThreads;
    const workers = [];
    const tentativasPorWorker = new Array(numThreads).fill(0);
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

    function finalizarWorker(worker, workerId) {
      worker.terminate().catch(() => {});
      let estado = 'esgotada';
      if (workerId === encontradaPorWorkerId) {
        estado = 'encontrou';
      } else if (encontrada || cancelState.cancelado) {
        estado = 'interrompida';
      }
      emitter.emit('thread_estado', {
        workerId,
        estado,
        tentativas: tentativasPorWorker[workerId],
      });
    }

    function entregarTrabalho(worker, workerId) {
      if (cancelState.cancelado || encontrada || proximoIndice >= total) {
        finalizarWorker(worker, workerId);
        return;
      }
      const inicio = proximoIndice;
      const fim = Math.min(inicio + TAMANHO_BLOCO, total);
      proximoIndice = fim;
      worker.postMessage({ inicio, fim });
    }

    for (let i = 0; i < numThreads; i++) {
      const workerId = i;
      const worker = new Worker(WORKER_PATH, {
        workerData: { senhaAlvo, alfabeto, tamanho },
      });
      workers.push(worker);
      emitter.emit('thread_estado', { workerId, estado: 'rodando', tentativas: 0 });

      worker.on('message', (resultado) => {
        tentativasRodada += resultado.tentativas;
        tentativasPorWorker[workerId] += resultado.tentativas;
        contador.total += resultado.tentativas;

        if (resultado.encontrada) {
          encontrada = resultado.encontrada;
          encontradaPorWorkerId = workerId;
        }

        emitter.emit('progresso', {
          workerId,
          tentativas: tentativasPorWorker[workerId],
          tentativasTotais: contador.total,
          comprimento: tamanho,
        });

        entregarTrabalho(worker, workerId);
      });

      worker.on('exit', () => contabilizarFinalizacao(workerId));

      entregarTrabalho(worker, workerId);
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
