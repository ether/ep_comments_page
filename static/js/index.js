/* global clearTimeout, clientVars, exports, html10n, pad, require, setTimeout */

/* TODO:
- lable reply textarea
- Make the chekbox appear above the suggested changes even when activated
*/


var _, $, jQuery;

var shared = require('./shared');
var $ = require('ep_etherpad-lite/static/js/rjquery').$;
var _ = require('ep_etherpad-lite/static/js/underscore');
var padcookie = require('ep_etherpad-lite/static/js/pad_cookie').padcookie;
var moment = require('ep_comments_page/static/js/moment-with-locales.min');
var commentBoxes = require('ep_comments_page/static/js/commentBoxes');
var commentIcons = require('ep_comments_page/static/js/commentIcons');
var newComment = require('ep_comments_page/static/js/newComment');
var preCommentMark = require('ep_comments_page/static/js/preCommentMark');
var commentL10n = require('ep_comments_page/static/js/commentL10n');
var events = require('ep_comments_page/static/js/copyPasteEvents');
var getCommentIdOnFirstPositionSelected = events.getCommentIdOnFirstPositionSelected;
var hasCommentOnSelection = events.hasCommentOnSelection;
var browser = require('ep_etherpad-lite/static/js/browser');
var Security = require('ep_etherpad-lite/static/js/security');

