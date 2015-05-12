var eejs = require('ep_etherpad-lite/node/eejs/');
var fs = require("fs");
// var clientIO = require('socket.io-client');
var commentManager = require('./commentManager');
var comments = require('./comments');
var padManager = require("ep_etherpad-lite/node/db/PadManager");
// var settings = require("ep_etherpad-lite/node/utils/Settings");

//ensure we have an apikey
var apikey = "";
try {
  apikey = fs.readFileSync("./APIKEY.txt","utf8");
}
catch(e){
  console.warn('Could not find APIKEY');
}

exports.socketio = function (hook_name, args, cb){
  var app = args.app;
  var io = args.io;
  var pushComment;
  var padComment = io;

  var commentSocket = io
  .of('/comment')
  .on('connection', function (socket) {

    // Join the rooms
    socket.on('getComments', function (data, callback) {
      var padId = data.padId;
      socket.join(padId);
      commentManager.getComments(padId, function (err, comments){
        callback(comments);
      });
    });

    socket.on('getCommentReplies', function (data, callback) {
      var padId = data.padId;
      commentManager.getCommentReplies(padId, function (err, replies){
        callback(replies);
      });
    });

    // On add events
    socket.on('addComment', function (data, callback) {
      var padId = data.padId;
      var content = data.comment;
      commentManager.addComment(padId, content, function (err, commentId, comment){
        socket.broadcast.to(padId).emit('pushAddComment', commentId, comment);
        callback(commentId, comment);
      });
    });

    socket.on('addCommentReply', function (data, callback) {
      var padId = data.padId;
      var content = data.reply;
      var commentId = data.commentId;
      commentManager.addCommentReply(padId, data, function (err, replyId, reply){
        reply.replyId = replyId;
        socket.broadcast.to(padId).emit('pushAddCommentReply', replyId, reply);
        callback(replyId, reply);
      });
    });

    // // comment added via API
    // socket.on('apiAddComment', function (data, callback) {
    //   var padId = data.padId;
    //   var commentId = data.commentId;
    //   var comment = data.comment;

    //   socket.broadcast.to(padId).emit('pushAddComment', commentId, comment);
    //   callback(commentId, comment);
    // });

  });
};

exports.eejsBlock_dd_insert = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_comments_page/templates/menuButtons.ejs");
  return cb();
};

exports.eejsBlock_mySettings = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_comments_page/templates/settings.ejs");
  return cb();
};

exports.eejsBlock_editbarMenuLeft = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_comments_page/templates/commentBarButtons.ejs");
  return cb();
};

exports.eejsBlock_scripts = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_comments_page/templates/comments.html", {}, module);
  return cb();
};

exports.eejsBlock_styles = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_comments_page/templates/styles.html", {}, module);
  return cb();
};

exports.expressCreateServer = function (hook_name, args, callback) {
  args.app.get('/p/:pad/:rev?/comments', function(req, res) {
    // check the api key
    apiKeyReceived = req.query.apikey || req.query.api_key;
    if(apiKeyReceived !== apikey.trim()) {
      res.statusCode = 401;
      res.json({code: 4, message: "no or wrong API Key", data: null});
      return;
    }

    // check comment data
    var error = checkCommentData(req);
    if(error) {
      res.json({code: 1, message: error, data: null});
      return;
    }
    var data = {
      author: "empty",
      name: req.query.name,
      text: req.query.text
    };

    // sanitize pad id before continuing
    var padIdReceived = req.params.pad
    padManager.sanitizePadId(padIdReceived, function(padId) {
      padIdReceived = padId;
    });

    comments.addPadComment(padIdReceived, data, function(err, commentId, comment) {
      if(err) {
        res.json({code: 2, message: "internal error", data: null});
      } else {
        // broadcastCommentAdded(padIdReceived, commentId, comment);
        res.json({code: 0, commentId: commentId});
      }
    });
  });

}

var checkCommentData = function(req) {
  if(typeof req.query.name === 'undefined') return "name is required";
  if(typeof req.query.text === 'undefined') return "text is required";

  return false;
}

// var broadcastCommentAdded = function(padId, commentId, comment) {
//   var socket = clientIO.connect(broadcastUrl);

//   var data = {
//     padId: padId,
//     commentId: commentId,
//     comment: comment
//   };

//   socket.emit('apiAddComment', data);
// }

// var buildBroadcastUrl = function() {
//   var url = "";
//   if(settings.ssl) {
//     url += "https://";
//   } else {
//     url += "http://";
//   }
//   url += settings.ip + ":" + settings.port + "/comment";

//   return url;
// }
// var broadcastUrl = buildBroadcastUrl();

/*
exports.expressCreateServer = function (hook_name, args, cb) {
  var app = args.app;

	app.get('/p/:pad/:rev?/comments', function(req, res, next) {
		var padId = req.params.pad;
		var revision = req.params.rev ? req.params.rev : null;

		comments.getPadComments(padId, revision, function(err, padComments) {
			res.render('comments.ejs', { locals: { comments: padComments } });
		});
	});

  app.get('/p/:pad/:rev?/add/comment/:name/:text', function(req, res, next) {
    var padId = req.params.pad;
    var revision = req.params.rev ? req.params.rev : null;
    var data = {
      author: "empty",
      selection: "empty",
      name: req.params.name,
      text: req.params.text
    };

    comments.addPadComment(padId, data, revision, function(err, commentId) {
      res.contentType('text/x-json');
      res.send('{ "commentId": "'+ commentId +'" }');
    });
  });
	app.configure(function(){
		args.app.set('views', __dirname + '/views');
    args.app.set('view options', {layout: false});
		args.app.engine('ejs', require('ejs').renderFile);
	}
};
*/
