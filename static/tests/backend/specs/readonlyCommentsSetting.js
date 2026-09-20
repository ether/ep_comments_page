'use strict';

// #454: `allowReadonlyComments` could not be reached on a stock install.
//   1. The plugin read its settings from the CJS mirror of core's Settings
//      module, which on released Etherpad 3.x cores does not carry the
//      top-level `ep_*` blocks — so every option fell back to its default.
//   2. The add-comment affordance always carried `acl-write`, which core hides
//      on read-only pads (`.readonly .acl-write { display: none }`, added for
//      #204) — so even with the setting forced on, the button stayed
//      `display: none` and the feature was unreachable.
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const common = require('ep_etherpad-lite/tests/backend/common');
const epComments = require('ep_comments_page');
const settings = require('ep_etherpad-lite/node/utils/Settings').default ||
  require('ep_etherpad-lite/node/utils/Settings');

const pluginRoot = path.resolve(__dirname, '..', '..', '..', '..');

const renderEditbarBlock = async () => {
  const args = {content: ''};
  await new Promise((resolve) => {
    epComments.eejsBlock_editbarMenuLeft('eejsBlock_editbarMenuLeft', args, resolve);
  });
  return args.content;
};

const toolbarButtonClass = () => {
  let captured = null;
  const toolbar = {
    button: (opts) => { captured = opts; return opts; },
    registerButton: () => {},
  };
  epComments.padInitToolbar('padInitToolbar', {toolbar}, () => {});
  return captured.class;
};

describe(__filename, function () {
  let savedSetting;

  before(async function () { await common.init(); });
  beforeEach(async function () { savedSetting = settings.ep_comments_page; });
  afterEach(async function () { settings.ep_comments_page = savedSetting; });

  describe('the setting is actually read (#454, problem 1)', function () {
    it('clientVars reports allowReadonlyComments from settings', async function () {
      settings.ep_comments_page = {allowReadonlyComments: true};
      const cv = await epComments.clientVars('clientVars', {});
      assert.equal(cv.allowReadonlyComments, true);

      settings.ep_comments_page = {};
      const off = await epComments.clientVars('clientVars', {});
      assert.equal(off.allowReadonlyComments, false);
    });

    it('server modules read Settings through its ES default export', function () {
      // The CJS mirror of core's Settings module is built before the top-level
      // `ep_*` blocks are merged onto the settings object, so on released cores
      // `require('.../Settings').ep_comments_page` is undefined. Reading the ES
      // default export (the real settings object) is what makes every
      // ep_comments_page option configurable at all.
      for (const file of ['index.js', 'commentManager.js', 'exportHTML.js']) {
        const src = fs.readFileSync(path.join(pluginRoot, file), 'utf8');
        assert.match(src, /require\('ep_etherpad-lite\/node\/utils\/Settings'\)\.default \|\|/,
            `${file} must read Settings via its ES default export`);
      }
    });
  });

  describe('acl-write does not hide the button the setting reveals (#454, problem 2)',
      function () {
        it('the add-comment button keeps acl-write while the setting is off (#204)',
            async function () {
              settings.ep_comments_page = {};
              assert.match(await renderEditbarBlock(), /acl-write/);
              assert.match(toolbarButtonClass(), /(^| )acl-write( |$)/);
            });

        it('the add-comment button drops acl-write when read-only commenting is on',
            async function () {
              settings.ep_comments_page = {allowReadonlyComments: true};
              const content = await renderEditbarBlock();
              assert.match(content, /addComment/,
                  'the editbar block must still render the button');
              assert.doesNotMatch(content, /acl-write/,
                  'core would hide the button on read-only pads while it has acl-write');
              assert.doesNotMatch(toolbarButtonClass(), /acl-write/);
              assert.match(toolbarButtonClass(), /buttonicon-comment-medical/);
            });
      });
});
