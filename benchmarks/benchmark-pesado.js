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
const REPETICOES = 2;   


const SENHA = 'zzzzzz';
const TAMANHO_MAX = 6;

async function medir(fn, numThreads) {
  let soma = 0;
  let ultima = null;
  for (let r = 0; r < REPETICOES; r++) {
    const res = await fn(SENHA, ALFABETO, TAMANHO_MAX, numThreads);
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
  console.log('Benchmark PESADO (tamanho 6). Isso leva ~15-25 min...\n');

  const THREADS = [1, 4, 8, 12, 24];
  console.log('=== ESCALABILIDADE DIFICIL (shared) ===');
  const escalabilidadeDificil = [];
  for (const n of THREADS) {
    const t0 = Date.now();
    const m = await medir(crackShared, n);
    escalabilidadeDificil.push({ threads: n, tempoMs: m.tempoMs, tentativas: m.tentativas });
    console.log(`threads=${String(n).padStart(2)}  tempo=${String(m.tempoMs).padStart(6)}ms   (rodou em ${Math.round((Date.now()-t0)/1000)}s)`);
  }
  const THREADS_CMP = 8;
  console.log(`\n=== COMPARACAO DIFICIL (senha "${SENHA}", ${THREADS_CMP} threads) ===`);
  const comparacaoDificil = [];
  for (const nome of Object.keys(ESTRATEGIAS)) {
    const t0 = Date.now();
    const m = await medir(ESTRATEGIAS[nome], THREADS_CMP);
    comparacaoDificil.push({ estrategia: nome, tempoMs: m.tempoMs });
    console.log(`${nome.padEnd(8)} tempo=${String(m.tempoMs).padStart(6)}ms   (rodou em ${Math.round((Date.now()-t0)/1000)}s)`);
  }

  console.log('\n\n===== COPIE TUDO DAQUI PARA BAIXO E ME MANDE =====\n');
  console.log(JSON.stringify({
    parametros: { alfabeto: ALFABETO, alfabetoLen: ALFABETO.length, senha: SENHA, tamanho: TAMANHO_MAX, repeticoes: REPETICOES },
    escalabilidadeDificil,
    comparacaoDificil,
  }, null, 2));
}

rodar();    