var cssFiles = ['ep_comments_page/static/css/comment.css', 'ep_comments_page/static/css/commentIcon.css'];

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
  moment.locale(html10n.getLanguage());

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
    moment.locale(html10n.getLanguage());
    self.localizeExistingComments();
  });

  // Recalculate position when editor is resized
  $('#settings input, #skin-variant-full-width').on('change', function(e) {
    self.setYofComments();
  });
  this.padInner.contents().on(UPDATE_COMMENT_LINE_POSITION_EVENT, function(e){
    self.setYofComments();
  });
  $(window).resize(_.debounce( function() { self.setYofComments() }, 100 ) );

  // On click comment icon toolbar
  $('.addComment').on('click', function(e){
    e.preventDefault(); // stops focus from being lost
    self.displayNewCommentForm();
  });

  // Import for below listener : we are using this.container.parent() so we include
  // events on both comment-modal and sidebar

  // Listen for events to delete a comment
  // All this does is remove the comment attr on the selection
  this.container.parent().on("click", ".comment-delete", function(){
    var commentId = $(this).closest('.comment-container')[0].id;
    self.socket.emit('deleteComment', {padId: self.padId, commentId: commentId, authorId: clientVars.userId}, function (err){
      if (!err) {
        self.deleteComment(commentId);
        var padOuter = $('iframe[name="ace_outer"]').contents();
        var padInner = padOuter.find('iframe[name="ace_inner"]');
        var selector = "."+commentId;
        var ace = self.ace;

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
      }

      if (err === 'unauth') {
        $.gritter.add({title: html10n.translations["ep_comments_page.error"] || "Error", text: html10n.translations["ep_comments_page.error.delete_unauth"] || "You cannot delete other users comments!",  class_name: "error"})
      } else {
        $.gritter.add({
          title: "Error",
          text: err,
          sticky: true,
          class_name: "error"
        })
      }
    });

  });

  // Listen for events to edit a comment
  // Here, it adds a form to edit the comment text
  this.container.parent().on("click", ".comment-edit", function(){
    var $commentBox = $(this).closest('.comment-container');
    $commentBox.addClass('editing');

    var textBox = self.findCommentText($commentBox).last();

    // if edit form not already there
    if (textBox.siblings('.comment-edit-form').length == 0) {
      // add a form to edit the field
      var data = {};
      data.text = textBox.text();
      var content = $("#editCommentTemplate").tmpl(data);
      // localize the comment/reply edit form
      commentL10n.localize(content);
      // insert form
      textBox.before(content);
    }
  });

  // submit the edition on the text and update the comment text
  this.container.parent().on("click", ".comment-edit-submit", function(e){
    e.preventDefault();
    e.stopPropagation();
    var $commentBox = $(this).closest('.comment-container');
    var $commentForm = $(this).closest('.comment-edit-form');
    var commentId = $commentBox.data('commentid');
    var commentText = $commentForm.find('.comment-edit-text').val();
    var data = {};
    data.commentId = commentId;
    data.padId = clientVars.padId;
    data.commentText = commentText;
    data.authorId = clientVars.userId;

    self.socket.emit('updateCommentText', data, function (err){
      if(!err) {
        $commentForm.remove();
        $commentBox.removeClass('editing');
        self.updateCommentBoxText(commentId, commentText);

        // although the comment or reply was saved on the data base successfully, it needs
        // to update the comment or comment reply variable with the new text saved
        self.setCommentOrReplyNewText(commentId, commentText);
      }

      if (err === 'unauth') {
        $.gritter.add({title: html10n.translations["ep_comments_page.error"] || "Error", text: html10n.translations["ep_comments_page.error.edit_unauth"] || "You cannot edit other users comments!",  class_name: "error"})
      } else {
        $.gritter.add({
          title: "Error",
          text: err,
          sticky: true,
          class_name: "error"
        })
      }

    });
  });

  // hide the edit form and make the comment author and text visible again
  this.container.parent().on("click", ".comment-edit-cancel", function(e){
    e.preventDefault();
    e.stopPropagation();
    var $commentBox = $(this).closest('.comment-container');
    var textBox = self.findCommentText($commentBox).last();
    textBox.siblings('.comment-edit-form').remove();
    $commentBox.removeClass('editing');
  });

  // Listen for include suggested change toggle
  this.container.parent().on("change", '.suggestion-checkbox', function(){
    var parentComment = $(this).closest('.comment-container');
    var parentSuggest = $(this).closest('.comment-reply');

    if($(this).is(':checked')){
      var commentId = parentComment.data('commentid');
      var padOuter = $('iframe[name="ace_outer"]').contents();
      var padInner = padOuter.find('iframe[name="ace_inner"]');

      var currentString = padInner.contents().find("."+commentId).html();

      parentSuggest.find(".from-value").html(currentString);
      parentSuggest.find('.suggestion').show();
    }else{
      parentSuggest.find('.suggestion').hide();
    }
  });

  // User accepts or revert a change
  this.container.parent().on("submit", ".comment-changeTo-form", function(e){
    e.preventDefault();
    var data = self.getCommentData();
    var commentEl = $(this).closest('.comment-container');
    data.commentId = commentEl.data('commentid');
    var padOuter = $('iframe[name="ace_outer"]').contents();
    var padInner = padOuter.find('iframe[name="ace_inner"]').contents();

    // Are we reverting a change?
    var isRevert = commentEl.hasClass("change-accepted");
    var newString = isRevert ? $(this).find(".from-value").html() : $(this).find(".to-value").html();

    // In case of suggested change is inside a reply, the parentId is different from the commentId (=replyId)
    var parentId = $(this).closest('.sidebar-comment').data('commentid');
    // Nuke all that aren't first lines of this comment
    padInner.find("."+parentId+":not(:first)").html("");

    var padCommentSpan = padInner.find("."+parentId).first();
    newString = newString.replace(/(?:\r\n|\r)/g, '<br />');

    // Write the new pad contents
    padCommentSpan.html(newString);

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

    // TODO: we need ace editor to commit the change so other people get it
    // currently after approving or reverting, you need to do other thing on the pad
    // for ace to commit
  });

  // When input reply is focused we display more option
  this.container.parent().on("focus", ".comment-content", function(e){
    $(this).closest('.new-comment').addClass('editing');
  });
  // When we leave we reset the form option to its minimal (only input)
  this.container.parent().on('mouseleave', ".comment-container", function(e) {
    $(this).find('.suggestion-checkbox').prop('checked', false);
    $(this).find('.new-comment').removeClass('editing');
  });

  // When a reply get submitted
  this.container.parent().on("submit", ".new-comment", function(e){
    e.preventDefault();

    var data = self.getCommentData();
    data.commentId = $(this).closest('.comment-container').data('commentid');
    data.reply = $(this).find(".comment-content").val();
    data.changeTo = $(this).find(".to-value").val() || null;
    data.changeFrom = $(this).find(".from-value").text() || null;
    self.socket.emit('addCommentReply', data, function (){
      self.getCommentReplies(function(replies){
        self.commentReplies = replies;
        self.collectCommentReplies();

        // Once the new reply is displayed, we clear the form
        $('iframe[name="ace_outer"]').contents().find('.new-comment').removeClass('editing');
      });
    });

    $(this).trigger('reset_reply');
  });
  this.container.parent().on("reset_reply", ".new-comment", function(e){
    // Reset the form
    $(this).find('.comment-content').val('');
    $(this).find(':focus').blur();
    $(this).find('.to-value').val('');
    $(this).find('.suggestion-checkbox').prop('checked', false);
    $(this).removeClass('editing');
  });
  // When click cancel reply
  this.container.parent().on("click", ".btn-cancel-reply", function(e) {
    $(this).closest('.new-comment').trigger('reset_reply')
  });


  // Enable and handle cookies
  if (padcookie.getPref("comments") === false) {
    self.padOuter.find('#comments, #commentIcons').removeClass("active");
    $('#options-comments').attr('checked','unchecked');
    $('#options-comments').attr('checked',false);
  } else {
    $('#options-comments').attr('checked','checked');
  }

  $('#options-comments').on('change', function() {
    if($('#options-comments').is(':checked')){
      enableComments()
    }else{
      disableComments();
    }
  });

  function enableComments() {
    padcookie.setPref("comments", true);
    self.padOuter.find('#comments, #commentIcons').addClass("active");
    $('body').addClass('comments-active')
    $('iframe[name="ace_outer"]').contents().find('body').addClass('comments-active')
  }

  function disableComments() {
    padcookie.setPref("comments", false);
    self.padOuter.find('#comments, #commentIcons').removeClass("active");
    $('body').removeClass('comments-active')
    $('iframe[name="ace_outer"]').contents().find('body').removeClass('comments-active')
  }

  // Check to see if we should show already..
  $('#options-comments').trigger('change');

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

