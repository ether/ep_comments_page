var _, $, jQuery;

var $ = require('ep_etherpad-lite/static/js/rjquery').$;
var _ = require('ep_etherpad-lite/static/js/underscore');
var cssFiles = ['ep_comments/static/css/comment.css'];

/************************************************************************/
/*                         ep_comments Plugin                           */
/************************************************************************/
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
 

// Container 
function ep_comments(context){
  this.container  = null;
  this.padOuter   = null;
  this.sideDiv    = null;
  this.padInner   = null;
  this.ace        = context.ace;
  this.socket     = io.connect('/comment');
  this.padId      = clientVars.padId;
  this.comments   = [];

  this.init();
}

// Init Etherpad plugin comment pads
ep_comments.prototype.init = function(){
  var self = this;
  var ace = this.ace;

  // Init prerequisite
  this.findContainers();
  this.insertContainer();
  this.hideLineNumbers();

  // Get all comments
  this.getComments(function (comments){
    if (!$.isEmptyObject(comments)){
      self.setComments(comments);
      self.collectComments();
    }
  });

  // Init add push event
  this.pushComment('add', function (commentId, comment){
    self.setComment(commentId, comment);
    console.log('pushComment', comment);
    window.setTimeout(function() {
      self.collectComments();
    }, 300);
  });

  // On click comment icon toolbar 
  $('#addComment').on('click', function(){
    // If a new comment box doesn't already exist 
    // Add a new comment and link it to the selection 
    if (self.container.find('#newComment').length == 0) self.addComment();
  });
};

// Insert comments container on sideDiv element use for linenumbers 
ep_comments.prototype.findContainers = function(){
  var padOuter = $('iframe[name="ace_outer"]').contents();

  this.padOuter = padOuter;
  this.sideDiv  = padOuter.find('#sidediv');
  this.padInner = padOuter.find('iframe[name="ace_inner"]');
};

// Hide line numbers
ep_comments.prototype.hideLineNumbers = function(){
  this.sideDiv.find('table').hide();
};

// Collect Comments and link text content to the sidediv
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

    if (commentId === null) {
      var isAuthorClassName = /(?:^| )(a.[A-Za-z0-9]*)/.exec(cls);
      if (isAuthorClassName) self.removeComment(isAuthorClassName[1], it);

      console.log('o_O', cls);
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

        $this.mouseenter(function(){
          commentElm.addClass('mouseover');
        }).mouseleave(function(){
          commentElm.removeClass('mouseover');
        });

        $(this).on('click', function(){
          markerTop = $(this).position().top;
          commentTop = commentElm.position().top;
          containerTop = container.css('top');
          console.log(container);
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
};

ep_comments.prototype.removeComment = function(className, id){
  console.log('remove comment', className, id);
}

// Insert comment container in sidebar
ep_comments.prototype.insertContainer = function(){
  var sideDiv = this.sideDiv;

  // Add comments 
  sideDiv.prepend('<div id="comments"></div>');

  this.container = sideDiv.find('#comments');
};

// Insert new Comment Form
ep_comments.prototype.insertNewComment = function(comment, callback){
  var index = 0;
  
  this.insertComment("", comment, index, true);

  this.container.find('#newComment #comment-reset').on('click',function(){
    var form = $(this).parent().parent();
    form.remove();
  });

  this.container.find('#newComment').submit(function(){
    var form = $(this);
    var text = form.find('.comment-content').val();

    if (text.length != 0) {
      form.remove();
      callback(text, index);
    }

    return false;
  });
};

// Insert a comment node 
ep_comments.prototype.insertComment = function(commentId, comment, index, isNew){
  var template          = (isNew === true) ? 'newCommentTemplate' : 'commentsTemplate';
  var content           = null;
  var container         = this.container;
  var commentAfterIndex = container.find('.sidebar-comment').eq(index);

  comment.commentId = commentId;
  content = $('#'+ template).tmpl(comment);

  console.log('position', index, commentAfterIndex);
  if (index === 0) {
    content.prependTo(container);
  } else if (commentAfterIndex.length === 0) {
    content.appendTo(container);
  } else {
    commentAfterIndex.before(content);
  }
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

  this.insertNewComment(data, function (text, index){
    data.comment.text = text;

    // Save comment
    socket.emit('addComment', data, function (commentId, comment){
      comment.commentId = commentId;
      
      //callback(commentId);
      ace.callWithAce(function (ace){
        console.log('addComment :: ', commentId);
        ace.ace_performSelectionChange(rep.selStart,rep.selEnd,true);
        ace.ace_setAttributeOnSelection('comment', commentId);
      },'insertComment', true);

      self.setComment(commentId, comment);
      self.collectComments();
    });
  });
};

// Push comment from collaborators
ep_comments.prototype.pushComment = function(eventType, callback){
  var socket = this.socket;

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
};

/************************************************************************/
/*                           Etherpad Hooks                             */
/************************************************************************/

var hooks = {

  // Init pad comments 
  postAceInit: function(hook, context){
    var Comments = new ep_comments(context);
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