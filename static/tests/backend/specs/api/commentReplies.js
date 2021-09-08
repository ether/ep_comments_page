'use strict';

const common = require('ep_etherpad-lite/tests/backend/common');
const io = require('socket.io-client');
const utils = require('../../../utils');
const createPad = utils.createPad;
const readOnlyId = utils.readOnlyId;
const createComment = utils.createComment;
const createCommentReply = utils.createCommentReply;
const commentRepliesEndPointFor = utils.commentRepliesEndPointFor;
const codeToBe0 = utils.codeToBe0;
const codeToBe1 = utils.codeToBe1;
const codeToBe4 = utils.codeToBe4;

let api;
let appUrl;
const apiKey = common.apiKey;

describe(__filename, function () {
  before(async function () {
    api = await common.init();
    appUrl = common.baseUrl;
  });

  describe('get comments replies', function () {
    let padID;
    // create a new pad before each test run
    beforeEach(function (done) {
      createPad((err, newPadID) => {
        padID = newPadID;
        done(err);
      });
    });

    it('return code 4 if apikey is missing', function (done) {
      api.get(listCommentRepliesEndPointFor(padID))
          .expect(codeToBe4)
          .expect('Content-Type', /json/)
          .expect(401, done);
    });

    it('returns code 4 if apikey is wrong', function (done) {
      api.get(listCommentRepliesEndPointFor(padID, 'wrongApiKey'))
          .expect(codeToBe4)
          .expect('Content-Type', /json/)
          .expect(401, done);
    });

    it('returns code 0 if apiKey is right', function (done) {
      api.get(listCommentRepliesEndPointFor(padID, apiKey))
          .expect(codeToBe0)
          .expect('Content-Type', /json/)
          .expect(200, done);
    });

    it('returns a list of comment replies', function (done) {
      // add a comment to a pad
      createComment(padID, {}, (err, comment) => {
        createCommentReply(padID, comment, {}, (err, replyId) => {
          api.get(listCommentRepliesEndPointFor(padID, apiKey))
              .expect((res) => {
                if (res.body.data.replies === undefined) {
                  throw new Error('Response expected to have a list of comment replies');
                }
                const replies = Object.keys(res.body.data.replies);
                if (replies.length !== 1) throw new Error('Response expected to have one reply');
              }).end(done);
        });
      });
    });

    it('returns comment replies data', function (done) {
      createComment(padID, {}, (err, comment) => {
        const text = 'text';
        const changeTo = 'changeTo';
        const changeFrom = 'changeFrom';
        const name = 'name';
        const timestamp = 1440671727068;
        const data = {
          commentId: comment,
          reply: text,
          changeTo,
          changeFrom,
          name,
          timestamp,
        };
        createCommentReply(padID, comment, data, (err, replyId) => {
          api.get(listCommentRepliesEndPointFor(padID, apiKey))
              .expect((res) => {
                const commentReplyData = res.body.data.replies[replyId];
                if (commentReplyData.commentId !== comment) {
                  throw new Error(`Wrong commentId. Expected: ${comment}, ` +
                                  `got: ${commentReplyData.commentId}`);
                }
                if (commentReplyData.text !== text) {
                  throw new Error(`Wrong text. Expected: ${text}, ` +
                                  `got: ${commentReplyData.text}`);
                }
                if (commentReplyData.changeTo !== changeTo) {
                  throw new Error(`Wrong changeTo. Expected: ${changeTo}, ` +
                                  `got: ${commentReplyData.changeTo}`);
                }
                if (commentReplyData.changeFrom !== changeFrom) {
                  throw new Error(`Wrong changeFrom. Expected: ${changeFrom}, ` +
                                  `got: ${commentReplyData.changeFrom}`);
                }
                if (commentReplyData.name !== name) {
                  throw new Error(`Wrong name. Expected: ${name}, ` +
                                  `got: ${commentReplyData.name}`);
                }
                if (commentReplyData.timestamp !== timestamp) {
                  throw new Error(`Wrong timestamp. Expected: ${timestamp}, ` +
                                  `got: ${commentReplyData.timestamp}`);
                }
              }).end(done);
        });
      });
    });

    it('returns same data for read-write and read-only pad ids', function (done) {
      // create comment
      createComment(padID, {}, (err, comment) => {
        // create reply
        createCommentReply(padID, comment, {}, (err, commentId) => {
          // get r-w data
          api.get(listCommentRepliesEndPointFor(padID, apiKey))
              .end((err, res) => {
                const rwData = JSON.stringify(res.body.data);
                // get read-only pad id
                readOnlyId(padID, (err, roPadId) => {
                  // get r-o data
                  api.get(listCommentRepliesEndPointFor(roPadId, apiKey))
                      .expect((res) => {
                        const roData = JSON.stringify(res.body.data);
                        if (roData !== rwData) {
                          throw new Error("Read-only and read-write data don't match. " +
                                          `Read-only data: ${roData}, read-write data: ${rwData}`);
                        }
                      })
                      .end(done);
                });
              });
        });
      });
    });
  });

  describe('create comment replies API', function () {
    let padID;
    let commentID;

    beforeEach(function (done) {
      // creates a new pad...
      createPad((err, newPadID) => {
        if (err) throw err;
        padID = newPadID;

        // ... and a comment before each test run
        createComment(padID, {}, (err, comment) => {
          commentID = comment;
          done(err);
        });
      });
    });

    it('returns code 1 if data is missing', function (done) {
      api.post(commentRepliesEndPointFor(padID))
          .field('apikey', apiKey)
          .expect(codeToBe1)
          .expect('Content-Type', /json/)
          .expect(200, done);
    });

    it('returns code 1 if data is not a JSON', function (done) {
      api.post(commentRepliesEndPointFor(padID))
          .field('apikey', apiKey)
          .field('data', 'not a JSON')
          .expect(codeToBe1)
          .expect('Content-Type', /json/)
          .expect(200, done);
    });

    it('returns code 4 if API key is missing', function (done) {
      api.post(commentRepliesEndPointFor(padID))
          .expect(codeToBe4)
          .expect('Content-Type', /json/)
          .expect(401, done);
    });

    it('returns code 4 if API key is wrong', function (done) {
      api.post(commentRepliesEndPointFor(padID))
          .field('apikey', 'wrongApiKey')
          .expect(codeToBe4)
          .expect('Content-Type', /json/)
          .expect(401, done);
    });

    it('returns code 0 when reply is successfully added', function (done) {
      api.post(commentRepliesEndPointFor(padID))
          .field('apikey', apiKey)
          .field('data', repliesData([replyData(commentID)]))
          .expect(codeToBe0)
          .expect('Content-Type', /json/)
          .expect(200, done);
    });

    it('returns reply ids when replies are successfully added', function (done) {
      const twoReplies = repliesData([replyData(), replyData()]);
      api.post(commentRepliesEndPointFor(padID))
          .field('apikey', apiKey)
          .field('data', twoReplies)
          .expect((res) => {
            if (res.body.replyIds === undefined) throw new Error('Response should have replyIds.');
            if (res.body.replyIds.length !== 2) {
              throw new Error('Response should have two reply ids.');
            }
          })
          .end(done);
    });

    context('when pad already have replies', function () {
      it('returns only the new reply ids', function (done) {
        createCommentReply(padID, commentID, {}, (err, touch) => {
          const twoReplies = repliesData([replyData(), replyData()]);
          api.post(commentRepliesEndPointFor(padID))
              .field('apikey', apiKey)
              .field('data', twoReplies)
              .expect((res) => {
                if (res.body.replyIds === undefined) {
                  throw new Error('Response should have replyIds.');
                }
                if (res.body.replyIds.length !== 2) {
                  throw new Error('Response should have two reply ids.');
                }
              })
              .end(done);
        });
      });
    });
  });

  describe('create comment reply API broadcast', function () {
    let padID;
    let commentID;
    let timesMessageWasReceived;
    let socket;

    // NOTE: this hook will timeout if you don't run your Etherpad in
    // loadTest mode. Be sure to adjust your settings.json when running
    // this test suite
    beforeEach(function (done) {
      timesMessageWasReceived = 0;

      // creates a new pad...
      createPad((err, newPadID) => {
        if (err) throw err;
        padID = newPadID;

        // ... and a comment before each test run, then...
        createComment(padID, {}, (err, comment) => {
          commentID = comment;

          // ... listens to the broadcast message:
          socket = io.connect(`${appUrl}/comment`);
          const req = {padId: padID};
          // needs to get comments to be able to join the pad room, where the messages will be
          // broadcast to:
          socket.emit('getComments', req, (errj, res) => {
            socket.on('pushAddCommentReply', (data) => {
              ++timesMessageWasReceived;
            });

            done();
          });
        });
      });
    });

    afterEach(function (done) {
      socket.close();
      done();
    });

    it('broadcasts comment reply creation to other clients of same pad', function (done) {
      // create first reply...
      createCommentReply(padID, commentID, {}, (err, replyId) => {
        if (err) throw err;
        if (!replyId) throw new Error('Reply should had been created');

        // ... create second reply...
        createCommentReply(padID, commentID, {}, (err, replyId) => {
          if (err) throw err;
          if (!replyId) throw new Error('Reply should had been created');

          // ... then check if both messages were received
          setTimeout(() => { // give it some time to process the message on the client
            if (timesMessageWasReceived !== 2) throw new Error('Message should had been received');
            done();
          }, 100);
        });
      });
    });

    it('does not broadcast comment reply creation to clients of different pad', function (done) {
      // creates another pad...
      createPad((err, otherPadId) => {
        if (err) throw err;

        // ... and another comment...
        createComment(otherPadId, {}, (err, otherCommentId) => {
          if (err) throw err;
          if (!otherCommentId) throw new Error('Comment should had been created');

          // ... and adds comment reply to it:
          createCommentReply(otherPadId, otherCommentId, {}, (err, replyId) => {
            if (err) throw err;
            if (!replyId) throw new Error('Reply should had been created');

            setTimeout(() => { // give it some time to process the message on the client
              if (timesMessageWasReceived !== 0) {
                throw new Error(`Message should had been received only for pad ${padID}`);
              }
              done();
            }, 100);
          });
        });
      });
    });
  });
});

const listCommentRepliesEndPointFor = function (padID, apiKey) {
  let extraParams = '';
  if (apiKey) {
    extraParams = `?apikey=${apiKey}`;
  }
  return commentRepliesEndPointFor(padID) + extraParams;
};

const repliesData = function (replies) {
  if (!replies) replies = [replyData()];

  return JSON.stringify(replies);
};

const replyData = function (commentId) {
  return {commentId, name: 'The Author', text: 'The Comment Text'};
};
