/**
 * Genera un resumen del último test run en formato Slack.
 * Uso: node scripts/slack-summary.js
 * El resultado se imprime en consola y se guarda en reports/summary.txt
 */

const fs = require('fs');
const path = require('path');

const reportPath = path.join(__dirname, '..', 'reports', 'results.json');

if (!fs.existsSync(reportPath)) {
  console.error('No se encontró reports/results.json. Corre npm run test:sanity primero.');
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
const { stats } = report;

const passed = [];
const failed = [];

function collectTests(suite, ancestors = []) {
  const title = suite.title ? [...ancestors, suite.title] : ancestors;

  if (suite.specs) {
    for (const spec of suite.specs) {
      const label = [...title, spec.title].join(' › ');
      const test = spec.tests?.[0];
      if (!test) continue;

      const lastResult = test.results?.[test.results.length - 1];
      const duration = ((lastResult?.duration ?? 0) / 1000).toFixed(1) + 's';

      if (spec.ok) {
        passed.push({ label, duration });
      } else {
        const rawError = lastResult?.errors?.[0]?.message ?? lastResult?.error?.message ?? 'Error desconocido';
        const error = rawError.replace(/\x1B\[[0-9;]*m/g, '').split('\n')[0].substring(0, 120);
        failed.push({ label, duration, error });
      }
    }
  }

  for (const sub of suite.suites ?? []) {
    collectTests(sub, title);
  }
}

for (const suite of report.suites ?? []) {
  collectTests(suite);
}

const totalMin = (stats.duration / 1000 / 60).toFixed(1);
const total = (stats.expected ?? 0) + (stats.unexpected ?? 0) + (stats.skipped ?? 0) + (stats.flaky ?? 0);
const env = process.env.TARGET_ENV?.toUpperCase() ?? 'STAGING';

const lines = [];

lines.push(`*Resumen — sanity suite · ${env}*`);
lines.push('');
lines.push(`✅ Pasaron: *${stats.expected ?? 0}*   ❌ Fallaron: *${stats.unexpected ?? 0}*   ⏭️ Saltados: *${stats.skipped ?? 0}*   ⏱️ Duración: *${totalMin} min*`);
lines.push(`Total: ${total} tests`);

if (failed.length > 0) {
  lines.push('');
  lines.push('*❌ Fallaron:*');
  for (const f of failed) {
    lines.push(`• \`${f.label}\``);
    lines.push(`  _${f.error}_`);
  }
}

if (passed.length > 0) {
  lines.push('');
  lines.push('*✅ Pasaron:*');
  for (const p of passed) {
    lines.push(`• ${p.label} (${p.duration})`);
  }
}

const output = lines.join('\n');
const outputFile = path.join(__dirname, '..', 'reports', 'summary.txt');
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, output, 'utf-8');

console.log(output);
console.log(`\n→ Guardado en reports/summary.txt`);
