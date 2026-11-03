import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(__dirname, '../../../supabase/migrations');

/** Body of the newest `CREATE [OR REPLACE] FUNCTION public.<name>` in supabase/migrations. */
export function newestFunction(name: string): { file: string; body: string } {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const header = new RegExp(String.raw`CREATE (OR REPLACE )?FUNCTION public\.${name}\s*\(`);
  for (const file of [...files].reverse()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8').replace(/\r\n/g, '\n');
    const start = sql.search(header);
    if (start === -1) continue;
    const rest = sql.slice(start);
    const end = rest.search(/^\$(function)?\$;/m);
    return { file, body: end === -1 ? rest : rest.slice(0, end) };
  }
  throw new Error(`no definition of ${name}`);
}
