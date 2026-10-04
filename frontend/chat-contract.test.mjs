import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openChatAction } from './src/utils/chatActions.js';

test('official handoffs use a separate safe window; local actions use routing', () => {
  const calls = [];
  const prior = globalThis.window;
  globalThis.window = { open: (...args) => calls.push(args) };
  try {
    openChatAction('https://www.canada.ca/en/immigration-refugees-citizenship.html', () => assert.fail('external route'));
    assert.deepEqual(calls[0], ['https://www.canada.ca/en/immigration-refugees-citizenship.html', '_blank', 'noopener,noreferrer']);
    openChatAction('/household', route => assert.equal(route, '/household'));
    for (const route of ['javascript:alert(1)', '//evil.example', 'https://www.canada.ca.evil.example', 'https://user@www.canada.ca', '/\\evil.example', 'https://evil.example']) {
      openChatAction(route, () => assert.fail('unsafe route'));
    }
    assert.equal(calls.length, 1);
  } finally { globalThis.window = prior; }
});
