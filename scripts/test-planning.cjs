/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS bootstrap installs TypeScript hooks before loading the entrypoint. */
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

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
require('../tests/adaptive-planner.test.ts')
require('../tests/speech-timing.test.ts')
