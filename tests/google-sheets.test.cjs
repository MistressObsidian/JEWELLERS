const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const receiver = fs.readFileSync(path.join(root, 'integrations/google-sheets/Code.gs'), 'utf8');
const client = fs.readFileSync(path.join(root, 'assets/application.js'), 'utf8');
const fields = {
  submissionId: 'abcdef0123456789abcdef0123456789', name: 'Test Applicant',
  email: 'applicant@example.com', instagram: '@test', snapchat: '', tiktok: '',
  category: 'Jewelry', why: 'I enjoy creating jewelry content.', consent: 'yes', website: ''
};

function googleHarness({ busy = false, saveError = false, rows = [] } = {}) {
  let released = 0;
  let openedId;
  const range = (row, column, height, width) => ({
    setNumberFormat() { return this; },
    setValues(values) {
      if (saveError && row > 1) throw new Error('Google write failed');
      values.forEach((valuesRow, offset) => {
        rows[row - 1 + offset] ||= [];
        valuesRow.forEach((value, index) => {
          // Simulate Sheets' apostrophe escape for literal text.
          rows[row - 1 + offset][column - 1 + index] = typeof value === 'string' && value.startsWith("'") ? value.slice(1) : value;
        });
      });
      return this;
    },
    getValues() {
      return Array.from({ length: height }, (_, index) =>
        Array.from({ length: width }, (_, col) => rows[row - 1 + index]?.[column - 1 + col] ?? ''));
    },
    createTextFinder(value) {
      return {
        matchEntireCell() { return this; }, useRegularExpression() { return this; },
        findNext() {
          const index = rows.findIndex((values, index) => index >= row - 1 && values[column - 1] === value);
          return index < 0 ? null : { getRow: () => index + 1 };
        }
      };
    }
  });
  const sheet = { getLastRow: () => rows.length, getRange: range, setFrozenRows() {} };
  const lock = { waitLock() {}, tryLock: () => !busy, releaseLock: () => { released++; } };
  const context = vm.createContext({
    LockService: { getScriptLock: () => lock },
    SpreadsheetApp: {
      openById(id) { openedId = id; return { getSheetByName: () => sheet, insertSheet: () => sheet }; },
      flush() {}
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) { return { text, setMimeType() { return this; } }; }
    }
  });
  vm.runInContext(receiver, context);
  return {
    rows,
    submit(overrides = {}, eventOverrides = {}) {
      const parameter = { ...fields, ...overrides };
      return JSON.parse(context.doPost({ parameter, postData: { length: 1000 }, ...eventOverrides }).text);
    },
    get released() { return released; },
    get openedId() { return openedId; }
  };
}

test('receiver saves all fields to the supplied spreadsheet and safely stores formula-like text', () => {
  const google = googleHarness();
  const result = google.submit({ name: '=1+1', why: "'literal text" });
  assert.equal(result.ok, true);
  assert.equal(google.openedId, '12LnVhOXM858v6c6jZ6QIgpKYq-PsbfGX62tEuCH_rIg');
  assert.equal(google.rows.length, 2);
  assert.deepEqual(google.rows[1].slice(1), [fields.submissionId, '=1+1', fields.email, '@test', '', '', 'Jewelry', "'literal text", 'Yes']);
  assert.equal(google.released, 1);
});

test('retry after a lost acknowledgment does not append a second application', () => {
  const google = googleHarness();
  assert.equal(google.submit().ok, true);
  assert.equal(google.submit().ok, true);
  assert.equal(google.rows.length, 2);
  assert.equal(google.submit({ name: 'Different applicant' }).code, 'RECEIPT_CONFLICT');
  assert.equal(google.rows.length, 2);
});

test('receiver rejects invalid fields, missing consent, bots, and oversized requests before opening the Sheet', () => {
  for (const overrides of [{ name: ' ' }, { email: 'bad' }, { consent: '' }, { category: 'unknown' },
    { website: 'spam' }, { why: 'x'.repeat(3001) }, { submissionId: 'bad-id' }]) {
    const google = googleHarness();
    assert.equal(google.submit(overrides).ok, false);
    assert.equal(google.openedId, undefined);
  }
  const google = googleHarness();
  assert.equal(google.submit({}, { postData: { length: 60001 } }).ok, false);
  assert.equal(google.submit({}, { parameters: { email: ['one', 'two'] } }).ok, false);
  assert.equal(google.openedId, undefined);
});

