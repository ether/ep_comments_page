'use strict';

// This is a workaround for https://github.com/eslint/eslint/issues/3458
require('eslint-config-etherpad/patch/modern-module-resolution');

module.exports = {
  root: true,
  extends: 'etherpad/plugin',
  ignorePatterns: [
    '/static/js/jquery.tmpl.min.js',
    '/static/js/moment-with-locales.min.js',
  ],
  overrides: [
    {
      // `jose` and `jwt-decode` are Etherpad core's own dependencies and are
      // resolved at runtime from the core install this plugin is loaded into,
      // exactly like `ep_etherpad-lite` itself -- which the shared config
      // already exempts for the same reason.
      files: ['apiUtils.js'],
      rules: {
        'n/no-missing-require': ['error', {
          allowModules: ['ep_etherpad-lite', 'jose', 'jwt-decode'],
        }],
      },
    },
    {
      // The backend specs deliberately load the plugin by package name, the
      // way Etherpad loads it, so that they exercise the published entry
      // points. The package is not installed into its own `node_modules`, so
      // the resolver cannot see it from here.
      files: ['static/tests/backend/**/*'],
      rules: {
        'n/no-missing-require': ['error', {
          allowModules: ['ep_etherpad-lite', 'ep_comments_page'],
        }],
      },
    },
    {
      // The shared browser profile parses at ES2017. The client code uses
      // numeric separators (ES2021), which every browser Etherpad supports
      // has had for years.
      files: ['static/js/**/*'],
      parserOptions: {ecmaVersion: 2021},
    },
  ],
};
