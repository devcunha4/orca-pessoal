import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';

type TransactionType = 'income' | 'expense';
type View = 'dashboard' | 'transactions' | 'budgets';

type Category = {
  id: string;
  name: string;
  color: string;
  budget: number;
};

type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  description: string;
  categoryId: string;
};

type Toast = { type: 'success' | 'error'; text: string } | null;

type FormDraft = {
  type: TransactionType;
  amount: string;
  date: string;
  description: string;
  categoryId: string;
};

const STORAGE_KEY = 'orca-budget-v1';
const COLORS = ['#6f7d57', '#d9915b', '#5a7fa8', '#b67987', '#8b77a8', '#c49a4b', '#5f8f86', '#aa6a4d'];
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const compactCurrency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const shifted = new Date(year, monthNumber - 1 + offset, 1, 12);
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}`;
}

function monthLabel(month: string, short = false) {
  const date = new Date(`${month}-01T12:00:00`);
  return new Intl.DateTimeFormat('pt-BR', { month: short ? 'short' : 'long', year: short ? undefined : 'numeric' })
    .format(date)
    .replace('.', '');
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(new Date(`${date}T12:00:00`))
    .replace('.', '');
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isRealDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function dateForMonth(month: string) {
  return month === monthKey() ? localDate() : `${month}-01`;
}

function parseAmount(value: string | undefined) {
  const raw = value?.replace(/R\$\s?/g, '').trim() ?? '';
  if (!raw) return 0;
  return Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    arrow: <><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></>,
    wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 16.5z" /><path d="M4 8h15" /><path d="M16 13h4" /><circle cx="16" cy="13" r=".7" fill="currentColor" stroke="none" /></>,
    list: <><path d="M8 6h12" /><path d="M8 12h12" /><path d="M8 18h12" /><path d="M3.5 6h.01" /><path d="M3.5 12h.01" /><path d="M3.5 18h.01" /></>,
    target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 20h16" /></>,
    upload: <><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M4 20h16" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    left: <path d="m15 18-6-6 6-6" />,
    right: <path d="m9 18 6-6-6-6" />,
    close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
    edit: <><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /><path d="m14.5 7.5 2 2" /></>,
    trash: <><path d="M4 7h16" /><path d="M10 11v5" /><path d="M14 11v5" /><path d="m6 7 1 13h10l1-13" /><path d="M9 7V4h6v3" /></>,
    spark: <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" /><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6z" /></>,
    calendar: <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M7 3v3M17 3v3M3 9h18" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    check: <path d="m5 12 4.5 4.5L19 7" />,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  };
  return <svg {...common}>{paths[name] ?? paths.spark}</svg>;
}

const baseCategories: Category[] = [
  { id: 'income', name: 'Receitas', color: '#86a46d', budget: 0 },
  { id: 'housing', name: 'Moradia', color: '#6f7d57', budget: 2400 },
  { id: 'market', name: 'Mercado', color: '#d9915b', budget: 1200 },
  { id: 'restaurants', name: 'Restaurantes', color: '#b67987', budget: 650 },
  { id: 'transport', name: 'Transporte', color: '#5a7fa8', budget: 450 },
  { id: 'leisure', name: 'Lazer', color: '#8b77a8', budget: 400 },
  { id: 'health', name: 'Saúde', color: '#5f8f86', budget: 300 },
];

function createSeedTransactions() {
  const current = monthKey();
  const months = [0, -1, -2, -3, -4, -5].map((offset) => shiftMonth(current, offset));
  const entries: Transaction[] = [];
  const push = (offset: number, type: TransactionType, amount: number, description: string, categoryId: string, day: number) => {
    const month = months[offset];
    entries.push({ id: `seed-${offset}-${description}`, type, amount, description, categoryId, date: `${month}-${pad(day)}` });
  };
  push(0, 'income', 7200, 'Salário mensal', 'income', 2);
  push(0, 'expense', 1900, 'Aluguel', 'housing', 5);
  push(0, 'expense', 540, 'Compras do mês', 'market', 7);
  push(0, 'expense', 860, 'Jantar e delivery', 'restaurants', 12);
  push(0, 'expense', 280, 'Combustível', 'transport', 15);
  push(0, 'expense', 210, 'Cinema e streaming', 'leisure', 18);
  push(0, 'expense', 320, 'Consulta e farmácia', 'health', 20);
  push(1, 'income', 7200, 'Salário mensal', 'income', 2);
  push(1, 'expense', 1900, 'Aluguel', 'housing', 5);
  push(1, 'expense', 980, 'Compras do mês', 'market', 8);
  push(1, 'expense', 490, 'Restaurantes', 'restaurants', 14);
  push(1, 'expense', 310, 'Combustível', 'transport', 17);
  push(2, 'income', 7200, 'Salário mensal', 'income', 2);
  push(2, 'expense', 1900, 'Aluguel', 'housing', 5);
  push(2, 'expense', 1060, 'Compras do mês', 'market', 9);
  push(2, 'expense', 720, 'Restaurantes', 'restaurants', 16);
  push(2, 'expense', 390, 'Transporte', 'transport', 18);
  push(3, 'income', 7200, 'Salário mensal', 'income', 2);
  push(3, 'expense', 1900, 'Aluguel', 'housing', 5);
  push(3, 'expense', 890, 'Compras do mês', 'market', 7);
  push(3, 'expense', 580, 'Restaurantes', 'restaurants', 12);
  push(3, 'expense', 340, 'Transporte', 'transport', 18);
  push(4, 'income', 7200, 'Salário mensal', 'income', 2);
  push(4, 'expense', 1900, 'Aluguel', 'housing', 5);
  push(4, 'expense', 920, 'Compras do mês', 'market', 8);
  push(4, 'expense', 610, 'Restaurantes', 'restaurants', 15);
  push(4, 'expense', 300, 'Transporte', 'transport', 17);
  push(5, 'income', 7200, 'Salário mensal', 'income', 2);
  push(5, 'expense', 1900, 'Aluguel', 'housing', 5);
  push(5, 'expense', 840, 'Compras do mês', 'market', 8);
  push(5, 'expense', 530, 'Restaurantes', 'restaurants', 13);
  push(5, 'expense', 290, 'Transporte', 'transport', 16);
  return entries;
}

function getInitialData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as { categories?: unknown; transactions?: unknown };
      if (Array.isArray(parsed.transactions) && Array.isArray(parsed.categories)) {
        const safeCategories = parsed.categories.filter((item): item is Category => {
          if (!item || typeof item !== 'object') return false;
          const candidate = item as Partial<Category>;
          return typeof candidate.id === 'string' && typeof candidate.name === 'string' && typeof candidate.color === 'string' && typeof candidate.budget === 'number' && Number.isFinite(candidate.budget) && candidate.budget >= 0;
        });
        const safeTransactions = parsed.transactions.filter((item): item is Transaction => {
          if (!item || typeof item !== 'object') return false;
          const candidate = item as Partial<Transaction>;
          return typeof candidate.id === 'string' && (candidate.type === 'income' || candidate.type === 'expense') && typeof candidate.amount === 'number' && Number.isFinite(candidate.amount) && candidate.amount > 0 && isRealDate(candidate.date) && typeof candidate.description === 'string' && candidate.description.trim().length > 0 && typeof candidate.categoryId === 'string';
        });
        if (safeCategories.length > 0) {
          const categories = safeCategories.some((category) => category.id === 'income') ? safeCategories : [{ ...baseCategories[0] }, ...safeCategories];
          return { categories, transactions: safeTransactions };
        }
      }
    }
  } catch {
    // A base limpa é mais segura se o armazenamento estiver corrompido.
  }
  return { categories: baseCategories, transactions: createSeedTransactions() };
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
}

function parseCSVLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function App() {
  const initial = useMemo(() => getInitialData(), []);
  const [categories, setCategories] = useState<Category[]>(initial.categories ?? baseCategories);
  const [transactions, setTransactions] = useState<Transaction[]>(initial.transactions ?? []);
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<Toast>(null);
  const [draft, setDraft] = useState<FormDraft>({ type: 'expense', amount: '', date: localDate(), description: '', categoryId: '' });
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ categories, transactions }));
    } catch {
      setToast({ type: 'error', text: 'Não foi possível salvar no navegador. Verifique o espaço disponível.' });
    }
  }, [categories, transactions]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const monthTransactions = useMemo(() => transactions.filter((transaction) => transaction.date.startsWith(selectedMonth)), [transactions, selectedMonth]);
  const income = useMemo(() => monthTransactions.filter((item) => item.type === 'income').reduce((total, item) => total + item.amount, 0), [monthTransactions]);
  const expenses = useMemo(() => monthTransactions.filter((item) => item.type === 'expense').reduce((total, item) => total + item.amount, 0), [monthTransactions]);
  const balance = income - expenses;
  const budgetTotal = categories.reduce((total, category) => total + category.budget, 0);
  const budgetSpent = useMemo(() => categories.reduce((total, category) => total + monthTransactions.filter((item) => item.type === 'expense' && item.categoryId === category.id).reduce((sum, item) => sum + item.amount, 0), 0), [categories, monthTransactions]);
  const categorySpending = useMemo(() => categories.map((category) => {
    const spent = monthTransactions.filter((item) => item.type === 'expense' && item.categoryId === category.id).reduce((total, item) => total + item.amount, 0);
    return { ...category, spent, percent: category.budget > 0 ? Math.min((spent / category.budget) * 100, 100) : 0, over: category.budget > 0 ? ((spent - category.budget) / category.budget) * 100 : 0 };
  }).sort((a, b) => b.spent - a.spent), [categories, monthTransactions]);
  const visibleTransactions = useMemo(() => monthTransactions.filter((item) => {
    const category = categoryMap.get(item.categoryId)?.name ?? '';
    const query = search.trim().toLowerCase();
    return !query || item.description.toLowerCase().includes(query) || category.toLowerCase().includes(query);
  }).sort((a, b) => b.date.localeCompare(a.date)), [monthTransactions, search, categoryMap]);
  const trend = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const month = shiftMonth(selectedMonth, index - 5);
    const items = transactions.filter((item) => item.date.startsWith(month));
    const totalIncome = items.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = items.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
    return { month, income: totalIncome, expenses: totalExpenses, balance: totalIncome - totalExpenses };
  }), [selectedMonth, transactions]);

  const overBudget = categorySpending.filter((category) => category.budget > 0 && category.spent > category.budget).sort((a, b) => b.over - a.over);
  const savingRate = income > 0 ? (balance / income) * 100 : 0;
  const maxTrend = Math.max(...trend.map((item) => Math.max(item.income, item.expenses)), 1);
  const latestExpense = [...monthTransactions].filter((item) => item.type === 'expense').sort((a, b) => b.date.localeCompare(a.date))[0];

  const showToast = (nextToast: Toast) => setToast(nextToast);
  const changeMonth = (offset: number) => setSelectedMonth(shiftMonth(selectedMonth, offset));

  const openNewTransaction = (type: TransactionType = 'expense') => {
    setEditingId(null);
    setDraft({ type, amount: '', date: dateForMonth(selectedMonth), description: '', categoryId: type === 'income' ? 'income' : categories.find((category) => category.id !== 'income')?.id ?? '' });
    setModalOpen(true);
  };

  const openEditTransaction = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setDraft({ type: transaction.type, amount: String(transaction.amount), date: transaction.date, description: transaction.description, categoryId: transaction.categoryId });
    setModalOpen(true);
  };

  const saveTransaction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = parseAmount(draft.amount);
    if (!amount || amount <= 0 || !isRealDate(draft.date) || !draft.description.trim() || !draft.categoryId) {
      showToast({ type: 'error', text: 'Preencha descrição, valor, data e categoria para salvar.' });
      return;
    }
    const next: Transaction = { id: editingId ?? id('tx'), type: draft.type, amount, date: draft.date, description: draft.description.trim(), categoryId: draft.categoryId };
    setTransactions((current) => editingId ? current.map((item) => item.id === editingId ? next : item) : [next, ...current]);
    setModalOpen(false);
    showToast({ type: 'success', text: editingId ? 'Lançamento atualizado.' : 'Lançamento adicionado.' });
  };

  const deleteTransaction = (transactionId: string) => {
    setTransactions((current) => current.filter((item) => item.id !== transactionId));
    showToast({ type: 'success', text: 'Lançamento excluído.' });
  };

  const updateBudget = (categoryId: string, value: string) => {
    const budget = Number(value.replace(',', '.'));
    setCategories((current) => current.map((category) => category.id === categoryId ? { ...category, budget: Number.isFinite(budget) && budget >= 0 ? budget : 0 } : category));
  };

  const addCategory = () => {
    const name = window.prompt('Nome da nova categoria');
    if (!name?.trim()) return;
    if (categories.some((category) => category.name.toLowerCase() === name.trim().toLowerCase())) {
      showToast({ type: 'error', text: 'Essa categoria já existe.' });
      return;
    }
    const newCategory = { id: id('cat'), name: name.trim(), color: COLORS[categories.length % COLORS.length], budget: 0 };
    setCategories((current) => [...current, newCategory]);
    showToast({ type: 'success', text: `${newCategory.name} foi criada.` });
  };

  const exportCSV = () => {
    const header = ['tipo', 'valor', 'data', 'descricao', 'categoria', 'orcamento_mensal'].join(';');
    const rows = transactions.map((transaction) => {
      const category = categoryMap.get(transaction.categoryId);
      return [transaction.type === 'income' ? 'receita' : 'despesa', transaction.amount.toFixed(2).replace('.', ','), transaction.date, transaction.description, category?.name ?? 'Sem categoria', category ? category.budget.toFixed(2).replace('.', ',') : ''].map(csvCell).join(';');
    });
    const blob = new Blob([`\uFEFF${[header, ...rows].join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orca-lancamentos-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast({ type: 'success', text: 'CSV exportado com todos os lançamentos.' });
  };

  const importCSV = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '').replace(/^\uFEFF/, '');
        const lines = text.split(/\r?\n/).filter((line) => line.trim());
        if (lines.length < 2) throw new Error('O arquivo não possui linhas de lançamentos.');
        const delimiter = lines[0].includes(';') ? ';' : ',';
        const headers = parseCSVLine(lines[0], delimiter).map(normalizeHeader);
        const findIndex = (aliases: string[]) => aliases.map((alias) => headers.indexOf(alias)).find((index) => index >= 0) ?? -1;
        const typeIndex = findIndex(['tipo', 'type', 'natureza']);
        const amountIndex = findIndex(['valor', 'amount']);
        const dateIndex = findIndex(['data', 'date']);
        const descriptionIndex = findIndex(['descricao', 'description', 'detalhe']);
        const categoryIndex = findIndex(['categoria', 'category']);
        const budgetIndex = findIndex(['orcamento_mensal', 'orcamento', 'budget']);
        if ([typeIndex, amountIndex, dateIndex, descriptionIndex, categoryIndex].some((index) => index < 0)) throw new Error('Use as colunas tipo, valor, data, descricao e categoria.');
        const nextCategories = [...categories];
        const imported: Transaction[] = [];
        let invalid = 0;
        lines.slice(1).forEach((line) => {
          const values = parseCSVLine(line, delimiter);
          const rawType = values[typeIndex]?.toLowerCase() ?? '';
          const amount = parseAmount(values[amountIndex]);
          const date = values[dateIndex]?.trim();
          const description = values[descriptionIndex]?.trim();
          const categoryName = values[categoryIndex]?.trim();
          const type: TransactionType = ['receita', 'income', 'entrada'].includes(rawType) ? 'income' : ['despesa', 'expense', 'saida', 'saída'].includes(rawType) ? 'expense' : 'expense';
          if (!amount || amount <= 0 || !isRealDate(date) || !description || !categoryName || !['receita', 'income', 'entrada', 'despesa', 'expense', 'saida', 'saída'].includes(rawType)) {
            invalid += 1;
            return;
          }
          let category = nextCategories.find((item) => item.name.toLowerCase() === categoryName.toLowerCase());
          if (!category) {
            const rawBudget = budgetIndex >= 0 ? values[budgetIndex]?.trim() : '';
            const budgetValue = rawBudget ? Number(rawBudget.replace(/\./g, '').replace(',', '.')) : 0;
            category = { id: id('cat'), name: categoryName, color: COLORS[nextCategories.length % COLORS.length], budget: Number.isFinite(budgetValue) && budgetValue >= 0 ? budgetValue : 0 };
            nextCategories.push(category);
          }
          imported.push({ id: id('tx'), type, amount, date, description, categoryId: category.id });
        });
        if (!imported.length) throw new Error('Nenhuma linha válida foi encontrada.');
        setCategories(nextCategories);
        setTransactions((current) => [...imported, ...current]);
        showToast({ type: 'success', text: `${imported.length} lançamento(s) importado(s)${invalid ? `; ${invalid} linha(s) ignorada(s)` : ''}.` });
      } catch (error) {
        showToast({ type: 'error', text: error instanceof Error ? error.message : 'Não foi possível ler o CSV.' });
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-mark"><span></span><span></span><span></span></div><div><strong>orça</strong><small>seu dinheiro, claro</small></div></div>
        <div className="sidebar-section-label">Visão geral</div>
        <nav className="main-nav" aria-label="Navegação principal">
          <button className={activeView === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('dashboard')}><Icon name="grid" /><span>Painel</span></button>
          <button className={activeView === 'transactions' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('transactions')}><Icon name="list" /><span>Lançamentos</span><em>{transactions.length}</em></button>
          <button className={activeView === 'budgets' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('budgets')}><Icon name="target" /><span>Orçamentos</span></button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="tip-card"><div className="tip-icon"><Icon name="spark" size={17} /></div><p><strong>Pequenos ajustes, grandes respiros.</strong> Acompanhe seus limites sem complicar.</p></div>
        <div className="storage-note"><span className="status-dot"></span><span>Dados salvos neste navegador</span></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark"><span></span><span></span><span></span></div><strong>orça</strong></div>
          <div className="topbar-context"><span className="eyebrow">Seu espaço financeiro</span><h1>{activeView === 'dashboard' ? 'Visão geral' : activeView === 'transactions' ? 'Lançamentos' : 'Orçamentos'}</h1></div>
          <div className="topbar-actions">
            <input ref={importRef} type="file" accept=".csv,text/csv" onChange={importCSV} hidden />
            <button className="quiet-button" onClick={() => importRef.current?.click()}><Icon name="upload" size={16} /> Importar CSV</button>
            <button className="quiet-button" onClick={exportCSV}><Icon name="download" size={16} /> Exportar</button>
            <button className="avatar" aria-label="Perfil">M</button>
          </div>
        </header>

        <div className="content-wrap">
          <div className="month-toolbar">
            <div><span className="eyebrow">Acompanhando agora</span><div className="month-switcher"><button onClick={() => changeMonth(-1)} aria-label="Mês anterior"><Icon name="left" size={16} /></button><strong>{monthLabel(selectedMonth)}</strong><button onClick={() => changeMonth(1)} aria-label="Próximo mês"><Icon name="right" size={16} /></button></div></div>
            <div className="toolbar-actions"><button className="outline-button" onClick={() => openNewTransaction('income')}><Icon name="plus" size={16} /> Receita</button><button className="primary-button" onClick={() => openNewTransaction('expense')}><Icon name="plus" size={16} /> Nova despesa</button></div>
          </div>

          {activeView === 'dashboard' && <Dashboard month={selectedMonth} income={income} expenses={expenses} balance={balance} budgetSpent={budgetSpent} budgetTotal={budgetTotal} categorySpending={categorySpending} trend={trend} maxTrend={maxTrend} overBudget={overBudget} savingRate={savingRate} latestExpense={latestExpense} categoryMap={categoryMap} onGoTransactions={() => setActiveView('transactions')} />}
          {activeView === 'transactions' && <TransactionsView transactions={visibleTransactions} categoryMap={categoryMap} search={search} setSearch={setSearch} onEdit={openEditTransaction} onDelete={deleteTransaction} onAdd={() => openNewTransaction('expense')} />}
          {activeView === 'budgets' && <BudgetsView categories={categories} categorySpending={categorySpending} onUpdate={updateBudget} onAddCategory={addCategory} />}
        </div>
      </main>

      {modalOpen && <TransactionModal draft={draft} editing={Boolean(editingId)} categories={categories} onChange={setDraft} onClose={() => setModalOpen(false)} onSubmit={saveTransaction} />}
      {toast && <div className={`toast ${toast.type}`} role="status"><span className="toast-mark"><Icon name={toast.type === 'success' ? 'check' : 'close'} size={15} /></span>{toast.text}</div>}
    </div>
  );
}

