#!/usr/bin/env python3
"""
Script para processar templates DOCX com LibreOffice
Preenche campos do template com dados do JSON
"""

import sys
import json
import subprocess
import os
from pathlib import Path

def processar_template(template_path, dados_path, output_path):
    """
    Processa template DOCX preenchendo com dados do JSON
    
    Args:
        template_path: Caminho para o template .docx
        dados_path: Caminho para o arquivo JSON com dados
        output_path: Caminho para salvar o documento final
    """
    
    # Carregar dados
    with open(dados_path, 'r', encoding='utf-8') as f:
        dados = json.load(f)
    
    print(f"📄 Template: {template_path}")
    print(f"📊 Dados: {dados_path}")
    print(f"💾 Output: {output_path}")
    
    # Por enquanto, apenas copiar o template
    # TODO: Implementar preenchimento de campos quando templates estiverem prontos
    import shutil
    shutil.copy(template_path, output_path)
    
    print("✅ Template copiado com sucesso")
    print("⚠️  NOTA: Preenchimento automático de campos será implementado quando templates estiverem finalizados")
    
    # Verificar se arquivo foi criado
    if not os.path.exists(output_path):
        raise Exception("Arquivo de saída não foi criado")
    
    # Verificar tamanho do arquivo
    size = os.path.getsize(output_path)
    print(f"📦 Tamanho do arquivo: {size} bytes")
    
    return True

def main():
    if len(sys.argv) != 4:
        print("Uso: python3 processar_template.py <template.docx> <dados.json> <output.docx>")
        sys.exit(1)
    
    template_path = sys.argv[1]
    dados_path = sys.argv[2]
    output_path = sys.argv[3]
    
    # Validar arquivos de entrada
    if not os.path.exists(template_path):
        print(f"❌ Erro: Template não encontrado: {template_path}")
        sys.exit(1)
    
    if not os.path.exists(dados_path):
        print(f"❌ Erro: Arquivo de dados não encontrado: {dados_path}")
        sys.exit(1)
    
    try:
        sucesso = processar_template(template_path, dados_path, output_path)
        if sucesso:
            print("✅ Processamento concluído com sucesso!")
            sys.exit(0)
        else:
            print("❌ Erro no processamento")
            sys.exit(1)
    except Exception as e:
        print(f"❌ Erro fatal: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
