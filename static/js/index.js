var _, $, jQuery;

var $ = require('ep_etherpad-lite/static/js/rjquery').$;
var _ = require('ep_etherpad-lite/static/js/underscore');
var padcookie = require('ep_etherpad-lite/static/js/pad_cookie').padcookie;
var prettyDate = require('ep_comments_page/static/js/timeFormat').prettyDate;

var cssFiles = ['ep_comments_page/static/css/comment.css'];

/************************************************************************/
/*                         ep_comments Plugin                           */
/************************************************************************/
// Container
function ep_comments(context){
  this.container  = null;
  this.padOuter   = null;
  this.padInner   = null;
  this.ace        = context.ace;

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
  this.insertContainer();

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
    self.localizeNewCommentForm();
  });

  // On click comment icon toolbar
  $('.addComment').on('click', function(e){
    $('iframe[name="ace_outer"]').contents().find('#comments').show();
    $('iframe[name="ace_outer"]').contents().find('#comments').addClass("active");
    e.preventDefault(); // stops focus from being lost
    // If a new comment box doesn't already exist
    // Add a new comment and link it to the selection
    // $('iframe[name="ace_outer"]').contents().find('#sidediv').removeClass('sidedivhidden');
    if (self.container.find('#newComment').length == 0) self.addComment();
    // console.log("setting focus to .comment-content");
    $('iframe[name="ace_outer"]').contents().find('#comments').find('#newComment').show();
    $('iframe[name="ace_outer"]').contents().find('#comments').find('#newComment').addClass("visible").removeClass("hidden");
    $('iframe[name="ace_outer"]').contents().find('.comment-content').focus();
  });

  // Listen for include suggested change toggle
  this.container.on("change", '#suggestion-checkbox', function(){
    if($(this).is(':checked')){
      $('iframe[name="ace_outer"]').contents().find('.suggestion').show();
    }else{
      $('iframe[name="ace_outer"]').contents().find('.suggestion').hide();
    }
  });

  // Listen for events to delete a comment
  // All this does is remove the comment attr on the selection
  this.container.on("click", ".comment-delete", function(){
    var commentId = $(this).parent()[0].id;
    self.deleteComment(commentId);
  })

  // Listen for include suggested change toggle
  this.container.on("change", '.reply-suggestion-checkbox', function(){
    if($(this).is(':checked')){
      var commentId = $(this).parent().parent().parent()[0].id;
      var padOuter = $('iframe[name="ace_outer"]').contents();
      var padInner = padOuter.find('iframe[name="ace_inner"]');

      var currentString = padInner.contents().find("."+commentId).html();
      $(this).parent().parent().find(".reply-comment-suggest-from").html(currentString);
      $(this).parent().parent().find('.reply-suggestion').show();
    }else{
      $(this).parent().parent().find('.reply-suggestion').hide();
    }
  });


  // Create hover modal
  $('iframe[name="ace_outer"]').contents().find("body")
    .append("<div class='comment-modal'><p class='comment-modal-name'></p><p class='comment-modal-comment'></p></div>");

  // DUPLICATE CODE REQUIRED FOR COMMENT REPLIES, see below for slightly different version
  this.container.on("click", ".comment-reply-changeTo-approve", function(e){
    e.preventDefault();
    var commentId = $(this).parent().parent().parent().parent()[0].id;
    var newString = $(this).parent().contents().find(".comment-changeTo-value").html();
    var padOuter = $('iframe[name="ace_outer"]').contents();
    var padInner = padOuter.find('iframe[name="ace_inner"]');

    // Nuke all that aren't first lines of this comment
    padInner.contents().find("."+commentId+":not(:first)").html("");
    var padCommentContent = padInner.contents().find("."+commentId).first();
    newString = newString.replace(/(?:\r\n|\r|\n)/g, '<br />');

    // Write the new pad contents
    $(padCommentContent).html(newString);
  });

  // User accepts a change
  this.container.on("submit", ".comment-changeTo-form", function(e){
    e.preventDefault();
    var data = self.getCommentData();
    var newString = $(this).parent().contents().find(".comment-changeTo-value").html();
    data.commentId = $(this).parent()[0].id;
    var padOuter = $('iframe[name="ace_outer"]').contents();
    var padInner = padOuter.find('iframe[name="ace_inner"]');

    // Nuke all that aren't first lines of this comment
    padInner.contents().find("."+data.commentId+":not(:first)").html("");

    var padCommentContent = padInner.contents().find("."+data.commentId).first();
    newString = newString.replace(/(?:\r\n|\r|\n)/g, '<br />');
    
    // Write the new pad contents
    $(padCommentContent).html(newString);
  });

  // TODO is this even used?
  this.container.on("submit", ".comment-reply", function(e){
    e.preventDefault();
    var data = self.getCommentData();
    data.commentId = $(this).parent()[0].id;
    data.reply = $(this).find(".comment-reply-input").val();
    data.changeTo = $(this).find(".reply-comment-suggest-to").val() || null;
    self.socket.emit('addCommentReply', data, function (){
      // Append the reply to the comment
      // console.warn("addCommentReplyEmit WE EXPECT REPLY ID", data);
      $('iframe[name="ace_outer"]').contents().find('#'+data.commentId + ' > .comment-reply > .comment-reply-input').val("");
      self.getCommentReplies(function(replies){
        self.commentReplies = replies;
        self.collectCommentReplies();
      });
    });
    if($(this).parent().parent().find(".reply-suggestion-checkbox").is(':checked')){
      $(this).parent().parent().find(".reply-suggestion-checkbox").click();
    }
  });

  // Enable and handle cookies
  if (padcookie.getPref("comments") === false) {
    self.container.hide();
    $('#options-comments').attr('checked','unchecked');
    $('#options-comments').attr('checked',false);
  }else{
    $('#options-comments').attr('checked','checked');
  }

  $('#options-comments').on('click', function() {
    if($('#options-comments').is(':checked')) {
      padcookie.setPref("comments", true);
      self.container.show();
    } else {
      padcookie.setPref("comments", false);
      self.container.hide();
    }
  });

  // Check to see if we should show already..
  if($('#options-comments').is(':checked')){
    self.container.show();
  }

};

