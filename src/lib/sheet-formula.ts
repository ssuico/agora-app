export interface FormulaColumn {
  id: string;
  label: string;
  type: string;
  formula?: string;
}

export interface FormulaRow {
  cells: Record<string, string>;
}

export type FormulaValue = { kind: 'blank' } | { kind: 'number'; value: number } | { kind: 'error'; message: string };

type Ast =
  | { k: 'num'; v: number }
  | { k: 'cell'; col: number; row: number | null }
  | { k: 'name'; label: string; row: number | null }
  | { k: 'neg'; expr: Ast }
  | { k: 'bin'; op: '+' | '-' | '*' | '/'; left: Ast; right: Ast }
  | { k: 'call'; name: string; args: Arg[] };

type Arg = { k: 'expr'; expr: Ast } | { k: 'range'; start: Ref; end: Ref };

type Ref = { k: 'cell'; col: number; row: number | null } | { k: 'name'; label: string; row: number | null };

type Tok =
  | { t: 'num'; v: number }
  | { t: 'ident'; v: string }
  | { t: 'name'; v: string }
  | { t: 'op'; v: '+' | '-' | '*' | '/' }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'comma' }
  | { t: 'colon' };

const FUNCTIONS = new Set(['SUM', 'AVERAGE', 'MIN', 'MAX', 'ROUND']);

