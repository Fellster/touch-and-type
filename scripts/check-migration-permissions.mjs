import { readdirSync, readFileSync } from 'node:fs';
const directory = new URL('../supabase/migrations/', import.meta.url);
const errors = [];
let count = 0;
for (const file of readdirSync(directory).filter((name) => name.endsWith('.sql'))) {
  const sql = readFileSync(new URL(file, directory), 'utf8').replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const statements = sql.toLowerCase().split(';').map((statement) => statement.replace(/\s+/g, ' ').trim());
  for (const match of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/gi)) {
    const table = match[1].toLowerCase(); count++;
    const includesTable = (statement) => new RegExp(`\\bpublic\\.${table}\\b`).test(statement);
    const grants = statements.filter((statement) => statement.startsWith('grant ') && includesTable(statement));
    const granted = (role) => {
      const privileges = new Set();
      for (const statement of grants) {
        const grant = statement.match(/^grant (.+?) on (?:table )?.+? to (.+)$/);
        if (!grant || !grant[2].split(',').map((item) => item.trim()).includes(role)) continue;
        for (const privilege of grant[1].split(',').map((item) => item.trim())) privileges.add(privilege);
      }
      return privileges.has('all') || privileges.has('all privileges') || ['select','insert','update','delete'].every((privilege) => privileges.has(privilege));
    };
    const enabled = statements.some((statement) => includesTable(statement) && statement.startsWith('alter table ') && statement.endsWith(' enable row level security'));
    const privateByDefault = statements.some((statement) => includesTable(statement) && /^revoke all(?: privileges)? on /.test(statement) && /from .*\banon\b/.test(statement));
    if (!enabled || !privateByDefault || !granted('authenticated') || !granted('service_role')) errors.push(`${file}: public.${table} needs same-file RLS, anon revocation, and explicit CRUD grants for authenticated/service_role`);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`PASS: ${count} public tables have explicit private-by-default migration permissions.`);
