// prisma-helper MCP 의 순수 로직(DB·전송 비의존). 단위 테스트 대상.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type IndexKind =
  | 'primary'
  | 'unique'
  | 'composite'
  | 'simple'
  | 'none';

export interface IndexResult {
  hasIndex: boolean;
  kind: IndexKind;
  detail: string;
}

// schema.prisma 에서 model 의 컬럼이 인덱싱(@id/@unique/@@unique/@@index)되어 있는지 점검.
export function checkIndex(
  schema: string,
  model: string,
  column: string,
): IndexResult {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = new RegExp(`model\\s+${esc(model)}\\s*\\{([^}]*)\\}`, 'm').exec(
    schema,
  );
  if (!block) {
    return {
      hasIndex: false,
      kind: 'none',
      detail: `모델 ${model} 을 schema.prisma 에서 찾을 수 없음`,
    };
  }
  const body = block[1];

  if (new RegExp(`^\\s*${esc(column)}\\s+\\S+.*@id`, 'm').test(body)) {
    return { hasIndex: true, kind: 'primary', detail: `${column} 은 primary key` };
  }
  if (new RegExp(`^\\s*${esc(column)}\\s+\\S+.*@unique`, 'm').test(body)) {
    return { hasIndex: true, kind: 'unique', detail: `${column} 에 @unique` };
  }

  const lists = (re: RegExp): string[][] => {
    const out: string[][] = [];
    let m: RegExpExecArray | null;
    const g = new RegExp(re.source, 'g');
    while ((m = g.exec(body))) {
      out.push(m[1].split(',').map((c) => c.trim()));
    }
    return out;
  };

  for (const cols of lists(/@@unique\(\[([^\]]+)\]\)/)) {
    if (cols.includes(column)) {
      return {
        hasIndex: true,
        kind: cols.length > 1 ? 'composite' : 'unique',
        detail: `@@unique([${cols.join(', ')}])`,
      };
    }
  }
  for (const cols of lists(/@@index\(\[([^\]]+)\]\)/)) {
    if (cols.includes(column)) {
      return {
        hasIndex: true,
        kind: cols.length > 1 ? 'composite' : 'simple',
        detail: `@@index([${cols.join(', ')}])`,
      };
    }
  }

  return {
    hasIndex: false,
    kind: 'none',
    detail: `${model}.${column} 에 인덱스 없음. 조회에 쓰이면 @index 검토`,
  };
}

export interface DestructiveResult {
  destructive: boolean;
  warnings: string[];
}

// 마이그레이션 SQL 미리보기에서 파괴적(DROP/타입변경/NOT NULL 추가) 패턴을 탐지.
export function detectDestructive(sql: string): DestructiveResult {
  const rules: [RegExp, string][] = [
    [/DROP\s+TABLE/i, '테이블 삭제'],
    [/DROP\s+COLUMN/i, '컬럼 삭제 (데이터 손실)'],
    [/ALTER\s+COLUMN[^;]*\bTYPE\b/i, '컬럼 타입 변경 (캐스팅 실패 위험)'],
    [/DROP\s+CONSTRAINT/i, '제약 삭제'],
    [/ADD\s+COLUMN[^;]*NOT\s+NULL(?![^;]*DEFAULT)/i, 'NOT NULL 컬럼 추가 (기존 행 위반)'],
  ];
  const warnings = rules.filter(([re]) => re.test(sql)).map(([, msg]) => msg);
  return { destructive: warnings.length > 0, warnings };
}

export interface PiiViolation {
  file: string;
  line: number;
  pattern: string;
}
export interface PiiResult {
  violations: PiiViolation[];
  total: number;
}

const PII_FIELDS = [
  'email',
  'phone',
  'ssn',
  'password',
  'token',
  'accessToken',
  'refreshToken',
];
const LOG_RE = [/console\.\w+/, /\w*[Ll]ogger\.\w+/];

// srcDir 하위 *.ts(테스트 제외)에서 로깅 호출에 PII 필드가 섞였는지 스캔.
export function scanPiiLogging(srcDir: string): PiiResult {
  const violations: PiiViolation[] = [];
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (name === 'node_modules' || name === 'dist') continue;
        walk(full);
        continue;
      }
      if (!name.endsWith('.ts')) continue;
      if (name.endsWith('.spec.ts') || name.endsWith('.test.ts')) continue;

      const content = readFileSync(full, 'utf8');
      content.split('\n').forEach((line, i) => {
        if (!LOG_RE.some((re) => re.test(line))) return;
        for (const pii of PII_FIELDS) {
          if (new RegExp(`\\.${pii}\\b`).test(line)) {
            violations.push({
              file: full,
              line: i + 1,
              pattern: line.trim().slice(0, 120),
            });
            break;
          }
        }
      });
    }
  };
  walk(srcDir);
  return { violations, total: violations.length };
}
