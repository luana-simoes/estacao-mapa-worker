# Worker de Formatação - Estação MAPA

Worker Node.js com LibreOffice para processar templates DOCX e gerar documentos acadêmicos formatados (ABNT, APA, Vancouver).

## 🏗️ Arquitetura

- **Express.js**: Servidor HTTP
- **LibreOffice**: Motor de processamento de documentos
- **Supabase**: Storage de templates e documentos finais
- **Fly.io**: Hospedagem do worker

## 📦 Instalação Local

```bash
# Instalar dependências Node.js
npm install

# Instalar LibreOffice (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y libreoffice libreoffice-writer python3

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Iniciar servidor
npm run dev
```

## 🚀 Deploy no Fly.io

### 1. Instalar Fly CLI

```bash
curl -L https://fly.io/install.sh | sh
```

### 2. Login no Fly.io

```bash
flyctl auth login
```

### 3. Criar aplicação

```bash
flyctl launch
```

### 4. Configurar secrets

```bash
flyctl secrets set SUPABASE_URL="https://seu-projeto.supabase.co"
flyctl secrets set SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key"
flyctl secrets set WORKER_SECRET_KEY="sua-chave-secreta-forte"
```

### 5. Deploy

```bash
flyctl deploy
```

### 6. Verificar status

```bash
flyctl status
flyctl logs
```

## 🔒 Segurança

- Worker aceita apenas requisições autenticadas com Bearer token
- Comunicação via HTTPS
- Secrets gerenciados pelo Fly.io
- Arquivos temporários são limpos após processamento

## 📡 Endpoints

### `GET /health`

Health check do serviço.

**Resposta:**
```json
{
  "status": "ok",
  "service": "worker-formatacao-mapa"
}
```

### `POST /formatar`

Processa formatação de documento.

**Headers:**
```
Authorization: Bearer {WORKER_SECRET_KEY}
Content-Type: application/json
```

**Body:**
```json
{
  "jobId": "uuid-do-job",
  "documentoId": "uuid-do-documento",
  "estruturaJson": { ... },
  "dadosBasicos": { ... },
  "normaFormatacao": "abnt"
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Processamento iniciado"
}
```

## 🗂️ Estrutura de Dados

### Templates no Supabase Storage

Bucket: `templates-formatacao`

Arquivos:
- `template_abnt.docx`
- `template_apa.docx`
- `template_vancouver.docx`

### Documentos Formatados no Supabase Storage

Bucket: `documentos-formatados`

Arquivos: `documento_{documentoId}_{timestamp}.docx`

## 🔧 Desenvolvimento

### Testar localmente

```bash
# Terminal 1: Iniciar worker
npm run dev

# Terminal 2: Testar endpoint
curl -X POST http://localhost:3001/formatar \
  -H "Authorization: Bearer sua-chave-secreta" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "test-123",
    "documentoId": "doc-456",
    "estruturaJson": {},
    "dadosBasicos": {},
    "normaFormatacao": "abnt"
  }'
```

## 📝 TODO

- [ ] Implementar preenchimento automático de campos nos templates
- [ ] Adicionar suporte para imagens e gráficos
- [ ] Implementar geração de sumário automático
- [ ] Adicionar validação de estrutura ABNT
- [ ] Implementar retry automático em caso de falha
- [ ] Adicionar métricas e monitoramento

## 🐛 Troubleshooting

### LibreOffice não encontrado

```bash
which libreoffice
# Se não retornar nada, instalar:
sudo apt-get install libreoffice
```

### Erro de permissão no script Python

```bash
chmod +x processar_template.py
```

### Worker não conecta ao Supabase

Verificar se as variáveis de ambiente estão corretas:
```bash
flyctl secrets list
```

## 📄 Licença

MIT
