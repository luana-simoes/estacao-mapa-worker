/**
 * Script para processar fila de formatação
 * 
 * Deve ser executado por um cron job ou worker externo
 * Exemplo: node process-queue.js
 */

const { dequeueFormatacao, saveTaskResult, requeueFormatacao } = require('./queue');
const { processarFormatacao } = require('./index');

async function processQueue() {
  console.log('🔍 Verificando fila de formatação...');

  try {
    const task = await dequeueFormatacao();

    if (!task) {
      console.log('📭 Nenhuma tarefa pendente');
      return;
    }

    console.log(`🔄 Processando tarefa ${task.id}`);

    try {
      // Processar formatação
      await processarFormatacao(
        task.id,
        task.documentoId,
        task.estruturaJson,
        task.dadosBasicos,
        task.normaFormatacao
      );

      // Salvar sucesso
      await saveTaskResult(task.id, 'success');
      console.log(`✅ Tarefa ${task.id} concluída com sucesso`);

    } catch (error) {
      console.error(`❌ Erro ao processar tarefa ${task.id}:`, error);

      // Tentar novamente
      const requeued = await requeueFormatacao(task);

      if (!requeued) {
        console.error(`❌ Tarefa ${task.id} falhou após ${task.maxAttempts} tentativas`);
      }
    }

  } catch (error) {
    console.error('❌ Erro ao processar fila:', error);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  processQueue()
    .then(() => {
      console.log('✅ Processamento concluído');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = { processQueue };
