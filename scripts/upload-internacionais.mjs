/**
 * Script one-shot: lê a planilha de fretes internacionais e salva no Supabase.
 * Uso: node scripts/upload-internacionais.mjs
 */
import { readFileSync, readdirSync } from "fs";
import { read, utils } from "xlsx";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hsyohvptriadxflghrlb.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzeW9odnB0cmlhZHhmbGdocmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzk3NjIsImV4cCI6MjA5MjYxNTc2Mn0.ZLcOrun9-nlKvDchNpgUK9MGpOQqN_-ORYaC96_n22I";

// Resolve path dynamically to handle NFD-encoded filenames on Windows
const usersDir = "C:/Users";
const userName = readdirSync(usersDir).find((u) => u.normalize("NFC").includes("lia") && u !== "Public" && u !== "Default");
if (!userName) throw new Error("Pasta do usuário não encontrada em C:/Users");
const desktopDir = `${usersDir}/${userName}/OneDrive/Desktop`;
const xlsxName = readdirSync(desktopDir).find((f) => f.normalize("NFC").includes("frete") && f.endsWith(".xlsx"));
if (!xlsxName) throw new Error("Arquivo de fretes não encontrado no Desktop");
const FILE_PATH = `${desktopDir}/${xlsxName}`;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── 1. Ler e parsear o arquivo ────────────────────────────────────────────────
console.log("📂 Lendo arquivo:", FILE_PATH);
const buf = readFileSync(FILE_PATH);
const wb = read(buf, { type: "buffer" });
const sheet = wb.Sheets[wb.SheetNames[0]];

const matrix = utils.sheet_to_json(sheet, {
  header: 1,
  defval: "",
  blankrows: false,
});

if (matrix.length < 2) {
  console.error("❌ Planilha vazia ou sem cabeçalho.");
  process.exit(1);
}

const headers = matrix[0].map((h, i) =>
  h ? String(h).trim() : `Col${i + 1}`
);

// Linha de totais: D = "-" e G/H/I numéricos com soma > 0
const totalsIdx = matrix.findIndex((row, idx) => {
  if (idx === 0) return false;
  const d = row[3];
  const g = Number(row[6]);
  const h = Number(row[7]);
  const i = Number(row[8]);
  return d === "-" && (!isNaN(g) || !isNaN(h) || !isNaN(i)) && g + h + i > 0;
});

let cont20 = 0, cont40 = 0, cont45 = 0, aereo = 0;
if (totalsIdx > 0) {
  cont20 = Number(matrix[totalsIdx][6]) || 0;
  cont40 = Number(matrix[totalsIdx][7]) || 0;
  cont45 = Number(matrix[totalsIdx][8]) || 0;
}

const dataRows = [];
let capturedSubRow = [];

matrix.forEach((row, idx) => {
  if (idx === 0 || idx === totalsIdx) return;

  const isSubHeader =
    row[6] === "20'" ||
    row[6] === '20"' ||
    (typeof row[6] === "string" && /^20['"]/.test(String(row[6])));
  if (isSubHeader) {
    capturedSubRow = row.map((v) =>
      v !== null && v !== undefined && v !== "" ? String(v).trim() : ""
    );
    return;
  }

  const hasData = row.some((v) => v !== "" && v !== null && v !== undefined);
  if (!hasData) return;

  const mod = String(row[4] ?? "").trim().toUpperCase();
  if (mod === "AÉREO" || mod === "AEREO" || mod === "AIR") aereo += 1;

  const obj = {};
  headers.forEach((h, i) => {
    const v = row[i];
    if (v !== undefined && v !== null && v !== "") obj[h] = v;
  });
  if (row[6] !== undefined && row[6] !== null && row[6] !== "") obj["__qty20"] = row[6];
  if (row[7] !== undefined && row[7] !== null && row[7] !== "") obj["__qty40"] = row[7];
  if (row[8] !== undefined && row[8] !== null && row[8] !== "") obj["__qty45"] = row[8];
  if (Object.keys(obj).length > 0) dataRows.push(obj);
});

const subHeaders = headers.map((_, i) => capturedSubRow[i] ?? "");
const totals = { cont20, cont40, cont45, aereo };
const uploadedAt = new Date().toISOString();
const fileName = "Cotações de frete 2026.xlsx";

console.log(`✅ Parsed: ${dataRows.length} registros | containers: 20ft=${cont20} 40ft=${cont40} 45ft=${cont45} aéreo=${aereo}`);
console.log(`   Colunas: ${headers.length} | SubHeaders detectados: ${capturedSubRow.filter(Boolean).length}`);

// ── 2. Salvar no Supabase ─────────────────────────────────────────────────────
console.log("\n⬆️  Enviando para Supabase (fretes_internacionais)...");

const payload = {
  id:          1,
  rows:        dataRows,
  columns:     headers,
  sub_headers: subHeaders,
  file_name:   fileName,
  uploaded_at: uploadedAt,
  totals,
};

const { error } = await supabase
  .from("fretes_internacionais")
  .upsert(payload, { onConflict: "id" });

if (error) {
  console.error("❌ Erro ao salvar no Supabase:", error.message);
  if (error.message.includes("does not exist")) {
    console.error("\n⚠️  A tabela ainda não existe no Supabase.");
    console.error("   Aplique a migration SQL no painel do Supabase primeiro:");
    console.error("   supabase/migrations/20260427120000_add_catalogo_and_internacionais.sql");
  }
  process.exit(1);
}

console.log("🎉 Dados salvos com sucesso!");
console.log(`   ${dataRows.length} registros em fretes_internacionais (id=1)`);