type DashboardProps = {
  month: string;
  income: number;
  expenses: number;
  balance: number;
  budgetSpent: number;
  budgetTotal: number;
  categorySpending: Array<Category & { spent: number; percent: number; over: number }>;
  trend: Array<{ month: string; income: number; expenses: number; balance: number }>;
  maxTrend: number;
  overBudget: Array<Category & { spent: number; percent: number; over: number }>;
  savingRate: number;
  latestExpense?: Transaction;
  categoryMap: Map<string, Category>;
  onGoTransactions: () => void;
};

function Dashboard({ month, income, expenses, balance, budgetSpent, budgetTotal, categorySpending, trend, maxTrend, overBudget, savingRate, latestExpense, categoryMap, onGoTransactions }: DashboardProps) {
  const chartWidth = 620;
  const chartHeight = 190;
  const chartPadding = 24;
  const trendMin = Math.min(...trend.map((item) => item.balance), 0);
  const trendMax = Math.max(maxTrend, ...trend.map((item) => item.balance), 1);
  const trendRange = Math.max(trendMax - trendMin, 1);
  const trendY = (value: number) => chartHeight - chartPadding - ((value - trendMin) / trendRange) * (chartHeight - chartPadding * 2);
  const zeroY = trendY(0);
  const points = trend.map((item, index) => `${chartPadding + (index * (chartWidth - chartPadding * 2)) / (trend.length - 1)},${trendY(item.balance)}`).join(' ');
  const expensePoints = trend.map((item, index) => `${chartPadding + (index * (chartWidth - chartPadding * 2)) / (trend.length - 1)},${trendY(item.expenses)}`).join(' ');
  const budgetPercent = budgetTotal > 0 ? Math.min((budgetSpent / budgetTotal) * 100, 100) : 0;
  const topCategories = categorySpending.filter((item) => item.spent > 0).slice(0, 5);
  return (
    <>
      <section className="hero-grid">
        <div className="balance-card">
          <div className="balance-top"><div><span className="eyebrow light">Saldo disponível</span><div className="balance-value">{currency.format(balance)}</div></div><div className="balance-icon"><Icon name="wallet" size={24} /></div></div>
          <div className="balance-bottom"><span><Icon name="arrow" size={14} /> {savingRate >= 0 ? `${Math.round(savingRate)}% da receita livre` : 'Despesas acima das receitas'}</span><small>receitas − despesas</small></div>
          <div className="card-swoosh"></div>
        </div>
        <div className="metric-card"><div className="metric-label"><span className="metric-dot green"></span>Receitas</div><strong>{currency.format(income)}</strong><small>neste mês</small><div className="metric-trend positive">↗ fluxo de entrada</div></div>
        <div className="metric-card"><div className="metric-label"><span className="metric-dot coral"></span>Despesas</div><strong>{currency.format(expenses)}</strong><small>neste mês</small><div className={`metric-trend ${expenses <= income ? 'positive' : 'negative'}`}>{expenses <= income ? '↘ sob controle' : '↗ acima das receitas'}</div></div>
      </section>

      <section className="dashboard-grid main-panels">
        <div className="panel trend-panel"><div className="panel-heading"><div><span className="eyebrow">Ritmo financeiro</span><h2>Tendência mês a mês</h2></div><span className="legend"><i className="legend-line olive"></i> saldo <i className="legend-line coral"></i> despesas</span></div><div className="trend-chart"><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Gráfico de tendência financeira"><defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#6f7d57" stopOpacity=".19" /><stop offset="1" stopColor="#6f7d57" stopOpacity="0" /></linearGradient></defs><path d={`M ${chartPadding},${zeroY} L ${points.replaceAll(' ', ' L ')} L ${chartWidth - chartPadding},${zeroY} Z`} fill="url(#areaFill)" /><polyline points={points} fill="none" stroke="#6f7d57" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><polyline points={expensePoints} fill="none" stroke="#d9915b" strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" /><line x1="24" y1={zeroY} x2="596" y2={zeroY} stroke="#dfe5dc" />{trend.map((item, index) => { const x = chartPadding + (index * (chartWidth - chartPadding * 2)) / (trend.length - 1); return <circle key={item.month} cx={x} cy={trendY(item.balance)} r="4" fill="#fdfdfa" stroke="#6f7d57" strokeWidth="2" />; })}</svg><div className="chart-labels">{trend.map((item) => <span key={item.month}>{monthLabel(item.month, true)}</span>)}</div></div></div>
        <div className="panel analysis-panel"><div className="panel-heading"><div><span className="eyebrow">Leitura rápida</span><h2>O que merece atenção</h2></div><div className="sparkle"><Icon name="spark" size={17} /></div></div><div className="analysis-list">{overBudget.length > 0 ? overBudget.slice(0, 3).map((item) => <div className="analysis-item warning" key={item.id}><span className="analysis-icon"><Icon name="arrow" size={15} /></span><p>A categoria <strong>{item.name}</strong> está <strong>{Math.round(item.over)}% acima</strong> do orçamento.</p></div>) : <div className="analysis-item good"><span className="analysis-icon"><Icon name="check" size={15} /></span><p>Você está dentro de todos os orçamentos. Continue assim.</p></div>}<div className="analysis-item neutral"><span className="analysis-icon"><Icon name="spark" size={15} /></span><p>Seu saldo livre é de <strong>{currency.format(Math.max(balance, 0))}</strong> neste mês.</p></div>{latestExpense && <div className="analysis-item neutral"><span className="analysis-icon"><Icon name="calendar" size={15} /></span><p>O último lançamento foi <strong>{latestExpense.description}</strong>, de {currency.format(latestExpense.amount)}.</p></div>}</div><button className="text-button" onClick={onGoTransactions}>Ver todos os lançamentos <Icon name="right" size={15} /></button></div>
      </section>

      <section className="dashboard-grid lower-panels"><div className="panel spending-panel"><div className="panel-heading"><div><span className="eyebrow">Para onde vai</span><h2>Gastos por categoria</h2></div><span className="panel-total">{currency.format(expenses)} no mês</span></div><div className="spending-content"><div className="donut-wrap"><div className="donut" style={{ background: `conic-gradient(${topCategories.map((item, index) => `${item.color} ${topCategories.slice(0, index).reduce((sum, previous) => sum + (previous.spent / Math.max(expenses, 1)) * 100, 0)}% ${topCategories.slice(0, index + 1).reduce((sum, previous) => sum + (previous.spent / Math.max(expenses, 1)) * 100, 0)}%`).join(', ')}, #edf0e9 0 100%)` }}><div><strong>{Math.round((expenses / Math.max(income, 1)) * 100)}%</strong><small>da receita</small></div></div></div><div className="category-bars">{topCategories.length > 0 ? topCategories.map((item) => <div className="category-row" key={item.id}><div className="row-top"><span><i className="color-dot" style={{ background: item.color }}></i>{item.name}</span><strong>{currency.format(item.spent)}</strong></div><div className="bar-track"><span style={{ width: `${Math.max((item.spent / Math.max(expenses, 1)) * 100, 3)}%`, background: item.color }}></span></div></div>) : <div className="empty-inline">Ainda não há despesas neste mês.</div>}</div></div></div><div className="panel budget-progress-panel"><div className="panel-heading"><div><span className="eyebrow">Limites do mês</span><h2>Orçamento usado</h2></div><span className="budget-percent">{Math.round(budgetPercent)}%</span></div><div className="big-progress"><span style={{ width: `${budgetPercent}%` }}></span></div><div className="budget-numbers"><div><small>Usado</small><strong>{currency.format(budgetSpent)}</strong></div><div><small>Definido</small><strong>{currency.format(budgetTotal)}</strong></div></div><div className="budget-message"><span className="message-check"><Icon name="check" size={14} /></span><p>{budgetPercent < 80 ? 'Seu ritmo está saudável. Há espaço para o que importa.' : 'Você está chegando perto dos seus limites. Vale dar uma olhada.'}</p></div><div className="mini-budget-list">{categorySpending.slice(0, 4).map((item) => <div key={item.id}><span><i className="color-dot" style={{ background: item.color }}></i>{item.name}</span><strong className={item.over > 0 ? 'over-text' : ''}>{Math.round(item.budget > 0 ? (item.spent / item.budget) * 100 : 0)}%</strong></div>)}</div></div></section>
    </>
  );
}

