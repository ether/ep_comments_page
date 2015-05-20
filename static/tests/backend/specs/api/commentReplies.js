var             supertest = require('ep_etherpad-lite/node_modules/supertest'),
                       io = require('socket.io-client'),
                  request = require('request'),
                    utils = require('../../../utils'),
                createPad = utils.createPad,
            createComment = utils.createComment,
commentRepliesEndPointFor = utils.commentRepliesEndPointFor,
                   apiKey = utils.apiKey,
                   appUrl = utils.appUrl,
                codeToBe0 = utils.codeToBe0,
                codeToBe1 = utils.codeToBe1,
                codeToBe4 = utils.codeToBe4,
                      api = supertest(appUrl);

describe('create comment reply API', function() {
  var padID;
  var commentID;

  beforeEach(function(done){
    // creates a new pad...
    padID = createPad(function(err, pad) {
      // ... and a comment before each test run
      createComment(pad, function(err, comment) {
        commentID = comment;
        done(err);
      });
    });
  });

  it('returns code 1 if commentId is missing', function(done) {
    api.post(commentRepliesEndPointFor(padID))
    .field('apikey', apiKey)
    .field('name', 'John Doe')
    .field('text', 'This is a reply')
    .expect(codeToBe1)
    .expect('Content-Type', /json/)
    .expect(200, done)
  });

  it('returns code 1 if name is missing', function(done) {
    api.post(commentRepliesEndPointFor(padID))
    .field('apikey', apiKey)
    .field('commentId', commentID)
    .field('text', 'This is a reply')
    .expect(codeToBe1)
    .expect('Content-Type', /json/)
    .expect(200, done)
  });

  it('returns code 1 if text is missing', function(done) {
    api.post(commentRepliesEndPointFor(padID))
    .field('apikey', apiKey)
    .field('commentId', commentID)
    .field('name', 'John Doe')
    .expect(codeToBe1)
    .expect('Content-Type', /json/)
    .expect(200, done)
  });

  it('returns code 4 if API key is missing', function(done) {
    api.post(commentRepliesEndPointFor(padID))
    .expect(codeToBe4)
    .expect('Content-Type', /json/)
    .expect(401, done)
  });

  it('returns code 4 if API key is wrong', function(done) {
    api.post(commentRepliesEndPointFor(padID))
    .field('apikey', 'wrongApiKey')
    .expect(codeToBe4)
    .expect('Content-Type', /json/)
    .expect(401, done)
  });

  it('returns code 0 when reply is successfully added', function(done) {
    api.post(commentRepliesEndPointFor(padID))
    .field('apikey', apiKey)
    .field('commentId', commentID)
    .field('name', 'John Doe')
    .field('text', 'This is a reply')
    .expect(codeToBe0)
    .expect('Content-Type', /json/)
    .expect(200, done)
  });

  it('returns reply id when reply is successfully added', function(done) {
    api.post(commentRepliesEndPointFor(padID))
    .field('apikey', apiKey)
    .field('commentId', commentID)
    .field('name', 'John Doe')
    .field('text', 'This is a reply')
    .expect(function(res){
      if(res.body.replyId === undefined) throw new Error("Response should have replyId.")
    })
    .end(done)
  });
});