// Insert comments container on element use for linenumbers
ep_comments.prototype.findContainers = function(){
  var padOuter = $('iframe[name="ace_outer"]').contents();
  this.padOuter = padOuter;
  this.padInner = padOuter.find('iframe[name="ace_inner"]');
  this.outerBody = padOuter.find('#outerdocbody')
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

    // make sure comments aer visible on the page
    // container.show();
    container.addClass("active");
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
        self.localize(commentElm);
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
  this.padInner.contents().on("mouseover", ".comment" ,function(e){
    self.highlightComment(e);
  });

  // click event
  this.padInner.contents().on("click", ".comment" ,function(e){
    self.highlightComment(e);
  });

  this.padInner.contents().on("mouseleave", ".comment" ,function(e){
    var cls             = e.currentTarget.classList;
    var classCommentId  = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
    var commentId       = (classCommentId) ? classCommentId[1] : null;
    var commentElm      = $('iframe[name="ace_outer"]').contents().find("#comments").find('#'+ commentId);
    commentElm.removeClass('mouseover');
    $('iframe[name="ace_outer"]').contents().find('.comment-modal').hide();
  });

  self.setYofComments();
};

// Collect Comments and link text content to the comments div
ep_comments.prototype.collectCommentReplies = function(callback){
  // console.warn("collectCommentReplies", this.commentReplies);
  var self        = this;
  var container   = this.container;
  var commentReplies = this.commentReplies;
  var padComment  = this.padInner.contents().find('.comment');
  $.each(this.commentReplies, function(replyId, replies){
    var commentId = replies.commentId;
    var existsAlready = $('iframe[name="ace_outer"]').contents().find('#'+replyId).length;
    if(existsAlready) return;

    replies.replyId = replyId;
    var content = $("#replyTemplate").tmpl(replies);
    $('iframe[name="ace_outer"]').contents().find('#'+commentId + ' .comment-reply-input').before(content);
  });
};

ep_comments.prototype.highlightComment = function(e){
  var cls             = e.currentTarget.classList;
  var classCommentId  = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
  var commentId       = (classCommentId) ? classCommentId[1] : null;
  var commentElm      = $('iframe[name="ace_outer"]').contents().find("#comments").find('#'+ commentId);
  var commentsVisible = this.container.is(":visible");
  if(commentsVisible){
    // sidebar view highlight
    commentElm.addClass('mouseover');
  }else{
    var commentElm      = $('iframe[name="ace_outer"]').contents().find("#comments").find('#'+ commentId);
    $('iframe[name="ace_outer"]').contents().find('.comment-modal').show().css({
      left: e.clientX +"px",
      top: e.clientY + 25 +"px"
    });
    // hovering comment view
    $('iframe[name="ace_outer"]').contents().find('.comment-modal-comment').html(commentElm.html());
  }
}

