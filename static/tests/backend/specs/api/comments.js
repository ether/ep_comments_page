'use strict';

const common = require('ep_etherpad-lite/tests/backend/common');
const generateJWTToken = common.generateJWTToken;
const io = require('socket.io-client');
const utils = require('../../../utils');
const createPad = utils.createPad;
const readOnlyId = utils.readOnlyId;
const createComment = utils.createComment;
const codeToBe0 = utils.codeToBe0;
const codeToBe1 = utils.codeToBe1;
const codeToBe4 = utils.codeToBe4;
const commentsEndPointFor = utils.commentsEndPointFor;

let api;
let appUrl;

describe(__filename, function () {
  before(async function () {
    api = await common.init();
    appUrl = common.baseUrl;
  });

  describe('get comments API', function () {
    let padID;

    // create a new pad before each test run
    beforeEach(function (done) {
      createPad((err, newPadID) => {
        padID = newPadID;
        done(err);
      });
    });

    it('returns code 4 if authorization header is missing', async function () {
      await api.get(listCommentsEndPointFor(padID))
          .expect(codeToBe4)
          .expect('Content-Type', /json/)
          .expect(401);
    });

    it('returns code 4 if authorization header is wrong', async function () {
      await api.get(listCommentsEndPointFor(padID))
          .set('Authorization', 'Bearer wrongtoken')
          .expect(codeToBe4)
          .expect('Content-Type', /json/)
          .expect(401);
    });

    it('returns code 0 when properly authorized', async function () {
      await api.get(listCommentsEndPointFor(padID))
          .set('Authorization', await generateJWTToken())
          .expect(codeToBe0)
          .expect('Content-Type', /json/)
          .expect(200);
    });

    it('returns comment list when properly authorized', function (done) {
      // creates first comment...
      createComment(padID, {}, (err, comment) => {
        // ... creates second comment...
        createComment(padID, {}, async (err, comment) => {
          // ... and finally checks if comments are returned
          api.get(listCommentsEndPointFor(padID))
              .set('Authorization', await generateJWTToken())
              .expect((res) => {
                if (res.body.data.comments === undefined) {
                  throw new Error('Response should have list of comments.');
                }
                const commentIds = Object.keys(res.body.data.comments);
                if (commentIds.length !== 2) throw new Error('Response should have two comments.');
              })
              .end(done);
        });
      });
    });

    it('returns comment data', function (done) {
      const name = 'name';
      const text = 'text';
      const timestamp = 1440671727068;
      const changeTo = 'changeTo';
      const changeFrom = 'changeFrom';
      const data = {
        name,
        text,
        timestamp,
        changeTo,
        changeFrom,
      };
      createComment(padID, data, async (err, commentId) => {
        api.get(listCommentsEndPointFor(padID))
            .set('Authorization', await generateJWTToken())
            .expect((res) => {
              const commentData = res.body.data.comments[commentId];
              if (commentData.name !== name) {
                throw new Error(`Wrong name. Expected: ${name}, got: ${commentData.name}`);
              }
              if (commentData.text !== text) {
                throw new Error(`Wrong text. Expected: ${text}, got: ${commentData.text}`);
              }
              if (commentData.timestamp !== timestamp) {
                throw new Error(`Wrong timestamp. Expected: ${timestamp}, ` +
                                `got: ${commentData.timestamp}`);
              }
              if (commentData.changeTo !== changeTo) {
                throw new Error(`Wrong changeTo. Expected: ${changeTo}, ` +
                                `got: ${commentData.changeTo}`);
              }
              if (commentData.changeFrom !== changeFrom) {
                throw new Error(`Wrong changeFrom. Expected: ${changeFrom}, ` +
                                `got: ${commentData.changeFrom}`);
              }
            })
            .end(done);
      });
    });

    it('returns same data for read-write and read-only pad ids', function (done) {
      createComment(padID, {}, async (err, commentId) => {
        api.get(listCommentsEndPointFor(padID))
            .set('Authorization', await generateJWTToken())
            .end((err, res) => {
              const rwData = JSON.stringify(res.body.data);
              readOnlyId(padID, async (err, roPadId) => {
                api.get(listCommentsEndPointFor(roPadId))
                    .set('Authorization', await generateJWTToken())
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

  describe('create comments API', function () {
    let padID;

    // create a new pad before each test run
    beforeEach(function (done) {
      createPad((err, newPadID) => {
        padID = newPadID;
        done(err);
      });
    });

    it('returns code 1 if data is missing', async function () {
      await api.post(commentsEndPointFor(padID))
          .set('Authorization', await generateJWTToken())
          .expect(codeToBe1)
          .expect('Content-Type', /json/)
          .expect(200);
    });

    it('returns code 1 if data is not a JSON', async function () {
      await api.post(commentsEndPointFor(padID))
          .set('Authorization', await generateJWTToken())
          .field('data', 'not a JSON')
          .expect(codeToBe1)
          .expect('Content-Type', /json/)
          .expect(200);
    });

    it('returns code 4 if authorization header is missing', async function () {
      await api.post(commentsEndPointFor(padID))
          .field('data', commentsData())
          .expect(codeToBe4)
          .expect('Content-Type', /json/)
          .expect(401);
    });

    it('returns code 4 if authorization header is wrong', async function () {
      await api.post(commentsEndPointFor(padID))
          .set('Authorization', 'Bearer wrongtoken')
          .field('data', commentsData())
          .expect(codeToBe4)
          .expect('Content-Type', /json/)
          .expect(401);
    });

    it('returns code 0 when comment is successfully added', async function () {
      await api.post(commentsEndPointFor(padID))
          .set('Authorization', await generateJWTToken())
          .field('data', commentsData())
          .expect(codeToBe0)
          .expect('Content-Type', /json/)
          .expect(200);
    });

    it('returns comment ids when comment is successfully added', async function () {
      const twoComments = commentsData([commentData(), commentData()]);
      await api.post(commentsEndPointFor(padID))
          .set('Authorization', await generateJWTToken())
          .field('data', twoComments)
          .expect((res) => {
            if (res.body.commentIds === undefined) {
              throw new Error('Response should have commentIds.');
            }
            if (res.body.commentIds.length !== 2) {
              throw new Error('Response should have two comment ids.');
            }
          });
    });

    context('when pad already have comments', function () {
      it('returns only the new comment ids', function (done) {
        createComment(padID, {}, async (err, touch) => {
          const twoComments = commentsData([commentData(), commentData()]);
          api.post(commentsEndPointFor(padID))
              .set('Authorization', await generateJWTToken())
              .field('data', twoComments)
              .expect((res) => {
                if (res.body.commentIds === undefined) {
                  throw new Error('Response should have commentIds.');
                }
                if (res.body.commentIds.length !== 2) {
                  throw new Error('Response should have two comment ids.');
                }
              })
              .end(done);
        });
      });
    });
  });

  // These tests rely on socket.io broadcasts that only work when Etherpad
  // is started with loadTest mode enabled. We don't enable loadTest in normal
  // CI (it's only enabled in the periodic load test cron job), so skip them
  // here to keep regular PR CI green.
  (process.env.LOAD_TEST ? describe : describe.skip)('create comment API broadcast', function () {
    let padID;
    let timesMessageWasReceived;
    let socket;

    beforeEach(function (done) {
      timesMessageWasReceived = 0;

      // create a new pad before each test run...
      createPad((err, newPadID) => {
        if (err) throw err;
        padID = newPadID;

        // ... and listens to the broadcast message:
        socket = io.connect(`${appUrl}/comment`);
        const req = {padId: padID};
        // needs to get comments to be able to join the pad room, where the messages will be
        // broadcast to:
        socket.emit('getComments', req, (errj, res) => {
          socket.on('pushAddComment', (data) => {
            ++timesMessageWasReceived;
          });

          done();
        });
      });
    });

    afterEach(function (done) {
      socket.close();
      done();
    });

    it('broadcasts comment creation to other clients of same pad', function (done) {
      // create first comment...
      createComment(padID, {}, (err, commentId) => {
        if (err) throw err;
        if (!commentId) throw new Error('Comment should had been created');

        // ... create second comment...
        createComment(padID, {}, (err, commentId) => {
          if (err) throw err;
          if (!commentId) throw new Error('Comment should had been created');

          // ... then check if both messages were received
          setTimeout(() => { // give it some time to process the messages on the client
            if (timesMessageWasReceived !== 2) throw new Error('Message should had been received');
            done();
          }, 100);
        });
      });
    });

    it('does not broadcast comment creation to clients of different pad', function (done) {
      // creates another pad...
      createPad((err, otherPadId) => {
        if (err) throw err;

        // ... and add comment to it:
        createComment(otherPadId, {}, (err, commentId) => {
          if (err) throw err;
          if (!commentId) throw new Error('Comment should had been created');

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

const listCommentsEndPointFor = function (padID) {
  return commentsEndPointFor(padID);
};

const commentsData = function (comments) {
  if (!comments) comments = [commentData()];

  return JSON.stringify(comments);
};

const commentData = function () {
  return {name: 'The Author', text: 'The Comment Text'};
};
