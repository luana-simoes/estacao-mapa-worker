# Templates DOCX

Este diretório contém os templates de formatação ABNT/APA/Vancouver.

## Estrutura

```
templates/
├── abnt_dissertacao.dotx
├── abnt_tese.dotx
├── abnt_artigo.dotx
├── apa_dissertacao.dotx
├── vancouver_artigo.dotx
└── README.md
```

## Como Adicionar Templates

1. Crie o template no Microsoft Word ou LibreOffice
2. Salve como `.dotx` (Word Template)
3. Adicione neste diretório
4. **NÃO faça commit** (templates são privados)
5. Faça upload manual no Fly.io ou Supabase Storage

## Campos Preenchíveis

Os templates devem conter campos que serão preenchidos pelo worker:

- `{{titulo}}`
- `{{autor}}`
- `{{orientador}}`
- `{{instituicao}}`
- `{{ano}}`
- `{{conteudo}}` (corpo do trabalho em HTML)
- `{{referencias}}` (lista de referências)

## Segurança

⚠️ **Templates não devem ser públicos** pois são ativos proprietários da Estação MAPA.
