var $ = require('ep_etherpad-lite/static/js/rjquery').$;
var _ = require('ep_etherpad-lite/static/js/underscore');
var padcookie = require('ep_etherpad-lite/static/js/pad_cookie').padcookie;
var browser = require('ep_etherpad-lite/static/js/browser');

var shared = require('./shared');
var commentBoxes = require('./commentBoxes');
var commentIcons = require('./commentIcons');
var newComment = require('./newComment');
var preCommentMark = require('./preCommentMark');
var commentL10n = require('./commentL10n');
var events = require('./copyPasteEvents');
var api = require('./api');
var utils = require('./utils');
var smUtils = require('ep_script_scene_marks/static/js/utils');

var getCommentIdOnFirstPositionSelected = events.getCommentIdOnFirstPositionSelected;
var hasCommentOnSelection = events.hasCommentOnSelection;

var cssFiles = [
  '//code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css',
  '//fonts.googleapis.com/css?family=Roboto:300,400', // light, regular
  'ep_comments_page/static/css/comment.css',
  'ep_comments_page/static/css/commentIcon.css',
  'ep_comments_page/static/css/commentModal.css',
  'ep_comments_page/static/css/commentModal-light.css',
  'ep_comments_page/static/css/commentModal-dark.css',
];

var UPDATE_COMMENT_LINE_POSITION_EVENT = 'updateCommentLinePosition';

/************************************************************************/
/*                         ep_comments Plugin                           */
/************************************************************************/

// Container
function ep_comments(context){
  this.container = null;
  this.padOuter  = null;
  this.padInner  = null;
  this.ace       = context.ace;

  // Required for instances running on weird ports
  // This probably needs some work for instances running on root or not on /p/
  var loc = document.location;
  var port = loc.port == "" ? (loc.protocol == "https:" ? 443 : 80) : loc.port;
  var url = loc.protocol + "//" + loc.hostname + ":" + port + "/" + "comment";
  this.socket     = io.connect(url);

  this.padId      = clientVars.padId;
  this.comments   = [];
  this.commentReplies = {};
  this.mapFakeComments = [];
  this.mapOriginalCommentsId = [];
  this.shouldCollectComment = false;
  this.init();
  this.preCommentMarker = preCommentMark.init(this.ace);
}

