var       supertest = require('ep_etherpad-lite/node_modules/supertest'),
                 io = require('socket.io-client'),
              utils = require('../../../utils'),
          createPad = utils.createPad,
      createComment = utils.createComment,
             appUrl = utils.appUrl,
             apiKey = utils.apiKey,
          codeToBe0 = utils.codeToBe0,
          codeToBe1 = utils.codeToBe1,
          codeToBe4 = utils.codeToBe4,
commentsEndPointFor = utils.commentsEndPointFor,
                api = supertest(appUrl);

describe('create comment API', function(){
  var padID;

  //create a new pad before each test run
  beforeEach(function(done){
    padID = createPad(done);
  });

  it('returns code 1 if name is missing', function(done) {
    api.post(commentsEndPointFor(padID))
    .field('apikey', apiKey)
    .field('text', 'This is a comment')
    .expect(codeToBe1)
    .expect('Content-Type', /json/)
    .expect(200, done)
  });

  it('returns code 1 if text is missing', function(done) {
    api.post(commentsEndPointFor(padID))
    .field('apikey', apiKey)
    .field('name', 'John Doe')
    .expect(codeToBe1)
    .expect('Content-Type', /json/)
    .expect(200, done)
  });

  it('returns code 4 if API key is missing', function(done) {
    api.post(commentsEndPointFor(padID))
    .field('name', 'John Doe')
    .field('text', 'This is a comment')
    .expect(codeToBe4)
    .expect('Content-Type', /json/)
    .expect(401, done)
  });

  it('returns code 4 if API key is wrong', function(done) {
    api.post(commentsEndPointFor(padID))
    .field('apikey', 'wrongApiKey')
    .field('name', 'John Doe')
    .field('text', 'This is a comment')
    .expect(codeToBe4)
    .expect('Content-Type', /json/)
    .expect(401, done)
  });

  it('returns code 0 when comment is successfully added', function(done) {
    api.post(commentsEndPointFor(padID))
    .field('apikey', apiKey)
    .field('name', 'John Doe')
    .field('text', 'This is a comment')
    .expect(codeToBe0)
    .expect('Content-Type', /json/)
    .expect(200, done)
  });

  it('returns comment id when comment is successfully added', function(done) {
    api.post(commentsEndPointFor(padID))
    .field('apikey', apiKey)
    .field('name', 'John Doe')
    .field('text', 'This is a comment')
    .expect(function(res){
      if(res.body.commentId === undefined) throw new Error("Response should have commentId.")
    })
    .end(done)
  });
})

describe('create comment API broadcast', function(){
  var padID;
  var messageReceived;

  // NOTE: this hook will timeout if you don't run your Etherpad in
  // loadTest mode. Be sure to adjust your settings.json when running
  // this test suite
  beforeEach(function(done){
    messageReceived = false

    //create a new pad before each test run...
    padID = createPad(function(err, pad) {
      // ... and listens to the broadcast message:
      var socket = io.connect(appUrl + "/comment");
      var req = { padId: pad };
      // needs to get comments to be able to join the pad room, where the messages will be broadcast to:
      socket.emit('getComments', req, function (res){
        socket.on('pushAddComment', function(data) {
          messageReceived = true;
        });

        done();
      });
    });
  });

  it('broadcasts comment creation to other clients of same pad', function(done) {
    createComment(padID, function(err, commentId) {
      if(err) throw err;
      if(!commentId) throw new Error("Comment should had been created");

      setTimeout(function() { //give it a second to process the message on the client
        if(!messageReceived) throw new Error("Message should had been received");
        done();
      }, 1000);
    });
  });

  it('does not broadcast comment creation to clients of different pad', function(done) {
    // creates another pad...
    createPad(function(err, otherPadId) {
      // ... and add comment to it:
      createComment(otherPadId, function(err, commentId) {
        if(err) throw err;
        if(!commentId) throw new Error("Comment should had been created");

        setTimeout(function() { //give it a second to process the message on the client
          if(messageReceived) throw new Error("Message should had been received only for pad " + padID);
          done();
        }, 1000);
      });
    });
  });

})
