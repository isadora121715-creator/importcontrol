/**
 * Script one-shot: lê as 3 planilhas (Conexões, Válvulas, Tubos) e gera
 * src/data/catalogo-static.json com todos os itens do catálogo.
 * Uso: node scripts/build-catalogo-static.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { read, utils } from "xlsx";

// ── resolver de arquivo no Desktop ────────────────────────────────────────
const usersDir = "C:/Users";
const userName = readdirSync(usersDir).find(
  (u) => u.normalize("NFC").includes("lia") && u !== "Public" && u !== "Default"
);
if (!userName) throw new Error("Pasta do usuário não encontrada em C:/Users");
const desktop = `${usersDir}/${userName}/OneDrive/Desktop`;
const allFiles = readdirSync(desktop);

function findFile(hint) {
  const name = allFiles.find(
    (f) => f.normalize("NFC").toLowerCase().includes(hint) && f.endsWith(".xlsx")
  );
  if (!name) throw new Error("Arquivo não encontrado no Desktop com hint: " + hint);
  return desktop + "/" + name;
}

// ── helpers ───────────────────────────────────────────────────────────────
function normalizeHdr(h) {
  return String(h ?? "")
    .toLowerCase()
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ç/g, "c")
    .replace(/ã/g, "a")
    .replace(/õ/g, "o")
    .replace(/á/g, "a")
    .replace(/é/g, "e")
    .replace(/í/g, "i")
    .replace(/ó/g, "o")
    .replace(/ú/g, "u")
    .replace(/â/g, "a")
    .replace(/ê/g, "e")
    .replace(/ô/g, "o");
}

function excelDate(serial) {
  const d = new Date(Math.floor(serial - 25569) * 86400000);
  return (
    String(d.getUTCDate()).padStart(2, "0") +
    "/" +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    "/" +
    d.getUTCFullYear()
  );
}

/** Lê sheet como matrix, limitando colunas a 60 para evitar bug de range. */
function readMatrix(buf) {
  const wb = read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const range = utils.decode_range(sheet["!ref"] || "A1");
  const capCol = Math.min(range.e.c, 59);
  sheet["!ref"] = utils.encode_range({ s: range.s, e: { r: range.e.r, c: capCol } });
  return utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
}

// ── parser Conexões ─────────────────────────────────────────────────────
// Formato: PI na coluna A, header "PI" exato (sem "INTERNO")
const CONEXOES_MAP = {
  pi: "pi", cliente: "cliente",
  codigo: "codigo", "codigo compra": "codigoCompra",
  descricao: "descricao",
  "qty venda": "qtyVenda", "qty compra": "qtyCompra",
  qty: "qtyVenda",
  "preco venda": "precoVenda", "preco compra": "precoCompra",
  po: "po", fornecedor: "fornecedor", forncedor: "fornecedor",
  "entrega fornecedor": "entregaFornecedor",
};

function parseConexoes(matrix) {
  // Procura linha de header: coluna contendo "PI" exato
  let hdrIdx = 0;
  for (let i = 0; i < Math.min(matrix.length, 8); i++) {
    if (matrix[i].some((v) => String(v).trim().toUpperCase() === "PI")) {
      hdrIdx = i;
      break;
    }
  }

  const rawHdrs = matrix[hdrIdx] ?? [];
  const hdrs = [];
  let qtyFound = false;
  let codigoFound = false;

  for (const h of rawHdrs) {
    let label = String(h).trim();
    const n = normalizeHdr(label);
    if (n === "qty")    { label = qtyFound    ? "QTY COMPRA"    : "QTY VENDA"; qtyFound    = true; }
    if (n === "codigo") { label = codigoFound ? "CODIGO COMPRA" : label;       codigoFound = true; }
    hdrs.push(label);
  }

  const rows = [];
  for (let i = hdrIdx + 1; i < matrix.length; i++) {
    const row = matrix[i];
    const mapped = {};
    let hasVal = false;
    for (let c = 0; c < hdrs.length; c++) {
      const v = row[c];
      if (v !== "" && v !== null && v !== undefined) hasVal = true;
      const field = CONEXOES_MAP[normalizeHdr(hdrs[c])];
      if (field && mapped[field] === undefined) mapped[field] = v;
    }
    if (hasVal) rows.push(mapped);
  }
  return rows;
}

