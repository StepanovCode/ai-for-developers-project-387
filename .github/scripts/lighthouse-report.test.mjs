import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { lighthouseContext, waitForPage } from './lighthouse-report.mjs';

function report() {
  return {
    lighthouseVersion: '13.5.0',
    requestedUrl: 'https://meetly.example/',
    finalDisplayedUrl: 'https://meetly.example/',
    fetchTime: '2026-10-19T03:17:00.000Z',
    categories: {
      performance: { title: 'Performance', score: 0.68 },
      accessibility: { title: 'Accessibility', score: 1 },
      'best-practices': { title: 'Best Practices', score: 0.96 },
      seo: { title: 'SEO', score: 1 },
    },
    audits: {
      'largest-contentful-paint': {
        id: 'largest-contentful-paint', title: 'Largest Contentful Paint',
        description: 'Time to render the largest visible content element.',
        score: 0.42, numericValue: 4800, numericUnit: 'millisecond', displayValue: '4.8 s',
      },
      'document-title': { id: 'document-title', title: 'Document has a title', score: 1 },
      'manual-check': { id: 'manual-check', title: 'Manual check', score: null },
    },
  };
}

test('preserves measured scores, metrics and failed audits for the agent', () => {
  const context = lighthouseContext(report());
  assert.equal(context.requestedUrl, 'https://meetly.example/');
  assert.equal(context.fetchTime, '2026-10-19T03:17:00.000Z');
  assert.equal(context.categories.performance.score, 0.68);
  assert.deepEqual(context.metrics['largest-contentful-paint'], {
    numericValue: 4800, numericUnit: 'millisecond', displayValue: '4.8 s',
  });
  assert.deepEqual(context.failedAudits, [{
    id: 'largest-contentful-paint', title: 'Largest Contentful Paint',
    description: 'Time to render the largest visible content element.',
    score: 0.42, numericValue: 4800, numericUnit: 'millisecond', displayValue: '4.8 s',
  }]);
});

test('rejects runtime failures even if Lighthouse produced a JSON report', () => {
  assert.throws(() => lighthouseContext({ ...report(), runtimeError: { code: 'NO_FCP' } }), /NO_FCP/);
});

test('rejects missing or invalid category scores instead of reporting success', () => {
  for (const score of [null, undefined, -1, 2, '0.8']) {
    const input = report();
    input.categories.performance.score = score;
    assert.throws(() => lighthouseContext(input), /performance/);
  }
  assert.throws(() => lighthouseContext({ ...report(), categories: {} }), /performance/);
  assert.throws(() => lighthouseContext({}), /report/i);
});

test('an audit without failed automated checks does not invent findings', () => {
  const input = report();
  input.audits['largest-contentful-paint'].score = 1;
  assert.deepEqual(lighthouseContext(input).failedAudits, []);
});

test('missing or credential-bearing URL is rejected before starting Lighthouse', () => {
  for (const url of ['', 'file:///etc/passwd', 'https://user:password@meetly.example/']) {
    const result = spawnSync(process.execPath, ['.github/scripts/lighthouse-report.mjs'], {
      env: { ...process.env, LIGHTHOUSE_URL: url }, encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /LIGHTHOUSE_URL/);
    assert.doesNotMatch(result.stderr, /spawnSync lighthouse/);
  }
});

test('a cold deployment can become ready before measurement, preserving the initial 503', async () => {
  const responses = [new Response('', { status: 503 }), new Response('', { status: 200 })];
  assert.deepEqual(await waitForPage('https://meetly.example/', {
    request: async () => responses.shift(), pause: async () => {},
  }), { statuses: [503, 200] });
});

test('persistent deployment failure is bounded and cannot become a successful audit', async () => {
  await assert.rejects(waitForPage('https://meetly.example/', {
    request: async () => new Response('', { status: 503 }), pause: async () => {},
  }), /not ready after 4 attempts.*503/);
});