type TransactionsProps = { transactions: Transaction[]; categoryMap: Map<string, Category>; search: string; setSearch: (value: string) => void; onEdit: (transaction: Transaction) => void; onDelete: (id: string) => void; onAdd: () => void };
function TransactionsView({ transactions, categoryMap, search, setSearch, onEdit, onDelete, onAdd }: TransactionsProps) {
  return <section className="page-section"><div className="page-intro"><div><span className="eyebrow">Histórico financeiro</span><h2>Todos os lançamentos</h2><p>Revise cada entrada e saída. Seus dados ficam somente neste navegador.</p></div><button className="primary-button" onClick={onAdd}><Icon name="plus" size={16} /> Nova despesa</button></div><div className="table-toolbar"><div className="search-field"><Icon name="search" size={17} /><input aria-label="Buscar por descrição ou categoria" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por descrição ou categoria" /></div><span className="result-count">{transactions.length} lançamento(s)</span></div><div className="transactions-table"><div className="table-head"><span>Descrição</span><span>Categoria</span><span>Data</span><span>Valor</span><span></span></div>{transactions.length > 0 ? transactions.map((transaction) => { const category = categoryMap.get(transaction.categoryId); return <div className="table-row" key={transaction.id}><div className="description-cell"><span className={`transaction-icon ${transaction.type}`}><Icon name={transaction.type === 'income' ? 'arrow' : 'chevron'} size={15} /></span><strong>{transaction.description}</strong></div><div><span className="category-pill"><i className="color-dot" style={{ background: category?.color ?? '#9ba59a' }}></i>{category?.name ?? 'Sem categoria'}</span></div><span className="date-cell">{dateLabel(transaction.date)}</span><strong className={`amount-cell ${transaction.type}`}>{transaction.type === 'income' ? '+' : '−'} {currency.format(transaction.amount)}</strong><div className="row-actions"><button onClick={() => onEdit(transaction)} aria-label="Editar"><Icon name="edit" size={15} /></button><button onClick={() => onDelete(transaction.id)} aria-label="Excluir"><Icon name="trash" size={15} /></button></div></div>; }) : <div className="empty-state"><div className="empty-icon"><Icon name="search" /></div><h3>Nada encontrado</h3><p>Tente outra busca ou adicione um novo lançamento.</p></div>}</div></section>;
}

