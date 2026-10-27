/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS bootstrap installs TypeScript hooks before loading the entrypoint. */
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
process.env.NODE_ENV = 'test'

// Type-checking is separate. This runner loads source TS using the installed compiler.
const resolve = Module._resolveFilename
Module._resolveFilename = function (request, parent, ...args) {
  const mapped = request.startsWith('@/') ? path.join(process.cwd(), 'src', request.slice(2)) : request
  return resolve.call(this, mapped, parent, ...args)
}
require.extensions['.ts'] = (module, filename) => {
  const {outputText} = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true},
    fileName: filename,
  })
  module._compile(outputText, filename)
}
const suites = process.argv.slice(2)
if (suites.length) suites.forEach((suite) => require(path.resolve(suite)))
else {
  require('../tests/adaptive-planner.test.ts')
  require('../tests/speech-timing.test.ts')
  require('../tests/content-improvements.test.ts')
  require('../tests/message-planning.test.ts')
  require('../tests/product-facts.test.ts')
  require('../tests/ai-main-flow.test.ts')
  require('../tests/visual-evidence.test.ts')
  require('../tests/product-video-analysis.test.ts')
  require('../tests/context-cache.test.ts')
  require('../tests/sales-writing.test.ts')
  require('../tests/automatic-duration.test.ts')
}