// ── parser Válvulas ──────────────────────────────────────────────────────
// Formato:
//   row 0 — data serial (data de atualização)
//   row 1 — headers: "PI INTERNO", ..., "CODIGO ", <desc example>, "QTD COMPRADA",
//            "PREÇO UNIT (USD)", "FATOR", "INCOTERM", "FORNECEDOR", ...
//   row 2+ — dados
//
// Col relevantes para catálogo:
//   "pi interno"        → pi (col 0)
//   "codigo"            → codigo (col 15)
//   col 16              → descricao (imediatamente após CODIGO)
//   "preco unit (usd)"  → precoCompra (col 18)
//   "fornecedor"        → fornecedor (col 21)

function parseValvulas(matrix) {
  // Header row: contains "PI INTERNO" in col 0
  let hdrIdx = -1;
  for (let i = 0; i < Math.min(matrix.length, 5); i++) {
    const n = normalizeHdr(String(matrix[i][0] ?? ""));
    if (n.startsWith("pi")) { hdrIdx = i; break; }
  }
  if (hdrIdx === -1) { console.warn("Válvulas: header row not found"); return []; }

  const hdrs = (matrix[hdrIdx] ?? []).map((h) => String(h).trim());

  // Find key column indices
  let colCodigo = -1, colDesc = -1, colPreco = -1, colForn = -1;
  for (let c = 0; c < hdrs.length; c++) {
    const n = normalizeHdr(hdrs[c]);
    if (n === "codigo" && colCodigo === -1)               colCodigo = c;
    if ((n.includes("preco unit") || n.includes("preco un")) && colPreco === -1) colPreco = c;
    if (n === "fornecedor" && colForn === -1)              colForn   = c;
  }
  // Description column: right after CODIGO
  colDesc = colCodigo >= 0 ? colCodigo + 1 : -1;

  const rows = [];
  let lastPI = null;

  for (let i = hdrIdx + 1; i < matrix.length; i++) {
    const row = matrix[i];
    const pi = row[0] !== "" ? row[0] : lastPI;
    if (row[0] !== "" && row[0] !== null) lastPI = row[0];
    if (!pi) continue;

    const codigo     = colCodigo >= 0 ? String(row[colCodigo] ?? "").trim() : "";
    const descricao  = colDesc   >= 0 ? String(row[colDesc]   ?? "").trim() : "";
    const precoRaw   = colPreco  >= 0 ? row[colPreco]  : "";
    const fornecedor = colForn   >= 0 ? String(row[colForn]   ?? "").trim() : "";
    const precoCompra = typeof precoRaw === "number" && precoRaw > 0 ? precoRaw : null;

    if (!codigo && !descricao) continue;
    rows.push({ pi, codigo, descricao, precoCompra, fornecedor });
  }
  return rows;
}

// ── parser Tubos ─────────────────────────────────────────────────────────
// Formato:
//   row 0 — headers: "PEDIDO INTERNO", "ITEM PV", "PRAZO CLIENTE", "CLIENTE",
//            "CODE HCI", "QTY/MTR", "QTY/PIECES", "FINAL QTY", "PREÇO UNIT $",
//            ..., "FORNECEDOR", ...
//   row 1+ — dados (linhas sem PEDIDO INTERNO = itens de estoque, PI = "ESTOQUE")
//
// Col relevantes:
//   "pedido interno" → pi (col 0)
//   "code hci"       → codigo + descricao (col 4)
//   "preco unit $"   → precoCompra (col 8)
//   "fornecedor"     → fornecedor (col 11)