// Insert comment container in sidebar
ep_comments.prototype.insertContainer = function(){
  // Add comments
  $('iframe[name="ace_outer"]').contents().find("#outerdocbody").prepend('<div id="comments"></div>');
  this.container = this.padOuter.find('#comments');
};

// Insert new Comment Form
ep_comments.prototype.insertNewComment = function(comment, callback){
  var ace = this.ace;
  var index = 0;

  this.insertComment("", comment, index, true);

  this.container.find('#newComment #comment-reset').on('click',function(){
    var form = $(this).parent().parent();
    $('iframe[name="ace_outer"]').contents().find('#comments').find('#newComment').addClass("hidden").removeClass("visible");
  });

  this.container.find('#newComment').submit(function(){
    var form = $(this);
    var text = form.find('.comment-content').val();
    var changeTo = form.find('.comment-suggest-to').val();
    var comment = {};
    comment.text = text;
    if(changeTo){
      comment.changeTo = changeTo;
    }
    if (text.length != 0) {
      form.remove();
      $('iframe[name="ace_outer"]').contents().find('#comments').find('#newComment').addClass("hidden").removeClass("visible");
      // console.log("calling back", text, index);
      callback(comment, index);
    }
    return false;
  });

  // Set the top of the form to be the same Y as the target Rep
  ace.callWithAce(function (ace){
    var rep = ace.ace_getRep();
    // console.log("rep", rep); // doesn't fire twice
    var line = rep.lines.atIndex(rep.selStart[0]);
    var key = "#"+line.key;
    var padOuter = $('iframe[name="ace_outer"]').contents();
    var padInner = padOuter.find('iframe[name="ace_inner"]');
    var ele = padInner.contents().find(key);
    var y = ele[0].offsetTop;
    $('iframe[name="ace_outer"]').contents().find('#comments').contents().find('#newComment').css("top", y+"px").show();
    // scroll new comment form to focus
    $('iframe[name="ace_outer"]').contents().find('#outerdocbody').scrollTop(y); // Works in Chrome
    $('iframe[name="ace_outer"]').contents().find('#outerdocbody').parent().scrollTop(y); // Works in Firefox
  },'getYofRep', true);
};

// Insert a comment node
ep_comments.prototype.insertComment = function(commentId, comment, index, isNew){
  var template          = (isNew === true) ? 'newCommentTemplate' : 'commentsTemplate';
  var content           = null;
  var container         = this.container;
  var commentAfterIndex = container.find('.sidebar-comment').eq(index);

  comment.commentId = commentId;
  content = $('#'+ template).tmpl(comment);

  this.localize(content);

  // position doesn't seem to be relative to rep

  // console.log('position', index, commentAfterIndex);
  if (index === 0) {
    content.prependTo(container);
  } else if (commentAfterIndex.length === 0) {
    content.appendTo(container);
  } else {
    commentAfterIndex.before(content);
  }
  this.setYofComments();
};

// Set all comments ot be inline with their target REP
ep_comments.prototype.setYofComments = function(){
  // for each comment in the pad
  var padOuter = $('iframe[name="ace_outer"]').contents();
  var padInner = padOuter.find('iframe[name="ace_inner"]');
  var inlineComments = padInner.contents().find(".comment");
  padOuter.find("#comments").children("div").each(function(){
    // hide each outer comment
    $(this).hide();
  });
  $.each(inlineComments, function(){
    var y = this.offsetTop;
    y = y-5;
    var commentId = /(?:^| )c-([A-Za-z0-9]*)/.exec(this.className); // classname is the ID of the comment
    var commentEle = padOuter.find('#c-'+commentId[1]) // find the comment
    commentEle.css("top", y+"px").show();
  });

};

ep_comments.prototype.localize = function(element) {
  html10n.translateElement(html10n.translations, element.get(0));
};

ep_comments.prototype.localizeNewCommentForm = function() {
  var newCommentForm = this.container.find('#newComment');
  if (newCommentForm.length !== 0) this.localize(newCommentForm);
};

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
      self.localize(commentElm);
      // ... and update its date
      comment.data.date = prettyDate(comment.data.timestamp);
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
  data.comment.name       = clientVars.userName;
  data.comment.timestamp  = new Date().getTime();

  // Si le client est Anonyme
  // In English please? :P
  if(data.comment.name === undefined){
    data.comment.name = clientVars.userAgent;
  }

  return data;
}

