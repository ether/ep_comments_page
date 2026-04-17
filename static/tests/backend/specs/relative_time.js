'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');

const pluginRoot = path.resolve(__dirname, '..', '..', '..', '..');
const indexPath = path.join(pluginRoot, 'static', 'js', 'index.js');

describe(__filename, function () {
  let src;
  before(function () {
    src = fs.readFileSync(indexPath, 'utf8');
  });

  it('registers a setInterval that calls refreshRelativeDates (#154)', function () {
    // Any cadence works, but the interval must actually be scheduled so the
    // relative-time strings update without a page reload.
    assert(/setInterval\([^)]*refreshRelativeDates[^)]*\)/.test(src),
        'init should call setInterval(() => this.refreshRelativeDates(), ...)');
  });

  it('refreshRelativeDates recomputes text from the datetime attribute (#154)',
      function () {
        const match = src.match(
            /EpComments\.prototype\.refreshRelativeDates\s*=\s*function[\s\S]*?\n\};/);
        assert(match, 'refreshRelativeDates should be defined on EpComments.prototype');
        const body = match[0];
        assert(/comment-created-at\[datetime\]/.test(body),
            'refreshRelativeDates must target elements with a datetime attribute so the ISO ' +
            'timestamp can be used as the source of truth');
        assert(/moment\([^)]+\)\.fromNow\(\)/.test(body),
            'refreshRelativeDates should recompute the relative time via moment(iso).fromNow()');
      });
});
