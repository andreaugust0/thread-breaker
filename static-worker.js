'use strict';


const { parentPort, workerData } = require('worker_threads');

function combinacoesDoTamanho(alfabetoLen, L) {
  return Math.pow(alfabetoLen, L);
}

function indiceParaSenha(indice, alfabeto, tamanhoMax) {
  const base = alfabeto.length;
  let restante = indice;

  for (let L = 1; L <= tamanhoMax; L++) {
    const qtd = combinacoesDoTamanho(base, L);
    if (restante < qtd) {
      const chars = new Array(L);
      let n = restante;
      for (let i = L - 1; i >= 0; i--) {
        chars[i] = alfabeto[n % base];
        n = Math.floor(n / base);
      }
      return chars.join('');
    }
    restante -= qtd;
  }
  return null; 
}

const { senhaAlvo, alfabeto, tamanhoMax, inicio, fim, workerId } = workerData;

const REPORT_A_CADA = 50000; // reporta progresso periodicamente pro main
let tentativas = 0;

for (let idx = inicio; idx < fim; idx++) {
  const candidata = indiceParaSenha(idx, alfabeto, tamanhoMax);
  tentativas++;

  if (candidata === senhaAlvo) {
    parentPort.postMessage({
      tipo: 'encontrada',
      workerId,
      senha: candidata,
      tentativas,
    });
    process.exit(0);
  }

  if (tentativas % REPORT_A_CADA === 0) {
    parentPort.postMessage({ tipo: 'progresso', workerId, tentativas });
  }
}

parentPort.postMessage({ tipo: 'esgotado', workerId, tentativas });