ep_comments.prototype.findCommentText = function($commentBox) {
  var isReply = $commentBox.hasClass('sidebar-comment-reply')
  if (isReply)
    return $commentBox.find(".comment-text");
  else
    return $commentBox.find('.compact-display-content .comment-text, .full-display-content .comment-title-wrapper .comment-text');
}
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
      comment.data.changeFrom = parseMultiline(comment.data.changeFrom);
      if (comment !== null) {
        // If comment is not in sidebar insert it
        if (commentElm.length == 0) {
          self.insertComment(commentId, comment.data, it);
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
  });

  // HOVER SIDEBAR COMMENT
  var hideCommentTimer;
  this.container.on("mouseover", ".sidebar-comment", function(e){
    // highlight comment
    clearTimeout(hideCommentTimer);
    commentBoxes.highlightComment(e.currentTarget.id, e);

  }).on("mouseout", ".sidebar-comment", function(e){
    // do not hide directly the comment, because sometime the mouse get out accidently
    hideCommentTimer = setTimeout(function() {
      commentBoxes.hideComment(e.currentTarget.id);
    },1000);
  });

  // HOVER OR CLICK THE COMMENTED TEXT IN THE EDITOR
  // hover event
  this.padInner.contents().on("mouseover", ".comment", function(e){
    if (container.is(':visible')) { // not on mobile
      clearTimeout(hideCommentTimer);
      var commentId = self.commentIdOf(e);
      commentBoxes.highlightComment(commentId, e, $(this));
    }
  });

  // click event
  this.padInner.contents().on("click", ".comment", function(e){
    var commentId = self.commentIdOf(e);
    commentBoxes.highlightComment(commentId, e, $(this));
  });

  this.padInner.contents().on("mouseleave", ".comment", function(e){
    var commentOpenedByClickOnIcon = commentIcons.isCommentOpenedByClickOnIcon();
    // only closes comment if it was not opened by a click on the icon
    if (!commentOpenedByClickOnIcon && container.is(':visible')) {
      hideCommentTimer = setTimeout(function() {
        self.closeOpenedComment(e);
      }, 1000);
    }
  });

  self.addListenersToCloseOpenedComment();

  self.setYofComments();
  if(callback) callback();
};

