# Dockerfile para Worker de Formatação com LibreOffice
FROM node:18-slim

# Instalar LibreOffice e dependências
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    python3 \
    python3-pip \
    fonts-liberation \
    fonts-dejavu \
    fonts-freefont-ttf \
    && rm -rf /var/lib/apt/lists/*

# Criar diretório de trabalho
WORKDIR /app

# Copiar package.json e instalar dependências
COPY package*.json ./
RUN npm install --production

# Copiar código da aplicação
COPY . .

# Dar permissão de execução ao script Python
RUN chmod +x processar_template.py

# Criar diretório para templates
RUN mkdir -p /app/templates

# Expor porta
EXPOSE 3001

# Variáveis de ambiente (serão sobrescritas pelo Fly.io)
ENV PORT=3001
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Iniciar aplicação
CMD ["npm", "start"]
