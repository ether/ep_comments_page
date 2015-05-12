var appUrl = 'http://localhost:9001';

var supertest = require('ep_etherpad-lite/node_modules/supertest'),
           fs = require('fs'),
         path = require('path'),
           // io = require('socket.io-client')
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
    api.get(padEndPointWithMissingName())
    .expect(codeToBe1)
    .expect('Content-Type', /json/)
    .expect(200, done)
  });

  it('returns code 1 if text is missing', function(done) {
    api.get(padEndPointWithMissingText())
    .expect(codeToBe1)
    .expect('Content-Type', /json/)
    .expect(200, done)
  });

  it('returns code 4 if API key is missing', function(done) {
    var missingApiKey = null;
    api.get(padEndPoint('comments', missingApiKey))
    .expect(codeToBe4)
    .expect('Content-Type', /json/)
    .expect(401, done)
  });

  it('returns code 4 if API key is wrong', function(done) {
    api.get(padEndPoint('comments', 'wrongApiKey'))
    .expect(codeToBe4)
    .expect('Content-Type', /json/)
    .expect(401, done)
  });

  it('returns code 0 when comment is successfully added', function(done) {
    api.get(padEndPointWithAllParams())
    .expect(codeToBe0)
    .expect('Content-Type', /json/)
    .expect(200, done)
  });

  it('returns comment id when comment is successfully added', function(done) {
    api.get(padEndPointWithAllParams())
    .expect(function(res){
      if(res.body.commentId === undefined) throw new Error("Response should have commentId.")
    })
    .end(done)
  });

  // it('broadcasts comment creation to other clients of same pad', function(done) {
  //   // listens to the pushAddComment message:
  //   var messageReceived = false;
  //   var socket = io.connect(appUrl+"/comment");
  //   socket.on('pushAddComment', function(data) {
  //     messageReceived = true;
  //   });

  //   // creates comment:
  //   api.get(padEndPointWithAllParams())
  //   .expect(function(res){
  //     setTimeout(function() { //give it a second to process the message on the client
  //       // TODO review this, test is not failing ever
  //       if(!messageReceived) throw new Error("Message should had been received");
  //       done();
  //     }, 1000);
  //   })
  //   .end(function(err, res){
  //     if(err) return done(err);
  //     done();
  //   })
  // });

  // it('does not broadcast comment creation to clients of different pad');
})

/* ***** helper functions ***** */

var createPad = function(pad, done) {
  api.get('/api/'+apiVersion+'/createPad?apikey='+apiKey+"&padID="+pad)
  .end(function(err, res){
    if(err || (res.body.code !== 0)) done(new Error("Unable to create new Pad"));
  })

  done();
}

var padEndPoint = function(point, key, pad){
  key = (typeof key !== 'undefined') ?  key : apiKey;
  pad = (typeof pad !== 'undefined') ?  pad : padID;

  url = '/p/'+pad+'/'+point
  if (key != null) url += '?apikey='+key

  return url;
}

function padEndPointWithMissingName() { return padEndPoint('comments')+"&text=This is a comment" }
function padEndPointWithMissingText() { return padEndPoint('comments')+"&name=John Doe" }
function padEndPointWithAllParams()   { return padEndPoint('comments')+"&name=John Doe&text=This is a comment" }

var codeToBe = function(expectedCode, res) {
  if(res.body.code !== expectedCode){
    throw new Error("Code should be " + expectedCode + ", was " + res.body.code);
  }
}

function codeToBe0(res) { codeToBe(0, res) }
function codeToBe1(res) { codeToBe(1, res) }
function codeToBe4(res) { codeToBe(4, res) }