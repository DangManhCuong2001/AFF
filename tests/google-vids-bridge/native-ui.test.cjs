const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve('tools/google-vids-bridge/extension/native-ui.js'), 'utf8');
function setup(labels, pathname = '/videos/d/fixture/edit') {
  let clicks = 0;
  const controls = labels.map(text => ({textContent: text, getClientRects: () => [1], getAttribute: name => name === 'role' ? 'tab' : null, click: () => {clicks++;}}));
  const context = vm.createContext({location: {origin: 'https://docs.google.com', pathname}, document: {querySelectorAll: selector => selector.startsWith('textarea') ? [] : controls}, getComputedStyle: () => ({visibility: 'visible'})});
  context.window = context;
  vm.runInContext(source, context);
  return {run: action => context.__affVidsNativeUIV1.run(action), clicks: () => clicks};
}
test('UI inspection never clicks Generate; Animate selection must be exact and unique', () => {
  const ui = setup(['Generate', 'Animate', 'Ingredients', 'private@example.com']);
  assert.equal(ui.run('inspect').ok, true);
  assert.equal(ui.clicks(), 0);
  assert.equal(ui.run('inspect').controls[3].label, '[omitted]');
  assert.equal(ui.run('generate').code, 'UI_ACTION_UNSUPPORTED');
  assert.equal(ui.clicks(), 0);
  assert.equal(ui.run('select-animate').ok, true);
  assert.equal(ui.clicks(), 1);
  const absent = setup(['Animate something else', 'Generate']);
  assert.equal(absent.run('select-animate').code, 'ANIMATE_CONTROL_NOT_FOUND');
  assert.equal(absent.clicks(), 0);
  const ambiguous = setup(['Animate', 'Animate']);
  assert.equal(ambiguous.run('select-animate').code, 'ANIMATE_CONTROL_AMBIGUOUS');
  assert.equal(ambiguous.clicks(), 0);
  assert.equal(setup(['Animate'], '/document/d/fixture/edit').run('inspect').code, 'VIDS_PAGE_REQUIRED');
});
