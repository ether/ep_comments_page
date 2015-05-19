var appUrl = 'http://localhost:9001';

var supertest = require('ep_etherpad-lite/node_modules/supertest'),
           fs = require('fs'),
         path = require('path'),
           io = require('socket.io-client'),
      request = require('request'),
          api = supertest(appUrl),
 randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;

var apiVersion = 1;
var padID;

var etherpad_root = '/../../../../../../ep_etherpad-lite/../..';
var filePath = path.join(__dirname, etherpad_root + '/APIKEY.txt');
var apiKey = fs.readFileSync(filePath,  {encoding: 'utf-8'});
apiKey = apiKey.replace(/\n$/, "");

describe('addComment', function(){
  //create a new pad before each test run
  beforeEach(function(done){
    padID = randomString(5);
    createPad(padID, done);
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

describe('addComment broadcast', function(){
  var messageReceived;

  // NOTE: this hook will timeout if you don't run your Etherpad in
  // loadTest mode. Be sure to adjust your settings.json when running
  // this test suite
  beforeEach(function(done){
    messageReceived = false

    //create a new pad before each test run...
    padID = randomString(5);
    createPad(padID, function() {
      // ... and listens to the broadcast message:
      var socket = io.connect(appUrl + "/comment");
      var req = { padId: padID };
      // needs to get comments to be able to join the padID room, where the messages will be broadcast to:
      socket.emit('getComments', req, function (res){
        socket.on('pushAddComment', function(data) {
          messageReceived = true;
        });

        done();
      });
    });
  });

  it('broadcasts comment creation to other clients of same pad', function(done) {
    var url = appUrl + commentsEndPointFor(padID);
    request.post(url,
      { form: {
          'apikey': apiKey,
          'name': 'John Doe',
          'text': 'This is a comment',
      } },
      function(error, res, body) {
        if(error) {
          throw error;
        }
        else if(res.statusCode != 200) {
          throw new Error("Failed on calling API. Status code: " + res.statusCode);
        }
        else {
          setTimeout(function() { //give it a second to process the message on the client
            if(!messageReceived) throw new Error("Message should had been received");
            done();
          }, 1000);
        }
      }
    );
  });

  it('does not broadcast comment creation to clients of different pad', function(done) {
    // creates another pad...
    otherPadId = randomString(5);
    createPad(otherPadId, function() {
      // ... and add comment to it:
      var url = appUrl + commentsEndPointFor(otherPadId);
      request.post(url,
        { form: {
            'apikey': apiKey,
            'name': 'Another author',
            'text': 'Comment for the other pad',
        } },
        function(error, res, body) {
          if(error) {
            throw error;
          }
          else if(res.statusCode != 200) {
            throw new Error("Failed on calling API. Status code: " + res.statusCode);
          }
          else {
            setTimeout(function() { //give it a second to process the message on the client
              if(messageReceived) throw new Error("Message should had been received only for pad " + padID);
              done();
            }, 1000);
          }
        }
      );
    });
  });

})

/* ***** helper functions ***** */

var createPad = function(pad, done) {
  api.get('/api/'+apiVersion+'/createPad?apikey='+apiKey+"&padID="+pad)
  .end(function(err, res){
    if(err || (res.body.code !== 0)) done(new Error("Unable to create new Pad"));
  })

  done();
}

function commentsEndPointFor(pad) {
  return '/p/'+pad+'/comments'
}

var codeToBe = function(expectedCode, res) {
  if(res.body.code !== expectedCode){
    throw new Error("Code should be " + expectedCode + ", was " + res.body.code);
  }
}

function codeToBe0(res) { codeToBe(0, res) }
function codeToBe1(res) { codeToBe(1, res) }
function codeToBe4(res) { codeToBe(4, res) }