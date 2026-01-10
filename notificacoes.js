/**
 * Sistema de notificações administrativas para o worker de formatação
 * Envia notificações para o painel administrativo via Supabase
 */

const { createClient } = require('@supabase/supabase-js');

// Configurar cliente Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    console.log('✅ Cliente Supabase inicializado para notificações administrativas');
  } catch (error) {
    console.error('⚠️  Erro ao inicializar cliente Supabase para notificações:', error);
  }
} else {
  console.log('⚠️  SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados. Notificações desabilitadas.');
}

/**
 * Envia uma notificação para o painel administrativo
 * @param {Object} options - Opções da notificação
 * @param {string} options.tipo - Tipo da notificação
 * @param {string} options.prioridade - Prioridade da notificação
 * @param {string} options.titulo - Título da notificação
 * @param {string} options.mensagem - Mensagem descritiva
 * @param {string} [options.origem='worker-formatacao'] - Origem da notificação
 * @param {string} [options.usuario_afetado] - ID do usuário relacionado
 * @param {Object} [options.dados_contexto] - Dados adicionais
 * @param {string} [options.acao_sugerida] - Sugestão de ação
 * @returns {Promise<boolean>} True se enviada com sucesso
 */
async function enviarNotificacaoAdmin({
  tipo,
  prioridade,
  titulo,
  mensagem,
  origem = 'worker-formatacao',
  usuario_afetado = null,
  dados_contexto = null,
  acao_sugerida = null,
}) {
  if (!supabase) {
    console.log('⚠️  Notificações desabilitadas. Notificação não registrada no painel admin.');
    return false;
  }

  try {
    const notificacao = {
      tipo,
      prioridade,
      titulo,
      mensagem,
      origem,
      usuario_afetado,
      dados_contexto,
      acao_sugerida,
    criada_em: new Date().toISOString(),
    lida: false,
    resolvida: false,
    enviada_push: false,
    enviada_email: false,
  };

    const { data, error } = await supabase
      .from('notificacoes_admin')
      .insert(notificacao);

    if (error) {
      console.error('⚠️  Falha ao enviar notificação ao painel admin:', error);
      return false;
    }

    console.log(`✅ Notificação enviada ao painel admin: [${prioridade}] ${titulo}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar notificação ao painel admin:', error);
    return false;
  }
}

/**
 * Notifica um erro de processamento ao painel administrativo
 * @param {string} jobId - ID do job
 * @param {string} operacao - Nome da operação que falhou
 * @param {Error} erro - Erro capturado
 * @param {string} [usuario_id] - ID do usuário relacionado
 * @param {Object} [detalhes] - Detalhes adicionais
 * @returns {Promise<boolean>}
 */
async function notificarErroProcessamento(jobId, operacao, erro, usuario_id = null, detalhes = null) {
  const dados_contexto = {
    job_id: jobId,
    operacao,
    tipo_erro: erro.name || 'Error',
    stack_trace: erro.stack,
    detalhes,
    timestamp: new Date().toISOString(),
  };

  return await enviarNotificacaoAdmin({
    tipo: 'erro_sistema',
    prioridade: 'alta',
    titulo: `Erro no Worker - ${operacao}`,
    mensagem: `Falha ao executar operação '${operacao}' no job ${jobId}: ${erro.message}`,
    origem: 'worker-formatacao',
    usuario_afetado: usuario_id,
    dados_contexto,
    acao_sugerida: `Verificar logs do worker e status do job ${jobId}`,
  });
}

/**
 * Notifica falha em integração externa ao painel administrativo
 * @param {string} jobId - ID do job
 * @param {string} servico - Nome do serviço externo
 * @param {Error} erro - Erro capturado
 * @param {string} [usuario_id] - ID do usuário relacionado
 * @param {Object} [detalhes] - Detalhes adicionais
 * @returns {Promise<boolean>}
 */
async function notificarIntegracaoFalhou(jobId, servico, erro, usuario_id = null, detalhes = null) {
  const dados_contexto = {
    job_id: jobId,
    servico,
    tipo_erro: erro.name || 'Error',
    detalhes,
    timestamp: new Date().toISOString(),
  };

  return await enviarNotificacaoAdmin({
    tipo: 'erro_integracao',
    prioridade: 'media',
    titulo: `Integração Falhou - ${servico}`,
    mensagem: `Falha na integração com ${servico} no job ${jobId}: ${erro.message}`,
    origem: 'worker-formatacao',
    usuario_afetado: usuario_id,
    dados_contexto,
    acao_sugerida: `Verificar status do serviço ${servico}, credenciais e conectividade`,
  });
}

/**
 * Notifica problema de configuração ao painel administrativo
 * @param {string} parametro - Nome do parâmetro problemático
 * @param {string} problema - Descrição do problema
 * @param {Object} [detalhes] - Detalhes adicionais
 * @returns {Promise<boolean>}
 */
async function notificarConfiguracaoInvalida(parametro, problema, detalhes = null) {
  const dados_contexto = {
    parametro,
    problema,
    detalhes,
    timestamp: new Date().toISOString(),
  };

  return await enviarNotificacaoAdmin({
    tipo: 'erro_configuracao',
    prioridade: 'alta',
    titulo: `Configuração Inválida - ${parametro}`,
    mensagem: `Problema de configuração detectado: ${problema}`,
    origem: 'worker-formatacao',
    dados_contexto,
    acao_sugerida: `Verificar e corrigir configuração do parâmetro '${parametro}'`,
  });
}

/**
 * Notifica erro crítico que requer atenção imediata
 * @param {string} jobId - ID do job
 * @param {string} titulo - Título do erro
 * @param {string} mensagem - Mensagem descritiva
 * @param {Error} erro - Erro capturado
 * @param {string} [usuario_id] - ID do usuário relacionado
 * @returns {Promise<boolean>}
 */
async function notificarErroCritico(jobId, titulo, mensagem, erro, usuario_id = null) {
  const dados_contexto = {
    job_id: jobId,
    tipo_erro: erro.name || 'Error',
    stack_trace: erro.stack,
    timestamp: new Date().toISOString(),
  };

  return await enviarNotificacaoAdmin({
    tipo: 'erro_critico',
    prioridade: 'critica',
    titulo: `CRÍTICO: ${titulo}`,
    mensagem,
    origem: 'worker-formatacao',
    usuario_afetado: usuario_id,
    dados_contexto,
    acao_sugerida: 'Atenção imediata necessária. Verificar logs e status do sistema.',
  });
}

/**
 * Notifica aviso (warning) ao painel administrativo
 * @param {string} titulo - Título do aviso
 * @param {string} mensagem - Mensagem descritiva
 * @param {Object} [dados_contexto] - Dados adicionais
 * @returns {Promise<boolean>}
 */
async function notificarAviso(titulo, mensagem, dados_contexto = null) {
  return await enviarNotificacaoAdmin({
    tipo: 'warning',
    prioridade: 'media',
    titulo,
    mensagem,
    origem: 'worker-formatacao',
    dados_contexto,
    acao_sugerida: 'Monitorar situação e tomar ação se necessário',
  });
}

module.exports = {
  enviarNotificacaoAdmin,
  notificarErroProcessamento,
  notificarIntegracaoFalhou,
  notificarConfiguracaoInvalida,
  notificarErroCritico,
  notificarAviso,
};
