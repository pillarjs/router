'use strict'

const neostandard = require('neostandard')

module.exports = neostandard({
  ts: true,
  filesTs: ['**/*.cts', '**/*.mts'],
  ignores: neostandard.resolveIgnoresFromGitignore()
})
