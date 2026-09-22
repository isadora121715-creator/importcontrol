# Atualizações — importcontrol

## ⚠️ Ação obrigatória e urgente (segurança)

O código continha um **token de acesso do GitHub** (`gho_...`) escrito diretamente
em 3 arquivos do frontend (visível para qualquer pessoa que abrisse o site e
olhasse o código-fonte no navegador):

- `src/components/CotacoesTab.tsx`
- `src/hooks/usePedidos.ts`
- `src/pages/Pagamentos.tsx`

Esse token era usado para atualizar Gists públicos do GitHub e sincronizar dados
entre usuários. Eu removi o token e reescrevi a sincronização para usar o bucket
público do Supabase Storage (`pedidos-json`) que o projeto já tinha provisionado
(ver `supabase/migrations/20260526000000_create_pedidos_json_storage.sql`) —
sem precisar de nenhum segredo no código do navegador.

**Isso não apaga o token do histórico do Git.** Mesmo depois de aplicar essas
mudanças, qualquer pessoa com acesso ao histórico de commits do repositório
ainda consegue ver o token antigo. Por isso, independentemente de aplicar este
código, é necessário:

1. Ir em GitHub → sua foto de perfil → **Settings** → **Developer settings** →
   **Personal access tokens** e **revogar/excluir** o token que começa com
   `gho_jB2H5L5Ma...`.
2. Se esse token também é usado em algum outro lugar (fora deste projeto),
   gerar um novo lá.
3. Se o repositório foi deixado público para eu conseguir acessá-lo, voltar a
   deixá-lo privado (Settings → General → Danger Zone → Change visibility).

## O que mais mudou

### 1. Suporte à nova planilha de Pagamentos
`src/lib/parseExcelPagamentos.ts` foi reescrito para ler o novo formato da
planilha (abas "Pagamentos - Material", "Pagamentos - Desembaraço" e "Câmbio"),
incluindo os novos campos: status da PO, termo de pagamento, taxa de câmbio,
cliente principal/secundário + faturamento + prazo, faturamento total da PO,
dias até vencer, urgência, score de priorização, envio/retorno do financeiro,
banco pagador e observações.

### 2. Painel de Prioridade (financeiro)
Nova aba "Prioridade" em `/pagamentos`: lista os pagamentos pendentes
ordenados pelo Score de Priorização (faturamento do cliente em risco ×
urgência), com destaque visual para os mais urgentes.

### 3. Ticker estilo Bloomberg
Novo componente `src/components/SupplierTicker.tsx`: uma faixa rolante
contínua com fornecedor + valor. Adicionado no topo de Pagamentos, Conexões,
Tubos e Válvulas.

### 4. Atualização automática
As telas de Pagamentos, Conexões, Tubos, Válvulas e Cotações agora verificam
por dados novos a cada 60 segundos automaticamente (antes só atualizava ao
recarregar a página ou voltar a focar a aba).

### 5. Detalhe expandido por clique
Em Pagamentos, clicar em qualquer linha da tabela abre um modal com todos os
campos novos (antes só apareciam as colunas visíveis na tabela).

## Como aplicar

Os 13 arquivos deste zip substituem os arquivos de mesmo caminho no repositório
(a estrutura de pastas já está correta — `public/...`, `src/...`). Você pode:

- Arrastar a pasta extraída para a página "Add file → Upload files" do GitHub
  (ele preserva os caminhos), ou
- Aplicar localmente com git e depois `git push`.

Depois de publicar, se a sincronização entre usuários não funcionar
imediatamente, verifique se a migração
`supabase/migrations/20260526000000_create_pedidos_json_storage.sql` já foi
executada no painel do Supabase (SQL Editor) — ela cria o bucket público
`pedidos-json` usado pela nova sincronização. Enquanto isso, o app já funciona
normalmente lendo os arquivos estáticos em `public/data/`, que atualizei com os
dados reais da planilha que você enviou.
