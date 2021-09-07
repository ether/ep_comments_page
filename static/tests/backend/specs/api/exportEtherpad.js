'use strict';

/*
 * Import and Export tests for comments in .etherpad format
 */

const assert = require('assert').strict;
const common = require('ep_etherpad-lite/tests/backend/common');
const superagent = require('superagent');
const fs = require('fs');

// test doc
const etherpadDoc = fs.readFileSync(`${__dirname}/test.etherpad`);
const apiVersion = 1;
const apiKey = common.apiKey;
const testPadId = makeid();
let api;

describe(__filename, function () {
  before(async function () { api = await common.init(); });

  describe('Imports and Exports', function () {
    it('creates a new Pad, imports content to it, checks that content', async function () {
      await api.get(`${endPoint('createPad')}&padID=${testPadId}`)
          .expect(200)
          .expect('Content-Type', /json/);
    });

    it('imports .etherpad incuding a comment', async function () {
      await api.post(`/p/${testPadId}/import`)
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
          .buffer(true).parse(superagent.parse.text)
          .expect(200)
          .expect(/comments:/);
    });
  });
}); // End of tests.


const endPoint = function (point, version) {
  version = version || apiVersion;
  return `/api/${version}/${point}?apikey=${apiKey}`;
};

function makeid() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < 5; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
