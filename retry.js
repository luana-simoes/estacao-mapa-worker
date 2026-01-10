/**
 * Sistema de retry automático para o worker de formatação
 */

/**
 * Executa uma função com retry automático em caso de falha
 * @param {Function} fn - Função a ser executada
 * @param {number} maxRetries - Número máximo de tentativas (padrão: 3)
 * @param {number} delayMs - Delay entre tentativas em ms (padrão: 2000)
 * @param {string} operationName - Nome da operação para logging
 * @returns {Promise<any>} Resultado da função
 */
async function executeWithRetry(fn, maxRetries = 3, delayMs = 2000, operationName = 'Operação') {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[RETRY] ${operationName} - Tentativa ${attempt}/${maxRetries}`);
      const result = await fn();
      
      if (attempt > 1) {
        console.log(`[RETRY] ${operationName} - Sucesso na tentativa ${attempt}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      console.error(`[RETRY] ${operationName} - Falha na tentativa ${attempt}:`, error.message);
      
      // Se não for a última tentativa, aguardar antes de tentar novamente
      if (attempt < maxRetries) {
        const waitTime = delayMs * attempt; // Backoff exponencial
        console.log(`[RETRY] ${operationName} - Aguardando ${waitTime}ms antes da próxima tentativa...`);
        await sleep(waitTime);
      }
    }
  }
  
  // Se chegou aqui, todas as tentativas falharam
  console.error(`[RETRY] ${operationName} - Todas as ${maxRetries} tentativas falharam`);
  throw lastError;
}

/**
 * Aguarda um período de tempo
 * @param {number} ms - Tempo em milissegundos
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Função de notificação movida para notificacoes.js

module.exports = {
  executeWithRetry,
  sleep,
};
