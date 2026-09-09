const { crackear: crackSingle }  = require('../single.js');
const { crackear: crackStatic }  = require('../static.js');
const { crackear: crackDynamic } = require('../dynamic.js');
const { crackear: crackShared }  = require('../shared.js');

const ESTRATEGIAS = {
  single:  crackSingle,
  static:  crackStatic,
  dynamic: crackDynamic,
  shared:  crackShared,
};

const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789'; 
const REPETICOES = 3; 


async function medir(fn, senha, tamanhoMax, numThreads) {
  let soma = 0;
  let ultima = null;
  for (let r = 0; r < REPETICOES; r++) {
    const res = await fn(senha, ALFABETO, tamanhoMax, numThreads);
    soma += res.tempoMs;
    ultima = res;
  }
  return {
    tempoMs: Math.round(soma / REPETICOES),
    encontrada: ultima.encontrada,
    tentativas: ultima.tentativas,
  };
}

async function rodar() {
  const SENHA_ESC = 'zzzz';      
  const TAM_ESC = 4;
  const THREADS_ESC = [1, 2, 3, 4, 6, 8, 12, 16, 24];

  console.log('=== EXP 1: ESCALABILIDADE (shared) ===');
  const escalabilidade = [];
  for (const n of THREADS_ESC) {
    const m = await medir(crackShared, SENHA_ESC, TAM_ESC, n);
    escalabilidade.push({ threads: n, tempoMs: m.tempoMs, tentativas: m.tentativas });
    console.log(`threads=${String(n).padStart(2)}  tempo=${String(m.tempoMs).padStart(5)}ms`);
  }


  const SENHA_CMP = 'zzzz';
  const TAM_CMP = 4;
  const THREADS_CMP = 4;

  console.log(`\n=== EXP 2: COMPARACAO (senha "${SENHA_CMP}", ${THREADS_CMP} threads) ===`);
  const comparacao = [];
  for (const nome of Object.keys(ESTRATEGIAS)) {
    const m = await medir(ESTRATEGIAS[nome], SENHA_CMP, TAM_CMP, THREADS_CMP);
    comparacao.push({ estrategia: nome, tempoMs: m.tempoMs });
    console.log(`${nome.padEnd(8)} tempo=${String(m.tempoMs).padStart(5)}ms`);
  }

  const THREADS_CRESC = 4;
  const TAMANHOS = [2, 3, 4, 5]; 

  console.log(`\n=== EXP 3: CRESCIMENTO POR TAMANHO (shared, ${THREADS_CRESC} threads) ===`);
  const crescimento = [];
  for (const t of TAMANHOS) {
    const senha = 'z'.repeat(t); 
    const m = await medir(crackShared, senha, t, THREADS_CRESC);
    crescimento.push({ tamanho: t, tempoMs: m.tempoMs, tentativas: m.tentativas });
    console.log(`tamanho=${t}  tempo=${String(m.tempoMs).padStart(6)}ms  tentativas=${m.tentativas.toLocaleString('pt-BR')}`);
  }
  console.log(JSON.stringify({
    parametros: { alfabeto: ALFABETO, alfabetoLen: ALFABETO.length, repeticoes: REPETICOES },
    escalabilidade,
    comparacao,
    crescimento,
  }, null, 2));
}

rodar();