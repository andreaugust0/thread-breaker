'use strict';

const { Worker } = require('worker_threads');
const path = require('path');

const WORKER_PATH = path.join(__dirname, '..', '..', 'static-worker.js');

function calcularOffsets(alfabetoLen, tamanhoMax) {
  const offsets = [0];
  let acc = 0;
  for (let L = 1; L <= tamanhoMax; L++) {
    acc += Math.pow(alfabetoLen, L);
    offsets.push(acc);
  }
  return offsets;
}

/**
 * Reaproveita static-worker.js (raiz do projeto, inalterado) e replica a
 * coordenação de static.js, mas forwarding o progresso de cada worker para
 * fora em tempo real via `emitter`, em vez de só acumular internamente.
 */
function iniciar({ senhaAlvo, alfabeto, tamanhoMax, numThreads }, emitter) {
  const inicioTempo = process.hrtime.bigint();

  const offsets = calcularOffsets(alfabeto.length, tamanhoMax);
  const total = offsets[offsets.length - 1];
  const tamanhoFatia = Math.ceil(total / numThreads);

  const workers = [];
  const tentativasPorWorker = new Array(numThreads).fill(0);

  let finalizado = false;
  let cancelado = false;
  let workersRestantes = numThreads;

  emitter.emit('iniciado', {
    total,
    numThreads,
    workers: Array.from({ length: numThreads }, (_, workerId) => ({ workerId })),
  });

  function encerrarTudo(senha) {
    if (finalizado) return;
    finalizado = true;

    const fimTempo = process.hrtime.bigint();
    const tempoMs = Number(fimTempo - inicioTempo) / 1e6;

    for (const w of workers) {
      w.terminate().catch(() => {});
    }

    const tentativasTotais = tentativasPorWorker.reduce((a, b) => a + b, 0);

    emitter.emit('concluido', {
      encontrada: senha,
      tempoMs: Number(tempoMs.toFixed(3)),
      tentativas: tentativasTotais,
      cancelado,
    });
  }

  for (let w = 0; w < numThreads; w++) {
    const inicio = w * tamanhoFatia;
    const fim = Math.min(inicio + tamanhoFatia, total);

    const worker = new Worker(WORKER_PATH, {
      workerData: { senhaAlvo, alfabeto, tamanhoMax, inicio, fim, workerId: w },
    });
    workers.push(worker);

    emitter.emit('thread_estado', { workerId: w, estado: 'rodando', tentativas: 0 });

    worker.on('message', (msg) => {
      if (msg.tipo === 'progresso') {
        tentativasPorWorker[msg.workerId] = msg.tentativas;
        const tentativasTotais = tentativasPorWorker.reduce((a, b) => a + b, 0);
        emitter.emit('progresso', {
          workerId: msg.workerId,
          tentativas: msg.tentativas,
          tentativasTotais,
        });
      } else if (msg.tipo === 'encontrada') {
        tentativasPorWorker[msg.workerId] = msg.tentativas;
        emitter.emit('thread_estado', { workerId: msg.workerId, estado: 'encontrou', tentativas: msg.tentativas });
        encerrarTudo(msg.senha);
      } else if (msg.tipo === 'esgotado') {
        tentativasPorWorker[msg.workerId] = msg.tentativas;
        emitter.emit('thread_estado', { workerId: msg.workerId, estado: 'esgotada', tentativas: msg.tentativas });
        workersRestantes--;
        if (workersRestantes === 0 && !finalizado) {
          encerrarTudo(null);
        }
      }
    });

    worker.on('error', (err) => {
      emitter.emit('erro_worker', { workerId: w, mensagem: err.message });
      workersRestantes--;
      if (workersRestantes === 0 && !finalizado) {
        encerrarTudo(null);
      }
    });
  }

  return {
    cancelar() {
      cancelado = true;
      encerrarTudo(null);
    },
  };
}

module.exports = { iniciar };
