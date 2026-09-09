
const { performance } = require('perf_hooks');
/**
 * 
 * @param {string} senhaAlvo 
 * @param {string} alfabeto
 * @param {number} tamanhoMax 
 * @param {number} [numThreads=1] 
 * @returns {Promise<{ encontrada: string|null, tempoMs: number, tentativas: number }>}
 */
async function crackear(senhaAlvo, alfabeto = 'abcdefghijklmnopqrstuvwxyz0123456789', tamanhoMax = 5, numThreads = 1) {
    const inicio = performance.now();
    let tentativas = 0;
    let encontrada = null;

    /**
     * @param {string} atual
     * @param {number} tamanhoRestante 
     * @returns {boolean} 
     */
    function buscar(atual, tamanhoRestante) {
        if (tamanhoRestante === 0) {
            tentativas++;
            if (atual === senhaAlvo) {
                encontrada = atual;
                return true;
            }
            return false;
        }

        for (let i = 0; i < alfabeto.length; i++) {
            if (buscar(atual + alfabeto[i], tamanhoRestante - 1)) {
                return true; 
            }
        }
        return false;
    }

    for (let tamanho = 1; tamanho <= tamanhoMax; tamanho++) {
        if (buscar('', tamanho)) {
            break;
        }
    }

    const fim = performance.now();
    const tempoMs = Number((fim - inicio).toFixed(2));

    return {
        encontrada,
        tempoMs,
        tentativas
    };
}

module.exports = { crackear };


if (require.main === module) {
    (async () => {
        const args = process.argv.slice(2);
        const senhaAlvo = args[0] || 'zzzzz';
        const alfabeto = args[1] || 'abcdefghijklmnopqrstuvwxyz0123456789';
        const tamanhoMax = parseInt(args[2], 10) || Math.max(senhaAlvo.length, 4);

        console.log('Estrategia: single-thread (baseline)');
        console.log(`Senha alvo: "${senhaAlvo}" | alfabeto: ${alfabeto.length} chars | threads: 1`);

        const resultado = await crackear(senhaAlvo, alfabeto, tamanhoMax, 1);

        console.log('---');
        console.log(`Encontrada: ${resultado.encontrada}`);
        console.log(`Tentativas: ${resultado.tentativas.toLocaleString('pt-BR')}`);
        console.log(`Tempo:      ${resultado.tempoMs} ms`);
    })();
}