function parseTubos(matrix) {
  // Header row: first row with "PEDIDO INTERNO" in col 0
  let hdrIdx = -1;
  for (let i = 0; i < Math.min(matrix.length, 5); i++) {
    const n = normalizeHdr(String(matrix[i][0] ?? ""));
    if (n.includes("pedido") || n.includes("pi")) { hdrIdx = i; break; }
  }
  if (hdrIdx === -1) { console.warn("Tubos: header row not found"); return []; }

  const hdrs = (matrix[hdrIdx] ?? []).map((h) => String(h).trim());

  // Find key column indices
  let colPI = -1, colCodigo = -1, colPreco = -1, colForn = -1;
  for (let c = 0; c < hdrs.length; c++) {
    const n = normalizeHdr(hdrs[c]);
    if ((n.includes("pedido") || n === "pi") && colPI     === -1) colPI     = c;
    if (n.includes("code")                   && colCodigo === -1) colCodigo = c;
    if (n.includes("preco unit")             && colPreco  === -1) colPreco  = c;
    if (n === "fornecedor"                   && colForn   === -1) colForn   = c;
  }
  // Fallback positions from known structure
  if (colPI     === -1) colPI     = 0;
  if (colCodigo === -1) colCodigo = 4;
  if (colPreco  === -1) colPreco  = 8;
  if (colForn   === -1) colForn   = 11;

  const rows = [];
  let lastPI = null;

  for (let i = hdrIdx + 1; i < matrix.length; i++) {
    const row = matrix[i];
    const rawPI = row[colPI];
    const pi = rawPI !== "" && rawPI !== null ? rawPI : lastPI;
    if (rawPI !== "" && rawPI !== null) lastPI = rawPI;
    if (!pi) continue;

    const codigo     = String(row[colCodigo] ?? "").trim();
    const precoRaw   = row[colPreco];
    const fornecedor = String(row[colForn]   ?? "").trim();
    const precoCompra = typeof precoRaw === "number" && precoRaw > 0 ? precoRaw : null;

    if (!codigo) continue;
    rows.push({ pi, codigo, descricao: codigo, precoCompra, fornecedor });
  }
  return rows;
}

// ── syncCatalogo ──────────────────────────────────────────────────────────
function makeKey(codigo, descricao) {
  if (codigo) return codigo.trim().toUpperCase();
  return descricao.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 60);
}

function syncToMap(rows, categoria, byKey) {
  const now = new Date().toISOString();
  for (const row of rows) {
    const codigo      = (row.codigo     ?? "").trim();
    const descricao   = (row.descricao  ?? "").trim();
    const fornecedor  = (row.fornecedor ?? "").trim();
    const precoCompra = typeof row.precoCompra === "number" ? row.precoCompra : null;
    if (!codigo && !descricao) continue;
    const key = makeKey(codigo, descricao);
    if (byKey.has(key)) {
      const item = byKey.get(key);
      if (precoCompra !== null) item.precoCompra = precoCompra;
      if (fornecedor && !item.fornecedores.includes(fornecedor)) item.fornecedores.push(fornecedor);
      if (!item.categorias.includes(categoria)) item.categorias.push(categoria);
      if (!item.codigo && codigo) item.codigo = codigo;
      item.ultimaAtualizacao = now;
    } else {
      byKey.set(key, {
        id: key,
        codigo,
        descricao,
        precoCompra,
        fornecedores: fornecedor ? [fornecedor] : [],
        categorias:   [categoria],
        ultimaAtualizacao: now,
      });
    }
  }
}

// ── main ──────────────────────────────────────────────────────────────────
const pathConexoes = findFile("cone");
const pathValvulas = findFile("valv");
const pathTubos    = findFile("tubo");

console.log("📂 Conexões:", pathConexoes);
console.log("📂 Válvulas:", pathValvulas);
console.log("📂 Tubos:   ", pathTubos);

console.log("   lendo arquivos...");
const matrixC = readMatrix(readFileSync(pathConexoes));
const matrixV = readMatrix(readFileSync(pathValvulas));
const matrixT = readMatrix(readFileSync(pathTubos));

console.log(`   matrix — Conexões: ${matrixC.length} | Válvulas: ${matrixV.length} | Tubos: ${matrixT.length} linhas`);

const rowsConexoes = parseConexoes(matrixC);
const rowsValvulas = parseValvulas(matrixV);
const rowsTubos    = parseTubos(matrixT);

console.log(`✅ Parsed — Conexões: ${rowsConexoes.length} | Válvulas: ${rowsValvulas.length} | Tubos: ${rowsTubos.length}`);

// Sample check
if (rowsValvulas.length > 0) console.log("   Válvulas sample:", JSON.stringify(rowsValvulas[0]));
if (rowsTubos.length > 0)    console.log("   Tubos sample:   ", JSON.stringify(rowsTubos[0]));

const byKey = new Map();
syncToMap(rowsConexoes, "Conexões", byKey);
syncToMap(rowsValvulas, "Válvulas", byKey);
syncToMap(rowsTubos,    "Tubos",    byKey);

const items = Array.from(byKey.values());
console.log(`📦 Catálogo: ${items.length} itens únicos`);

writeFileSync("src/data/catalogo-static.json", JSON.stringify(items, null, 2));
console.log("🎉 Salvo em: src/data/catalogo-static.json");
