#!/usr/bin/env node
/**
 * Umbral mínimo de cobertura de líneas (§3.6 plan): subir MIN_LINE_PCT por fases (§1.1).
 * Lee coverage/coverage-summary.json generado por Jest con json-summary.
 */
const fs = require('fs');
const path = require('path');

const MIN_LINE_PCT = Number(process.env.MIN_LINE_COVERAGE_PCT ?? '5');
const summaryPath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');

if (!fs.existsSync(summaryPath)) {
  console.error('check-coverage-min: falta coverage/coverage-summary.json (ejecute jest con --coverage y json-summary).');
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const total = summary.total;
if (!total || total.lines == null) {
  console.error('check-coverage-min: formato inesperado en coverage-summary.json');
  process.exit(1);
}

const pct = total.lines.pct;
if (pct < MIN_LINE_PCT) {
  console.error(
    `check-coverage-min: cobertura de líneas ${pct.toFixed(2)}% < mínimo ${MIN_LINE_PCT}% (ajuste tests o MIN_LINE_COVERAGE_PCT).`,
  );
  process.exit(1);
}

console.log(`check-coverage-min: líneas ${pct.toFixed(2)}% >= ${MIN_LINE_PCT}% (OK).`);
