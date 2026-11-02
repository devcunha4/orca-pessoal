export type TxType = "income" | "expense";
export interface Category { id: string; name: string; budget: number; kind: TxType }
export interface Tx { id: string; type: TxType; amount: number; date: string; description: string; categoryId: string }
export interface Data { categories: Category[]; transactions: Tx[] }

const KEY = "orca:v1";
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** Dados antigos não tinham "kind": deduz pelo nome (salário/renda = provento). */
function guessKind(name: string): TxType {
  const n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /salario|renda|provento|rendimento|receita|freela|bonus|decimo/.test(n) ? "income" : "expense";
}

export function load(): Data {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (Array.isArray(d.categories) && Array.isArray(d.transactions)) {
        d.categories = d.categories.map((c: Category) => ({ ...c, kind: c.kind === "income" || c.kind === "expense" ? c.kind : guessKind(c.name) }));
        return d;
      }
    }
  } catch { /* ignora */ }
  return {
    categories: [
      ...["Moradia", "Alimentação", "Transporte", "Lazer", "Saúde"].map((name) => ({ id: uid(), name, budget: 0, kind: "expense" as TxType })),
      ...["Salário", "Renda extra"].map((name) => ({ id: uid(), name, budget: 0, kind: "income" as TxType })),
    ],
    transactions: [],
  };
}
export function save(d: Data) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignora */ }
}

/* ---------- proteção do armazenamento ---------- */
/** Pede ao navegador para NÃO apagar os dados sozinho (ex.: falta de espaço). null = sem suporte. */
export async function protectStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return null; }
}
/** Só consulta se a proteção já está ativa (não abre pedido de permissão). */
export async function storageProtected(): Promise<boolean | null> {
  try { return navigator.storage?.persisted ? await navigator.storage.persisted() : null; } catch { return null; }
}

/* ---------- formatação ---------- */
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (n: number) => brl.format(n);
export const pct = (n: number) => `${Math.round(n)}%`;

/** Aceita "100", "100,50", "1.234,56", "1234.56", "R$ 10" */
export function parseMoney(s: string): number | null {
  let t = s.trim().replace(/[R$\s]/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/* ---------- meses ---------- */
export const today = () => {
  const d = new Date(); // data local (toISOString usaria UTC e pode "pular" de dia à noite)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const monthOf = (date: string) => date.slice(0, 7);
export function shiftMonth(ym: string, n: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function monthLabel(ym: string, short = false) {
  const [y, m] = ym.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: short ? "short" : "long", year: short ? "2-digit" : "numeric" });
  return s.replace(".", "");
}
export const fmtDate = (d: string) => d.split("-").reverse().join("/");

/* ---------- cálculos ---------- */
export function summarize(txs: Tx[], ym: string) {
  const list = txs.filter((t) => monthOf(t.date) === ym);
  const income = list.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = list.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const byCat = new Map<string, number>(); // gastos por categoria
  const incomeByCat = new Map<string, number>(); // proventos por categoria
  list.forEach((t) => {
    const m = t.type === "expense" ? byCat : incomeByCat;
    m.set(t.categoryId, (m.get(t.categoryId) || 0) + t.amount);
  });
  return { income, expense, balance: income - expense, byCat, incomeByCat };
}

/* ---------- CSV ---------- */
export function parseCSV(text: string): string[][] {
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/)[0] || "";
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const esc = (s: string) => (/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function toCSV(d: Data): string {
  const name = (id: string) => d.categories.find((c) => c.id === id)?.name ?? "";
  const lines = ["data;tipo;descricao;categoria;valor"];
  [...d.transactions].sort((a, b) => a.date.localeCompare(b.date)).forEach((t) =>
    lines.push([t.date, t.type === "income" ? "receita" : "despesa", esc(t.description), esc(name(t.categoryId)), String(t.amount).replace(".", ",")].join(";")));
  return "\uFEFF" + lines.join("\r\n");
}

function parseDate(s: string): string | null {
  s = s.trim();
  let y: number, m: number, d: number;
  let r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (r) { y = +r[1]; m = +r[2]; d = +r[3]; }
  else if ((r = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) { d = +r[1]; m = +r[2]; y = +r[3]; }
  else return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export interface ImportResult { data: Data; added: number; errors: string[] }

export function importCSV(text: string, current: Data): ImportResult {
  const rows = parseCSV(text);
  const errors: string[] = [];
  if (rows.length < 2) return { data: current, added: 0, errors: ["O arquivo está vazio ou só tem o cabeçalho."] };
  const head = rows[0].map(norm);
  const idx = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const iDate = idx("data", "date"), iType = idx("tipo", "type"), iVal = idx("valor", "value", "amount");
  const iDesc = idx("descricao", "description"), iCat = idx("categoria", "category");
  const missing = [iDate < 0 && "data", iType < 0 && "tipo", iVal < 0 && "valor"].filter(Boolean);
  if (missing.length) return { data: current, added: 0, errors: [`Faltam colunas obrigatórias: ${missing.join(", ")}. Use o cabeçalho: data;tipo;descricao;categoria;valor`] };

  const categories = [...current.categories];
  const txs: Tx[] = [];
  rows.slice(1).forEach((r, n) => {
    const line = n + 2;
    const date = parseDate(r[iDate] ?? "");
    const t = norm(r[iType] ?? "");
    const type: TxType | null = ["receita", "income"].includes(t) ? "income" : ["despesa", "expense"].includes(t) ? "expense" : null;
    const amount = parseMoney(r[iVal] ?? "");
    if (!date) return void errors.push(`Linha ${line}: data inválida ("${r[iDate] ?? ""}"). Use AAAA-MM-DD ou DD/MM/AAAA.`);
    if (!type) return void errors.push(`Linha ${line}: tipo inválido ("${r[iType] ?? ""}"). Use receita ou despesa.`);
    if (amount === null) return void errors.push(`Linha ${line}: valor inválido ("${r[iVal] ?? ""}"). Use um número maior que zero.`);
    const catName = (iCat >= 0 ? r[iCat] ?? "" : "").trim();
    let categoryId = "";
    if (catName) {
      let c = categories.find((x) => x.kind === type && norm(x.name) === norm(catName));
      if (!c) { c = { id: uid(), name: catName, budget: 0, kind: type }; categories.push(c); }
      categoryId = c.id;
    }
    txs.push({ id: uid(), type, amount, date, description: (iDesc >= 0 ? r[iDesc] ?? "" : "").trim(), categoryId });
  });
  return { data: { categories, transactions: [...current.transactions, ...txs] }, added: txs.length, errors };
}