export function columnLetter(index: number): string {
  let n = index + 1;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

function letterIndex(letter: string): number {
  let n = 0;
  for (const char of letter) n = n * 26 + (char.charCodeAt(0) - 64);
  return n - 1;
}

function tokenize(input: string): Tok[] {
  const source = input.trim().replace(/^=/, '');
  const tokens: Tok[] = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === ' ' || char === '\t' || char === '\n') {
      i += 1;
      continue;
    }
    if (char === '+' || char === '-' || char === '*' || char === '/' || char === '×' || char === '÷') {
      const op = char === '×' ? '*' : char === '÷' ? '/' : char;
      tokens.push({ t: 'op', v: op });
      i += 1;
      continue;
    }
    if (char === '(') {
      tokens.push({ t: 'lp' });
      i += 1;
      continue;
    }
    if (char === ')') {
      tokens.push({ t: 'rp' });
      i += 1;
      continue;
    }
    if (char === ',') {
      tokens.push({ t: 'comma' });
      i += 1;
      continue;
    }
    if (char === ':') {
      tokens.push({ t: 'colon' });
      i += 1;
      continue;
    }
    if (char === '[') {
      const end = source.indexOf(']', i + 1);
      if (end < 0) throw new Error('Missing ] in column name');
      const name = source.slice(i + 1, end).trim();
      if (!name) throw new Error('Empty column name');
      tokens.push({ t: 'name', v: name });
      i = end + 1;
      continue;
    }
    if (char >= '0' && char <= '9' || char === '.') {
      const match = /^\d+(\.\d+)?/.exec(source.slice(i));
      if (!match) throw new Error('Invalid number');
      tokens.push({ t: 'num', v: Number(match[0]) });
      i += match[0].length;
      continue;
    }
    if (/[A-Za-z]/.test(char)) {
      const match = /^[A-Za-z]+/.exec(source.slice(i));
      if (!match) throw new Error('Invalid formula');
      tokens.push({ t: 'ident', v: match[0].toUpperCase() });
      i += match[0].length;
      continue;
    }
    throw new Error(`Unexpected "${char}"`);
  }
  return tokens;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Tok[]) {}

  parse(): Ast {
    const expr = this.parseExpr();
    if (this.peek()) throw new Error('Unexpected part of the formula');
    return expr;
  }

  private peek(): Tok | undefined {
    return this.tokens[this.index];
  }

  private eat(): Tok {
    const token = this.tokens[this.index];
    if (!token) throw new Error('Formula ended early');
    this.index += 1;
    return token;
  }

  private parseExpr(): Ast {
    let left = this.parseTerm();
    while (this.peek()?.t === 'op' && (this.peek()?.t === 'op' && (this.peek() as { v: string }).v.match(/^[+-]$/))) {
      const op = (this.eat() as { v: '+' | '-' }).v;
      left = { k: 'bin', op, left, right: this.parseTerm() };
    }
    return left;
  }

  private parseTerm(): Ast {
    let left = this.parseUnary();
    while (this.peek()?.t === 'op' && /^[*/]$/.test((this.peek() as { v: string }).v)) {
      const op = (this.eat() as { v: '*' | '/' }).v;
      left = { k: 'bin', op, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): Ast {
    if (this.peek()?.t === 'op' && (this.peek() as { v: string }).v === '-') {
      this.eat();
      return { k: 'neg', expr: this.parseUnary() };
    }
    if (this.peek()?.t === 'op' && (this.peek() as { v: string }).v === '+') {
      this.eat();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Ast {
    const token = this.peek();
    if (!token) throw new Error('Formula ended early');
    if (token.t === 'num') {
      this.eat();
      return { k: 'num', v: token.v };
    }
    if (token.t === 'lp') {
      this.eat();
      const expr = this.parseExpr();
      if (this.peek()?.t !== 'rp') throw new Error('Missing )');
      this.eat();
      return expr;
    }
    if (token.t === 'ident' && FUNCTIONS.has(token.v) && this.tokens[this.index + 1]?.t === 'lp') {
      return this.parseCall();
    }
    const ref = this.tryParseRef();
    if (!ref) throw new Error('Expected a number, column, or function');
    return ref;
  }

  private parseCall(): Ast {
    const name = (this.eat() as { v: string }).v;
    if (this.peek()?.t !== 'lp') throw new Error(`Expected ( after ${name}`);
    this.eat();
    const args: Arg[] = [];
    if (this.peek()?.t !== 'rp') {
      args.push(this.parseArg());
      while (this.peek()?.t === 'comma') {
        this.eat();
        args.push(this.parseArg());
      }
    }
    if (this.peek()?.t !== 'rp') throw new Error('Missing )');
    this.eat();
    if (args.length === 0) throw new Error(`${name} needs a value`);
    if (name === 'ROUND' && args.some((arg) => arg.k === 'range')) throw new Error('ROUND cannot use a range');
    if (name !== 'ROUND' && args.length > 1 && args.some((arg) => arg.k === 'range')) {
      throw new Error(`${name} ranges stand alone`);
    }
    return { k: 'call', name, args };
  }

  private parseArg(): Arg {
    const mark = this.index;
    const start = this.tryParseRef();
    if (start && this.peek()?.t === 'colon') {
      this.eat();
      const end = this.tryParseRef();
      if (!end) throw new Error('Invalid range');
      return { k: 'range', start, end };
    }
    this.index = mark;
    return { k: 'expr', expr: this.parseExpr() };
  }

  private tryParseRef(): Ref | null {
    const token = this.peek();
    if (token?.t === 'name') {
      this.eat();
      return { k: 'name', label: token.v, row: null };
    }
    if (token?.t === 'ident' && /^[A-Z]+$/.test(token.v)) {
      this.eat();
      let row: number | null = null;
      const next = this.peek();
      if (next?.t === 'num' && Number.isInteger(next.v) && next.v >= 1) {
        this.eat();
        row = next.v - 1;
      }
      return { k: 'cell', col: letterIndex(token.v), row };
    }
    return null;
  }
}

function findColumn(columns: FormulaColumn[], ref: Ref): number {
  if (ref.k === 'cell') {
    if (ref.col < 0 || ref.col >= columns.length) throw new Error('Unknown column');
    return ref.col;
  }
  const index = columns.findIndex((column) => column.label.toLowerCase() === ref.label.toLowerCase());
  if (index < 0) throw new Error(`Unknown column ${ref.label}`);
  return index;
}

interface Engine {
  columns: FormulaColumn[];
  rows: FormulaRow[];
  memo: Map<string, number | null>;
  stack: string[];
}

function evaluateStored(engine: Engine, key: string, formula: string, row: number): number | null {
  if (engine.stack.includes(key)) throw new Error('Circular reference');
  if (engine.memo.has(key)) return engine.memo.get(key) ?? null;
  engine.stack.push(key);
  let value: number | null;
  try {
    value = evalAst(parseFormula(formula), engine, row);
  } finally {
    engine.stack.pop();
  }
  engine.memo.set(key, value);
  return value;
}

function readNumber(engine: Engine, col: number, row: number): number | null {
  const column = engine.columns[col];
  if (!column) throw new Error('Unknown column');
  if (row < 0 || row >= engine.rows.length) throw new Error('Unknown row');
  const raw = (engine.rows[row]?.cells[column.id] ?? '').trim();
  const key = `${column.id}:${row}`;
  if (raw.startsWith('=')) return evaluateStored(engine, key, raw, row);
  if (column.type === 'formula') return evaluateStored(engine, key, column.formula ?? '', row);
  if (column.type !== 'number') throw new Error(`"${column.label}" is not a number column`);
  if (!raw) return null;
  const parsed = parseSheetNumber(raw);
  if (parsed == null) throw new Error(`"${column.label}" has a value that is not a number`);
  return parsed;
}

function rangeValues(engine: Engine, arg: Extract<Arg, { k: 'range' }>, currentRow: number): Array<number | null> {
  const startCol = findColumn(engine.columns, arg.start);
  const endCol = findColumn(engine.columns, arg.end);
  const startRow = arg.start.row;
  const endRow = arg.end.row;
  if ((startRow == null) !== (endRow == null)) throw new Error('A range needs two row numbers, or none');
  const rowFrom = startRow == null ? 0 : Math.min(startRow, endRow ?? startRow);
  const rowTo = startRow == null ? engine.rows.length - 1 : Math.max(startRow, endRow ?? startRow);
  const colFrom = Math.min(startCol, endCol);
  const colTo = Math.max(startCol, endCol);
  const values: Array<number | null> = [];
  for (let row = rowFrom; row <= rowTo; row += 1) {
    for (let col = colFrom; col <= colTo; col += 1) {
      values.push(readNumber(engine, col, row));
    }
  }
  return values;
}

function present(values: Array<number | null>): number[] {
  return values.filter((value): value is number => value != null);
}

function evalAst(ast: Ast, engine: Engine, row: number): number | null {
  const sameRow = collectSameRow(ast);
  if (sameRow.length > 0 && sameRow.every((ref) => readNumber(engine, findColumn(engine.columns, ref), row) == null)) {
    return null;
  }
  return evalNumber(ast, engine, row);
}

function evalNumber(ast: Ast, engine: Engine, row: number): number | null {
  switch (ast.k) {
    case 'num':
      return ast.v;
    case 'neg': {
      const value = evalNumber(ast.expr, engine, row);
      return value == null ? null : -value;
    }
    case 'cell':
    case 'name':
      return readNumber(engine, findColumn(engine.columns, ast), ast.row ?? row);
    case 'bin': {
      const left = evalNumber(ast.left, engine, row);
      const right = evalNumber(ast.right, engine, row);
      if (left == null && right == null) return null;
      const a = left ?? 0;
      const b = right ?? 0;
      if (ast.op === '+') return a + b;
      if (ast.op === '-') return a - b;
      if (ast.op === '*') return a * b;
      if (b === 0) throw new Error('Cannot divide by zero');
      return a / b;
    }
    case 'call':
      return evalCall(ast, engine, row);
    default:
      return null;
  }
}

function evalCall(ast: Extract<Ast, { k: 'call' }>, engine: Engine, row: number): number | null {
  if (ast.name === 'ROUND') {
    const value = ast.args[0]?.k === 'expr' ? evalNumber(ast.args[0].expr, engine, row) : null;
    if (value == null) return null;
    const digits = ast.args[1]?.k === 'expr' ? evalNumber(ast.args[1].expr, engine, row) : 0;
    const places = Math.max(0, Math.min(6, Math.trunc(digits ?? 0)));
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
  }
  const values: Array<number | null> = [];
  for (const arg of ast.args) {
    if (arg.k === 'range') values.push(...rangeValues(engine, arg, row));
    else values.push(evalNumber(arg.expr, engine, row));
  }
  const numbers = present(values);
  if (numbers.length === 0) return null;
  if (ast.name === 'SUM') return numbers.reduce((sum, value) => sum + value, 0);
  if (ast.name === 'AVERAGE') return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  if (ast.name === 'MIN') return Math.min(...numbers);
  if (ast.name === 'MAX') return Math.max(...numbers);
  throw new Error(`Unknown function ${ast.name}`);
}

function collectSameRow(ast: Ast): Ref[] {
  switch (ast.k) {
    case 'cell':
    case 'name':
      return ast.row == null ? [ast] : [];
    case 'neg':
      return collectSameRow(ast.expr);
    case 'bin':
      return [...collectSameRow(ast.left), ...collectSameRow(ast.right)];
    case 'call':
      return ast.args.flatMap((arg) => (arg.k === 'expr' ? collectSameRow(arg.expr) : []));
    default:
      return [];
  }
}

const parsed = new Map<string, Ast | { error: string }>();

function parseFormula(formula: string): Ast {
  const key = formula.trim();
  const cached = parsed.get(key);
  if (cached) {
    if ('error' in cached) throw new Error(cached.error);
    return cached;
  }
  try {
    const ast = new Parser(tokenize(key)).parse();
    parsed.set(key, ast);
    return ast;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid formula';
    parsed.set(key, { error: message });
    throw new Error(message);
  }
}

export function parseSheetNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function evaluateFormula(
  formula: string | undefined,
  columns: FormulaColumn[],
  rows: FormulaRow[],
  rowIndex: number,
  columnId?: string
): FormulaValue {
  const text = formula?.trim() ?? '';
  if (!text) return { kind: 'blank' };
  try {
    const engine: Engine = {
      columns,
      rows,
      memo: new Map(),
      stack: columnId ? [`${columnId}:${rowIndex}`] : [],
    };
    const value = evalAst(parseFormula(text), engine, rowIndex);
    if (value == null || !Number.isFinite(value)) return { kind: 'blank' };
    return { kind: 'number', value: Math.round(value * 100) / 100 };
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : 'Invalid formula' };
  }
}
