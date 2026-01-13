require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const { executeWithRetry } = require('./retry');
const { notificarErroProcessamento, notificarIntegracaoFalhou, notificarErroCritico } = require('./notificacoes');
const { obterStatusSaude } = require('./health');
const { enqueueFormatacao, getTaskStatus, getQueueSize } = require('./queue');

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3001;

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Secret para autenticação
const WORKER_SECRET = process.env.WORKER_SECRET_KEY;

// Middleware
app.use(express.json({ limit: '50mb' }));

// Middleware de autenticação
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const token = authHeader.substring(7);
  
  if (token !== WORKER_SECRET) {
    return res.status(403).json({ error: 'Token inválido' });
  }

  next();
};

// Health check detalhado
app.get('/health', async (req, res) => {
  try {
    const healthStatus = await obterStatusSaude();
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Endpoint principal de formatação (com fila)
app.post('/formatar', authMiddleware, async (req, res) => {
  const { jobId, documentoId, estruturaJson, dadosBasicos, normaFormatacao, useQueue = true } = req.body;

  console.log(`[JOB ${jobId}] Iniciando formatação do documento ${documentoId}`);

  try {
    // Validar dados
    if (!jobId || !documentoId || !estruturaJson) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    // Se useQueue=true, adicionar à fila e retornar imediatamente
    if (useQueue) {
      try {
        await enqueueFormatacao(jobId, documentoId, estruturaJson, dadosBasicos, normaFormatacao);
        return res.json({ success: true, message: 'Tarefa adicionada à fila', jobId });
      } catch (queueError) {
        console.warn('⚠️ Erro ao adicionar à fila, processando sincronamente:', queueError);
        // Continuar para processamento síncrono em caso de erro
      }
    }

    // Processamento síncrono (fallback ou quando useQueue=false)
    res.json({ success: true, message: 'Processamento iniciado' });

    // Processar em background
    processarFormatacao(jobId, documentoId, estruturaJson, dadosBasicos, normaFormatacao)
      .catch(error => {
        console.error(`[JOB ${jobId}] Erro no processamento:`, error);
      });

  } catch (error) {
    console.error(`[JOB ${jobId}] Erro:`, error);
    res.status(500).json({ error: 'Erro ao processar formatação' });
  }
});

// Endpoint para verificar status da tarefa
app.get('/status/:jobId', authMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await getTaskStatus(jobId);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para verificar tamanho da fila
app.get('/queue/size', authMiddleware, async (req, res) => {
  try {
    const size = await getQueueSize();
    res.json({ queueSize: size });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function processarFormatacao(jobId, documentoId, estruturaJson, dadosBasicos, normaFormatacao) {
  const tempDir = `/tmp/formatacao-${jobId}`;
  
  try {
    // Criar diretório temporário
    await fs.mkdir(tempDir, { recursive: true });

    console.log(`[JOB ${jobId}] Diretório temporário criado: ${tempDir}`);

    // 1. Baixar template do Supabase (com retry)
    const templateNome = `template_${normaFormatacao || 'abnt'}.docx`;
    const templatePath = path.join(tempDir, templateNome);
    
    const { data: templateData, error: templateError } = await executeWithRetry(
      async () => {
        const result = await supabase
          .storage
          .from('templates-formatacao')
          .download(templateNome);
        
        if (result.error) {
          throw new Error(`Erro ao baixar template: ${result.error.message}`);
        }
        
        return result;
      },
      3,
      2000,
      `Download do template ${templateNome}`
    );

    if (templateError) {
      throw new Error(`Erro ao baixar template: ${templateError.message}`);
    }

    // Salvar template localmente
    const templateBuffer = Buffer.from(await templateData.arrayBuffer());
    await fs.writeFile(templatePath, templateBuffer);

    console.log(`[JOB ${jobId}] Template baixado: ${templatePath}`);

    // 2. Criar arquivo de dados JSON
    const dadosPath = path.join(tempDir, 'dados.json');
    await fs.writeFile(dadosPath, JSON.stringify({
      ...dadosBasicos,
      estrutura: estruturaJson,
    }, null, 2));

    console.log(`[JOB ${jobId}] Dados salvos: ${dadosPath}`);

    // 3. Processar com LibreOffice
    const outputPath = path.join(tempDir, 'documento_formatado.docx');
    
    // Script Python para preencher template (será criado separadamente)
    const scriptPath = path.join(__dirname, 'processar_template.py');
    
    const comando = `python3 ${scriptPath} "${templatePath}" "${dadosPath}" "${outputPath}"`;
    
    console.log(`[JOB ${jobId}] Executando: ${comando}`);
    
    const { stdout, stderr } = await execAsync(comando, {
      timeout: 120000, // 2 minutos
    });

    if (stderr) {
      console.warn(`[JOB ${jobId}] Avisos:`, stderr);
    }

    console.log(`[JOB ${jobId}] Processamento concluído`);

    // 4. Fazer upload do arquivo final para Supabase Storage (com retry)
    const arquivoFinal = await fs.readFile(outputPath);
    const arquivoNome = `documento_${documentoId}_${Date.now()}.docx`;

    const { data: uploadData, error: uploadError } = await executeWithRetry(
      async () => {
        const result = await supabase
          .storage
          .from('documentos-formatados')
          .upload(arquivoNome, arquivoFinal, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            upsert: false,
          });
        
        if (result.error) {
          throw new Error(`Erro ao fazer upload: ${result.error.message}`);
        }
        
        return result;
      },
      3,
      2000,
      `Upload do documento ${arquivoNome}`
    );

    if (uploadError) {
      throw new Error(`Erro ao fazer upload: ${uploadError.message}`);
    }

    console.log(`[JOB ${jobId}] Upload concluído: ${arquivoNome}`);

    // 5. Gerar URL assinada (válida por 1 hora)
    const { data: urlData, error: urlError } = await supabase
      .storage
      .from('documentos-formatados')
      .createSignedUrl(arquivoNome, 3600);

    if (urlError) {
      throw new Error(`Erro ao gerar URL: ${urlError.message}`);
    }

    // 6. Atualizar job no banco de dados
    const { error: updateError } = await supabase
      .from('formatacao_jobs')
      .update({
        status: 'concluido',
        arquivo_url: urlData.signedUrl,
        arquivo_nome: arquivoNome,
        concluido_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (updateError) {
      throw new Error(`Erro ao atualizar job: ${updateError.message}`);
    }

    console.log(`[JOB ${jobId}] Job concluído com sucesso`);

    // 7. Limpar arquivos temporários
    await fs.rm(tempDir, { recursive: true, force: true });

  } catch (error) {
    console.error(`[JOB ${jobId}] Erro fatal:`, error);

    // Notificar erro ao painel administrativo
    await notificarErroProcessamento(
      jobId,
      'Formatação de documento',
      error,
      null, // usuario_id (adicionar se disponível no job)
      { documentoId, normaFormatacao }
    );

    // Atualizar job com erro
    await supabase
      .from('formatacao_jobs')
      .update({
        status: 'erro',
        erro_mensagem: error.message,
        concluido_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // Limpar arquivos temporários em caso de erro
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error(`[JOB ${jobId}] Erro ao limpar arquivos:`, cleanupError);
    }
  }
}

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Worker de formatação rodando na porta ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM recebido, encerrando gracefully...');
  process.exit(0);
});
