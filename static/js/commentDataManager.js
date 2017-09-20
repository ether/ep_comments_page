var $ = require('ep_etherpad-lite/static/js/rjquery').$;
var _ = require('ep_etherpad-lite/static/js/underscore');

var linesChangedListener = require('./linesChangedListener');
var api = require('./api');
var utils = require('./utils');
var smUtils = require('ep_script_scene_marks/static/js/utils');

var commentDataManager = function(socket) {
  this.socket = socket;
  this.comments = {};

  linesChangedListener.onLineChanged('.comment, heading', this.triggerDataChanged.bind(this));

  api.setHandleCommentEdition(this._onCommentEdition.bind(this));
  api.setHandleReplyEdition(this._onReplyEdition.bind(this));

  // listen to comment or reply changes made by other users on this pad
  var self = this;
  this.socket.on('textCommentUpdated', function (commentId, commentText) {
    self._setCommentOrReplyNewText(commentId, commentText);
  });
}

commentDataManager.prototype.getComments = function() {
  return this.comments;
}

commentDataManager.prototype.getRepliesOfComment = function(commentId) {
  return this.comments[commentId].replies;
}

commentDataManager.prototype.addComments = function(comments) {
  for(var commentId in comments) {
    this.addComment(commentId, comments[commentId]);
  }
}
commentDataManager.prototype.addComment = function(commentId, commentData) {
  commentData.commentId     = commentId;
  commentData.date          = commentData.timestamp;
  commentData.formattedDate = new Date(commentData.timestamp).toISOString();
  commentData.replies       = {};

  this.comments[commentId] = commentData;
}

commentDataManager.prototype.addReplies = function(replies) {
  for(var replyId in replies) {
    this.addReplyWithoutTriggeringDataChangedEvent(replyId, replies[replyId]);
  }
}

commentDataManager.prototype.addReplyWithoutTriggeringDataChangedEvent = function(replyId, replyData) {
  this.addReply(replyId, replyData, true);
}

commentDataManager.prototype.addReply = function(replyId, replyData, doNotTriggerDataChanged) {
  replyData.replyId       = replyId;
  replyData.date          = replyData.timestamp;
  replyData.formattedDate = new Date(replyData.timestamp).toISOString();

  var commentOfReply = this.comments[replyData.commentId];

  // precaution, if for any reason the comment was removed but the reply wasn't
  if (commentOfReply && commentOfReply.replies) {
    commentOfReply.replies[replyId] = replyData;
  }

  if (!doNotTriggerDataChanged) {
    this.triggerDataChanged();
  }
}

commentDataManager.prototype._onCommentEdition = function(commentId, commentText) {
  var self = this;
  var data = {
    padId: clientVars.padId,
    commentId: commentId,
    commentText: commentText,
  }

  this.socket.emit('updateCommentText', data, function(err) {
    if (!err) {
      // although the comment was saved on the data base successfully, we need
      // to update our local data with the new text saved
      var comment = self.comments[commentId];
      comment.text = commentText;

      self.triggerDataChanged();
    }
  });
}

commentDataManager.prototype._onReplyEdition = function(commentId, replyId, replyText) {
  var self = this;
  var data = {
    padId: clientVars.padId,
    commentId: replyId,
    commentText: replyText,
  }

  this.socket.emit('updateCommentText', data, function(err) {
    if (!err) {
      // although the reply was saved on the data base successfully, we need
      // to update our local data with the new text saved
      var reply = self.comments[commentId].replies[replyId];
      reply.text = replyText;

      self.triggerDataChanged();
    }
  });
}

commentDataManager.prototype._setCommentOrReplyNewText = function(commentOrReplyId, text) {
  var comment = this.comments[commentOrReplyId];
  if (comment) {
    comment.text = text;
  } else {
    // TODO receive commentId, so we don't need to look for the reply on each comment
    var flattenReplies = utils.getRepliesIndexedByReplyId(this.comments);
    var commentId = flattenReplies[commentOrReplyId].commentId;

    var reply = this.comments[commentId].replies[commentOrReplyId];
    reply.text = text;
  }

  this.triggerDataChanged();
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
  this._resetRepliesOnComments();

  var req = { padId: clientVars.padId };
  var self = this;
  this.socket.emit('getCommentReplies', req, function(res) {
    self.addReplies(res.replies);

    if (callback) callback(res.replies);
  });
}

commentDataManager.prototype._resetRepliesOnComments = function() {
  _(this.comments).each(function(comment, commentId) {
    comment.replies = {};
  });
}

commentDataManager.prototype.triggerDataChanged = function() {
  // TODO this method is doing too much. On this case we only need to send the list
  // of comments on the api, don't need to collect all comments from text
  this.updateListOfCommentsStillOnText();
}

commentDataManager.prototype._getHeadingOfLine = function($lineWithComment) {
  if ($lineWithComment.is('div.withHeading')) {
    return $lineWithComment;
  } else if (smUtils.checkIfHasSceneMark($lineWithComment)) {
    return $lineWithComment.nextUntil('div.withHeading').addBack().last().next();
  } else {
    return $lineWithComment.prevUntil('div.withHeading').addBack().first().prev();
  }
}
// some comments might had been removed from text, so update the list
commentDataManager.prototype.updateListOfCommentsStillOnText = function() {
  // TODO can we store the data that we're processing here, so we don't need to redo
  // the processing for the data we had already built?

  var self = this;
  var commentIdRegex = /(?:^| )(c-[A-Za-z0-9]*)/;
  var replyIdRegex = /(?:^| )(cr-[A-Za-z0-9]*)/;

  var $commentsOnText = utils.getPadInner().find('.comment');
  var $scenes = utils.getPadInner().find('div.withHeading');

  // get the order of comments to send on API + grab data from script to be used
  // to fill comment & reply data later
  var orderedComments = $commentsOnText.map(function() {
    var classCommentId = commentIdRegex.exec($(this).attr('class'));
    var commentId      = classCommentId && classCommentId[1];

    // ignore comments without a valid id -- maybe comment was deleted?
    return commentId && {
      commentId: commentId,
      element: this,
    };
  });

  // remove null and duplicate ids (this happens when comment is split
  // into 2 parts -- by an overlapping comment, for example)
  orderedComments = _(orderedComments)
    .chain()
    .compact()
    .unique('commentId')
    .value();

  var commentsToSend = _(orderedComments).map(function(commentInfo) {
    // create a copy of each comment, so we can change it without messing up
    // with self.comments
    var commentData = Object.assign({}, self.comments[commentInfo.commentId]);

    // fill scene number
    var $lineWithComment = $(commentInfo.element).closest('div');
    var $headingOfSceneWhereCommentIs = self._getHeadingOfLine($lineWithComment);
    var sceneNumberOfComment = 1 + $scenes.index($headingOfSceneWhereCommentIs);
    commentData.scene = sceneNumberOfComment;

    // remove replies that are not on text anymore
    var commentReplyIds = _(commentInfo.element.classList).filter(function(className) {
      return replyIdRegex.test(className);
    });

    // sort replies by date. Note: this needs to be done because DELETE/UNDO messes
    // up with the order of the replies on text class
    var sortedReplyIds = _(commentReplyIds).sortBy(function(replyId) {
      return commentData.replies[replyId].timestamp;
    });
    commentData.replies = _(commentData.replies).pick(sortedReplyIds);

    return commentData;
  });

  api.triggerDataChanged(commentsToSend);
}

exports.init = function(socket) {
  return new commentDataManager(socket);
}