// Init Etherpad plugin comment pads
ep_comments.prototype.init = function(){
  var self = this;
  var ace = this.ace;

  // Init prerequisite
  this.findContainers();
  this.insertContainers(); // Insert comment containers in sidebar

  // Init icons container
  commentIcons.insertContainer();

  // Get all comments
  this.getComments(function (comments){
    if (!$.isEmptyObject(comments)){
      self.setComments(comments);
      self.collectComments();
    }
  });

  this.getCommentReplies(function (replies){
    if (!$.isEmptyObject(replies)){
      // console.log("collecting comment replies");
      self.commentReplies = replies;
      self.collectCommentReplies();
    }
    self.commentRepliesListen();
    self.commentListen();
  });

  // Init add push event
  this.pushComment('add', function (commentId, comment){
    self.setComment(commentId, comment);
    // console.log('pushComment', comment);
    self.collectCommentsAfterSomeIntervalsOfTime();
  });

  // When language is changed, we need to reload the comments to make sure
  // all templates are localized
  html10n.bind('localized', function() {
    self.localizeExistingComments();
    newComment.localizeNewCommentForm();
  });

  // When screen size changes (user changes device orientation, for example),
  // we need to make sure all sidebar comments are on the correct place
  utils.waitForResizeToFinishThenCall(200, function() {
    self.editorResized();
  });

  // Allow recalculating the comments position by event
  this.padInner.contents().on(UPDATE_COMMENT_LINE_POSITION_EVENT, function(e){
    self.editorResized();
  });

  this.padInner.contents().find("#innerdocbody").addClass("comments");
  this.addListenersToCloseOpenedComment();

  // On click comment icon toolbar
  $('.addComment').on('click', function(e){
    e.preventDefault(); // stops focus from being lost
    self.displayNewCommentForm();
  });

  // Listen for events to edit a comment
  // Here, it adds a form to edit the comment text
  this.container.parent().on("click", ".comment-edit", function(){
    var $commentBox = $(this).closest('note');

    // hide the option window when it show the edit form
    var $commentOptions = $commentBox.children('.comment-options'); // edit, delete actions
    $commentOptions.addClass('hidden');
    $commentBox.children('.comment-options-button').removeClass('comment-options-selected');

    // hide the comment author name and the comment text
    $commentBox.children('.comment-author-name, .comment-text').addClass('hidden');
    self.addCommentEditFormIfDontExist($commentBox);

    // place original text on the edit form
    var originalText = $commentBox.children('.comment-text').text();
    $commentBox.find('.comment-edit-text').text(originalText);
  });

  // submit the edition on the text and update the comment text
  this.container.parent().on("click", ".comment-edit-submit", function(e){
    e.preventDefault();
    e.stopPropagation();
    var $commentBox = $(this).closest('note');
    var commentId = $commentBox.data('commentid');
    var commentText = $commentBox.find('.comment-edit-text')[0].value;
    var data = {};
    data.commentId = commentId;
    data.padId = clientVars.padId;
    data.commentText = commentText;

    self.socket.emit('updateCommentText', data, function (err){
      if(!err) {
        $commentBox.children('.comment-edit-form').remove();
        $commentBox.children('.comment-author-name, .comment-text').removeClass('hidden');
        self.updateCommentBoxText(commentId, commentText);

        // although the comment or reply was saved on the data base successfully, it needs
        // to update the comment or comment reply variable with the new text saved
        self.setCommentOrReplyNewText(commentId, commentText);
      }
    });
  });

  this.container.parent().on("click", ".comment-options-button", function(){ // three dots button
    // if it exists any other comment option window open, hide them
    var $padOuter = $('iframe[name="ace_outer"]').contents();
    var $thisCommentOption = $(this).siblings('.comment-options');
    $padOuter.find('.comment-options').not($thisCommentOption).addClass('hidden');

    // unselect any other three dots selected
    $thisThreeDotsClicked = $(this);
    $padOuter.find('.comment-options-button').not($thisThreeDotsClicked).removeClass('comment-options-selected');

    $(this).siblings('.comment-options').toggleClass('hidden');
    var threeDotsButtonIsSelected = $(this).siblings('.comment-options').hasClass('hidden') === false;
    $(this).toggleClass('comment-options-selected', threeDotsButtonIsSelected);
  });

  // hide the edit form and make the comment author and text visible again
  this.container.parent().on("click", ".comment-edit-cancel", function(e){
    e.preventDefault();
    e.stopPropagation();
    var $commentBox = $(this).closest('note');
    $commentBox.children('.comment-edit-form').remove();
    $commentBox.children('.comment-author-name, .comment-text').removeClass('hidden');
  });

  this.container.parent().on("mouseleave", ".comment-options-wrapper", function(){
    var $padOuter = $('iframe[name="ace_outer"]').contents();
    $padOuter.find('.comment-options-button').removeClass('comment-options-selected');
    $padOuter.find('.comment-options').addClass('hidden');
  });

  // is this even used? - Yes, it is!
  this.container.on("submit", ".comment-reply", function(e){
    e.preventDefault();
    var data = self.getCommentData();
    data.commentId = $(this).parent().data('commentid');
    data.reply = $(this).find(".comment-reply-input").val();
    self.socket.emit('addCommentReply', data, function (){
      // Append the reply to the comment
      // console.warn("addCommentReplyEmit WE EXPECT REPLY ID", data);
      $('iframe[name="ace_outer"]').contents().find('#'+data.commentId + ' > form.comment-reply  .comment-reply-input').val("");
      self.getCommentReplies(function(replies){
        self.commentReplies = replies;
        self.collectCommentReplies();
      });
    });
  });

  // Enable and handle cookies
  if (padcookie.getPref("comments") === false) {
    self.container.removeClass("active");
    $('#options-comments').attr('checked','unchecked');
    $('#options-comments').attr('checked',false);
  }else{
    $('#options-comments').attr('checked','checked');
  }

  $('#options-comments').on('click', function() {
    if($('#options-comments').is(':checked')) {
      padcookie.setPref("comments", true);
      self.container.addClass("active");
    } else {
      padcookie.setPref("comments", false);
      self.container.removeClass("active");
    }
  });

  // Check to see if we should show already..
  if($('#options-comments').is(':checked')){
    self.container.addClass("active");
  }

  // TODO - Implement to others browser like, Microsoft Edge, Opera, IE
  // Override  copy, cut, paste events on Google chrome and Mozilla Firefox.
  // When an user copies a comment and selects only the span, or part of it, Google chrome
  // does not copy the classes only the styles, for example:
  // <comment class='comment'><span>text to be copied</span></comment>
  // As the comment classes are not only used for styling we have to add these classes when it pastes the content
  // The same does not occur when the user selects more than the span, for example:
  // text<comment class='comment'><span>to be copied</span></comment>
  if(browser.chrome || browser.firefox){
    self.padInner.contents().on("copy", function(e) {
      events.addTextOnClipboard(e, self.ace, self.padInner, false, self.comments, self.commentReplies);
    });

    self.padInner.contents().on("cut", function(e) {
      events.addTextOnClipboard(e, self.ace, self.padInner, true);
    });

    self.padInner.contents().on("paste", function(e) {
      events.saveCommentsAndReplies(e);
    });
  }
};

