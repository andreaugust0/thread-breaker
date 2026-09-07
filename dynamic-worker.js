const { parentPort, workerData } = require('worker_threads');
 
const { senhaAlvo, alfabeto, tamanho } = workerData;
 
// Mesma conversao indice -> senha usada pelo coordenador.
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
 
// O worker fica ocioso esperando a fila. A cada bloco { inicio, fim } que
// recebe, testa todos os candidatos daquele intervalo, devolve o resultado
// e volta a esperar o proximo bloco. Quem termina mais rapido recebe mais
// blocos: e assim que a fila dinamica equilibra a carga sozinha.
parentPort.on('message', ({ inicio, fim }) => {
  let tentativas = 0;
  let encontrada = null;
 
  for (let i = inicio; i < fim; i++) {
    tentativas++;
    const candidato = numeroParaSenha(i, alfabeto, tamanho);
 
    if (candidato === senhaAlvo) {
      encontrada = candidato;
      break; // achou dentro deste bloco: para de testar o resto
    }
  }
 
  // Bloco concluido: avisa o coordenador e pede (implicitamente) mais trabalho.
  parentPort.postMessage({ encontrada, tentativas });
});