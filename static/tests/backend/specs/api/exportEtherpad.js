'use strict';

/*
 * Import and Export tests for comments in .etherpad format
 */

const assert = require('assert').strict;
const common = require('ep_etherpad-lite/tests/backend/common');
const generateJWTToken = common.generateJWTToken;
const padutils = require('ep_etherpad-lite/static/js/pad_utils').default ||
    require('ep_etherpad-lite/static/js/pad_utils');
const superagent = require('superagent');
const fs = require('fs');
const path = require('path');

// test doc — kept under ../../fixtures/ rather than alongside this spec
// because etherpad-lite's mocha glob is `static/tests/backend/specs/**` (no
// extension filter), so any non-JS file inside specs/ trips the ESM loader
// with `ERR_UNKNOWN_FILE_EXTENSION`. Fixtures must live OUTSIDE specs/.
const etherpadDoc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'fixtures', 'test.etherpad'));
const testPadId = makeid();
const authorToken = padutils.generateAuthorToken();
let api;

describe(__filename, function () {
  before(async function () { api = await common.init(); });

  describe('Imports and Exports', function () {
    // Since etherpad 3.3.13 only the pad's creator may import a .etherpad file whose rev-0
    // author differs from the target pad's. Import into a pad that doesn't exist yet, with an
    // author token, so the importer creates the pad and is its creator. Pre-creating the pad
    // through the HTTP API would make the system author the creator and the import a 400.
    it('imports .etherpad incuding a comment', async function () {
      await api.post(`/p/${testPadId}/import`)
          .set('Authorization', await generateJWTToken())
          .set('Cookie', `token=${authorToken}`)
          .attach('file', etherpadDoc, {
            filename: '/test.etherpad',
            contentType: 'application/etherpad',
          })
          .expect(200)
          .expect('Content-Type', /json/)
          .expect((res) => assert.equal(res.body.code, 0));
    });

    it('exports .etherpad and checks it includes comments', async function () {
      await api.get(`/p/${testPadId}/export/etherpad`)
          .set('Authorization', await generateJWTToken())
          .buffer(true).parse(superagent.parse.text)
          .expect(200)
          .expect(/comments:/);
    });
  });
}); // End of tests.


function makeid() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < 5; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
