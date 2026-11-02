import { useEffect, useMemo, useRef, useState } from "react";
import {
  Category, Data, Tx, TxType, fmtDate, importCSV, load, money, monthLabel, monthOf, parseMoney,
  pct, protectStorage, save, shiftMonth, storageProtected, summarize, toCSV, today, uid,
} from "./lib";

/*
 * IMPORTANTE: todos os componentes ficam no nível do arquivo (nunca dentro de
 * outro componente). Declarar componente dentro de componente recria os inputs
 * a cada tecla e faz o campo perder o foco — era esse o bug do formulário.
 */

type Tab = "painel" | "lancamentos" | "categorias" | "historico" | "dados";
const TABS: [Tab, string][] = [
  ["painel", "Painel"], ["lancamentos", "Lançamentos"], ["categorias", "Categorias"], ["historico", "Histórico"], ["dados", "Dados"],
];

function NavIcon({ tab }: { tab: Tab }) {
  const icon = {
    painel: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    lancamentos: <><circle cx="12" cy="12" r="8.5" /><path d="M12 8v8M8 12h8" /></>,
    categorias: <><path d="M5 6h14M5 12h14M5 18h14" /><circle cx="3" cy="6" r=".5" /><circle cx="3" cy="12" r=".5" /><circle cx="3" cy="18" r=".5" /></>,
    historico: <><path d="M4 8a8 8 0 1 1-1 5" /><path d="M3 4v5h5M12 7v5l3 2" /></>,
    dados: <><path d="M4 20V12M10 20V4M16 20V9M22 20V6" /></>,
  }[tab];

  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>;
}

export default function App() {
  const [data, setData] = useState<Data>(load);
  const [tab, setTab] = useState<Tab>("painel");
  const [month, setMonth] = useState(() => today().slice(0, 7));
  useEffect(() => save(data), [data]);
  useEffect(() => { void protectStorage(); }, []); // pede ao navegador para não apagar os dados sozinho

  const catName = (id: string) => data.categories.find((c) => c.id === id)?.name ?? "Sem categoria";
  const pageTitle = TABS.find(([key]) => key === tab)?.[1] ?? "Painel";
  const showMonth = tab === "painel" || tab === "lancamentos";

  return (
    <div className="shell">
      <header className="topbar">
        <h1 className="brand">Orça</h1>
        <span className="brand-caption">Orçamento pessoal</span>
        <nav className="top-nav" aria-label="Seções">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={tab === key ? "navbtn on" : "navbtn"}
              aria-current={tab === key ? "page" : undefined}
              onClick={() => setTab(key)}
            >
              <NavIcon tab={key} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </header>
      <main className="content">
        <div className="page-head">
          <h2 className="page-title">{pageTitle}</h2>
          {showMonth && <MonthNav month={month} setMonth={setMonth} />}
        </div>
        {tab === "painel" && <Dashboard data={data} month={month} catName={catName} onNewTransaction={() => setTab("lancamentos")} />}
        {tab === "lancamentos" && <Transactions data={data} setData={setData} month={month} setMonth={setMonth} catName={catName} />}
        {tab === "categorias" && <Categories data={data} setData={setData} />}
        {tab === "historico" && <History data={data} month={month} setMonth={setMonth} catName={catName} goto={(m) => { setMonth(m); setTab("painel"); }} />}
        {tab === "dados" && <DataTab data={data} setData={setData} />}
      </main>
      <nav className="bottom-nav" aria-label="Seções">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? "navbtn on" : "navbtn"}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => setTab(key)}
          >
            <NavIcon tab={key} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ---------------- navegação de mês ---------------- */