type BudgetsProps = { categories: Category[]; categorySpending: Array<Category & { spent: number; percent: number; over: number }>; onUpdate: (id: string, value: string) => void; onAddCategory: () => void };
function BudgetsView({ categories, categorySpending, onUpdate, onAddCategory }: BudgetsProps) {
  return <section className="page-section"><div className="page-intro"><div><span className="eyebrow">Planeje antes de gastar</span><h2>Orçamentos por categoria</h2><p>Defina limites mensais e acompanhe o ritmo de cada escolha.</p></div><button className="outline-button" onClick={onAddCategory}><Icon name="plus" size={16} /> Nova categoria</button></div><div className="budget-cards">{categorySpending.map((category) => <div className="budget-card" key={category.id}><div className="budget-card-head"><span className="category-heading"><i className="color-dot large" style={{ background: category.color }}></i><strong>{category.name}</strong></span><span className={category.over > 0 ? 'status-tag danger' : 'status-tag'}>{category.over > 0 ? `${Math.round(category.over)}% acima` : 'no ritmo'}</span></div><div className="budget-card-values"><div><small>Gasto atual</small><strong>{currency.format(category.spent)}</strong></div><div className="budget-input-wrap"><small>Limite mensal</small><div><span>R$</span><input aria-label={`Limite mensal para ${category.name}`} value={category.budget} onChange={(event) => onUpdate(category.id, event.target.value)} inputMode="decimal" /></div></div></div><div className="bar-track thick"><span style={{ width: `${Math.min(category.budget > 0 ? (category.spent / category.budget) * 100 : 0, 100)}%`, background: category.color }}></span></div><div className="budget-card-foot"><span>{category.budget > 0 ? `${Math.round((category.spent / category.budget) * 100)}% utilizado` : 'Defina um limite para acompanhar'}</span><span>{category.budget > category.spent ? `restam ${currency.format(category.budget - category.spent)}` : 'limite ultrapassado'}</span></div></div>)}</div></section>;
}