// Delete a pad comment cake
ep_comments.prototype.deleteComment = function(commentId){

  // CAKE NONE OF THIS IS WORKING, NEED A NEW APPROACH

  // We need to get the REP of a given comment and set the comment attribute to null..
  // All we know is the commentId so we use that to locate the string in a line
  var padOuter = $('iframe[name="ace_outer"]').contents();
  var padInner = padOuter.find('iframe[name="ace_inner"]');

  var comment = padInner.contents().find("."+commentId);
  console.log(comment);
  comment.removeClass("comment");
  var self    = this;

}

// Add a pad comment
ep_comments.prototype.addComment = function (callback){
  var socket  = this.socket;
  var data    = this.getCommentData();
  var ace     = this.ace;
  var self    = this;
  var rep     = {};

  ace.callWithAce(function (ace){
    var saveRep = ace.ace_getRep();
    rep.lines = saveRep.lines;
    rep.selStart = saveRep.selStart;
    rep.selEnd = saveRep.selEnd;
  },'saveCommentedSelection', true);

  // If we don't have a selection then return nothing
  if (rep.selStart[0] == rep.selEnd[0] && rep.selStart[1] == rep.selEnd[1]) {
    return;
  }

  var firstLine, lastLine;
  firstLine = rep.selStart[0];
  lastLine = Math.max(firstLine, rep.selEnd[0] - ((rep.selEnd[1] === 0) ? 1 : 0));
  var totalNumberOfLines = 0;
  $('iframe[name="ace_outer"]').contents().find(".comment-suggest-from").html("");

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
     selectedText += lineText + "\n";
  });

  // Set the top of the form
  $('iframe[name="ace_outer"]').contents().find('#comments').find('#newComment').css("top", $('#editorcontainer').css("top"));
  // TODO This doesn't appear to get the Y right for the input field...

  this.insertNewComment(data, function (comment, index){
    if(comment.changeTo){
      data.comment.changeTo = comment.changeTo;
    }
    data.comment.text = comment.text;

    // Save comment
    socket.emit('addComment', data, function (commentId, comment){
      comment.commentId = commentId;

      //callback(commentId);
      ace.callWithAce(function (ace){
        // console.log('addComment :: ', commentId);
        ace.ace_performSelectionChange(rep.selStart,rep.selEnd,true);
        ace.ace_setAttributeOnSelection('comment', commentId);
      },'insertComment', true);

      self.setComment(commentId, comment);
      self.collectComments();
    });
  });

  // Write the text to the changeFrom form
  $('iframe[name="ace_outer"]').contents().find(".comment-suggest-from").val(selectedText);

};

// Listen for comment replies
ep_comments.prototype.commentRepliesListen = function(){
  var self = this;
  var socket = this.socket;
  socket.on('pushAddCommentReply', function (replyId, reply, changeTo){
    console.warn("pAcR response", replyId, reply, changeTo);
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



// Push comment from collaborators
ep_comments.prototype.pushComment = function(eventType, callback){
  var socket = this.socket;

//  console.error("eventType", eventType);

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
    var padOuter = $('iframe[name="ace_outer"]').contents();
    // padOuter.find('#sidediv').removeClass("sidedivhidden"); // TEMPORARY to do removing authorship colors can add sidedivhidden class to sidesiv!
    if(!context.callstack.docTextChanged) return;
    // for each comment

    // NOTE this is duplicate code because of the way this is written, ugh, this needs fixing
    var padInner = padOuter.find('iframe[name="ace_inner"]');
    var inlineComments = padInner.contents().find(".comment");
    padOuter.find("#comments").children().each(function(){
      // hide each outer comment
      $(this).hide();
    });
    $.each(inlineComments, function(){
      var y = this.offsetTop;
      var commentId = /(?:^| )c-([A-Za-z0-9]*)/.exec(this.className);
      var commentEle = padOuter.find('#c-'+commentId[1]);
      y = y-5;
      commentEle.css("top", y+"px").show();
    });
  },

  // Insert comments classes
  aceAttribsToClasses: function(hook, context){
    if(context.key == 'comment') return ['comment', context.value];
  },

  aceEditorCSS: function(){
    return cssFiles;
  }

};

exports.aceEditorCSS          = hooks.aceEditorCSS;
exports.postAceInit           = hooks.postAceInit;
exports.aceAttribsToClasses   = hooks.aceAttribsToClasses;
exports.aceEditEvent          = hooks.aceEditEvent;

