const { Worker } = require('worker_threads'); 

function buscarNoTamanho(senhaAlvo, alfabeto, tamanho, numThreads) { 

  return new Promise((resolve) => {
    const total = Math.pow(alfabeto.length, tamanho);
    const tamanhoFatia = Math.ceil(total / numThreads); 

    
    const bufferCompartilhado = new SharedArrayBuffer(4); 

    let contaThreads = 0;       
    let encontrada = null;   
    let tentativas = 0;       

    for (let i = 0; i < numThreads; i++) {
      const inicio = i * tamanhoFatia; 
      const fim = Math.min((i + 1) * tamanhoFatia, total);

      const worker = new Worker('./shared-worker.js', { 
        workerData: { senhaAlvo, alfabeto, tamanho, inicio, fim, bufferCompartilhado }
      });

      worker.on('message', (resultado) => {
        contaThreads++;
        tentativas += resultado.tentativas;      
        if (resultado.encontrada) {
          encontrada = resultado.encontrada;     
        }

        if (contaThreads === numThreads) {
          resolve({ encontrada, tentativas });   
        }
      });
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


 