type ModalProps = { draft: FormDraft; editing: boolean; categories: Category[]; onChange: (draft: FormDraft) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void };
function TransactionModal({ draft, editing, categories, onChange, onClose, onSubmit }: ModalProps) {
  const firstFieldRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    firstFieldRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><span className="eyebrow">Novo movimento</span><h2 id="modal-title">{editing ? 'Editar lançamento' : 'Adicionar lançamento'}</h2></div><button type="button" className="close-button" onClick={onClose} aria-label="Fechar"><Icon name="close" size={18} /></button></div><div className="type-toggle"><button type="button" className={draft.type === 'expense' ? 'selected expense' : ''} onClick={() => onChange({ ...draft, type: 'expense' })}>Despesa</button><button type="button" className={draft.type === 'income' ? 'selected income' : ''} onClick={() => onChange({ ...draft, type: 'income' })}>Receita</button></div><form onSubmit={onSubmit}><label className="field wide"><span>Descrição</span><input ref={firstFieldRef} value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} placeholder="Ex.: mercado da semana" /></label><div className="field-row"><label className="field"><span>Valor</span><div className="input-prefix"><b>R$</b><input type="text" inputMode="decimal" value={draft.amount} onChange={(event) => onChange({ ...draft, amount: event.target.value })} placeholder="0,00" /></div></label><label className="field"><span>Data</span><div className="input-prefix"><Icon name="calendar" size={16} /><input type="date" value={draft.date} onChange={(event) => onChange({ ...draft, date: event.target.value })} /></div></label></div><label className="field wide"><span>Categoria</span><select value={draft.categoryId} onChange={(event) => onChange({ ...draft, categoryId: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><div className="modal-actions"><button type="button" className="quiet-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button">{editing ? 'Salvar alterações' : 'Adicionar lançamento'} <Icon name="arrow" size={15} /></button></div></form></div></div>;
}

export default App;