// This function is useful to collect new comments on the collaborators
ep_comments.prototype.collectCommentsAfterSomeIntervalsOfTime = function() {
  var self = this;
  window.setTimeout(function() {
    self.collectComments();

    var count_comments=0;
    for(var key in self.comments)  {count_comments++;}
    var padOuter = $('iframe[name="ace_outer"]').contents();
    this.padOuter = padOuter;
    this.padInner = padOuter.find('iframe[name="ace_inner"]');
    var padComment  = this.padInner.contents().find('.comment');
    if( count_comments > padComment.length ) {
       window.setTimeout(function() {
          self.collectComments();
          var count_comments=0;
          for(var key in self.comments)  {count_comments++;}
          var padComment  = this.padInner.contents().find('.comment');
          if( count_comments > padComment.length ) {
             window.setTimeout(function() {
                self.collectComments();
                var count_comments=0;
                for(var key in self.comments)  {count_comments++;}
                var padComment  = this.padInner.contents().find('.comment');
                if( count_comments > padComment.length ) {
                   window.setTimeout(function() {
                      self.collectComments();

                    }, 9000);
                }
              }, 3000);
          }
        }, 1000);
    }
  }, 300);
}

ep_comments.prototype.addCommentEditFormIfDontExist = function ($commentBox) {
  var hasEditForm = $commentBox.children(".comment-edit-form").length;
  if (!hasEditForm) {
    // get text from comment
    var commentTextValue = $commentBox.find('.comment-text').text();

    // add a form to edit the field
    var data = {};
    data.text = commentTextValue;
    var content = $("#editCommentTemplate").tmpl(data);

    // localize the comment/reply edit form
    commentL10n.localize(content);

    // insert form
    $commentBox.children(".comment-text").after(content);
  }
}

// Insert comments container on element use for linenumbers
ep_comments.prototype.findContainers = function(){
  var padOuter = $('iframe[name="ace_outer"]').contents();
  this.padOuter = padOuter;
  this.padInner = padOuter.find('iframe[name="ace_inner"]');
  this.outerBody = padOuter.find('#outerdocbody');
};