ep_comments.prototype.addListenersToCloseOpenedComment = function() {
  var self = this;

  // we need to add listeners to the different iframes of the page
  $(document).on("touchstart click", function(e){
    self.closeOpenedCommentIfNotOnSelectedElements(e);
  });
  this.padOuter.find('html').on("touchstart click", function(e){
    self.closeOpenedCommentIfNotOnSelectedElements(e);
  });
  this.padInner.contents().find('html').on("touchstart click", function(e){
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
  // any of the comment icons
  if (commentIcons.shouldNotCloseComment(e) || commentBoxes.shouldNotCloseComment(e)) { // a comment box or the comment modal
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
    if (commentId) {
    // tell comment icon that this comment has 1+ replies
    commentIcons.commentHasReply(commentId);

    var existsAlready = $('iframe[name="ace_outer"]').contents().find('#'+replyId).length;
    if(existsAlready) return;

    reply.replyId = replyId;
    reply.text = reply.text || ""
    reply.date = moment(reply.timestamp).fromNow();
    reply.formattedDate = new Date(reply.timestamp).toISOString();

    var content = $("#replyTemplate").tmpl(reply);
    if (reply.author !== clientVars.userId) {
      $(content).find('.comment-edit').remove();
    }
    // localize comment reply
    commentL10n.localize(content);
    var repliesContainer = $('iframe[name="ace_outer"]').contents().find('#'+commentId + ' .comment-replies-container');
    repliesContainer.append(content);
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

  // Create hover modal
  target.prepend("<div class='comment-modal popup'><div class='popup-content comment-modal-comment'></div></div>");

  // Add comments side bar container
  target.prepend('<div id="comments"></div>');

  this.container = this.padOuter.find('#comments');
};

// Insert a comment node
ep_comments.prototype.insertComment = function(commentId, comment, index){
  var content           = null;
  var container         = this.container;
  var commentAfterIndex = container.find('.sidebar-comment').eq(index);

  comment.commentId = commentId;
  comment.reply = true;
  content = $('#commentsTemplate').tmpl(comment);
  if (comment.author !== clientVars.userId) {
    $(content).find('.comment-actions-wrapper').addClass('hidden');
  }
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
  var inlineComments = this.getFirstOcurrenceOfCommentIds();
  var commentsToBeShown = [];

  $.each(inlineComments, function(){
    var commentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(this.className); // classname is the ID of the comment
    if(!commentId || !commentId[1]) return;
    var commentEle = padOuter.find('#'+commentId[1])

    var topOffset = this.offsetTop;
    topOffset += parseInt(padInner.css('padding-top').split('px')[0])
    topOffset += parseInt($(this).css('padding-top').split('px')[0])

    if(commentId) {
      // adjust outer comment...
      commentBoxes.adjustTopOf(commentId[1], topOffset);
      // ... and adjust icons too
      commentIcons.adjustTopOf(commentId[1], topOffset);

      // mark this comment to be displayed if it was visible before we start adjusting its position
      if (commentIcons.shouldShow(commentEle)) commentsToBeShown.push(commentEle);
    }
  });

  // re-display comments that were visible before
  _.each(commentsToBeShown, function(commentEle) {
    commentEle.show();
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
   if(commentId && commentId[1]) return commentId[1];
  });
  return _.uniq(commentsId);
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
    if(commentId && commentId[1]) {
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

  padComments.each(function(key, it) {
    var $this           = $(it);
    var cls             = $this.attr('class');
    var classCommentId  = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
    var commentId       = (classCommentId) ? classCommentId[1] : null;

    if (commentId !== null) {
      var commentElm  = self.container.find('#'+ commentId);
      var comment     = comments[commentId];

      // localize comment element...
      commentL10n.localize(commentElm);
      // ... and update its date
      comment.data.date = moment(comment.data.timestamp).fromNow();
      comment.data.formattedDate = new Date(comment.data.timestamp).toISOString();
      $(commentElm).find('.comment-created-at').html(comment.data.date);
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
  comment.date = moment(comment.timestamp).fromNow();
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

// Delete a pad comment
ep_comments.prototype.deleteComment = function(commentId){
  $('iframe[name="ace_outer"]').contents().find('#' + commentId).remove();
}

var cloneLine = function (line) {
  var padOuter = $('iframe[name="ace_outer"]').contents();
  var padInner = padOuter.find('iframe[name="ace_inner"]');

  var lineElem = $(line.lineNode);
  var lineClone = lineElem.clone();
  var innerdocbodyMargin = $(padInner).offset().left + parseInt(padInner.css('padding-left') + lineElem.offset().left) || 0;
  padInner.contents().find('body').append(lineClone);
  lineClone.css({position: 'absolute'});
  lineClone.css(lineElem.offset());
  lineClone.css({left: innerdocbodyMargin});
  lineClone.width(lineElem.width());

  return lineClone;
};

var isHeading = function (index) {
  var attribs = this.documentAttributeManager.getAttributesOnLine(index);
 for (var i=0; i<attribs.length; i++) {
   if (attribs[i][0] === 'heading') {
     var value = attribs[i][1];
     i = attribs.length;
     return value;
   }
 }
 return false;
}

function getXYOffsetOfRep(el, rep){
  var selStart = rep.selStart;
  var selEnd = rep.selEnd;

  if (selStart[0] > selEnd [0] || (selStart[0] === selEnd[0] && selStart[1] > selEnd[1])) { //make sure end is after start
    var startPos = _.clone(selStart);
    selEnd = selStart;
    selStart = startPos;
  }

  var startIndex = 0;
  var endIndex = selEnd[1];
  var lineIndex = selEnd[0];
  if (selStart[0] === selEnd[0]) {
    startIndex = selStart[1];
  }

  var padInner = $('iframe[name="ace_outer"]').contents().find('iframe[name="ace_inner"]');

  // Get the target Line
  var startLine = rep.lines.atIndex(selStart[0]);
  var endLine = rep.lines.atIndex(selEnd[0]);
  var clone = cloneLine(endLine);
  var lineText = Security.escapeHTML($(endLine.lineNode).text()).split('');
  lineText.splice(endIndex, 0, '</span>');
  lineText.splice(startIndex, 0, '<span id="selectWorker">');
  lineText = lineText.join('');

  var heading = isHeading(lineIndex);
  if (heading) {
    lineText = '<' + heading + '>' + lineText + '</' + heading + '>';
  }
  $(clone).html(lineText);

  // Is the line visible yet?
  if ( $(startLine.lineNode).length !== 0 ) {
    var worker =  $(clone).find('#selectWorker');
    var top = worker.offset().top + padInner.offset().top + parseInt(padInner.css('padding-top')); // A standard generic offset'
    var left = worker.offset().left;
    //adjust position
    top = top + worker[0].offsetHeight;

    if (left < 0) {
      left = 0;
    }
    // Remove the clone element
    $(clone).remove();

    return [left, top];
  }
}

function parseMultiline (text) {
  if (!text) return text;
  text = JSON.stringify(text);
  return text.substr(1, (text.length-2));
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
    $.gritter.add({text: html10n.translations["ep_comments_page.add_comment.hint"] || "Please first select the text to comment"})
    return;
  }

  self.createNewCommentFormIfDontExist(rep);

  // Write the text to the changeFrom form
  $('#newComment').find(".from-value").text(selectedText);

  // Display form
  setTimeout(function() {
    var position = getXYOffsetOfRep($('#newComment') ,rep);
    newComment.showNewCommentPopup(position);
  });

  // Check if the first element selected is visible in the viewport
  var $firstSelectedElement = self.getFirstElementSelected();
  var firstSelectedElementInViewport = self.isElementInViewport($firstSelectedElement);

  if(!firstSelectedElementInViewport){
    self.scrollViewportIfSelectedTextIsNotVisible($firstSelectedElement);
  }

  // Adjust focus on the form
  $('#newComment').find('.comment-content').focus();
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
  var noTextSelected = ((rep.selStart[0] == rep.selEnd[0]) && (rep.selStart[1] == rep.selEnd[1]));

  return noTextSelected;
}

// Create form to add comment
ep_comments.prototype.createNewCommentFormIfDontExist = function(rep) {
  var data = this.getCommentData();
  var self = this;

  // If a new comment box doesn't already exist, create one
  data.changeFrom = parseMultiline(self.getSelectedText(rep));
  newComment.insertNewCommentPopupIfDontExist(data, function(comment, index) {
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
      // console.log('addComment :: ', rep, comment);
      ace.ace_performSelectionChange(rep.selStart, rep.selEnd, true);
      ace.ace_setAttributeOnSelection('comment', commentId);
    },'insertComment', true);

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
  data.changeTo = commentData.changeTo
  data.changeFrom = commentData.changeFrom;
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
  data.changeTo = replyData.changeTo
  data.changeFrom = replyData.changeFrom;
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
  this.socket.on('pushAddCommentReply', (replyId, reply) => {
    this.getCommentReplies((replies) => {
      if (!$.isEmptyObject(replies)){
        this.commentReplies = replies;
        this.collectCommentReplies();
      }
    });
  });
};

ep_comments.prototype.updateCommentBoxText = function (commentId, commentText) {
  var $comment = this.container.parent().find("[data-commentid='" + commentId + "']");
  var textBox = this.findCommentText($comment);
  textBox.text(commentText)
}

ep_comments.prototype.showChangeAsAccepted = function(commentId){
  var self = this;

  // Get the comment
  var comment = this.container.parent().find("[data-commentid='" + commentId + "']");
  // Revert other comment that have already been accepted
  comment.closest('.sidebar-comment')
         .find('.comment-container.change-accepted').addBack('.change-accepted')
         .each(function() {
    $(this).removeClass('change-accepted');
    var data = {commentId: $(this).attr('data-commentid'), padId: self.padId}
    self.socket.emit('revertChange', data, function (){});
  })

  // this comment get accepted
  comment.addClass('change-accepted');
}

ep_comments.prototype.showChangeAsReverted = function(commentId){
  var self = this;
  // Get the comment
  var comment = self.container.parent().find("[data-commentid='" + commentId + "']");
  comment.removeClass('change-accepted');
}

// Push comment from collaborators
ep_comments.prototype.pushComment = function(eventType, callback){
  var socket = this.socket;
  var self = this;

  socket.on('textCommentUpdated', function (commentId, commentText) {
    self.updateCommentBoxText(commentId, commentText);
  })

  socket.on('commentDeleted', function(commentId){
    self.deleteComment(commentId);
  });

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
  postAceInit: function(hookName, context, cb) {
    if(!pad.plugins) pad.plugins = {};
    var Comments = new ep_comments(context);
    pad.plugins.ep_comments_page = Comments;

    if (!$('#editorcontainerbox').hasClass('flex-layout')) {
      $.gritter.add({
        title: "Error",
        text: "Ep_comments_page: Please upgrade to etherpad 1.8.3 for this plugin to work correctly",
        sticky: true,
        class_name: "error"
      })
    }
    return cb();
  },

  postToolbarInit: function (hookName, args, cb) {
    var editbar = args.toolbar;

    editbar.registerCommand('addComment', function () {
      pad.plugins.ep_comments_page.displayNewCommentForm();
    });
    return cb();
  },

  aceEditEvent: function(hookName, context, cb) {
    if(!pad.plugins) pad.plugins = {};
    // first check if some text is being marked/unmarked to add comment to it
    var eventType = context.callstack.editEvent.eventType;
    if(eventType === "unmarkPreSelectedTextToComment") {
      pad.plugins.ep_comments_page.preCommentMarker.handleUnmarkText(context);
    } else if(eventType === "markPreSelectedTextToComment") {
      pad.plugins.ep_comments_page.preCommentMarker.handleMarkText(context);
    }

    if (eventType == 'setup' || eventType == 'setBaseText' || eventType == 'importText') return cb();

    if(context.callstack.docTextChanged && pad.plugins.ep_comments_page){
      pad.plugins.ep_comments_page.setYofComments();
    }

    // some times on init ep_comments_page is not yet on the plugin list
    if (pad.plugins.ep_comments_page) {
      var commentWasPasted = pad.plugins.ep_comments_page.shouldCollectComment;
      var domClean = context.callstack.domClean;
      // we have to wait the DOM update from a fakeComment 'fakecomment-123' to a comment class 'c-123'
      if(commentWasPasted && domClean){
        pad.plugins.ep_comments_page.collectComments(function(){
          pad.plugins.ep_comments_page.collectCommentReplies();
          pad.plugins.ep_comments_page.shouldCollectComment = false;
        });
      }
    }
    return cb();
  },

  // Insert comments classes
  aceAttribsToClasses: function(hookName, context, cb) {
    if(context.key === 'comment' && context.value !== "comment-deleted") {
      return cb(['comment', context.value]);
    }
    // only read marks made by current user
    if(context.key === preCommentMark.MARK_CLASS && context.value === clientVars.userId) {
      return cb([preCommentMark.MARK_CLASS, context.value]);
    }
    return cb();
  },

  aceEditorCSS: function(hookName, context, cb) {
    return cb(cssFiles);
  }

};

exports.aceEditorCSS          = hooks.aceEditorCSS;
exports.postAceInit           = hooks.postAceInit;
exports.postToolbarInit       = hooks.postToolbarInit;
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
exports.aceInitialized = function(hookName, context, cb) {
  var editorInfo = context.editorInfo;
  isHeading = _(isHeading).bind(context);
  editorInfo.ace_getRepFromSelector = _(getRepFromSelector).bind(context);
  editorInfo.ace_getCommentIdOnFirstPositionSelected = _(getCommentIdOnFirstPositionSelected).bind(context);
  editorInfo.ace_hasCommentOnSelection = _(hasCommentOnSelection).bind(context);
  return cb();
}
