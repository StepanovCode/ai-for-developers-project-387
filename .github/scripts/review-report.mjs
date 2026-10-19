import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function reviewText(output) {
  const messages = new Map();
  const finishes = new Map();
  let lastMessage;
  for (const line of output.split('\n').filter((line) => line.trim())) {
    const event = JSON.parse(line);
    if (event.type === 'error') throw new Error('OpenCode reported an error');
    if (event.type === 'step_finish') finishes.set(event.part?.messageID, event.part?.reason);
    if (event.type !== 'text' || !event.part?.text?.trim()) continue;
    const { messageID, text } = event.part;
    if (!messageID) throw new Error('OpenCode text has no message ID');
    messages.set(messageID, [...(messages.get(messageID) ?? []), text.trim()]);
    lastMessage = messageID;
  }
  const report = messages.get(lastMessage)?.join('\n\n');
  if (!report) throw new Error('OpenCode returned no review text');
  if (finishes.get(lastMessage) !== 'stop') throw new Error('OpenCode review did not complete');
  if (report.length > 50000) throw new Error('OpenCode review is too long');
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , input, output] = process.argv;
  writeFileSync(output, reviewText(readFileSync(input, 'utf8')) + '\n');
}