// Collect Comments and link text content to the comments div
ep_comments.prototype.collectComments = function(callback){
  var self = this;
  var $commentsOnText = this.padInner.contents().find('.comment');

  // TODO organize this code when we're done removing stuff from plugin:

  // place icons + fill scene number of comments to send on API
  var $scenes = this.padInner.contents().find('div.withHeading');
  $commentsOnText.each(function() {
    var classCommentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec($(this).attr('class'));
    var commentId      = classCommentId && classCommentId[1];

    var $lineWithComment = $(this).closest('div');
    var commentData = self.comments[commentId].data;
    commentData.commentId = commentId;
    commentIcons.addIcon(commentData);

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

  self.setYofComments();
  if(callback) callback();
};

ep_comments.prototype.addListenersToCloseOpenedComment = function() {
  var self = this;

  // we need to add listeners to the different iframes of the page
  $(document).on("touchstart", function(e){
    self.closeOpenedCommentIfNotOnSelectedElements(e);
  });
  this.padOuter.find('html').on("touchstart", function(e){
    self.closeOpenedCommentIfNotOnSelectedElements(e);
  });
  this.padInner.contents().find('html').on("touchstart", function(e){
    self.closeOpenedCommentIfNotOnSelectedElements(e);
  });
}

// Close comment that is opened
ep_comments.prototype.closeOpenedComment = function(e) {
  var commentId = this.commentIdOf(e);
  commentBoxes.hideComment(commentId);
}

// Close comment if event target was outside of comment or on a comment icon
ep_comments.prototype.closeOpenedCommentIfNotOnSelectedElements = function(e) {
  // Don't do anything if clicked on the allowed elements:
  if (commentIcons.shouldNotCloseComment(e) // any of the comment icons
    || commentBoxes.shouldNotCloseComment(e)) { // a comment box or the comment modal
    return;
  }

  // All clear, can close the comment
  this.closeOpenedComment(e);
}

// Collect Comments and link text content to the comments div
ep_comments.prototype.collectCommentReplies = function(callback){
  var self        = this;
  var container   = this.container;
  var commentReplies = this.commentReplies;
  var padComment  = this.padInner.contents().find('.comment');
  $.each(this.commentReplies, function(replyId, reply){
    var commentId = reply.commentId;
    // tell comment icon that this comment has 1+ replies
    commentIcons.commentHasReply(commentId);

    var existsAlready = $('iframe[name="ace_outer"]').contents().find('#'+replyId).length;
    if(existsAlready){
        return;
    }

    reply.replyId = replyId;
    reply.formattedDate = new Date(reply.timestamp).toISOString();

    var content = $("#replyTemplate").tmpl(reply);
    // localize comment reply
    commentL10n.localize(content);
    $('iframe[name="ace_outer"]').contents().find('#'+commentId + ' .comment-reply-input-label').before(content);
  });
};

ep_comments.prototype.commentIdOf = function(e){
  var cls             = e.currentTarget.classList;
  var classCommentId  = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);

  return (classCommentId) ? classCommentId[1] : null;
};

// Insert comment container in sidebar
ep_comments.prototype.insertContainers = function(){
  var target = $('iframe[name="ace_outer"]').contents().find("#outerdocbody");

  // Add comments
  target.prepend('<div id="comments"></div>');
  this.container = this.padOuter.find('#comments');

  // Add newComments
  newComment.insertContainers(target);
};

// Set all comment icons to be aligned with their commented text
ep_comments.prototype.setYofComments = function(){
  // hide comment icons while their position is being updated
  commentIcons.hideIcons();

  var inlineComments = this.getFirstOcurrenceOfCommentIds();
  $.each(inlineComments, function(){
    var topOfCommentedText = this.offsetTop;
    var commentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(this.className);
    if(commentId) {
      commentIcons.adjustTopOf(commentId[1], topOfCommentedText);
    }
  });
};

ep_comments.prototype.getFirstOcurrenceOfCommentIds = function(){
  var padOuter = $('iframe[name="ace_outer"]').contents();
  var padInner = padOuter.find('iframe[name="ace_inner"]').contents();
  var commentsId = this.getUniqueCommentsId(padInner);
  var firstOcurrenceOfCommentIds = _.map(commentsId, function(commentId){
   return padInner.find("." + commentId).first().get(0);
  });
  return firstOcurrenceOfCommentIds;
 }

ep_comments.prototype.getUniqueCommentsId = function(padInner){
  var inlineComments = padInner.find(".comment");
  var commentsId = _.map(inlineComments, function(inlineComment){
   var commentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(inlineComment.className);
   // avoid when it has a '.comment' that it has a fakeComment class 'fakecomment-123' yet.
   if(commentId) return commentId[1];
  });
  return _.uniq(commentsId);
}

// Make the adjustments after editor is resized (due to a window resize or
// enabling/disabling Page View)
ep_comments.prototype.editorResized = function() {
  var self = this;

  commentIcons.adjustIconsForNewScreenSize();

  // We try increasing timeouts, to make sure user gets the response as fast as we can
  setTimeout(function() {
    if (!self.allCommentsOnCorrectYPosition()) self.adjustCommentPositions();
    setTimeout(function() {
      if (!self.allCommentsOnCorrectYPosition()) self.adjustCommentPositions();
      setTimeout(function() {
        if (!self.allCommentsOnCorrectYPosition()) self.adjustCommentPositions();
      }, 1000);
    }, 500);
  }, 250);
}

// Adjusts position on the screen for sidebar comments and comment icons
ep_comments.prototype.adjustCommentPositions = function(){
  commentIcons.adjustIconsForNewScreenSize();
  this.setYofComments();
}

// Indicates if all comments are on the correct Y position, and don't need to
// be adjusted
ep_comments.prototype.allCommentsOnCorrectYPosition = function(){
  // for each comment in the pad
  var padOuter = $('iframe[name="ace_outer"]').contents();
  var padInner = padOuter.find('iframe[name="ace_inner"]');
  var inlineComments = padInner.contents().find(".comment");
  var allCommentsAreCorrect = true;

  $.each(inlineComments, function(){
    var y = this.offsetTop;
    var commentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(this.className);
    if(commentId) {
      if (!commentBoxes.isOnTop(commentId[1], y)) { // found one comment on the incorrect place
        allCommentsAreCorrect = false;
        return false; // to break loop
      }
    }
  });

  return allCommentsAreCorrect;
}

ep_comments.prototype.localizeExistingComments = function() {
  var self        = this;
  var padComments = this.padInner.contents().find('.comment');
  var comments    = this.comments;

  padComments.each(function(it) {
    var $this           = $(this);
    var cls             = $this.attr('class');
    var classCommentId  = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
    var commentId       = (classCommentId) ? classCommentId[1] : null;

    if (commentId !== null) {
      var commentElm  = self.container.find('#'+ commentId);
      var comment     = comments[commentId];

      // localize comment element
      commentL10n.localize(commentElm);
    }
  });
};

// Set comments content data
ep_comments.prototype.setComments = function(comments){
  for(var commentId in comments){
    this.setComment(commentId, comments[commentId]);
  }
};

// Set comment data
ep_comments.prototype.setComment = function(commentId, comment){
  var comments = this.comments;
  comment.date = comment.timestamp;
  comment.formattedDate = new Date(comment.timestamp).toISOString();

  if (comments[commentId] == null) comments[commentId] = {};
  comments[commentId].data = comment;

};

// commentReply = ['c-reply-123', commentDataObject]
// commentDataObject = {author:..., name:..., text:..., ...}
ep_comments.prototype.setCommentReply = function(commentReply){
  var commentReplies = this.commentReplies;
  var replyId = commentReply[0];
  commentReplies[replyId] = commentReply[1];
};

// set the text of the comment or comment reply
ep_comments.prototype.setCommentOrReplyNewText = function(commentOrReplyId, text){
  if(this.comments[commentOrReplyId]){
    this.comments[commentOrReplyId].data.text = text;
  }else if(this.commentReplies[commentOrReplyId]){
    this.commentReplies[commentOrReplyId].text = text;
  }
};

// Get all comments
ep_comments.prototype.getComments = function (callback){
  var req = { padId: this.padId };

  this.socket.emit('getComments', req, function (res){
    callback(res.comments);
  });
};

// Get all comment replies
ep_comments.prototype.getCommentReplies = function (callback){
  var req = { padId: this.padId };
  this.socket.emit('getCommentReplies', req, function (res){
    // console.log("res.replies", res.replies);
    callback(res.replies);
  });
};

ep_comments.prototype.getCommentData = function (){
  var data = {};

  // Insert comment data
  data.padId              = this.padId;
  data.comment            = {};
  data.comment.author     = clientVars.userId;
  data.comment.name       = pad.myUserInfo.name;
  data.comment.timestamp  = new Date().getTime();

  // If client is anonymous
  if(data.comment.name === undefined){
    data.comment.name = clientVars.userAgent;
  }

  return data;
}

ep_comments.prototype.displayNewCommentForm = function() {
  var rep = {};
  var hasSelectedText = false;
  var ace = this.ace;

  ace.callWithAce(function(ace) {
    var saveRep = ace.ace_getRep();

    rep.lines    = saveRep.lines;
    rep.selStart = saveRep.selStart;
    rep.selEnd   = saveRep.selEnd;

    hasSelectedText = !ace.ace_isCaret();
  },'saveCommentedSelection', true);

  // do nothing if we have nothing selected
  if (hasSelectedText) {
    this.showNewCommentForm(rep);
  }
}

// Create form to add comment
ep_comments.prototype.showNewCommentForm = function(rep) {
  var data = this.getCommentData();
  var self = this;

  newComment.showNewCommentForm(data, function(comment, index) {
    data.comment.text = comment.text;
    self.saveComment(data, rep);
  });
};

// Save comment
ep_comments.prototype.saveComment = function(data, rep) {
  var self = this;
  self.socket.emit('addComment', data, function (commentId, comment){
    comment.commentId = commentId;

    self.ace.callWithAce(function (ace){
      // console.log('addComment :: ', commentId);
      ace.ace_performSelectionChange(rep.selStart, rep.selEnd, true);
      ace.ace_setAttributeOnSelection('comment', commentId);
    },'saveComment', true);

    self.setComment(commentId, comment);
    self.collectComments();
  });
}

// commentData = {c-newCommentId123: data:{author:..., date:..., ...}, c-newCommentId124: data:{...}}
ep_comments.prototype.saveCommentWithoutSelection = function (padId, commentData) {
  var self = this;
  var data = self.buildComments(commentData);
  self.socket.emit('bulkAddComment', padId, data, function (comments){
    self.setComments(comments);
    self.shouldCollectComment = true
  });
}

ep_comments.prototype.buildComments = function(commentsData){
  var self = this;
  var comments = _.map(commentsData, function(commentData, commentId){
    return self.buildComment(commentId, commentData.data);
  });
  return comments;
}

// commentData = {c-newCommentId123: data:{author:..., date:..., ...}, ...
ep_comments.prototype.buildComment = function(commentId, commentData){
  var data = {};
  data.padId = this.padId;
  data.commentId = commentId;
  data.text = commentData.text;
  data.name = commentData.name;
  data.timestamp = parseInt(commentData.timestamp);

  return data;
}

ep_comments.prototype.getMapfakeComments = function(){
  return this.mapFakeComments;
}

// commentReplyData = {c-reply-123:{commentReplyData1}, c-reply-234:{commentReplyData1}, ...}
ep_comments.prototype.saveCommentReplies = function(padId, commentReplyData){
  var self = this;
  var data = self.buildCommentReplies(commentReplyData);
  self.socket.emit('bulkAddCommentReplies', padId, data, function (replies){
    _.each(replies,function(reply){
      self.setCommentReply(reply);
    });
    self.shouldCollectComment = true; // force collect the comment replies saved
  });
}

ep_comments.prototype.buildCommentReplies = function(repliesData){
  var self = this;
  var replies = _.map(repliesData, function(replyData){
    return self.buildCommentReply(replyData);
  });
  return replies;
}

// take a replyData and add more fields necessary. E.g. 'padId'
ep_comments.prototype.buildCommentReply = function(replyData){
  var data = {};
  data.padId = this.padId;
  data.commentId = replyData.commentId;
  data.text = replyData.text;
  data.replyId = replyData.replyId;
  data.name = replyData.name;
  data.timestamp = parseInt(replyData.timestamp);

  return data;
}

// Listen for comment
ep_comments.prototype.commentListen = function(){
  var self = this;
  var socket = this.socket;
  socket.on('pushAddCommentInBulk', function (){
    self.getComments(function (allComments){
      if (!$.isEmptyObject(allComments)){
        // we get the comments in this format {c-123:{author:...}, c-124:{author:...}}
        // but it's expected to be {c-123: {data: {author:...}}, c-124:{data:{author:...}}}
        // in this.comments
        var commentsProcessed = {};
        _.map(allComments, function (comment, commentId) {
          commentsProcessed[commentId] = {}
          commentsProcessed[commentId].data = comment;
        });
        self.comments = commentsProcessed;
        self.collectCommentsAfterSomeIntervalsOfTime(); // here we collect on the collaborators
      }
    });
  });
};

// Listen for comment replies
ep_comments.prototype.commentRepliesListen = function(){
  var self = this;
  var socket = this.socket;
  socket.on('pushAddCommentReply', function (replyId, reply){
    self.getCommentReplies(function (replies){
      if (!$.isEmptyObject(replies)){
        self.commentReplies = replies;
        self.collectCommentReplies();
      }
    });
  });

};

ep_comments.prototype.updateCommentBoxText = function (commentId, commentText) {
  var $comment = this.container.parent().find("[data-commentid='" + commentId + "']");
  $comment.children('.comment-text').text(commentText)
}

// Push comment from collaborators
ep_comments.prototype.pushComment = function(eventType, callback){
  var socket = this.socket;
  var self = this;

  socket.on('textCommentUpdated', function (commentId, commentText) {
    self.updateCommentBoxText(commentId, commentText);
  })

  // On collaborator add a comment in the current pad
  if (eventType == 'add'){
    socket.on('pushAddComment', function (commentId, comment){
      callback(commentId, comment);
    });
  }

  // On collaborator delete a comment in the current pad
  else if (eventType == 'remove'){
    socket.on('pushRemoveComment', function (commentId){
      callback(commentId);
    });
  }

  // On reply
  else if (eventType == "addCommentReply"){
    socket.on('pushAddCommentReply', function (replyId, reply){
      callback(replyId, reply);
    });
  }
};

/************************************************************************/
/*                           Etherpad Hooks                             */
/************************************************************************/

var hooks = {

  // Init pad comments
  postAceInit: function(hook, context){
    if(!pad.plugins) pad.plugins = {};
    var Comments = new ep_comments(context);
    pad.plugins.ep_comments_page = Comments;

    api.initialize(context.ace);
  },

  aceEditEvent: function(hook, context){
    // first check if some text is being marked/unmarked to add comment to it
    var eventType = context.callstack.editEvent.eventType;
    if(eventType === "unmarkPreSelectedTextToComment") {
      pad.plugins.ep_comments_page.preCommentMarker.handleUnmarkText(context);
    } else if(eventType === "markPreSelectedTextToComment") {
      pad.plugins.ep_comments_page.preCommentMarker.handleMarkText(context);
    }

    // var padOuter = $('iframe[name="ace_outer"]').contents();
    // padOuter.find('#sidediv').removeClass("sidedivhidden"); // TEMPORARY to do removing authorship colors can add sidedivhidden class to sidesiv!
    if(eventType == "setup" || eventType == "setBaseText" || eventType == "importText") return;
    if(context.callstack.docTextChanged) pad.plugins.ep_comments_page.setYofComments();
    var commentWasPasted = pad.plugins && pad.plugins.ep_comments_page.shouldCollectComment;
    var domClean = context.callstack.domClean;
    // we have to wait the DOM update from a fakeComment 'fakecomment-123' to a comment class 'c-123'
    if(commentWasPasted && domClean){
      pad.plugins.ep_comments_page.collectComments(function(){
        pad.plugins.ep_comments_page.collectCommentReplies();
        pad.plugins.ep_comments_page.shouldCollectComment = false;
      });
    }
  },

  // Insert comments classes
  aceAttribsToClasses: function(hook, context){
    if(context.key === 'comment' && context.value !== "comment-deleted") {
      return ['comment', context.value];
    }
    // only read marks made by current user
    if(context.key === preCommentMark.MARK_CLASS && context.value === clientVars.userId) {
      return [preCommentMark.MARK_CLASS, context.value];
    }
  },

  aceEditorCSS: function(){
    return cssFiles;
  }

};

exports.aceEditorCSS          = hooks.aceEditorCSS;
exports.postAceInit           = hooks.postAceInit;
exports.aceAttribsToClasses   = hooks.aceAttribsToClasses;
exports.aceEditEvent          = hooks.aceEditEvent;

// Given a CSS selector and a target element (in this case pad inner)
// return the rep as an array of array of tuples IE [[[0,1],[0,2]], [[1,3],[1,5]]]
// We have to return an array of a array of tuples because there can be multiple reps
// For a given selector
// A more sane data structure might be an object such as..
/*
0:{
  xStart: 0,
  xEnd: 1,
  yStart: 0,
  yEnd: 1
},
1:...
*/
// Alas we follow the Etherpad convention of using tuples here.
function getRepFromSelector(selector) {
  var attributeManager = this.documentAttributeManager;
  var $padOuter = $('iframe[name="ace_outer"]').contents();
  var $padInner = $padOuter.find('iframe[name="ace_inner"]').contents();

  var repArr = [];

  // first find the element
  var elements = $padInner.find(selector);
  // One might expect this to be a rep for the entire document
  // However what we actually need to do is find each selection that includes
  // this comment and remove it.  This is because content can be pasted
  // Mid comment which would mean a remove selection could have unexpected consequences

  $.each(elements, function(index, span){
    // create a rep array container we can push to..
    var rep = [[],[]];

    // span not be the div so we have to go to parents until we find a div
    var parentDiv = $(span).closest("div");
    // line Number is obviously relative to entire document
    // So find out how many elements before in this parent?
    var lineNumber = $(parentDiv).prevAll("div").length;
    // We can set beginning of rep Y (lineNumber)
    rep[0][0] = lineNumber;

    // We can also update the end rep Y
    rep[1][0] = lineNumber;

    // Given the comment span, how many characters are before it?

    // All we need to know is the number of characters before .foo
    /*

    <div id="boo">
      hello
      <span class='nope'>
        world
      </span>
      are you
      <span class='foo'>
        here?
      </span>
    </div>

    */
    // In the example before the correct number would be 21
    // I guess we could do prevAll each length?
    // If there are no spans before we get 0, simples!
    // Note that this only works if spans are being used, which imho
    // Is the correct container however if block elements are registered
    // It's plausable that attributes are not maintained :(
    var leftOffset = 0;

    // If the line has a lineAttribute then leftOffset should be +1
    // Get each line Attribute on this line..
    var hasLineAttribute = false;
    var attrArr = attributeManager.getAttributesOnLine(lineNumber);
    $.each(attrArr, function(attrK, value){
      if(value[0] === "lmkr") hasLineAttribute = true;
    });
    if(hasLineAttribute) leftOffset++;

    $(span).prevAll("span").each(function(){
      var spanOffset = $(this).text().length;
      leftOffset += spanOffset;
    });
    rep[0][1] = leftOffset;

    // All we need to know is span text length and it's left offset in chars
    var spanLength = $(span).text().length;

    rep[1][1] = rep[0][1] + $(span).text().length; // Easy!
    repArr.push(rep);
  });
  return repArr;
}
// Once ace is initialized, we set ace_doInsertHeading and bind it to the context
exports.aceInitialized = function(hook, context){
  var editorInfo = context.editorInfo;
  editorInfo.ace_getRepFromSelector = _(getRepFromSelector).bind(context);
  editorInfo.ace_getCommentIdOnFirstPositionSelected = _(getCommentIdOnFirstPositionSelected).bind(context);
  editorInfo.ace_hasCommentOnSelection = _(hasCommentOnSelection).bind(context);
}
