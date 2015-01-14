var _, $, jQuery;

var $ = require('ep_etherpad-lite/static/js/rjquery').$;
var _ = require('ep_etherpad-lite/static/js/underscore');
var padcookie = require('ep_etherpad-lite/static/js/pad_cookie').padcookie;

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
  this.socket     = io.connect('/comment');
  this.padId      = clientVars.padId;
  this.comments   = [];
  this.commentReplies = {};
  this.init();
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
    }, 300);
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

  // Create hover modal
  $('iframe[name="ace_outer"]').contents().find("body")
    .append("<div class='comment-modal'><p class='comment-modal-name'></p><p class='comment-modal-comment'></p></div>");

  // Listen to reply clicks
  this.container.on("click", ".comment-reply-button", function(e){
    var commentId = $(this).parent()[0].id;
    $('iframe[name="ace_outer"]').contents().find("#"+commentId).append("<form class='comment-reply'><input class='comment-reply-input'><!--<input type=submit>--></form>");
  });

  // var socket = this.socket;
  this.container.on("submit", ".comment-reply", function(e){
    e.preventDefault();
    var data = self.getCommentData();
    data.commentId = $(this).parent()[0].id;
    data.reply = $(this).find(".comment-reply-input").val();

    self.socket.emit('addCommentReply', data, function (){
      // Append the reply to the comment
      // console.warn("addCommentReplyEmit WE EXPECT REPLY ID", data);
      $('iframe[name="ace_outer"]').contents().find('#'+data.commentId + ' > .comment-reply > .comment-reply-input').val("");
      self.getCommentReplies(function(replies){
        self.commentReplies = replies;
        self.collectCommentReplies();
      });
    });

  });

  // Enable and handle cookies
  if (padcookie.getPref("comments")) {
    $('#options-comments').attr('checked','checked');
  }else{
    self.container.hide();
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
    $('iframe[name="ace_outer"]').contents().find('#'+commentId + ' > .comment-reply-button').before(content);
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

ep_comments.prototype.removeComment = function(className, id){
  // console.log('remove comment', className, id);
}

// Insert comment container in sidebar
ep_comments.prototype.insertContainer = function(){
  // Add comments 
  $('iframe[name="ace_outer"]').contents().find("#outerdocbody").prepend('<div id="comments"></div>');
  this.container = this.padOuter.find('#comments');
};

// Insert new Comment Form
ep_comments.prototype.insertNewComment = function(comment, callback){
  var index = 0;

  this.insertComment("", comment, index, true);

  this.container.find('#newComment #comment-reset').on('click',function(){
    var form = $(this).parent().parent();
    $('iframe[name="ace_outer"]').contents().find('#comments').find('#newComment').addClass("hidden").removeClass("visible");
  });

  this.container.find('#newComment').submit(function(){
    var form = $(this);
    var text = form.find('.comment-content').val();
    if (text.length != 0) {
      form.remove();
      $('iframe[name="ace_outer"]').contents().find('#comments').find('#newComment').addClass("hidden").removeClass("visible");
      // console.log("calling back", text, index);
      callback(text, index);
    }
    return false;
  });

  // Set the top of the form to be the same Y as the target Rep
  var ace = this.ace;
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
  if(data.comment.name === undefined){
    data.comment.name = clientVars.userAgent;
  }

  return data;
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
    rep.selStart = saveRep.selStart;
    rep.selEnd = saveRep.selEnd;
  },'saveCommentedSelection', true);

  if (rep.selStart[0] == rep.selEnd[0] && rep.selStart[1] == rep.selEnd[1]) {
    return;
  }

  // Set the top of the form
  $('iframe[name="ace_outer"]').contents().find('#comments').find('#newComment').css("top", $('#editorcontainer').css("top"));

  // CAKE TODO This doesn't appear to get the Y right for the input field...

  this.insertNewComment(data, function (text, index){
    data.comment.text = text;

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
};

// Listen for comment replies
ep_comments.prototype.commentRepliesListen = function(){
  var self = this;
  var socket = this.socket;
  socket.on('pushAddCommentReply', function (replyId, reply){
    // console.warn("pAcR response", replyId, reply);
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
    // Cake this bit is a bit rough..
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

function prettyDate(time){
  var time_formats = [
  [60, 'seconds', 1], // 60
  [120, '1 minute ago', '1 minute from now'], // 60*2
  [3600, 'minutes', 60], // 60*60, 60
  [7200, '1 hour ago', '1 hour from now'], // 60*60*2
  [86400, 'hours', 3600], // 60*60*24, 60*60
  [172800, 'yesterday', 'tomorrow'], // 60*60*24*2
  [604800, 'days', 86400], // 60*60*24*7, 60*60*24
  [1209600, 'last week', 'next week'], // 60*60*24*7*4*2
  [2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
  [4838400, 'last month', 'next month'], // 60*60*24*7*4*2
  [29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
  [58060800, 'last year', 'next year'], // 60*60*24*7*4*12*2
  [2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
  [5806080000, 'last century', 'next century'], // 60*60*24*7*4*12*100*2
  [58060800000, 'centuries', 2903040000] // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
  ];
  /*
  var time = ('' + date_str).replace(/-/g,"/").replace(/[TZ]/g," ").replace(/^\s\s*/   /*rappel   , '').replace(/\s\s*$/, '');
  if(time.substr(time.length-4,1)==".") time =time.substr(0,time.length-4);
  */
  var seconds = (new Date - new Date(time)) / 1000;
  var token = 'ago', list_choice = 1;
  if (seconds < 0) {
    seconds = Math.abs(seconds);
    token = 'from now';
    list_choice = 2;
  }
  var i = 0, format;
  while (format = time_formats[i++]) 
    if (seconds < format[0]) {
      if (typeof format[2] == 'string')
        return format[list_choice];
      else
        return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ' + token;
    }
  return time;
};
 
exports.aceEditorCSS          = hooks.aceEditorCSS;
exports.postAceInit           = hooks.postAceInit;
exports.aceAttribsToClasses   = hooks.aceAttribsToClasses;
exports.aceEditEvent          = hooks.aceEditEvent;

