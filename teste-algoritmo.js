// teste-algoritmo.js
// Compara SÓ o custo de gerar senhas, sem threads, sem coordenação.
// Agora com TRÊS versões: shared, static ANTIGA e static OTIMIZADA,
// para comprovar que a otimização (tabela de potências) funcionou.
//
// Rode:  node teste-algoritmo.js

const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789';
const QUANTAS = 10_000_000;
const TAMANHO_MAX = 5;

// ---- SHARED (numeroParaSenha) ----
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

// ---- STATIC ANTIGA (Math.pow dentro do laço) ----
function combinacoesDoTamanho(alfabetoLen, L) {
  return Math.pow(alfabetoLen, L);
}
function indiceParaSenhaAntiga(indice, alfabeto, tamanhoMax) {
  const base = alfabeto.length;
  let restante = indice;
  for (let L = 1; L <= tamanhoMax; L++) {
    const qtd = combinacoesDoTamanho(base, L); // Math.pow toda vez
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

// ---- STATIC OTIMIZADA (tabela de potências pré-calculada) ----
const baseOtim = ALFABETO.length;
const potencias = [0];
for (let L = 1; L <= TAMANHO_MAX; L++) {
  potencias[L] = Math.pow(baseOtim, L); // calculado UMA vez
}
function indiceParaSenhaOtimizada(indice, alfabeto, tamanhoMax) {
  const base = alfabeto.length;
  let restante = indice;
  for (let L = 1; L <= tamanhoMax; L++) {
    const qtd = potencias[L]; // consulta a tabela (barato)
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

function medir(nome, fn) {
  const t0 = Date.now();
  let lixo = '';
  for (let i = 0; i < QUANTAS; i++) {
    lixo = fn(i, ALFABETO, TAMANHO_MAX);
  }
  const dt = Date.now() - t0;
  if (lixo.length < 0) console.log(lixo); // impede otimização que apaga o laço
  return dt;
}

console.log(`Gerando ${QUANTAS.toLocaleString('pt-BR')} senhas (sem threads):\n`);

const tShared = (() => {
  const t0 = Date.now();
  let lixo = '';
  for (let i = 0; i < QUANTAS; i++) lixo = numeroParaSenha(i, ALFABETO, 5);
  if (lixo.length < 0) console.log(lixo);
  return Date.now() - t0;
})();

const tAntiga = medir('antiga', indiceParaSenhaAntiga);
const tOtim = medir('otim', indiceParaSenhaOtimizada);

console.log(`  shared (numeroParaSenha)      : ${tShared} ms`);
console.log(`  static ANTIGA (Math.pow)      : ${tAntiga} ms`);
console.log(`  static OTIMIZADA (tabela)     : ${tOtim} ms`);
console.log('');
console.log(`  Otimizada é ${(tAntiga / tOtim).toFixed(1)}x mais rápida que a antiga`);
console.log(`  Otimizada vs shared: ${(tOtim / tShared).toFixed(1)}x`);