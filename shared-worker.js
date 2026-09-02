const { parentPort, workerData } = require('worker_threads'); 

const { senhaAlvo, alfabeto, tamanho, inicio, fim, bufferCompartilhado } = workerData; 
const bandeira = new Int32Array(bufferCompartilhado); 

let tentativas = 0;
let encontrada = null; 


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

for (let i = inicio; i < fim; i++) { 

  if (i % 1000 === 0 && Atomics.load(bandeira, 0) === 1) {
    break;
  }

  tentativas++; 
  const candidato = numeroParaSenha(i, alfabeto, tamanho); 

  if (candidato === senhaAlvo) { 
    Atomics.store(bandeira, 0, 1); 
    encontrada = candidato;
    break;
  }
}

parentPort.postMessage({ encontrada, tentativas }); 

