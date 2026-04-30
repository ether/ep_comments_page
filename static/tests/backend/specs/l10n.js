'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');

const pluginRoot = path.resolve(__dirname, '..', '..', '..', '..');
const enPath = path.join(pluginRoot, 'locales', 'en.json');
const commentsTemplatePath = path.join(pluginRoot, 'templates', 'comments.html');

const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

describe(__filename, function () {
  let en;
  let template;

  before(function () {
    en = readJSON(enPath);
    template = fs.readFileSync(commentsTemplatePath, 'utf8');
  });

  it('every data-l10n-id referenced in comments.html exists in en.json', function () {
    const ids = new Set();
    const re = /data-l10n-id="([^"]+)"/g;
    let m;
    while ((m = re.exec(template)) !== null) ids.add(m[1]);
    assert(ids.size > 0, 'expected at least one data-l10n-id in comments.html');
    for (const id of ids) {
      // Some data-l10n-id values are computed via jquery template syntax like
      // `{{if reply}}...{{/if}}`. Enumerate the possible keys in that case.
      if (id.includes('{{if reply}}')) {
        const a = id.replace('{{if reply}}reply{{else}}comment{{/if}}', 'reply');
        const b = id.replace('{{if reply}}reply{{else}}comment{{/if}}', 'comment');
        assert(Object.prototype.hasOwnProperty.call(en, a), `missing ${a}`);
        assert(Object.prototype.hasOwnProperty.call(en, b), `missing ${b}`);
        continue;
      }
      assert(Object.prototype.hasOwnProperty.call(en, id),
          `missing translation for data-l10n-id "${id}"`);
    }
  });

  it('suggestion label does not use a key with unresolved placeholders (regression for #273)',
      function () {
        // The display-suggestion template previously used
        // `suggested_change_from` whose English value contains {{changeFrom}} /
        // {{changeTo}}. No data-l10n-args is provided on the span, so the
        // placeholders were rendered as literal text. The replacement label
        // key must not require any arguments.
        const labelKey = 'ep_comments_page.comments_template.suggested_change_from_label';
        assert(Object.prototype.hasOwnProperty.call(en, labelKey),
            `expected ${labelKey} in en.json`);
        assert(!/\{\{/.test(en[labelKey]),
            `${labelKey} must not contain {{placeholders}}; got: ${en[labelKey]}`);

        // The template references the new label key.
        assert(template.includes(`data-l10n-id="${labelKey}"`),
            `comments.html should reference ${labelKey} for the suggestion display label`);
      });

  it('new-comment form label does not use a key with unresolved placeholders',
      function () {
        // The new-comment template previously used `suggest_change_from`
        // whose English value contains "{{changeFrom}}". The data-l10n-args
        // attribute relied on jquery.tmpl substituting the selected text into
        // valid JSON, which broke whenever the selection contained quotes or
        // backslashes. The replacement label key must not require args.
        const fromLabel = 'ep_comments_page.comments_template.suggest_change_from_label';
        const toLabel = 'ep_comments_page.comments_template.suggest_change_to_label';
        for (const key of [fromLabel, toLabel]) {
          assert(Object.prototype.hasOwnProperty.call(en, key),
              `expected ${key} in en.json`);
          assert(!/\{\{/.test(en[key]),
              `${key} must not contain {{placeholders}}; got: ${en[key]}`);
        }
        assert(template.includes(`data-l10n-id="${fromLabel}"`),
            `comments.html should reference ${fromLabel} for the new-comment label`);
        assert(template.includes(`data-l10n-id="${toLabel}"`),
            `comments.html should reference ${toLabel} for the new-comment label`);

        // The placeholder-laden key must not be referenced from the template.
        const placeholderKey = 'ep_comments_page.comments_template.suggest_change_from';
        assert(!template.includes(`data-l10n-id="${placeholderKey}"`),
            'comments.html must not reference the placeholder-laden suggest_change_from key');
      });
});
