'use strict'

const neostandard = require('neostandard')

module.exports = [
  ...neostandard({
    ts: true,
    filesTs: ['**/*.cts', '**/*.mts'],
    ignores: neostandard.resolveIgnoresFromGitignore()
  }),
  {
    // Preserve existing eslint-disable comments during the migration.
    linterOptions: { reportUnusedDisableDirectives: false }
  },
  {
    files: ['test/types.ts'],
    rules: {
      '@stylistic/quotes': ['error', 'double'],
      '@stylistic/semi': ['error', 'always']
    }
  }
]
