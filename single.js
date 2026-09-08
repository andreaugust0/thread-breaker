/**
 * ==============================================================================
 * PROJETO DE SISTEMAS OPERACIONAIS - QUEBRADOR DE SENHAS POR FORÇA BRUTA
 * Módulo: Baseline Single-Thread (single.js)
 * ==============================================================================
 * 
 * CONCEITO DE SISTEMAS OPERACIONAIS:
 * - O Node.js executa JavaScript em uma única thread principal (Single-Threaded Event Loop).
 * - Uma rotina de força bruta é uma tarefa intensiva de CPU (CPU-bound).
 * - Executar essa tarefa em single-thread bloqueia o Event Loop e utiliza apenas 1 núcleo
 *   do processador, servindo como Linha de Base (T1) para cálculo de Speedup e Eficiência:
 *   
 *   Speedup (S) = T1 / Tp   (onde T1 é o tempo desta thread e Tp é o tempo com P threads)
 * ==============================================================================
 */

const { performance } = require('perf_hooks');

/**
 * Contrato unificado do projeto para os algoritmos de força bruta.
 * 
 * @param {string} senhaAlvo - Senha a ser descoberta (ex: 'pass', 'so24')
 * @param {string} alfabeto - Conjunto de caracteres disponíveis para a busca
 * @param {number} tamanhoMax - Tamanho máximo das combinações geradas
 * @param {number} [numThreads=1] - Quantidade de threads (fixado em 1 neste baseline)
 * @returns {Promise<{ encontrada: string|null, tempoMs: number, tentativas: number }>}
 */
async function crackear(senhaAlvo, alfabeto = 'abcdefghijklmnopqrstuvwxyz0123456789', tamanhoMax = 5, numThreads = 1) {
    const inicio = performance.now();
    let tentativas = 0;
    let encontrada = null;

    /**
     * Função recursiva de busca em profundidade (DFS) para gerar combinações
     * @param {string} atual - Prefixo acumulado
     * @param {number} tamanhoRestante - Caracteres restantes a preencher
     * @returns {boolean} - true se encontrou a senha alvo
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
                return true; // Encerra recursão imediatamente ao encontrar
            }
        }
        return false;
    }

    // Testa combinações começando do tamanho 1 até o tamanhoMax
    for (let tamanho = 1; tamanho <= tamanhoMax; tamanho++) {
        if (buscar('', tamanho)) {
            break; // Senha encontrada, interrompe o loop de tamanhos
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

// Exporta a função para ser utilizada pelo projeto principal / benchmark / servidor web
module.exports = { crackear };

// ==============================================================================
// EXECUÇÃO DIRETA VIA TERMINAL (node single.js [senha] [alfabeto] [tamanhoMax])
// ==============================================================================
if (require.main === module) {
    (async () => {
        const args = process.argv.slice(2);
        const senhaAlvo = args[0] || 'so24';
        const alfabeto = args[1] || 'abcdefghijklmnopqrstuvwxyz0123456789';
        const tamanhoMax = parseInt(args[2], 10) || Math.max(senhaAlvo.length, 4);

        console.log('====================================================');
        console.log(' 🧵 SISTEMAS OPERACIONAIS - FORÇA BRUTA (SINGLE-THREAD)');
        console.log('====================================================');
        console.log(`🎯 Senha Alvo       : "${senhaAlvo}"`);
        console.log(`🔤 Alfabeto (${alfabeto.length.toString().padStart(2, ' ')} ch) : ${alfabeto}`);
        console.log(`📏 Tamanho Máximo   : ${tamanhoMax}`);
        console.log(`⚡ Threads em uso   : 1 (Baseline Single-Thread)`);
        console.log('----------------------------------------------------');
        console.log('⏳ Executando busca sequencial...');

        const resultado = await crackear(senhaAlvo, alfabeto, tamanhoMax, 1);

        console.log('----------------------------------------------------');
        if (resultado.encontrada !== null) {
            console.log(`✅ Senha encontrada : "${resultado.encontrada}"`);
        } else {
            console.log(`❌ Senha não encontrada no espaço de busca fornecido.`);
        }
        console.log(`⏱️  Tempo decorrido  : ${resultado.tempoMs} ms (${(resultado.tempoMs / 1000).toFixed(3)} s)`);
        console.log(`🔢 Tentativas totais: ${resultado.tentativas.toLocaleString('pt-BR')}`);
        
        if (resultado.tempoMs > 0) {
            const keysPerSec = Math.round((resultado.tentativas / resultado.tempoMs) * 1000);
            console.log(`🚀 Taxa de busca    : ${keysPerSec.toLocaleString('pt-BR')} chaves/segundo`);
        }
        console.log('====================================================\n');
    })();
}
