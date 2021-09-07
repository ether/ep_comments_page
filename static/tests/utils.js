'use strict';

const common = require('ep_etherpad-lite/tests/backend/common');
const randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;

const apiKey = common.apiKey;
const apiVersion = 1;

// Functions to validate API responses:
const codeToBe = function (expectedCode, res) {
  if (res.body.code !== expectedCode) {
    throw new Error(`Code should be ${expectedCode}, was ${res.body.code}`);
  }
};

const codeToBe0 = function (res) { codeToBe(0, res); };
const codeToBe1 = function (res) { codeToBe(1, res); };
const codeToBe4 = function (res) { codeToBe(4, res); };

// App end point to create a comment via API
const commentsEndPointFor = function (pad) {
  return `/p/${pad}/comments`;
};

// App end point to create a comment reply via API
const commentRepliesEndPointFor = function (pad) {
  return `/p/${pad}/commentReplies`;
};

// Creates a pad and returns the pad id. Calls the callback when finished.
const createPad = function (done) {
  common.init().then((agent) => {
    const pad = randomString(5);
    agent.get(`/api/${apiVersion}/createPad?apikey=${apiKey}&padID=${pad}`)
        .end((err, res) => {
          if (err || (res.body.code !== 0)) return done(new Error('Unable to create new Pad'));
          done(null, pad);
        });
  });
};

const readOnlyId = function (padID, done) {
  common.init().then((agent) => {
    agent.get(`/api/${apiVersion}/getReadOnlyID?apikey=${apiKey}&padID=${padID}`)
        .end((err, res) => {
          if (err || (res.body.code !== 0)) return done(new Error('Unable to get read only id'));
          done(null, res.body.data.readOnlyID);
        });
  });
};

// Creates a comment and calls the callback when finished.
const createComment = function (pad, commentData, done) {
  commentData = commentData || {};
  commentData.name = commentData.name || 'John Doe';
  commentData.text = commentData.text || 'This is a comment';
  common.init().then((agent) => {
    agent.post(commentsEndPointFor(pad))
        .send({
          apikey: apiKey,
          data: JSON.stringify([commentData]),
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .expect(codeToBe0)
        .end((err, res) => {
          if (err) return done(err);
          done(null, res.body.commentIds[0]);
        });
  });
};

// Creates a comment reply and calls the callback when finished.
const createCommentReply = function (pad, comment, replyData, done) {
  replyData = replyData || {};
  replyData.commentId = comment;
  replyData.name = replyData.name || 'John Doe';
  replyData.text = replyData.text || 'This is a reply';
  common.init().then((agent) => {
    agent.post(commentRepliesEndPointFor(pad))
        .send({
          apikey: apiKey,
          data: JSON.stringify([replyData]),
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .expect(codeToBe0)
        .end((err, res) => {
          if (err) return done(err);
          done(null, res.body.replyIds[0]);
        });
  });
};

/* ********** Available functions/values: ********** */
exports.apiVersion = apiVersion;
exports.createPad = createPad;
exports.readOnlyId = readOnlyId;
exports.createComment = createComment;
exports.createCommentReply = createCommentReply;
exports.codeToBe0 = codeToBe0;
exports.codeToBe1 = codeToBe1;
exports.codeToBe4 = codeToBe4;
exports.commentsEndPointFor = commentsEndPointFor;
exports.commentRepliesEndPointFor = commentRepliesEndPointFor;
