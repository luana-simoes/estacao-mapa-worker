/**
 * Sistema de Fila Redis para Worker de Formatação
 * 
 * Gerencia enfileiramento e processamento de tarefas de formatação
 * de forma assíncrona e escalável
 */

const Redis = require('ioredis');

let redis = null;

// Inicializar Redis
function getRedisClient() {
  if (!redis && process.env.REDIS_URL) {
    try {
      redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      });

      redis.on('error', (error) => {
        console.error('❌ Erro no Redis:', error);
      });

      redis.on('connect', () => {
        console.log('✅ Redis conectado com sucesso');
      });
    } catch (error) {
      console.error('❌ Erro ao conectar Redis:', error);
      redis = null;
    }
  }
  return redis;
}

/**
 * Adicionar tarefa à fila de formatação
 */
async function enqueueFormatacao(jobId, documentoId, estruturaJson, dadosBasicos, normaFormatacao, priority = 5) {
  const client = getRedisClient();
  
  if (!client) {
    throw new Error('Redis não disponível');
  }

  const task = {
    id: jobId,
    type: 'formatacao',
    documentoId,
    estruturaJson,
    dadosBasicos,
    normaFormatacao,
    priority,
    createdAt: Date.now(),
    attempts: 0,
    maxAttempts: 3
  };

  // Adicionar à fila ordenada por prioridade
  const score = priority * 1000000 + Date.now();
  await client.zadd('queue:formatacao', score, JSON.stringify(task));
  
  // Salvar metadados da tarefa
  await client.set(`task:${jobId}`, JSON.stringify({
    status: 'queued',
    createdAt: Date.now()
  }), 'EX', 3600); // 1 hora de expiração

  console.log(`✅ Tarefa ${jobId} adicionada à fila de formatação`);
  
  return jobId;
}

/**
 * Buscar próxima tarefa da fila
 */
async function dequeueFormatacao() {
  const client = getRedisClient();
  
  if (!client) {
    return null;
  }

  // Buscar tarefa com maior prioridade (menor score)
  const tasks = await client.zrange('queue:formatacao', 0, 0);
  
  if (!tasks || tasks.length === 0) {
    return null;
  }

  const taskData = tasks[0];
  const task = JSON.parse(taskData);

  // Remover da fila
  await client.zrem('queue:formatacao', taskData);

  // Atualizar status
  await client.set(`task:${task.id}`, JSON.stringify({
    status: 'processing',
    startedAt: Date.now()
  }), 'EX', 3600);

  console.log(`🔄 Processando tarefa ${task.id}`);

  return task;
}

/**
 * Salvar resultado da tarefa
 */
async function saveTaskResult(taskId, status, result = null, error = null) {
  const client = getRedisClient();
  
  if (!client) {
    return;
  }

  await client.set(`task:${taskId}`, JSON.stringify({
    status,
    result,
    error,
    completedAt: Date.now()
  }), 'EX', 3600);

  console.log(`✅ Resultado da tarefa ${taskId} salvo: ${status}`);
}

/**
 * Recolocar tarefa na fila (retry)
 */
async function requeueFormatacao(task) {
  const client = getRedisClient();
  
  if (!client) {
    throw new Error('Redis não disponível');
  }

  task.attempts += 1;

  if (task.attempts >= task.maxAttempts) {
    await saveTaskResult(task.id, 'failed', null, 'Máximo de tentativas excedido');
    return false;
  }

  // Recolocar na fila com prioridade reduzida
  const score = (task.priority + task.attempts) * 1000000 + Date.now();
  await client.zadd('queue:formatacao', score, JSON.stringify(task));

  console.log(`🔄 Tarefa ${task.id} recolocada na fila (tentativa ${task.attempts}/${task.maxAttempts})`);

  return true;
}

/**
 * Obter status da tarefa
 */
async function getTaskStatus(taskId) {
  const client = getRedisClient();
  
  if (!client) {
    return { status: 'unknown' };
  }

  const data = await client.get(`task:${taskId}`);
  
  if (!data) {
    return { status: 'not_found' };
  }

  return JSON.parse(data);
}

/**
 * Obter tamanho da fila
 */
async function getQueueSize() {
  const client = getRedisClient();
  
  if (!client) {
    return 0;
  }

  return await client.zcard('queue:formatacao');
}

/**
 * Limpar fila (apenas para testes/manutenção)
 */
async function clearQueue() {
  const client = getRedisClient();
  
  if (!client) {
    return;
  }

  await client.del('queue:formatacao');
  console.log('✅ Fila de formatação limpa');
}

module.exports = {
  enqueueFormatacao,
  dequeueFormatacao,
  saveTaskResult,
  requeueFormatacao,
  getTaskStatus,
  getQueueSize,
  clearQueue
};
