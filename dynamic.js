const { Worker } = require('worker_threads');

const TAMANHO_BLOCO = 100000;
 
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
 
function buscarNoTamanho(senhaAlvo, alfabeto, tamanho, numThreads) {
 
  return new Promise((resolve) => {
    const total = Math.pow(alfabeto.length, tamanho);
 
    let proximoIndice = 0;
 
    let encontrada = null;
    let tentativas = 0;
    let workersVivos = numThreads;
 
    function finalizarWorker(worker) {
      worker.terminate();
      workersVivos--;
      if (workersVivos === 0) {
        resolve({ encontrada, tentativas });
      }
    }
 
    function entregarTrabalho(worker) {
      if (encontrada || proximoIndice >= total) {
        finalizarWorker(worker);
        return;
      }
      const inicio = proximoIndice;
      const fim = Math.min(inicio + TAMANHO_BLOCO, total);
      proximoIndice = fim;
      worker.postMessage({ inicio, fim });
    }
 
    for (let i = 0; i < numThreads; i++) {
      const worker = new Worker('./dynamic-worker.js', {
        workerData: { senhaAlvo, alfabeto, tamanho }
      });
 
      worker.on('message', (resultado) => {
        tentativas += resultado.tentativas;
        if (resultado.encontrada) {
          encontrada = resultado.encontrada;
        }
        entregarTrabalho(worker);
      });
 
      entregarTrabalho(worker);
    }
  });
}
 
async function crackear(senhaAlvo, alfabeto, tamanhoMax, numThreads) {
  const inicioTempo = Date.now();
  let tentativasTotais = 0;
 
  for (let tamanho = 1; tamanho <= tamanhoMax; tamanho++) {
    const resultado = await buscarNoTamanho(senhaAlvo, alfabeto, tamanho, numThreads);
    tentativasTotais += resultado.tentativas;
 
    if (resultado.encontrada) {
      return {
        encontrada: resultado.encontrada,
        tempoMs: Date.now() - inicioTempo,
        tentativas: tentativasTotais
      };
    }
  }
 
  return {
    encontrada: null,
    tempoMs: Date.now() - inicioTempo,
    tentativas: tentativasTotais
  };
}
 
module.exports = { crackear };
 
if (require.main === module) {
  const os = require('os');
 
  const senhaAlvo = process.argv[2] || 'zzzzz';
  const alfabeto = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const tamanhoMax = senhaAlvo.length;
  const numThreads = 12;
 
  console.log(`Estrategia: fila dinamica`);
  console.log(`Senha alvo: "${senhaAlvo}" | alfabeto: ${alfabeto.length} chars | threads: ${numThreads}`);
 
  crackear(senhaAlvo, alfabeto, tamanhoMax, numThreads).then((r) => {
    console.log('---');
    console.log(`Encontrada: ${r.encontrada}`);
    console.log(`Tentativas: ${r.tentativas.toLocaleString('pt-BR')}`);
    console.log(`Tempo:      ${r.tempoMs} ms`);
  });
}