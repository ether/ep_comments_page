var eejs = require('ep_etherpad-lite/node/eejs/');
var commentManager = require('./commentManager');

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
      // console.warn("addCommentReply data", data);
      commentManager.addCommentReply(padId, data, function (err, replyId, reply){
        reply.replyId = replyId;
        socket.broadcast.to(padId).emit('pushAddCommentReply', replyId, reply);
        console.warn("Broadcast replies reply ID as ", replyId);
        callback(replyId, reply);
      });
    });

  });
};

exports.eejsBlock_dd_insert = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_comments_page/templates/menuButtons.ejs");
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
