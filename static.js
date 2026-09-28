 'use strict';
 
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

function calcularOffsets(alfabetoLen, tamanhoMax) {
  const offsets = [0];
  let acc = 0;
  for (let L = 1; L <= tamanhoMax; L++) {
    acc += Math.pow(alfabetoLen, L); 
    offsets.push(acc);
  }
  return offsets;
}
 
function totalCombinacoes(offsets) {
  return offsets[offsets.length - 1];
}
function indiceParaSenha(indice, alfabeto, offsets) {
  const base = alfabeto.length;
 
  let L = 1;
  while (offsets[L] <= indice) L++;
 
  let n = indice - offsets[L - 1];
  const chars = new Array(L);
  for (let i = L - 1; i >= 0; i--) {
    chars[i] = alfabeto[n % base];
    n = Math.floor(n / base);
  }
  return chars.join('');
}
 
if (!isMainThread) {
  const { senhaAlvo, alfabeto, tamanhoMax, inicio, fim, workerId } = workerData;

  const offsets = calcularOffsets(alfabeto.length, tamanhoMax);
 
  const REPORT_A_CADA = 50000;
  let tentativas = 0;
 
  for (let idx = inicio; idx < fim; idx++) {
    const candidata = indiceParaSenha(idx, alfabeto, offsets);
    tentativas++;
 
    if (candidata === senhaAlvo) {
      parentPort.postMessage({
        tipo: 'encontrada',
        workerId,
        senha: candidata,
        tentativas,
      });
      return;
    }
 
    if (tentativas % REPORT_A_CADA === 0) {
      parentPort.postMessage({ tipo: 'progresso', workerId, tentativas });
    }
  }
 
  parentPort.postMessage({ tipo: 'esgotado', workerId, tentativas });
}
 

function crackear(senhaAlvo, alfabeto, tamanhoMax, numThreads) {
  return new Promise((resolve) => {
    const inicioTempo = process.hrtime.bigint();
 
    const offsets = calcularOffsets(alfabeto.length, tamanhoMax);
    const total = totalCombinacoes(offsets);
    const tamanhoFatia = Math.ceil(total / numThreads);
 
    const workers = [];
    const tentativasPorWorker = new Array(numThreads).fill(0);
 
    let finalizado = false;
    let workersRestantes = numThreads;
 
    function encerrarTudo(resultado) {
      if (finalizado) return;
      finalizado = true;
 
      const fimTempo = process.hrtime.bigint();
      const tempoMs = Number(fimTempo - inicioTempo) / 1e6;
 
      for (const w of workers) {
        w.terminate().catch(() => {});
      }
 
      const tentativasTotais = tentativasPorWorker.reduce((a, b) => a + b, 0);
 
      resolve({
        encontrada: resultado.senha || null,
        tempoMs: Number(tempoMs.toFixed(3)),
        tentativas: tentativasTotais,
      });
    }
 
    for (let w = 0; w < numThreads; w++) {
      const inicio = w * tamanhoFatia;
      const fim = Math.min(inicio + tamanhoFatia, total);
 
      if (inicio >= fim) {
        workersRestantes--;
        continue;
      }
 
      const worker = new Worker(__filename, {
        workerData: {
          senhaAlvo,
          alfabeto,
          tamanhoMax,
          inicio,
          fim,
          workerId: w,
        },
      });
 
      workers.push(worker);
 
      worker.on('message', (msg) => {
        if (msg.tipo === 'progresso') {
          tentativasPorWorker[msg.workerId] = msg.tentativas;
        } else if (msg.tipo === 'encontrada') {
          tentativasPorWorker[msg.workerId] = msg.tentativas;
          encerrarTudo({ senha: msg.senha });
        } else if (msg.tipo === 'esgotado') {
          tentativasPorWorker[msg.workerId] = msg.tentativas;
          workersRestantes--;
          if (workersRestantes === 0 && !finalizado) {
            encerrarTudo({ senha: null });
          }
        }
      });
 
      worker.on('error', (err) => {
        console.error(`Erro no worker ${w}:`, err);
        workersRestantes--;
        if (workersRestantes === 0 && !finalizado) {
          encerrarTudo({ senha: null });
        }
      });
    }
 
    if (workersRestantes === 0 && !finalizado) {
      encerrarTudo({ senha: null });
    }
  });
}

if (isMainThread && require.main === module) {
  const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const SENHA_ALVO = process.argv[2] || 'zzzzz';
  const TAMANHO_MAX = SENHA_ALVO.length;
  const NUM_THREADS = 4;
 
  console.log('Estrategia: divisao estatica');
  console.log(`Senha alvo: "${SENHA_ALVO}" | alfabeto: ${ALFABETO.length} chars | threads: ${NUM_THREADS}`);
 
  crackear(SENHA_ALVO, ALFABETO, TAMANHO_MAX, NUM_THREADS).then((resultado) => {
    console.log('---');
    console.log(`Encontrada: ${resultado.encontrada}`);
    console.log(`Tentativas: ${resultado.tentativas.toLocaleString('pt-BR')}`);
    console.log(`Tempo:      ${resultado.tempoMs} ms`);
  });
}
 
module.exports = { crackear };