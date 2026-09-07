const { Worker } = require('worker_threads');
 
// Tamanho de cada bloco distribuido pela fila.
// Blocos menores => melhor balanceamento de carga (nenhum worker fica com
// uma fatia gigante enquanto os outros ja acabaram), mas mais troca de
// mensagens com a thread principal. Blocos maiores => menos mensagens,
// porem balanceamento pior. Este valor e o meio-termo.
const TAMANHO_BLOCO = 5000;
 
// Converte um numero (indice) na senha correspondente do espaco de busca.
// E a mesma logica das outras estrategias: tratamos o alfabeto como digitos
// de uma base, entao cada indice vira uma combinacao unica.
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
 
    // A "fila dinamica" e simplesmente o proximo indice ainda nao entregue.
    // Diferente da divisao estatica, NAO cortamos o espaco em N fatias fixas
    // no inicio. Entregamos blocos pequenos sob demanda: quem termina o seu
    // bloco volta e pega o proximo. Assim as threads terminam praticamente
    // juntas, sem nenhuma ociosa esperando as outras (balanceamento de carga).
    let proximoIndice = 0;
 
    let encontrada = null;
    let tentativas = 0;
    let workersVivos = numThreads;
 
    // Desliga um worker e resolve a busca quando todos ja pararam.
    function finalizarWorker(worker) {
      worker.terminate();
      workersVivos--;
      if (workersVivos === 0) {
        resolve({ encontrada, tentativas });
      }
    }
 
    // Entrega o proximo bloco da fila para o worker.
    // Se a senha ja foi achada ou a fila esvaziou, encerra este worker.
    function entregarTrabalho(worker) {
      if (encontrada || proximoIndice >= total) {
        finalizarWorker(worker);
        return;
      }
      const inicio = proximoIndice;
      const fim = Math.min(inicio + TAMANHO_BLOCO, total);
      proximoIndice = fim; // avanca a fila
      worker.postMessage({ inicio, fim });
    }
 
    for (let i = 0; i < numThreads; i++) {
      const worker = new Worker('./dynamic-worker.js', {
        workerData: { senhaAlvo, alfabeto, tamanho }
      });
 
      // Cada mensagem e o resultado de UM bloco concluido.
      worker.on('message', (resultado) => {
        tentativas += resultado.tentativas;
        if (resultado.encontrada) {
          encontrada = resultado.encontrada;
        }
        // Worker esta livre: entrega o proximo bloco (ou encerra).
        entregarTrabalho(worker);
      });
 
      // Primeiro bloco de cada worker: enche a fila inicial.
      entregarTrabalho(worker);
    }
  });
}
 
async function crackear(senhaAlvo, alfabeto, tamanhoMax, numThreads) {
  const inicioTempo = Date.now();
  let tentativasTotais = 0;
 
  // Tenta senhas de tamanho 1, depois 2, ... ate tamanhoMax.
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
 
// Permite rodar direto no terminal: `node dynamic.js`
// (nao executa quando o arquivo e apenas importado pela parte web).
if (require.main === module) {
  const os = require('os');
 
  // Parametros de teste (ajuste a vontade).
  const senhaAlvo = process.argv[2] || 'sos';
  const alfabeto = 'abcdefghijklmnopqrstuvwxyz';
  const tamanhoMax = senhaAlvo.length;
  const numThreads = os.cpus().length;
 
  console.log(`Estrategia: fila dinamica`);
  console.log(`Senha alvo: "${senhaAlvo}" | alfabeto: ${alfabeto.length} chars | threads: ${numThreads}`);
 
  crackear(senhaAlvo, alfabeto, tamanhoMax, numThreads).then((r) => {
    console.log('---');
    console.log(`Encontrada: ${r.encontrada}`);
    console.log(`Tentativas: ${r.tentativas.toLocaleString('pt-BR')}`);
    console.log(`Tempo:      ${r.tempoMs} ms`);
  });
}