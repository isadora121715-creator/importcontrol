# Recriar o projeto ImportBuilder

Recriação completa do app **ImportBuilder** — um dashboard de gestão de importações (compras, vendas, embarques, fornecedores, materiais como tubos e válvulas) com upload de planilhas Excel, autenticação e visualizações analíticas.

O projeto original é Vite + React Router + Supabase. Vou portá-lo para o stack do Lovable: **TanStack Start + Lovable Cloud (Supabase)**, mantendo a mesma estrutura visual, funcionalidades e componentes.

## O que será construído

### Autenticação
- Página de **Landing** pública (apresentação do produto)
- **Login** (email/senha)
- **Reset de senha**
- Contexto de autenticação protegendo rotas internas

### Páginas do dashboard (rotas protegidas)
- **Geral** — visão consolidada com KPIs, gráficos de vendas vs compras, status por fornecedor, alertas inteligentes
- **Compras** — pedidos de compra com filtros, tabela de fornecedores, alertas de atraso, plano de ação
- **Vendas** — performance de vendas
- **Embarques** — acompanhamento de shipments com gráfico de tipo de embarque e análise mensal
- **Tubos** — dashboard específico do material "tubos"
- **Válvulas** — dashboard específico do material "válvulas"
- **Fornecedores** — visão por fornecedor com gráfico pizza e tabela de status
- **Configurações** — preferências do usuário e tema

### Componentes principais
- AppLayout com sidebar de navegação e header com tabs
- DashboardCards / GeneralKPIs / DashboardStates
- FilterSidebar (filtros laterais)
- Charts: SalesVsPurchasesChart, FornecedorPieChart, ShipmentTypeChart, StatusBySupplierChart, MonthlyAnalysis
- Tabelas: SupplierStatusTable, DelayAlertTable, ValvulasTable, CodeLookupTable
- Modais: ActionPlanModal, PoDocumentsModal, MaterialDetailModal, PoDetailModal
- StatusBadge, SmartAlerts, MobileToggle, ThemeToggle (claro/escuro)

### Upload e parsing de Excel
- Parsers para diferentes tipos de planilha: `parseExcel` (geral), `parseExcelEmbarques`, `parseExcelTubos`, `parseExcelValvulas`
- Importação dos dados para o banco

### Exportação de dashboards
- Download de dashboards em PDF/imagem para: Geral, Embarques, Tubos, Válvulas, Relatório de atrasos

### Backend (Lovable Cloud)
- Tabela `pedidos` (pedidos de importação) com colunas para fornecedor, material, status, datas, valores, embarque
- Tabela `profiles` (dados de usuário)
- Tabela `user_roles` (admin/user) — separada por segurança
- RLS habilitado em todas as tabelas
- Storage bucket para anexos de PO (documentos)
- Dados iniciais a partir de `pedidos.json` do projeto original como seed

### PWA
- Manifest e ícones (192/512) preservados
- Favicon e logos (Fluxo, HCI) copiados como assets

## Detalhes técnicos

- **Stack alvo**: TanStack Start v1, React 19, Tailwind v4, shadcn/ui (já presente), Recharts (gráficos), xlsx (parsing), html2canvas + jsPDF (export), TanStack Query (dados)
- **Roteamento**: arquivos em `src/routes/` (não `src/pages/` — o original será portado). Layout autenticado em `src/routes/_app.tsx` com `<Outlet/>`; rotas filhas como `_app.geral.tsx`, `_app.compras.tsx`, etc.
- **Auth**: Lovable Cloud Auth (Supabase) com email/senha; auto-confirm habilitado para testes; loaders das rotas protegidas redirecionam para `/login` se não autenticado
- **Banco**: migrations criando `pedidos`, `profiles`, `user_roles` + enum `app_role` + função `has_role` (security definer) + policies RLS
- **Tema**: variáveis oklch já no `styles.css`; ThemeToggle alterna classe `dark`
- **Imports binários**: logos JPEG e ícones PNG do zip original não podem ser extraídos no modo de planejamento — após aprovação, vou recriá-los/substituí-los (logos placeholder ou pedirei reupload se quiser os exatos)

## Estrutura de rotas (TanStack)

```text
src/routes/
  __root.tsx              shell + providers (Query, Auth, Theme)
  index.tsx               Landing
  login.tsx
  reset-password.tsx
  _app.tsx                layout autenticado (sidebar + header)
  _app.geral.tsx
  _app.compras.tsx
  _app.vendas.tsx
  _app.embarques.tsx
  _app.tubos.tsx
  _app.valvulas.tsx
  _app.fornecedores.tsx
  _app.configuracoes.tsx
```

## Observações

- O projeto é grande (~80 arquivos de código). Vou recriar tudo numa única passada após aprovação, mas alguns refinamentos visuais podem precisar de ajustes posteriores
- Os arquivos binários (logos, ícones, favicon) do zip original não foram extraídos — usarei placeholders ou logos genéricos. Se quiser os exatos, faça reupload das imagens separadamente como PNG/JPG após a recriação
- O `.env` original com chaves Supabase do projeto antigo será ignorado — o Lovable Cloud provisionará um novo backend automaticamente
