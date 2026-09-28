const { parentPort, workerData } = require('worker_threads');
 
const { senhaAlvo, alfabeto, tamanho } = workerData;
 
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
 

parentPort.on('message', ({ inicio, fim }) => {
  let tentativas = 0;
  let encontrada = null;
 
  for (let i = inicio; i < fim; i++) {
    tentativas++;
    const candidato = numeroParaSenha(i, alfabeto, tamanho);
 
    if (candidato === senhaAlvo) {
      encontrada = candidato;
      break;
    }
  }
 
  parentPort.postMessage({ encontrada, tentativas });
});