test('busy, write failures, and unexpected existing headers never return success or overwrite existing data', () => {
  assert.equal(googleHarness({ busy: true }).submit().code, 'BUSY');
  const failed = googleHarness({ saveError: true });
  assert.equal(failed.submit().code, 'SAVE_FAILED');
  assert.equal(failed.released, 1);
  const rows = [['Existing data', 'Keep this']];
  assert.equal(googleHarness({ rows }).submit().code, 'SAVE_FAILED');
  assert.deepEqual(rows, [['Existing data', 'Keep this']]);
});

function browserHarness(fetch, endpoint = 'https://script.google.com/macros/s/test-deployment/exec') {
  const button = { disabled: true, textContent: 'Submit application' };
  const input = { disabled: false };
  const status = { hidden: true, dataset: {}, textContent: '' };
  const values = { ...fields };
  delete values.submissionId;
  const listeners = {};
  let resetCount = 0;
  const form = {
    elements: [input, button], querySelector: () => button,
    addEventListener: (name, callback) => { listeners[name] = callback; },
    reportValidity: () => true, setAttribute() {}, removeAttribute() {},
    reset() { resetCount++; }
  };
  const context = vm.createContext({
    document: { getElementById: id => id === 'ambassadorApplication' ? form : status },
    window: { ambassadorApplicationConfig: { endpoint } },
    FormData: class { constructor() { return Object.entries(values); } },
    URL, URLSearchParams, Uint8Array, crypto: webcrypto, AbortController,
    setTimeout, clearTimeout, fetch
  });
  vm.runInContext(client, context);
  return { button, input, status, values, submit: () => listeners.submit({ preventDefault() {} }), get resetCount() { return resetCount; } };
}

test('unconfigured form cannot send and explains temporary unavailability', async () => {
  for (const endpoint of ['', 'https://docs.google.com/spreadsheets/d/test/edit', 'https://script.google.com/macros/s/test/dev']) {
    let called = false;
    const browser = browserHarness(() => { called = true; }, endpoint);
    await browser.submit();
    assert.equal(called, false);
    assert.equal(browser.button.disabled, true);
    assert.equal(browser.status.dataset.state, 'unavailable');
  }
});

test('form only resets after a matching acknowledgment and blocks concurrent submissions', async () => {
  let resolve;
  let count = 0;
  let body;
  const browser = browserHarness((url, request) => {
    count++;
    body = request.body;
    assert.equal(request.method, 'POST');
    assert.equal(request.mode, 'cors');
    assert.equal(request.credentials, 'omit');
    return new Promise(done => { resolve = done; });
  });
  const pending = browser.submit();
  assert.equal(browser.resetCount, 0);
  assert.equal(browser.button.disabled, true);
  assert.equal(browser.input.disabled, true);
  await browser.submit();
  assert.equal(count, 1);
  resolve({ ok: true, json: async () => ({ ok: true, submissionId: body.get('submissionId') }) });
  await pending;
  assert.equal(browser.resetCount, 1);
  assert.equal(browser.status.dataset.state, 'success');
  assert.equal(browser.button.disabled, false);
  assert.equal(browser.input.disabled, false);
});

test('network, HTTP, JSON, server, and mismatched receipt errors preserve fields', async () => {
  const failures = [
    async () => { throw new TypeError('Network failed'); },
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => { throw new Error('HTML login page'); } }),
    async () => ({ ok: true, json: async () => ({ ok: false }) }),
    async () => ({ ok: true, json: async () => ({ ok: true, submissionId: 'wrong' }) })
  ];
  for (const fetch of failures) {
    const browser = browserHarness(fetch);
    await browser.submit();
    assert.equal(browser.resetCount, 0);
    assert.equal(browser.status.dataset.state, 'error');
    assert.equal(browser.button.disabled, false);
    assert.equal(browser.values.name, fields.name);
  }
});

test('unchanged retries reuse receipt; editing the application generates a new one', async () => {
  const receipts = [];
  const browser = browserHarness(async (url, request) => {
    receipts.push(request.body.get('submissionId'));
    throw new Error('Response lost');
  });
  await browser.submit();
  await browser.submit();
  browser.values.name = 'Updated name';
  await browser.submit();
  assert.equal(receipts[0], receipts[1]);
  assert.notEqual(receipts[1], receipts[2]);
});

test('actual page loads config before client and includes the named acknowledgment', () => {
  const html = fs.readFileSync(path.join(root, 'thompsons-jewellers-ambassador.html'), 'utf8');
  assert.ok(html.indexOf('assets/application-config.js') < html.indexOf('assets/application.js'));
  assert.match(html, /id="ambassadorApplication"/);
  assert.match(html, /name="consent" value="yes"/);
  assert.match(html, /id="applicationStatus"[^>]+role="status"/);
  assert.doesNotMatch(html, /onsubmit=/);
});