function MonthNav({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  return (
    <div className="monthnav">
      <button type="button" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
      <strong>{monthLabel(month)}</strong>
      <button type="button" aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
    </div>
  );
}

/* ---------------- cores das categorias ---------------- */
const CHART_PALETTE = ["#68796e", "#a48d72", "#74818b", "#ad776b", "#8b8b70", "#8b7590", "#647d83"];
function colorFor(data: Data, id: string) {
  const index = data.categories.findIndex((category) => category.id === id);
  return index < 0 ? "#9aa19a" : CHART_PALETTE[index % CHART_PALETTE.length];
}

/* ---------------- gráfico de pizza (rosca) ---------------- */
interface Slice { id: string; label: string; value: number; color: string }

function PieChart({ slices, title }: { slices: Slice[]; title: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = slices.reduce((sum, x) => sum + x.value, 0);
  const R = 80;
  const C = 2 * Math.PI * R; // comprimento da circunferência
  const gap = slices.length > 1 ? 2 : 0; // espacinho entre as fatias
  let acc = 0; // quanto da circunferência já foi usado
  const active = slices.find((x) => x.id === hover);

  return (
    <div className="pie">
      <svg viewBox="0 0 200 200" role="img" aria-label={title}>
        <g transform="rotate(-90 100 100)">
          {slices.map((x) => {
            const len = Math.max((x.value / total) * C - gap, 0);
            const circle = (
              <circle key={x.id || "none"} cx="100" cy="100" r={R} fill="none" stroke={x.color}
                strokeWidth={hover === x.id ? 38 : 32}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-acc}
                onMouseEnter={() => setHover(x.id)} onMouseLeave={() => setHover(null)} />
            );
            acc += (x.value / total) * C;
            return circle;
          })}
        </g>
        <text x="100" y="94" textAnchor="middle" className="pc-label">{active ? active.label : title}</text>
        <text x="100" y="116" textAnchor="middle" className="pc-value">{money(active ? active.value : total)}</text>
        {active && <text x="100" y="134" textAnchor="middle" className="pc-label">{pct((active.value / total) * 100)} do total</text>}
      </svg>
      <ul className="plegend">
        {slices.map((x) => (
          <li key={x.id || "none"} className={hover === x.id ? "on" : ""}
            onMouseEnter={() => setHover(x.id)} onMouseLeave={() => setHover(null)}>
            <i className="pdot" style={{ background: x.color }} />
            <span>{x.label}</span>
            <b>{money(x.value)}</b>
            <span className="muted">{pct((x.value / total) * 100)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- painel ---------------- */
interface Common { data: Data; month: string; catName: (id: string) => string }

function Dashboard({ data, month, catName, onNewTransaction }: Common & { onNewTransaction: () => void }) {
  const s = useMemo(() => summarize(data.transactions, month), [data.transactions, month]);
  const toSlices = (m: Map<string, number>): Slice[] =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).map(([id, value]) => ({ id, value, label: catName(id), color: colorFor(data, id) }));
  const expenseSlices = toSlices(s.byCat);
  const incomeSlices = toSlices(s.incomeByCat);
  const budgeted = data.categories.filter((c) => c.kind === "expense" && c.budget > 0);

  return (
    <>
      <section className="hero">
        <div className="hero-head">
          <div>
            <h2 className="hero-title">Saldo do mês</h2>
            <p className="hero-period">{monthLabel(month)}</p>
          </div>
          <button className="primary" type="button" onClick={onNewTransaction}>Novo lançamento</button>
        </div>
        <p className={s.balance < 0 ? "big neg" : "big"}>{money(s.balance)}</p>
        <p className="hero-context">O que entrou menos o que saiu</p>
        <div className="flow">
          <div className="flowbox in"><span>Proventos (entrou)</span><b>{money(s.income)}</b></div>
          <div className="flowbox out"><span>Gastos (saiu)</span><b>{money(s.expense)}</b></div>
        </div>
      </section>

      <div className="charts-grid">
        <section>
          <h2>Entradas por categoria</h2>
          {incomeSlices.length === 0 ? <p className="empty">Nenhuma entrada neste mês. <button className="text-action" type="button" onClick={onNewTransaction}>Registrar uma</button></p> : <PieChart slices={incomeSlices} title="Entradas" />}
        </section>

        <section>
          <h2>Saídas por categoria</h2>
          {expenseSlices.length === 0 ? <p className="empty">Nenhuma saída neste mês. <button className="text-action" type="button" onClick={onNewTransaction}>Registrar uma</button></p> : <PieChart slices={expenseSlices} title="Saídas" />}
        </section>
      </div>

      <section>
        <h2>Orçamentos dos gastos</h2>
        {budgeted.length === 0 && <p className="empty">Defina um orçamento mensal nas categorias de gastos para acompanhar o limite aqui.</p>}
        {budgeted.map((c) => {
          const spent = s.byCat.get(c.id) || 0;
          const ratio = (spent / c.budget) * 100;
          return (
            <div className="catrow" key={c.id}>
              <div className="line"><span>{c.name}</span>
                <span>{money(spent)}<span className="muted"> de {money(c.budget)}</span></span></div>
              <div className="bar" role="img" aria-label={`${pct(ratio)} do orçamento`}>
                <i style={{ width: `${Math.min(ratio, 100)}%` }} className={ratio > 100 ? "over" : ratio >= 80 ? "warn" : ""} />
              </div>
            </div>
          );
        })}
      </section>

      <section>
        <h2>Gastos por categoria, comparado a {monthLabel(shiftMonth(month, -1))}</h2>
        <CategoryDelta data={data} month={month} catName={catName} />
      </section>

      <section>
        <h2>Tendência dos últimos 6 meses</h2>
        <TrendChart data={data} month={month} />
      </section>

      <section>
        <h2>Análises</h2>
        <Insights data={data} month={month} catName={catName} />
      </section>
    </>
  );
}

/* ---------------- comparação com o mês passado, por categoria ---------------- */
function CategoryDelta({ data, month, catName }: Common) {
  const cur = summarize(data.transactions, month);
  const prev = summarize(data.transactions, shiftMonth(month, -1));
  const ids = [...new Set([...cur.byCat.keys(), ...prev.byCat.keys()])];
  const rows = ids.map((id) => {
    const a = cur.byCat.get(id) || 0; // gasto neste mês
    const b = prev.byCat.get(id) || 0; // gasto no mês passado
    return { id, a, b, d: b > 0 ? ((a - b) / b) * 100 : 0 };
  }).sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b));

  function phrase(r: { a: number; b: number; d: number }) {
    if (r.b === 0) return { text: "gasto novo, sem gasto no mês passado", cls: "neg" };
    if (r.a === 0) return { text: "nenhum gasto neste mês", cls: "pos" };
    if (Math.round(Math.abs(r.d)) === 0) return { text: "igual ao mês passado", cls: "muted" };
    return { text: `${pct(Math.abs(r.d))} ${r.d > 0 ? "a mais" : "a menos"} que no mês passado`, cls: r.d > 0 ? "neg" : "pos" };
  }

  if (rows.length === 0) return <p className="empty">Registre gastos neste mês ou no anterior para comparar.</p>;
  return (
    <ul className="delta">
      {rows.map((r) => {
        const ph = phrase(r);
        return (
          <li key={r.id || "none"}>
            <b>{catName(r.id)}</b>
            <span className={ph.cls}>{ph.text}</span>
            <span className="muted">{money(r.b)} → {money(r.a)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function TrendChart({ data, month }: { data: Data; month: string }) {
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));
  const vals = months.map((m) => ({ m, ...summarize(data.transactions, m) }));
  const min = Math.min(0, ...vals.map((v) => v.balance));
  const max = Math.max(1, ...vals.flatMap((v) => [v.income, v.expense, v.balance]));
  const range = max - min || 1;
  const minValue = min - range * .08;
  const maxValue = max + range * .08;
  const W = 600, H = 220, left = 78, right = 590, top = 14, base = 178;
  const step = (right - left) / (vals.length - 1);
  const y = (value: number) => top + ((maxValue - value) / (maxValue - minValue)) * (base - top);
  const series = [
    { key: "income", label: "Entradas", color: "var(--pos)", dash: "" },
    { key: "expense", label: "Saídas", color: "var(--neg)", dash: "" },
    { key: "balance", label: "Saldo", color: "var(--accent)", dash: "5 4" },
  ] as const;
  const compactMoney = new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1,
  });

  return (
    <div className="chartwrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolução de entradas, saídas e saldo nos últimos 6 meses">
        {[0, 1, 2, 3].map((tick) => {
          const value = maxValue - ((maxValue - minValue) * tick) / 3;
          const cy = y(value);
          return (
            <g key={tick}>
              <line x1={left} x2={right} y1={cy} y2={cy} stroke="var(--line)" />
              <text x={left - 8} y={cy + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{compactMoney.format(value)}</text>
            </g>
          );
        })}
        {minValue < 0 && maxValue > 0 && (
          <line x1={left} x2={right} y1={y(0)} y2={y(0)} stroke="var(--muted)" strokeDasharray="3 4" />
        )}
        {vals.map((v, i) => {
          const cx = left + i * step;
          return (
            <g key={v.m}>
              <text x={cx} y={H - 7} textAnchor="middle" fontSize="12" fill="var(--muted)" fontWeight={v.m === month ? 700 : 400}>{monthLabel(v.m, true)}</text>
            </g>
          );
        })}
        {series.map((item) => {
          const points = vals.map((v, i) => `${left + i * step},${y(v[item.key])}`).join(" ");
          return (
            <g key={item.key}>
              <polyline points={points} fill="none" stroke={item.color} strokeWidth="2.5" strokeDasharray={item.dash} strokeLinecap="round" strokeLinejoin="round" />
              {vals.map((v, i) => (
                <circle key={v.m} cx={left + i * step} cy={y(v[item.key])} r="3.5" fill="var(--surface)" stroke={item.color} strokeWidth="2">
                  <title>{`${item.label} em ${monthLabel(v.m)}: ${money(v[item.key])}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <p className="legend">
        {series.map((item) => <span key={item.key}><i className={`sw line-${item.key}`} /> {item.label}</span>)}
      </p>
    </div>
  );
}

function Insights({ data, month, catName }: Common) {
  const cur = summarize(data.transactions, month);
  const prev = summarize(data.transactions, shiftMonth(month, -1));
  const out: { kind: "bad" | "warn" | "ok" | "info"; text: string }[] = [];

  data.categories.forEach((c) => {
    const spent = cur.byCat.get(c.id) || 0;
    if (c.budget <= 0 || spent === 0) return;
    const r = (spent / c.budget) * 100;
    if (r > 100) out.push({ kind: "bad", text: `${c.name} está ${pct(r - 100)} acima do orçamento (${money(spent)} de ${money(c.budget)}).` });
    else if (r >= 80) out.push({ kind: "warn", text: `${c.name} já usou ${pct(r)} do orçamento. Sobram ${money(c.budget - spent)}.` });
  });
  if (cur.expense > 0) {
    const top = [...cur.byCat.entries()].sort((a, b) => b[1] - a[1])[0];
    out.push({ kind: "info", text: `Sua maior despesa é ${catName(top[0])}: ${pct((top[1] / cur.expense) * 100)} de tudo o que você gastou.` });
  }
  if (prev.expense > 0 && cur.expense > 0) {
    const d = ((cur.expense - prev.expense) / prev.expense) * 100;
    if (Math.abs(d) >= 5) out.push({ kind: d > 0 ? "warn" : "ok", text: `Você gastou ${pct(Math.abs(d))} ${d > 0 ? "a mais" : "a menos"} que no mês passado.` });
  }
  if (cur.income > 0 && cur.balance < 0) out.push({ kind: "bad", text: `Você gastou ${money(-cur.balance)} a mais do que ganhou neste mês.` });
  else if (cur.income > 0 && cur.balance > 0) out.push({ kind: "ok", text: `Você guardou ${pct((cur.balance / cur.income) * 100)} da sua renda neste mês.` });

  if (out.length === 0) return <p className="empty">Registre receitas e despesas para ver análises aqui.</p>;
  return <ul className="insights">{out.map((o, i) => <li key={i} className={o.kind}>{o.text}</li>)}</ul>;
}

/* ---------------- lançamentos ---------------- */
function TxForm({ categories, editing, defaultDate, onSave, onCancel }: {
  categories: Category[]; editing: Tx | null; defaultDate: string; onSave: (t: Tx) => void; onCancel: () => void;
}) {
  const [type, setType] = useState<TxType>(editing?.type ?? "expense");
  const [amount, setAmount] = useState(editing ? String(editing.amount).replace(".", ",") : "");
  const [date, setDate] = useState(editing?.date ?? defaultDate);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");
  const [error, setError] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  // Só aparecem categorias do mesmo tipo do lançamento (gasto ou provento).
  const options = categories.filter((c) => c.kind === type);
  const catId = options.some((c) => c.id === categoryId) ? categoryId : "";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseMoney(amount);
    if (n === null) return setError("Informe um valor maior que zero, por exemplo 100 ou 49,90.");
    if (!date) return setError("Escolha a data.");
    onSave({ id: editing?.id ?? uid(), type, amount: n, date, description: description.trim(), categoryId: catId });
    if (!editing) { setAmount(""); setDescription(""); setError(""); amountRef.current?.focus(); }
  }

  return (
    <form className={`form tx ${type === "income" ? "in" : "out"}`} onSubmit={submit}>
      <div className="kind" role="group" aria-label="Tipo do lançamento">
        <button type="button" className={type === "expense" ? "k out on" : "k out"} onClick={() => setType("expense")}>
          <b>Gasto</b><span>dinheiro que saiu</span>
        </button>
        <button type="button" className={type === "income" ? "k in on" : "k in"} onClick={() => setType("income")}>
          <b>Provento</b><span>dinheiro que entrou</span>
        </button>
      </div>
      <label>Valor (R$)
        <input ref={amountRef} inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label>Data
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label>Descrição
        <input placeholder={type === "income" ? "Ex.: salário de novembro" : "Ex.: mercado"} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label>Categoria de {type === "income" ? "provento" : "gasto"}
        <select value={catId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Sem categoria</option>
          {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      {options.length === 0 && <p className="muted">Você ainda não tem categorias de {type === "income" ? "proventos" : "gastos"}. Crie uma na aba Categorias.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button className="primary" type="submit">{editing ? "Salvar alterações" : type === "income" ? "Registrar provento" : "Registrar gasto"}</button>
        {editing && <button type="button" onClick={onCancel}>Cancelar</button>}
      </div>
    </form>
  );
}

function Transactions({ data, setData, month, setMonth, catName }: Common & { setData: (f: (d: Data) => Data) => void; setMonth: (m: string) => void }) {
  const [editing, setEditing] = useState<Tx | null>(null);
  const [notice, setNotice] = useState<{ text: string; month: string } | null>(null);
  // Data padrão do formulário: hoje, se o mês escolhido é o atual; senão o dia 1 do mês escolhido.
  const defaultDate = month === monthOf(today()) ? today() : `${month}-01`;
  const [view, setView] = useState<"all" | TxType>("all");
  const all = data.transactions.filter((t) => monthOf(t.date) === month).sort((a, b) => b.date.localeCompare(a.date));
  const list = view === "all" ? all : all.filter((t) => t.type === view);
  const nIn = all.filter((t) => t.type === "income").length;
  const totalIn = all.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalOut = all.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  function onSave(t: Tx) {
    setData((d) => ({
      ...d,
      transactions: d.transactions.some((x) => x.id === t.id) ? d.transactions.map((x) => (x.id === t.id ? t : x)) : [...d.transactions, t],
    }));
    setEditing(null);
    setNotice({ text: `Salvo em ${fmtDate(t.date)}.`, month: monthOf(t.date) });
  }
  function remove(t: Tx) {
    if (confirm(`Excluir "${t.description || catName(t.categoryId)}" de ${money(t.amount)}?`))
      setData((d) => ({ ...d, transactions: d.transactions.filter((x) => x.id !== t.id) }));
  }

  return (
    <>
      <section>
        <h2>{editing ? "Editar lançamento" : "Novo lançamento"}</h2>
        <TxForm key={`${editing?.id ?? "novo"}-${month}`} categories={data.categories} editing={editing} defaultDate={defaultDate} onSave={onSave} onCancel={() => setEditing(null)} />
        {notice && (
          <p className="notice" role="status">{notice.text}{" "}
            {notice.month !== month && <button onClick={() => { setMonth(notice.month); setNotice(null); }}>Ver {monthLabel(notice.month)}</button>}
          </p>
        )}
      </section>
      <section>
        <h2>Lançamentos de {monthLabel(month)}</h2>
        <div className="seg" role="group" aria-label="Filtrar lançamentos">
          <button className={view === "all" ? "on" : ""} onClick={() => setView("all")}>Todos ({all.length})</button>
          <button className={view === "income" ? "on" : ""} onClick={() => setView("income")}>Proventos ({nIn})</button>
          <button className={view === "expense" ? "on" : ""} onClick={() => setView("expense")}>Gastos ({all.length - nIn})</button>
        </div>
        <p className="totals"><span className="pos">Proventos +{money(totalIn)}</span><span className="neg">Gastos −{money(totalOut)}</span></p>
        {list.length === 0 && <p className="empty">Nada registrado aqui neste mês ainda.</p>}
        <ul className="txlist">
          {list.map((t) => (
            <li key={t.id} className={t.type === "income" ? "in" : "out"}>
              <div>
                <b><span className={t.type === "income" ? "badge in" : "badge out"}>{t.type === "income" ? "Provento" : "Gasto"}</span>{t.description || catName(t.categoryId)}</b>
                <span className="muted">{fmtDate(t.date)} · {catName(t.categoryId)}</span>
              </div>
              <span className={t.type === "income" ? "pos" : "neg"}>{t.type === "income" ? "+" : "−"}{money(t.amount)}</span>
              <span className="rowbtns">
                <button onClick={() => { setEditing(t); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Editar</button>
                <button onClick={() => remove(t)}>Excluir</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/* ---------------- categorias ---------------- */
function CategoryRow({ c, onChange, onDelete }: { c: Category; onChange: (c: Category) => void; onDelete: () => void }) {
  const [name, setName] = useState(c.name);
  const [budget, setBudget] = useState(c.budget ? String(c.budget).replace(".", ",") : "");
  const isExpense = c.kind === "expense";
  function commit() {
    const n = name.trim() || c.name;
    const b = !isExpense || budget.trim() === "" ? 0 : parseMoney(budget) ?? c.budget;
    setName(n); setBudget(b ? String(b).replace(".", ",") : "");
    if (n !== c.name || b !== c.budget) onChange({ ...c, name: n, budget: b });
  }
  return (
    <li className={isExpense ? "catedit" : "catedit solo"}>
      <input aria-label="Nome da categoria" value={name} onChange={(e) => setName(e.target.value)} onBlur={commit} />
      {isExpense && (
        <input aria-label={`Orçamento mensal de ${c.name}`} inputMode="decimal" placeholder="Sem orçamento" value={budget}
          onChange={(e) => setBudget(e.target.value)} onBlur={commit} />
      )}
      <button onClick={onDelete}>Excluir</button>
    </li>
  );
}

function Categories({ data, setData }: { data: Data; setData: (f: (d: Data) => Data) => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TxType>("expense");
  const [budget, setBudget] = useState("");
  function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setData((d) => ({ ...d, categories: [...d.categories, { id: uid(), name: n, kind, budget: kind === "expense" ? parseMoney(budget) ?? 0 : 0 }] }));
    setName(""); setBudget("");
  }
  function remove(c: Category) {
    const used = data.transactions.filter((t) => t.categoryId === c.id).length;
    if (confirm(used ? `"${c.name}" tem ${used} lançamento(s). Eles ficarão sem categoria. Excluir?` : `Excluir "${c.name}"?`))
      setData((d) => ({
        categories: d.categories.filter((x) => x.id !== c.id),
        transactions: d.transactions.map((t) => (t.categoryId === c.id ? { ...t, categoryId: "" } : t)),
      }));
  }
  const update = (nc: Category) => setData((d) => ({ ...d, categories: d.categories.map((x) => (x.id === nc.id ? nc : x)) }));
  return (
    <>
      <section>
        <h2>Nova categoria</h2>
        <form className="form inline" onSubmit={add}>
          <label>Tipo
            <select value={kind} onChange={(e) => setKind(e.target.value as TxType)}>
              <option value="expense">Gasto (dinheiro que sai)</option>
              <option value="income">Provento (dinheiro que entra)</option>
            </select>
          </label>
          <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "income" ? "Ex.: Freelance" : "Ex.: Educação"} /></label>
          {kind === "expense" && (
            <label>Orçamento mensal (R$)<input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Opcional" /></label>
          )}
          <button className="primary" type="submit">Criar categoria</button>
        </form>
      </section>
      <section className="panel out">
        <h2>Categorias de gastos</h2>
        <p className="muted">Edite o nome ou o orçamento direto na lista. Deixe o orçamento vazio para não acompanhar limite.</p>
        <ul className="catlist">
          {data.categories.filter((c) => c.kind === "expense").map((c) => <CategoryRow key={c.id} c={c} onDelete={() => remove(c)} onChange={update} />)}
        </ul>
      </section>
      <section className="panel in">
        <h2>Categorias de proventos</h2>
        <ul className="catlist">
          {data.categories.filter((c) => c.kind === "income").map((c) => <CategoryRow key={c.id} c={c} onDelete={() => remove(c)} onChange={update} />)}
        </ul>
      </section>
    </>
  );
}

/* ---------------- histórico ---------------- */
function History({ data, month, setMonth, catName, goto }: Common & { setMonth: (m: string) => void; goto: (m: string) => void }) {
  const [other, setOther] = useState(() => shiftMonth(month, -1));
  const months = [...new Set(data.transactions.map((t) => monthOf(t.date)))].sort().reverse();
  const a = summarize(data.transactions, month), b = summarize(data.transactions, other);
  const ids = [...new Set([...a.byCat.keys(), ...b.byCat.keys()])];
  const diff = (x: number, y: number) => (y === 0 ? (x === 0 ? "—" : "novo") : `${x >= y ? "+" : "−"}${pct((Math.abs(x - y) / y) * 100)}`);

  return (
    <>
      <section>
        <h2>Comparar meses</h2>
        <div className="compare">
          <label>Mês A<input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></label>
          <label>Mês B<input type="month" value={other} onChange={(e) => e.target.value && setOther(e.target.value)} /></label>
        </div>
        <div className="tablewrap">
          <table>
            <thead><tr><th></th><th>{monthLabel(month, true)}</th><th>{monthLabel(other, true)}</th><th>Variação</th></tr></thead>
            <tbody>
              <tr><td>Receitas</td><td>{money(a.income)}</td><td>{money(b.income)}</td><td>{diff(a.income, b.income)}</td></tr>
              <tr><td>Despesas</td><td>{money(a.expense)}</td><td>{money(b.expense)}</td><td>{diff(a.expense, b.expense)}</td></tr>
              <tr><td><b>Saldo</b></td><td><b>{money(a.balance)}</b></td><td><b>{money(b.balance)}</b></td><td></td></tr>
              {ids.map((id) => (
                <tr key={id || "none"} className="sub"><td>{catName(id)}</td><td>{money(a.byCat.get(id) || 0)}</td><td>{money(b.byCat.get(id) || 0)}</td><td>{diff(a.byCat.get(id) || 0, b.byCat.get(id) || 0)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2>Meses com lançamentos</h2>
        {months.length === 0 && <p className="empty">Seu histórico aparece aqui depois do primeiro lançamento.</p>}
        <ul className="txlist">
          {months.map((m) => {
            const s = summarize(data.transactions, m);
            return (
              <li key={m}>
                <b>{monthLabel(m)}</b>
                <span className={s.balance < 0 ? "neg" : "pos"}>{money(s.balance)}</span>
                <span className="rowbtns"><button onClick={() => goto(m)}>Abrir no painel</button></span>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

/* ---------------- dados (CSV) ---------------- */
function DataTab({ data, setData }: { data: Data; setData: (d: Data) => void }) {
  const [msg, setMsg] = useState<{ ok: string; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [prot, setProt] = useState<boolean | null | undefined>(undefined);
  useEffect(() => { storageProtected().then(setProt); }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = importCSV(await f.text(), data);
    if (r.added > 0) setData(r.data);
    setMsg({ ok: r.added > 0 ? `${r.added} lançamento(s) importado(s).` : "Nenhum lançamento foi importado.", errors: r.errors });
    if (fileRef.current) fileRef.current.value = "";
  }
  function download(content: string, name: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <section>
        <h2>Importar CSV</h2>
        <p className="muted">Colunas: <code>data;tipo;descricao;categoria;valor</code>. Data em AAAA-MM-DD ou DD/MM/AAAA, tipo "receita" ou "despesa". Categorias novas são criadas automaticamente. Linhas com erro são ignoradas e listadas abaixo.</p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} />
        {msg && (
          <div className="result">
            <p><b>{msg.ok}</b></p>
            {msg.errors.length > 0 && <ul className="errlist">{msg.errors.slice(0, 30).map((er, i) => <li key={i}>{er}</li>)}
              {msg.errors.length > 30 && <li>… e mais {msg.errors.length - 30} erro(s).</li>}</ul>}
          </div>
        )}
      </section>
      <section>
        <h2>Exportar CSV</h2>
        <p className="muted">Baixe todos os seus lançamentos. O arquivo abre direto no Excel.</p>
        <button className="primary" onClick={() => download(toCSV(data), `orca-${today()}.csv`, "text/csv;charset=utf-8")}>Baixar lançamentos (.csv)</button>
      </section>
      <section>
        <h2>Armazenamento</h2>
        <p className="muted">Seus dados ficam só neste navegador ({data.transactions.length} lançamentos, {data.categories.length} categorias). Exporte um CSV de vez em quando como cópia de segurança.</p>
        {prot === true && <p className="pos"><b>Proteção ativa.</b> O navegador não apaga seus dados sozinho quando faltar espaço. Isso não vale se você limpar os dados do navegador manualmente.</p>}
        {prot === false && (
          <p>A proteção contra limpeza automática ainda não foi concedida pelo navegador.{" "}
            <button onClick={() => protectStorage().then(setProt)}>Proteger meus dados</button></p>
        )}
        {prot === null && <p className="muted">Este navegador não oferece proteção contra limpeza automática. Use o CSV como cópia de segurança.</p>}
        <button onClick={() => { if (confirm("Apagar TODOS os dados deste navegador? Isso não tem volta.")) setData({ categories: [], transactions: [] }); }}>Apagar todos os dados</button>
      </section>
    </>
  );
}
