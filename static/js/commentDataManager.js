var $ = require('ep_etherpad-lite/static/js/rjquery').$;
var _ = require('ep_etherpad-lite/static/js/underscore');

var api = require('./api');
var utils = require('./utils');
var smUtils = require('ep_script_scene_marks/static/js/utils');

var commentDataManager = function(socket) {
  this.socket = socket;
  this.comments = {};
  this.commentReplies = {};

  api.setHandleCommentEdition(this.onCommentOrReplyEdition.bind(this));

  // listen to comment changes made by other users on this pad
  var self = this;
  this.socket.on('textCommentUpdated', function (commentId, commentText) {
    self._setCommentOrReplyNewText(commentId, commentText);
  });
}

commentDataManager.prototype.getComments = function() {
  return this.comments;
}

commentDataManager.prototype.getReplies = function() {
  return this.commentReplies;
}

commentDataManager.prototype.addComments = function(comments) {
  for(var commentId in comments) {
    this.addComment(commentId, comments[commentId]);
  }
}
commentDataManager.prototype.addComment = function(commentId, comment) {
  comment.commentId     = commentId;
  comment.date          = comment.timestamp;
  comment.formattedDate = new Date(comment.timestamp).toISOString();

  // initialize obj if necessary
  this.comments[commentId] = this.comments[commentId] || {};

  // TODO can we store directly on this.comments[commentId] (without ".data")?
  this.comments[commentId].data = comment;
}

commentDataManager.prototype.addReplies = function(replies) {
  for(var replyId in replies) {
    this.addReply(replyId, replies[replyId]);
  }
}
commentDataManager.prototype.addReply = function(replyId, reply) {
  reply.replyId       = replyId;
  reply.date          = reply.timestamp;
  reply.formattedDate = new Date(reply.timestamp).toISOString();

  this.commentReplies[replyId] = reply;
}

commentDataManager.prototype.onCommentOrReplyEdition = function(commentOrReplyId, commentText) {
  var self = this;
  var data = {
    padId: clientVars.padId,
    commentId: commentOrReplyId,
    commentText: commentText,
  }

  this.socket.emit('updateCommentText', data, function(err) {
    if (!err) {
      // although the comment or reply was saved on the data base successfully, we need
      // to update our local data with the new text saved
      self._setCommentOrReplyNewText(commentOrReplyId, commentText);

      // TODO this method is doing too much. On this case we only need to send the list
      // of comments on the api, don't need to collect all comments from text
      self.updateListOfCommentsStillOnText();
    }
  });
}

commentDataManager.prototype._setCommentOrReplyNewText = function(commentOrReplyId, text) {
  var comment = this.comments[commentOrReplyId];
  var reply = this.commentReplies[commentOrReplyId];

  if (comment) {
    comment.data.text = text;
  } else if (reply) {
    reply.text = text;
  }
}

commentDataManager.prototype.refreshAllCommentData = function(callback) {
  var req = { padId: clientVars.padId };

  var self = this;
  this.socket.emit('getComments', req, function(res) {
    self.comments = {};
    self.addComments(res.comments);

    callback(res.comments);
  });
}

commentDataManager.prototype.refreshAllReplyData = function(callback) {
  var req = { padId: clientVars.padId };

  var self = this;
  this.socket.emit('getCommentReplies', req, function(res) {
    self.commentReplies = {};
    self.addReplies(res.replies);

    callback(res.replies);
  });
};

// some comments might had been removed from text, so update the list
commentDataManager.prototype.updateListOfCommentsStillOnText = function() {
  var self = this;

  var $commentsOnText = utils.getPadInner().find('.comment');
  var $scenes = utils.getPadInner().find('div.withHeading');

  // fill scene number of comments to send on API
  $commentsOnText.each(function() {
    var classCommentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec($(this).attr('class'));
    var commentId      = classCommentId && classCommentId[1];

    var $lineWithComment = $(this).closest('div');
    var commentData = self.comments[commentId].data;
    commentData.commentId = commentId;

    var $headingOfSceneWhereCommentIs;
    if ($lineWithComment.is('div.withHeading')) {
      $headingOfSceneWhereCommentIs = $lineWithComment;
    } else if (smUtils.checkIfHasSceneMark($lineWithComment)) {
      $headingOfSceneWhereCommentIs = $lineWithComment.nextUntil('div.withHeading').addBack().last().next();
    } else {
      $headingOfSceneWhereCommentIs = $lineWithComment.prevUntil('div.withHeading').addBack().first().prev();
    }

    self.comments[commentId].data.scene = 1 + $scenes.index($headingOfSceneWhereCommentIs);
  });

  // get the order of comments to send on API
  var orderedCommentIds = $commentsOnText.map(function() {
    var classCommentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec($(this).attr('class'));
    var commentId      = classCommentId && classCommentId[1];
    return commentId;
  });
  // remove null and duplicate ids (this happens when comment is split
  // into 2 parts -- by an overlapping comment, for example)
  orderedCommentIds = _(orderedCommentIds)
    .chain()
    .compact()
    .unique()
    .value();

  api.triggerDataChanged(self.comments, orderedCommentIds);
}

exports.init = function(socket) {
  return new commentDataManager(socket);
}
