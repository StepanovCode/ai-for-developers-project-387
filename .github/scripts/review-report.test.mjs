import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewText } from './review-report.mjs';

function events(...items) {
  return items.map((item) => JSON.stringify(item)).join('\n');
}

test('publishes only the final assistant message, without tool output or reasoning', () => {
  const report = reviewText(events(
    { type: 'text', part: { messageID: 'earlier', text: 'Сначала проверю diff' } },
    { type: 'tool_use', part: { output: 'internal tool output' } },
    { type: 'reasoning', part: { text: 'private reasoning' } },
    { type: 'text', part: { messageID: 'final', text: 'Проблем не найдено.' } },
    { type: 'text', part: { messageID: 'final', text: 'Проверки не запускались.' } },
    { type: 'step_finish', part: { reason: 'stop' } },
  ));
  assert.equal(report, 'Проблем не найдено.\n\nПроверки не запускались.');
});

test('provider error rejects a partial report', () => {
  assert.throws(() => reviewText(events(
    { type: 'text', part: { messageID: 'partial', text: 'Начало отчёта' } },
    { type: 'error', error: { name: 'APIError', data: { message: 'provider failed' } } },
  )), /OpenCode reported an error/);
});

test('interrupted or token-limited responses cannot be published as complete reviews', () => {
  const text = { type: 'text', part: { messageID: 'partial', text: 'Незавершённый отчёт' } };
  assert.throws(() => reviewText(events(text)), /did not complete/);
  assert.throws(() => reviewText(events(text, { type: 'step_finish', part: { reason: 'length' } })), /did not complete/);
});

test('empty or malformed output cannot be published as a successful review', () => {
  for (const output of ['', '\n', events({ type: 'step_finish' }), 'not json']) {
    assert.throws(() => reviewText(output));
  }
});

test('oversized reports fail before the GitHub comment limit', () => {
  assert.throws(() => reviewText(events(
    { type: 'text', part: { messageID: 'final', text: 'x'.repeat(50001) } },
    { type: 'step_finish', part: { reason: 'stop' } },
  )), /too long/);
});
