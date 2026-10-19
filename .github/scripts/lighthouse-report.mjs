import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export async function waitForPage(url, { request = fetch, pause = setTimeout } = {}) {
  const statuses = [];
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await request(url, { signal: AbortSignal.timeout(15000) });
      statuses.push(response.status);
      await response.body?.cancel();
      if (response.ok) return { statuses };
    } catch {
      statuses.push('network error');
    }
    if (attempt < 4) await pause(10000);
  }
  throw new Error(`Public page not ready after 4 attempts: ${statuses.join(', ')}`);
}

export function lighthouseContext(report) {
  if (!report?.requestedUrl || !report.fetchTime || !report.audits) {
    throw new Error('Incomplete Lighthouse report');
  }
  if (report.runtimeError) throw new Error(`Lighthouse failed: ${report.runtimeError.code}`);
  for (const name of ['performance', 'accessibility', 'best-practices', 'seo']) {
    const score = report.categories?.[name]?.score;
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1) {
      throw new Error(`Lighthouse has no valid ${name} score`);
    }
  }
  const metrics = {};
  for (const id of ['first-contentful-paint', 'largest-contentful-paint', 'speed-index',
    'total-blocking-time', 'cumulative-layout-shift']) {
    const audit = report.audits[id];
    if (audit) metrics[id] = { numericValue: audit.numericValue, numericUnit: audit.numericUnit,
      displayValue: audit.displayValue };
  }
  return {
    lighthouseVersion: report.lighthouseVersion,
    requestedUrl: report.requestedUrl,
    finalDisplayedUrl: report.finalDisplayedUrl,
    fetchTime: report.fetchTime,
    categories: Object.fromEntries(Object.entries(report.categories)
      .map(([id, { title, score }]) => [id, { title, score }])),
    metrics,
    runWarnings: report.runWarnings ?? [],
    failedAudits: Object.values(report.audits)
      .filter((audit) => typeof audit.score === 'number' && audit.score < 1)
      .map(({ id, title, description, score, displayValue, numericValue, numericUnit }) =>
        ({ id, title, description, score, displayValue, numericValue, numericUnit })),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.LIGHTHOUSE_URL) throw new Error('Set LIGHTHOUSE_URL before running the audit');
  const url = new URL(process.env.LIGHTHOUSE_URL);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('LIGHTHOUSE_URL must be an HTTP(S) URL without credentials');
  }
  mkdirSync('/reports', { recursive: true });
  for (const file of ['lighthouse.report.json', 'lighthouse.report.html', 'context.json', 'preflight.json']) {
    rmSync(`/reports/${file}`, { force: true });
  }
  const preflight = await waitForPage(url.href);
  writeFileSync('/reports/preflight.json', JSON.stringify(preflight, null, 2) + '\n');
  const result = spawnSync('lighthouse', [url.href, '--quiet',
    '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
    '--only-categories=performance,accessibility,best-practices,seo',
    '--output=json', '--output=html', '--output-path=/reports/lighthouse',
    '--max-wait-for-load=60000'], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Lighthouse process failed (${result.status ?? result.signal})`);
  const report = JSON.parse(readFileSync('/reports/lighthouse.report.json', 'utf8'));
  writeFileSync('/reports/context.json', JSON.stringify(lighthouseContext(report), null, 2) + '\n');
}
