var             supertest = require('ep_etherpad-lite/node_modules/supertest'),
                       io = require('socket.io-client'),
                  request = require('request'),
                    utils = require('../../../utils'),
                createPad = utils.createPad,
            createComment = utils.createComment,
       createCommentReply = utils.createCommentReply,
commentRepliesEndPointFor = utils.commentRepliesEndPointFor,
                   apiKey = utils.apiKey,
                   appUrl = utils.appUrl,
                codeToBe0 = utils.codeToBe0,
                codeToBe1 = utils.codeToBe1,
                codeToBe4 = utils.codeToBe4,
                      api = supertest(appUrl);


describe('get comments replies', function(){
  var padID;
  //create a new pad before each test run
  beforeEach(function(done){
    padID = createPad(done);
  });

  it('return code 4 if apikey is missing', function(done){
    api.get(listCommentRepliesEndPointFor(padID))
    .expect(codeToBe4)
    .expect('Content-Type',/json/)
    .expect(401, done)
  });

  it('returns code 4 if apikey is wrong', function(done){
    api.get(listCommentRepliesEndPointFor(padID,"wrongApiKey"))
    .expect(codeToBe4)
    .expect('Content-Type',/json/)
    .expect(401, done)
  })

  it ('returns code 0 if apiKey is right', function(done){
    api.get(listCommentRepliesEndPointFor(padID, apiKey))
    .expect(codeToBe0)
    .expect('Content-Type',/json/)
    .expect(200, done)
  })

  it('returns a list of comment replies', function(done){
    // add a comment to a pad
    createComment(pad, {},function(err, comment) {
      createCommentReply(pad, comment, {},function(err, replyId){
        api.get(listCommentRepliesEndPointFor(padID, apiKey))
        .expect(function(res){
          if(res.body.data.replies === undefined) throw new Error("Response expected to have a list of comment replies")
          var replies = Object.keys(res.body.data.replies);
          if(replies.length !==1) throw new Error("Response expected to have one reply")
        }).end(done);
      })
    });
  })

  it('returns comment replies timestamp', function(done){
    createComment(pad,{}, function(err,comment){
      var expectedTimestamp = 1440671727068;
      createCommentReply(pad,comment,{"timestamp": expectedTimestamp}, function(err, replyId){
        api.get(listCommentRepliesEndPointFor(padID, apiKey))
        .expect(function(res){
          var comment_reply_data = res.body.data.replies[replyId];
          if(comment_reply_data.timestamp != expectedTimestamp ) throw new Error("Wrong timestamp. Expected: " + expectedTimestamp + ", got:" + comment_reply_data.timestamp)
        }).end(done);
      })
    })
  });
})

describe('create comment reply API', function() {
  var padID;
  var commentID;

  beforeEach(function(done){
    // creates a new pad...
    padID = createPad(function(err, pad) {
      // ... and a comment before each test run
      createComment(pad, {},function(err, comment) {
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

describe('create comment reply API broadcast', function() {
  var padID;
  var messageReceived;

  // NOTE: this hook will timeout if you don't run your Etherpad in
  // loadTest mode. Be sure to adjust your settings.json when running
  // this test suite
  beforeEach(function(done){
    messageReceived = false

    // creates a new pad...
    padID = createPad(function(err, pad) {
      // ... and a comment before each test run, then...
      createComment(pad, {},function(err, comment) {
        commentID = comment;

        // ... listens to the broadcast message:
        var socket = io.connect(appUrl + "/comment");
        var req = { padId: pad };
        // needs to get comments to be able to join the pad room, where the messages will be broadcast to:
        socket.emit('getComments', req, function (res){
          socket.on('pushAddCommentReply', function(data) {
            messageReceived = true;
          });

          done();
        });
      });
    });
  });

  it('broadcasts comment reply creation to other clients of same pad', function(done) {
    createCommentReply(padID, commentID, function(err, replyId) {
      if(err) throw err;
      if(!replyId) throw new Error("Reply should had been created");

      setTimeout(function() { //give it some time to process the message on the client
        if(!messageReceived) throw new Error("Message should had been received");
        done();
      }, 100);
    });
  });

  it('does not broadcast comment reply creation to clients of different pad', function(done) {
    // creates another pad...
    createPad(function(err, otherPadId) {
      // ... and another comment...
      createComment(otherPadId, {},function(err, otherCommentId) {
        if(err) throw err;
        if(!otherCommentId) throw new Error("Comment should had been created");

        // ... and adds comment reply to it:
        createCommentReply(otherPadId, otherCommentId, function(err, replyId) {
          if(err) throw err;
          if(!replyId) throw new Error("Reply should had been created");

          setTimeout(function() { //give it some time to process the message on the client
            if(messageReceived) throw new Error("Message should had been received only for pad " + padID);
            done();
          }, 100);
        });
      });
    });
  });
});

var listCommentRepliesEndPointFor = function(padID, apiKey) {
  var extraParams = "";
  if(apiKey) {
    extraParams = "?apikey=" + apiKey;
  }
  return commentRepliesEndPointFor(padID) + extraParams;
}