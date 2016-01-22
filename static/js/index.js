/* TODO:
- lable reply textarea
- Make the chekbox appear above the suggested changes even when activated
*/


var _, $, jQuery;

var $ = require('ep_etherpad-lite/static/js/rjquery').$;
var _ = require('ep_etherpad-lite/static/js/underscore');
var padcookie = require('ep_etherpad-lite/static/js/pad_cookie').padcookie;
var prettyDate = require('ep_comments_page/static/js/timeFormat').prettyDate;
var commentBoxes = require('ep_comments_page/static/js/commentBoxes');
var commentIcons = require('ep_comments_page/static/js/commentIcons');
var newComment = require('ep_comments_page/static/js/newComment');
var preCommentMark = require('ep_comments_page/static/js/preCommentMark');
var commentL10n = require('ep_comments_page/static/js/commentL10n');
var events = require('ep_comments_page/static/js/copyPasteEvents');
var getCommentIdOnSelection = events.getCommentIdOnSelection;
var browser = require('ep_etherpad-lite/static/js/browser');


var cssFiles = ['ep_comments_page/static/css/comment.css', 'ep_comments_page/static/css/commentIcon.css'];

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
  this.init();
  this.preCommentMarker = preCommentMark.init(this.ace);

  // If we're on a read only pad then hide the ability to attempt to merge a suggestion
  if(clientVars.readonly){
    this.padInner.append(
        "<style>.comment-changeTo-approve," +
               ".comment-reply-changeTo-approve{display:none;}</style>");
  }
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
      self.commentRepliesListen();
    }
  });

  // Init add push event
  this.pushComment('add', function (commentId, comment){
    self.setComment(commentId, comment);
    // console.log('pushComment', comment);
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
  });

  // When language is changed, we need to reload the comments to make sure
  // all templates are localized
  html10n.bind('localized', function() {
    self.localizeExistingComments();
    newComment.localizeNewCommentForm();
  });

  // When screen size changes (user changes device orientation, for example),
  // we need to make sure all sidebar comments are on the correct place
  newComment.waitForResizeToFinishThenCall(200, function() {
    self.editorResized();
  });

  // When Page View is enabled/disabled, we need to recalculate position of comments
  $('#options-pageview').on('click', function(e) {
    self.editorResized();
  });
  // When Page Breaks are enabled/disabled, we need to recalculate position of comments
  $('#options-pagebreaks').on('click', function(e) {
    self.editorResized();
  });

  // On click comment icon toolbar
  $('.addComment').on('click', function(e){
    e.preventDefault(); // stops focus from being lost
    self.displayNewCommentForm();
  });

  // Listen for events to delete a comment
  // All this does is remove the comment attr on the selection
  this.container.on("click", ".comment-delete", function(){
    var commentId = $(this).parent().parent()[0].id;
    self.deleteComment(commentId);
  })

  // Listen for include suggested change toggle
  this.container.on("change", '.reply-suggestion-checkbox', function(){
    if($(this).is(':checked')){
      var commentId = $(this).parent().parent().parent()[0].id;
      var padOuter = $('iframe[name="ace_outer"]').contents();
      var padInner = padOuter.find('iframe[name="ace_inner"]');

      var currentString = padInner.contents().find("."+commentId).html();
      $(this).parent().parent().find(".reply-comment-changeFrom-value").html(currentString);
      $(this).parent().parent().find('.reply-suggestion').addClass("active");
    }else{
      $(this).parent().parent().find('.reply-suggestion').removeClass("active");
    }
  });


  // Create hover modal
  $('iframe[name="ace_outer"]').contents().find("body")
    .append("<div class='comment-modal'><p class='comment-modal-name'></p><p class='comment-modal-comment'></p></div>");

  // DUPLICATE CODE REQUIRED FOR COMMENT REPLIES, see below for slightly different version
  this.container.on("click", ".comment-reply-changeTo-approve > input", function(e){
    e.preventDefault();
    var data = {};
    data.commentId = $(this).parent().parent().parent().parent().parent()[0].id;
    data.padId = clientVars.padId;

    data.replyId = $(this).parent().parent().parent()[0].id;
    var padOuter = $('iframe[name="ace_outer"]').contents();
    var padInner = padOuter.find('iframe[name="ace_inner"]');

    // Are we reverting a change?
    var submitButton = $(this);
    var isRevert = submitButton.hasClass("revert");
    if(isRevert){
      var newString = $(this).parent().parent().parent().contents().find(".comment-changeFrom-value").html();
    }else{
      var newString = $(this).parent().parent().parent().contents().find(".comment-changeTo-value").html();
    }

    // Nuke all that aren't first lines of this comment
    padInner.contents().find("."+data.commentId+":not(:first)").html("");
    var padCommentContent = padInner.contents().find("."+data.commentId).first();
    newString = newString.replace(/(?:\r\n|\r|\n)/g, '<br />');

    // Write the new pad contents
    $(padCommentContent).html(newString);

    // We change commentId to replyId in the data object so it's properly processed by the server..  This is hacky
    data.commentId = data.replyId;

    if(isRevert){
      // Tell all users this change was reverted
      self.socket.emit('revertChange', data, function (){});
      self.showChangeAsReverted(data.replyId);
    }else{
      // Tell all users this change was accepted
      self.socket.emit('acceptChange', data, function (){});

      // Update our own comments container with the accepted change
      self.showChangeAsAccepted(data.replyId);
    }

  });

  // User accepts a change
  this.container.on("submit", ".comment-changeTo-form", function(e){
    e.preventDefault();
    var data = self.getCommentData();
    data.commentId = $(this).parent()[0].id;
    var padOuter = $('iframe[name="ace_outer"]').contents();
    var padInner = padOuter.find('iframe[name="ace_inner"]');

    // Are we reverting a change?
    var submitButton = $(this).contents().find("input[type='submit']");
    var isRevert = submitButton.hasClass("revert");
    if(isRevert){
      var newString = $(this).parent().contents().find(".comment-changeFrom-value").html();
    }else{
      var newString = $(this).parent().contents().find(".comment-changeTo-value").html();
    }

    // Nuke all that aren't first lines of this comment
    padInner.contents().find("."+data.commentId+":not(:first)").html("");

    var padCommentContent = padInner.contents().find("."+data.commentId).first();
    newString = newString.replace(/(?:\r\n|\r)/g, '<br />');

    // Write the new pad contents
    $(padCommentContent).html(newString);

    if(isRevert){
      // Tell all users this change was reverted
      self.socket.emit('revertChange', data, function (){});
      self.showChangeAsReverted(data.commentId);
    }else{
      // Tell all users this change was accepted
      self.socket.emit('acceptChange', data, function (){});

      // Update our own comments container with the accepted change
      self.showChangeAsAccepted(data.commentId);
    }
  });

  // is this even used? - Yes, it is!
  this.container.on("submit", ".comment-reply", function(e){
    e.preventDefault();
    var data = self.getCommentData();
    data.commentId = $(this).parent()[0].id;
    data.reply = $(this).find(".comment-reply-input").val();
    data.changeTo = $(this).find(".reply-comment-suggest-to").val() || null;
    data.changeFrom = $(this).find(".reply-comment-changeFrom-value").text() || null;
    self.socket.emit('addCommentReply', data, function (){
      // Append the reply to the comment
      // console.warn("addCommentReplyEmit WE EXPECT REPLY ID", data);
      $('iframe[name="ace_outer"]').contents().find('#'+data.commentId + ' > form.comment-reply  .comment-reply-input').val("");
      self.getCommentReplies(function(replies){
        self.commentReplies = replies;
        self.collectCommentReplies();
      });
    });

    // On submit we should hide this suggestion no?
    if($(this).parent().parent().find(".reply-suggestion-checkbox").is(':checked')){
      $(this).parent().parent().find(".reply-suggestion-checkbox:checked").click();
      $(this).parent().parent().find(".reply-comment-suggest-to").val("");
      //Only uncheck checked boxes. TODO: is a cleanup operation. Should we do it here?
    }
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

  // Override  copy, cut, paste events on Google chrome.
  // When an user copies a comment and selects only the span, or part of it, Google chrome
  // does not copy the classes only the styles, for example:
  // <comment><span>text to be copied</span></comment>
  // As the comment classes are not only used for styling we have to add these classes when it pastes the content
  // The same does not occur when the user selects more than the span, for example:
  // text<comment><span>to be copied</span></comment>
  if(browser.chrome){
    self.padInner.contents().on("copy", function(e) {
      events.addTextOnClipboard(e, self.ace, self.padInner);
    });

    self.padInner.contents().on("cut", function(e) {
      events.addTextOnClipboard(e, self.ace, self.padInner);
      // remove the selected text
      self.padInner.contents()[0].execCommand("delete");
    });

    self.padInner.contents().on("paste", function(e) {
      events.addCommentClasses(e);
    });
  }
};

// Insert comments container on element use for linenumbers
ep_comments.prototype.findContainers = function(){
  var padOuter = $('iframe[name="ace_outer"]').contents();
  this.padOuter = padOuter;
  this.padInner = padOuter.find('iframe[name="ace_inner"]');
  this.outerBody = padOuter.find('#outerdocbody');
};

// Collect Comments and link text content to the comments div
ep_comments.prototype.collectComments = function(callback){
  var self        = this;
  var container   = this.container;
  var comments    = this.comments;
  var padComment  = this.padInner.contents().find('.comment');

  padComment.each(function(it){
    var $this           = $(this);
    var cls             = $this.attr('class');
    var classCommentId  = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
    var commentId       = (classCommentId) ? classCommentId[1] : null;

    if(!commentId){
      // console.log("returning due to no comment id, probably due to a deleted comment");
      return;
    }

    self.padInner.contents().find("#innerdocbody").addClass("comments");

    if (commentId === null) {
      var isAuthorClassName = /(?:^| )(a.[A-Za-z0-9]*)/.exec(cls);
      if (isAuthorClassName) self.removeComment(isAuthorClassName[1], it);
      return;
    }
    var commentId   = classCommentId[1];
    var commentElm  = container.find('#'+ commentId);

    var comment     = comments[commentId];
    if(comment){
      if (comment !== null) {
        // If comment is not in sidebar insert it
        if (commentElm.length == 0) {
          self.insertComment(commentId, comment.data, it);
          commentElm = container.find('#'+ commentId);

          $(this).on('click', function(){
            markerTop = $(this).position().top;
            commentTop = commentElm.position().top;
            containerTop = container.css('top');
            container.css('top', containerTop - (commentTop - markerTop));
          });
        }

        // localize comment element
        commentL10n.localize(commentElm);
      }
    }
    var prevCommentElm = commentElm.prev();
    var commentPos;

    if (prevCommentElm.length == 0) {
      commentPos = 0;
    } else {
      var prevCommentPos = prevCommentElm.css('top');
      var prevCommentHeight = prevCommentElm.innerHeight();

      commentPos = parseInt(prevCommentPos) + prevCommentHeight + 30;
    }

    commentElm.css({ 'top': commentPos });

    // Should we show "Revert" instead of "Accept"
    // Comment Replies are NOT handled here..
    if(comments[commentId]){
      var showRevert = comments[commentId].data.changeAccepted;
    }

    if(showRevert){
      self.showChangeAsAccepted(commentId);
    }

  });
  // now if we apply a class such as mouseover to the editor it will go shitty
  // so what we need to do is add CSS for the specific ID to the document...
  // It's fucked up but that's how we do it..
  var padInner = this.padInner;
  this.container.on("mouseover", ".sidebar-comment", function(e){
    var commentId = e.currentTarget.id;
    var inner = $('iframe[name="ace_outer"]').contents().find('iframe[name="ace_inner"]');
    inner.contents().find("head").append("<style>."+commentId+"{ color:orange }</style>");
    // on hover we should show the reply option
  }).on("mouseout", ".sidebar-comment", function(e){
    var commentId = e.currentTarget.id;
    var inner = $('iframe[name="ace_outer"]').contents().find('iframe[name="ace_inner"]');
    inner.contents().find("head").append("<style>."+commentId+"{ color:black }</style>");
    // TODO this could potentially break ep_font_color
  });

  // hover event
  this.padInner.contents().on("mouseover", ".comment", function(e){
    var commentId = self.commentIdOf(e);
    commentBoxes.highlightComment(commentId, e);
  });

  // click event
  this.padInner.contents().on("click", ".comment", function(e){
    var commentId = self.commentIdOf(e);
    commentBoxes.highlightComment(commentId, e);
  });

  this.padInner.contents().on("mouseleave", ".comment", function(e){
    var commentOpenedByClickOnIcon = commentIcons.isCommentOpenedByClickOnIcon();

    // only closes comment if it was not opened by a click on the icon
    if (!commentOpenedByClickOnIcon) {
      self.closeOpenedComment(e);
    }
  });

  self.addListenersToCloseOpenedComment();

  self.setYofComments();
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
    // Should we show "Revert" instead of "Accept"
    // Comment Replies ARE handled here..
    if(reply.changeAccepted){
      self.showChangeAsAccepted(replyId);
    }
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

// Insert a comment node
ep_comments.prototype.insertComment = function(commentId, comment, index){
  var content           = null;
  var container         = this.container;
  var commentAfterIndex = container.find('.sidebar-comment').eq(index);

  comment.commentId = commentId;
  content = $('#commentsTemplate').tmpl(comment);

  commentL10n.localize(content);

  // position doesn't seem to be relative to rep

  // console.log('position', index, commentAfterIndex);
  if (index === 0) {
    content.prependTo(container);
  } else if (commentAfterIndex.length === 0) {
    content.appendTo(container);
  } else {
    commentAfterIndex.before(content);
  }

  // insert icon
  commentIcons.addIcon(commentId, comment);
};

// Set all comments to be inline with their target REP
ep_comments.prototype.setYofComments = function(){
  // for each comment in the pad
  var padOuter = $('iframe[name="ace_outer"]').contents();
  var padInner = padOuter.find('iframe[name="ace_inner"]');
  var inlineComments = padInner.contents().find(".comment");
  var commentsToBeShown = [];

  // hide each outer comment...
  commentBoxes.hideAllComments();
  // ... and hide comment icons too
  commentIcons.hideIcons();

  $.each(inlineComments, function(){
    var y = this.offsetTop;
    var commentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(this.className); // classname is the ID of the comment
    if(commentId) {
      // adjust outer comment...
      var commentEle = commentBoxes.adjustTopOf(commentId[1], y);
      // ... and adjust icons too
      commentIcons.adjustTopOf(commentId[1], y);

      // mark this comment to be displayed if it was visible before we start adjusting its position
      if (commentIcons.shouldShow(commentEle)) commentsToBeShown.push(commentEle);
    }
  });

  // re-display comments that were visible before
  _.each(commentsToBeShown, function(commentEle) {
    commentEle.show();
  });
};

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

      // localize comment element...
      commentL10n.localize(commentElm);
      // ... and update its date
      comment.data.date = prettyDate(comment.data.timestamp);
      comment.data.formattedDate = new Date(comment.data.timestamp).toISOString();
      commentElm.attr('title', comment.data.date);
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
  comment.date = prettyDate(comment.timestamp);
  comment.formattedDate = new Date(comment.timestamp).toISOString();
  if (comments[commentId] == null) comments[commentId] = {};
  comments[commentId].data = comment;
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

// Delete a pad comment
ep_comments.prototype.deleteComment = function(commentId){
  var padOuter = $('iframe[name="ace_outer"]').contents();
  var padInner = padOuter.find('iframe[name="ace_inner"]');
  var selector = "."+commentId;
  var ace = this.ace;
  ace.callWithAce(function(aceTop){
    var repArr = aceTop.ace_getRepFromSelector(selector, padInner);
    // rep is an array of reps..  I will need to iterate over each to do something meaningful..
    $.each(repArr, function(index, rep){
      // I don't think we need this nested call
      ace.callWithAce(function (ace){
        ace.ace_performSelectionChange(rep[0],rep[1],true);
        ace.ace_setAttributeOnSelection('comment', 'comment-deleted');
        // Note that this is the correct way of doing it, instead of there being
        // a commentId we now flag it as "comment-deleted"
      });
    });
  },'deleteCommentedSelection', true);

//  });
//  }, 'getRep');
}

ep_comments.prototype.displayNewCommentForm = function() {
  var self = this;
  var rep = {};
  var ace = this.ace;

  ace.callWithAce(function(ace) {
    var saveRep = ace.ace_getRep();

    rep.lines    = saveRep.lines;
    rep.selStart = saveRep.selStart;
    rep.selEnd   = saveRep.selEnd;
  },'saveCommentedSelection', true);

  var selectedText = self.getSelectedText(rep);
  // we have nothing selected, do nothing
  var noTextSelected = (selectedText.length === 0);
  if (noTextSelected) {
    return;
  }

  self.createNewCommentFormIfDontExist(rep);

  // Write the text to the changeFrom form
  var padOuter = $('iframe[name="ace_outer"]').contents();
  padOuter.find(".comment-suggest-from").val(selectedText);

  // Display form
  newComment.showNewCommentForm();

  // Check if the first element selected is visible in the viewport
  var $firstSelectedElement = self.getFirstElementSelected();
  var firstSelectedElementInViewport = self.isElementInViewport($firstSelectedElement);

  if(!firstSelectedElementInViewport){
    self.scrollViewportIfSelectedTextIsNotVisible($firstSelectedElement);
  }

  // Adjust focus on the form
  padOuter.find('.comment-content').focus();

  // fix for iOS: when opening #newComment, we need to force focus on padOuter
  // contentWindow, otherwise keyboard will be displayed but text input made by
  // the user won't be added to textarea
  var outerIframe = $('iframe[name="ace_outer"]').get(0);
  if (outerIframe && outerIframe.contentWindow) {
    outerIframe.contentWindow.focus();
  }
}

ep_comments.prototype.scrollViewportIfSelectedTextIsNotVisible = function($firstSelectedElement){
  // Set the top of the form to be the same Y as the target Rep
    var y = $firstSelectedElement.offsetTop;
    var padOuter = $('iframe[name="ace_outer"]').contents();
    padOuter.find('#outerdocbody').scrollTop(y); // Works in Chrome
    padOuter.find('#outerdocbody').parent().scrollTop(y); // Works in Firefox
}

ep_comments.prototype.isElementInViewport = function(element) {
  var elementPosition = element.getBoundingClientRect();
  var scrollTopFirefox = $('iframe[name="ace_outer"]').contents().find('#outerdocbody').parent().scrollTop(); // works only on firefox
  var scrolltop = $('iframe[name="ace_outer"]').contents().find('#outerdocbody').scrollTop() || scrollTopFirefox;
  // position relative to the current viewport
  var elementPositionTopOnViewport = elementPosition.top - scrolltop;
  var elementPositionBottomOnViewport = elementPosition.bottom - scrolltop;

  var $ace_outer = $('iframe[name="ace_outer"]');
  var ace_outerHeight = $ace_outer.height();
  var ace_outerPaddingTop = this.getIntValueOfCSSProperty($ace_outer, "padding-top");

  var clientHeight = ace_outerHeight - ace_outerPaddingTop;

  var elementAboveViewportTop = elementPositionTopOnViewport < 0;
  var elementBelowViewportBottom = elementPositionBottomOnViewport > clientHeight;

  return !(elementAboveViewportTop || elementBelowViewportBottom);
}

ep_comments.prototype.getIntValueOfCSSProperty = function($element, property){
  var valueString = $element.css(property);
  return parseInt(valueString) || 0;
}

ep_comments.prototype.getFirstElementSelected = function(){
  var element;

  this.ace.callWithAce(function(ace) {
    var rep = ace.ace_getRep();
    var line = rep.lines.atIndex(rep.selStart[0]);
    var key = "#"+line.key;
    var padOuter = $('iframe[name="ace_outer"]').contents();
    var padInner = padOuter.find('iframe[name="ace_inner"]').contents();
    element = padInner.find(key);

  },'getFirstElementSelected', true);

  return element[0];
}

// Indicates if user selected some text on editor
ep_comments.prototype.checkNoTextSelected = function(rep) {
  var noTextSelected = (rep.selStart[0] == rep.selEnd[0] && rep.selStart[1] == rep.selEnd[1]);

  return noTextSelected;
}

// Create form to add comment
ep_comments.prototype.createNewCommentFormIfDontExist = function(rep) {
  var data = this.getCommentData();
  var self = this;

  // If a new comment box doesn't already exist, create one
  newComment.insertNewCommentFormIfDontExist(data, function(comment, index) {
    if(comment.changeTo){
      data.comment.changeFrom = comment.changeFrom;
      data.comment.changeTo = comment.changeTo;
    }
    data.comment.text = comment.text;

    self.saveComment(data, rep);
  });
};

// Get a string representation of the text selected on the editor
ep_comments.prototype.getSelectedText = function(rep) {
  var self = this;
  var firstLine = rep.selStart[0];
  var lastLine = self.getLastLine(firstLine, rep);
  var selectedText = "";

  _(_.range(firstLine, lastLine + 1)).each(function(lineNumber){
     // rep looks like -- starts at line 2, character 1, ends at line 4 char 1
     /*
     {
        rep.selStart[2,0],
        rep.selEnd[4,2]
     }
     */
     var line = rep.lines.atIndex(lineNumber);
     // If we span over multiple lines
     if(rep.selStart[0] === lineNumber){
       // Is this the first line?
       if(rep.selStart[1] > 0){
         var posStart = rep.selStart[1];
       }else{
         var posStart = 0;
       }
     }
     if(rep.selEnd[0] === lineNumber){
       if(rep.selEnd[1] <= line.text.length){
         var posEnd = rep.selEnd[1];
       }else{
         var posEnd = 0;
       }
     }
     var lineText = line.text.substring(posStart, posEnd);
     // When it has a selection with more than one line we select at least the beginning
     // of the next line after the first line. As it is not possible to select the beginning
     // of the first line, we skip it.
     if(lineNumber > firstLine){
      // if the selection takes the very beginning of line, and the element has a lineMarker,
      // it means we select the * as well, so we need to clean it from the text selected
      lineText = self.cleanLine(line, lineText);
      lineText = '\n' + lineText;
     }
     selectedText += lineText;
  });
  return selectedText;
}

ep_comments.prototype.getLastLine = function(firstLine, rep){
  var lastLineSelected = rep.selEnd[0];

  if (lastLineSelected > firstLine){
    // Ignore last line if the selected text of it it is empty
    if(this.lastLineSelectedIsEmpty(rep, lastLineSelected)){
      lastLineSelected--;
    }
  }
  return lastLineSelected;
}

ep_comments.prototype.lastLineSelectedIsEmpty = function(rep, lastLineSelected){
  var line = rep.lines.atIndex(lastLineSelected);
  // when we've a line with line attribute, the first char line position
  // in a line is 1 because of the *, otherwise is 0
  var firstCharLinePosition = this.lineHasMarker(line) ? 1 : 0;
  var lastColumnSelected = rep.selEnd[1];

  return lastColumnSelected === firstCharLinePosition;
}

ep_comments.prototype.lineHasMarker = function(line){
  return line.lineMarker === 1;
}

ep_comments.prototype.cleanLine = function(line, lineText){
  var hasALineMarker = this.lineHasMarker(line);
  if(hasALineMarker){
    lineText = lineText.substring(1);
  }
  return lineText;
}

// Save comment
ep_comments.prototype.saveComment = function(data, rep) {
  var self = this;

  self.socket.emit('addComment', data, function (commentId, comment){
    comment.commentId = commentId;

    self.ace.callWithAce(function (ace){
      // console.log('addComment :: ', commentId);
      ace.ace_performSelectionChange(rep.selStart, rep.selEnd, true);
      ace.ace_setAttributeOnSelection('comment', commentId);
    },'insertComment', true);

    self.setComment(commentId, comment);
    self.collectComments();
  });
}

// Listen for comment replies
ep_comments.prototype.commentRepliesListen = function(){
  var self = this;
  var socket = this.socket;
  socket.on('pushAddCommentReply', function (replyId, reply, changeTo, changeFrom){
    // console.warn("pAcR response", replyId, reply, changeTo, changeFrom);
    // callback(replyId, reply);
    // self.collectCommentReplies();
    self.getCommentReplies(function (replies){
      if (!$.isEmptyObject(replies)){
        // console.log("collecting comment replies");
        self.commentReplies = replies;
        self.collectCommentReplies();
        self.commentRepliesListen();
      }
    });
  });

};

ep_comments.prototype.showChangeAsAccepted = function(commentId){
  var self = this;

  // Get the comment
  var comment = self.container.find("#"+commentId);
  var button = comment.find("input[type='submit']").first(); // we need to get the first button otherwise the replies suggestions will be affected too
  button.attr("data-l10n-id", "ep_comments_page.comments_template.revert_change.value");
  button.addClass("revert");
  commentL10n.localize(button);
}

ep_comments.prototype.showChangeAsReverted = function(commentId){
  var self = this;

  // Get the comment
  var comment = self.container.find("#"+commentId);
  var button = comment.find("input[type='submit']").first(); // we need to get the first button otherwise the replies suggestions will be affected too
  button.attr("data-l10n-id", "ep_comments_page.comments_template.accept_change.value");
  button.removeClass("revert");
  commentL10n.localize(button);
}

// Push comment from collaborators
ep_comments.prototype.pushComment = function(eventType, callback){
  var socket = this.socket;
  var self = this;

  socket.on('changeAccepted', function(commentId){
    self.showChangeAsAccepted(commentId);
  });

  socket.on('changeReverted', function(commentId){
    self.showChangeAsReverted(commentId);
  });

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
    if(!context.callstack.docTextChanged) return;

    // only adjust comments if plugin was already initialized,
    // otherwise there's nothing to adjust anyway
    if (pad.plugins && pad.plugins.ep_comments_page) {
      pad.plugins.ep_comments_page.setYofComments();
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
function getRepFromSelector(selector, container){
  var attributeManager = this.documentAttributeManager;

  var repArr = [];

  // first find the element
  var elements = container.contents().find(selector);
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
  editorInfo.ace_getCommentIdOnSelection = _(getCommentIdOnSelection).bind(context);
}

