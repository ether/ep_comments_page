'use strict';

const utils = require('../../../utils');
const codeToBe0 = utils.codeToBe0;
const apiVersion = utils.apiVersion;
const randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;
const settings = require('ep_etherpad-lite/node/utils/Settings');
const common = require('ep_etherpad-lite/tests/backend/common');
const db = require('ep_etherpad-lite/node/db/DB');

let agent;
const apiKey = common.apiKey;

describe(__filename, function () {
  let padID;
  let html;

  before(async function () { agent = await common.init(); });

  beforeEach(async function () {
    padID = randomString(5);
    await agent.get(`/api/${apiVersion}/createPad?apikey=${apiKey}&padID=${padID}`)
        .expect(200)
        .expect('Content-Type', /json/)
        .expect(codeToBe0);
    await agent.get(`/api/${apiVersion}/setHTML?apikey=${apiKey}&padID=${padID}&html=${html()}`)
        .expect(200)
        .expect('Content-Type', /json/)
        .expect(codeToBe0);
  });

  context('when pad text has one comment', function () {
    before(async function () {
      html = () => buildHTML(textWithComment('c-1234'));
    });

    it('returns ok', async function () {
      agent.get(getHTMLEndPointFor(padID))
          .expect(codeToBe0)
          .expect('Content-Type', /json/)
          .expect(200);
    });

    it('returns HTML with comment class', async function () {
      await insertCommentToDB(padID, 'c-1234');
      agent.get(getHTMLEndPointFor(padID))
          .expect((res) => {
            const expectedRegex = regexWithComment('c-1234');
            const expectedComments = new RegExp(expectedRegex);
            const html = res.body.data.html;
            const foundComment = html.match(expectedComments);
            if (!foundComment) {
              throw new Error(`Comment not exported. Regex used: ${expectedRegex}, ` +
                              `html exported: ${html}`);
            }
          });
    });
  });
  context('when pad text has two comments in a single line', function () {
    before(async function () {
      html = () => buildHTML(textWithComment('c-1234') + textWithComment('c-82a3'));
    });

    it('returns HTML with two comments spans', async function () {
      await insertCommentToDB(padID, 'c-1234');
      await insertCommentToDB(padID, 'c-82a3');
      agent.get(getHTMLEndPointFor(padID))
          .expect((res) => {
            const firstComment = regexWithComment('c-1234');
            const secondComment = regexWithComment('c-82a3');
            const expectedRegex = `${firstComment}.*${secondComment}`;
            const expectedComments = new RegExp(expectedRegex);

            const html = res.body.data.html;
            const foundComment = html.match(expectedComments);
            if (!foundComment) {
              throw new Error(`Comment not exported. Regex used: ${expectedRegex}, ` +
                              `html exported: ${html}`);
            }
          });
    });
  });

  context('when pad text has no comments', function () {
    before(async function () {
      html = () => buildHTML('empty pad');
    });

    it('returns HTML with no comment', function (done) {
      agent.get(getHTMLEndPointFor(padID))
          .expect((res) => {
            const expectedRegex = '.*empty pad.*';
            const noComment = new RegExp(expectedRegex);

            const html = res.body.data.html;
            const foundComment = html.match(noComment);
            if (!foundComment) {
              throw new Error('Comment exported, should not have any. ' +
                              `Regex used: ${expectedRegex}, html exported: ${html}`);
            }
          })
          .end(done);
    });
  });

  context('when pad text has comment inside strong', function () {
    before(async function () {
      html = () => buildHTML(
          `<strong>${textWithComment('c-2342', 'this is a comment and bold')}</strong>`);
    });

    // Etherpad exports tags using the order they are defined on the array (bold is always inside
    // comment)
    xit('returns HTML with strong and comment, in any order', function (done) {
      agent.get(getHTMLEndPointFor(padID))
          .expect(200)
          .expect('Content-Type', /json/)
          .expect(codeToBe0)
          .expect((res) => {
            const strongInsideCommentRegex =
                regexWithComment('c-2342', '<strong>this is a comment and bold</strong>');
            const commentInsideStrongRegex =
                `<strong>${regexWithComment('c-2342', 'this is a comment and bold')}</strong>`;
            const expectedStrongInsideComment = new RegExp(strongInsideCommentRegex);
            const expectedCommentInsideStrong = new RegExp(commentInsideStrongRegex);

            const html = res.body.data.html;
            const foundComment =
                html.match(expectedStrongInsideComment) || html.match(expectedCommentInsideStrong);
            if (!foundComment) {
              throw new Error('Comment not exported. Regex used: ' +
                              `[${strongInsideCommentRegex} || ${commentInsideStrongRegex}], ` +
                              `html exported: ${html}`);
            }
          })
          .end(done);
    });
  });

  context('when pad text has comment in strong', function () {
    before(async function () {
      html = () => buildHTML(
          textWithComment('c-2342', '<strong>this is a comment and bold</strong>'),
      );
    });

    // Etherpad exports tags using the order they are defined on the array (bold is always inside
    // comment)
    it('returns HTML with strong and comment, in any order', function (done) {
      agent.get(getHTMLEndPointFor(padID))
          .expect((res) => {
            const html = res.body.data.html;
            const foundComment = (html.indexOf('<strong>') !== -1);
            if (!foundComment) {
              throw new Error(`Comment not exported. Regex used: <strong>, html exported: ${html}`);
            }
          })
          .end(done);
    });
  });

  context('when pad text has part with comment and part without it', function () {
    before(async function () {
      html = () => buildHTML(`no comment here ${textWithComment('c-2342')}`);
    });

    it('returns HTML with part with comment and part without it', async function () {
      await insertCommentToDB(padID, 'c-2342');
      agent.get(getHTMLEndPointFor(padID))
          .expect((res) => {
            const expectedRegex = `no comment here ${regexWithComment('c-2342')}`;
            const expectedComments = new RegExp(expectedRegex);
            const html = res.body.data.html;
            const foundComment = html.match(expectedComments);
            if (!foundComment) {
              throw new Error(`Comment not exported. Regex used: ${expectedRegex}, ` +
                              `html exported: ${html}`);
            }
          });
    });
  });


  context('Don\'t export when settings.exportHtml = false, pad text has one comment', function () {
    before(async function () {
      html = () => buildHTML(textWithComment('c-1234'));
    });

    it('returns ok', async function () {
      settings.ep_comments_page = {exportHTML: false};
      agent.get(getHTMLEndPointFor(padID))
          .expect(codeToBe0)
          .expect('Content-Type', /json/)
          .expect(200);
    });

    it('returns HTML without comment class', async function () {
      settings.ep_comments_page = {exportHtml: false};
      agent.get(getHTMLEndPointFor(padID))
          .expect((res) => {
            const expectedRegex = regexWithComment('c-1234');
            const expectedComments = new RegExp(expectedRegex);
            const html = res.body.data.html;
            const foundComment = html.match(expectedComments);
            if (foundComment) {
              throw new Error(`Comment exported. Regex used: ${expectedRegex}, ` +
                              `html exported: ${html}`);
            }
          });
    });
  });

  context('Export when settings.exportHtml = true, pad text has one comment', function () {
    before(async function () {
      html = () => buildHTML(textWithComment('c-1234'));
    });

    it('returns ok', async function () {
      settings.ep_comments_page = {exportHTML: true};
      agent.get(getHTMLEndPointFor(padID))
          .expect(codeToBe0)
          .expect('Content-Type', /json/)
          .expect(200);
    });

    it('returns HTML with comment class', async function () {
      settings.ep_comments_page = {exportHtml: true};
      await insertCommentToDB(padID, 'c-1234');
      agent.get(getHTMLEndPointFor(padID))
          .expect((res) => {
            const expectedRegex = regexWithComment('c-1234');
            const expectedComments = new RegExp(expectedRegex);
            const html = res.body.data.html;
            const foundComment = html.match(expectedComments);
            if (!foundComment) {
              throw new Error(`Comment not exported. Regex used: ${expectedRegex}, ` +
                              `html exported: ${html}`);
            }
          });
    });
  });
});

const getHTMLEndPointFor = (padID) => `/api/${apiVersion}/getHTML?apikey=${apiKey}&padID=${padID}`;

const buildHTML = (body) => `<html><body>${body}</body></html>`;

const textWithComment = (commentId, text) => {
  if (!text) text = `this is ${commentId}`;

  return `<span class='comment ${commentId}'>${text}`;
};

const regexWithComment = (commentID, text) => {
  if (!text) text = `this is ${commentID}`;

  return `<span .*class=['|"].*comment ${commentID}.*['|"].*>${text}`;
};

const insertCommentToDB = async (padID, commentId) => {
  const text = `this is ${commentId}`;
  let comments = await db.get(`comments:${padID}`);
  if (!comments) {
    comments = {};
  }
  comments[commentId] = {text};

  return db.set(`comments:${padID}`, comments);
};
