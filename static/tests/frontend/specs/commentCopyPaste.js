describe('Comment copy and paste', function () {
  var helperFunctions, event;

  var FIRST_LINE = 0;
  var SECOND_LINE = 1;

  before(function(cb){
    helperFunctions = ep_comments_page_test_helper.copyAndPaste;
    helperFunctions.createPad(this, cb);
  });

  context('when user copies a text with a comment', function(){
    var commentText = 'My comment';
    var replyText = 'A reply';
    before(function (cb) {
      helperFunctions.addComentAndReplyToLine(FIRST_LINE, commentText, replyText, function(){
        event = helperFunctions.copyLine();
        cb();
      });
    });

    // create a new pad after the tests of paste run
    after(function(cb) {
      helperFunctions.createPad(this, cb);
    });

    it('keeps the text copied on the buffer', function (done) {
      var dataFromGetData = event.originalEvent.clipboardData.getData('text/html');
      var $dataFromGetData = $(dataFromGetData);
      var textCopied = helperFunctions.cleanText($dataFromGetData.text());
      var hasCopiedSpanTag = $dataFromGetData.filter('span').length === 1;
      expect(textCopied).to.be('something ');
      expect(hasCopiedSpanTag).to.be(true);
      done();
    });

    it('generates a fake comment class', function(done) {
      var dataFromGetData = event.originalEvent.clipboardData.getData('text/html');
      var $dataFromGetData = $(dataFromGetData);
      var classes = $dataFromGetData.attr('class');
      var hasFakerCommentClass = classes.match(/(fakecomment-)([a-zA-Z0-9]{16}$)/).length > 0;
      expect(hasFakerCommentClass).to.be(true);
      done();
    });

    it('puts the comment data on the clipboardData', function(done) {
      var commentDataValues = helperFunctions.getCommentDataValues(event);
      var originalCommentId = helperFunctions.getCommentIdOfLine(FIRST_LINE);
      var textOfCommentOnClipboard = commentDataValues.text;
      var idOfOriginalCommentOnClipboard = commentDataValues.originalCommentId;
      expect(textOfCommentOnClipboard).to.be(commentText);
      expect(idOfOriginalCommentOnClipboard).to.be(originalCommentId)
      done();
    });

    it('puts the comment reply data on the clipboardData', function(done) {
      var commentReplyDataValues = helperFunctions.getCommentReplyDataValues(event);
      var textOfCommentOnClipboard = commentReplyDataValues.text;
      expect(textOfCommentOnClipboard).to.be(replyText);
      done();
    });

    it('has the fields required to build a comment', function(done) {
      var commentDataValues = helperFunctions.getCommentDataValues(event);
      var keys = _.keys(commentDataValues);
      var keysLength = keys.length;
      var keysRequired = ["author", "name", "text", "timestamp", "commentId", "date", "formattedDate", "originalCommentId"];
      var containsAllKeys = _.difference(keys, keysRequired).length === 0;
      expect(keysLength).to.be(8);
      expect(containsAllKeys).to.be(true);
      done();
    });

    it('has the fields required to build a comment reply', function(done) {
      var commentReplyDataValues = helperFunctions.getCommentReplyDataValues(event);
      var keys = _.keys(commentReplyDataValues);
      var keysLength = keys.length;
      var keysRequired = ["commentId", "text", "changeTo", "changeFrom", "author", "name", "timestamp", "replyId", "formattedDate"];
      var containsAllKeys = _.difference(keys, keysRequired).length === 0;
      expect(keysLength).to.be(9);
      expect(containsAllKeys).to.be(true);
      done();
    });
  });

  context('when user pastes a text with comment', function() {
    var commentText = 'My comment 2';
    var replyText = 'Reply 2';
    before(function (cb) {
      helperFunctions.enlargeScreen(function(){
        helperFunctions.addComentAndReplyToLine(FIRST_LINE, commentText, replyText, function(){
          event = helperFunctions.copyLine();
          helperFunctions.pasteTextOnLine(event, SECOND_LINE);
          cb();
        });
      });
    });

    it('generates a different comment id for the comment pasted', function (done) {
      var commentIdOriginal = helperFunctions.getCommentIdOfLine(FIRST_LINE);
      var commentIdLinePasted = null;
      // wait for the new comment to be created
      helper.waitFor(function(){
        commentIdLinePasted = helperFunctions.getCommentIdOfLine(SECOND_LINE);
        return commentIdLinePasted !== null;
      }).done(function(){
        var commentsHasDifferentIds = commentIdOriginal !== commentIdLinePasted;
        expect(commentsHasDifferentIds).to.be(true);
        done();
      });
    });

    it('creates a new icon for the comment pasted', function(done) {
      helperFunctions.finishTestIfIconsAreNotEnabled(done, function(){
        helperFunctions.createdCommentOnLine(SECOND_LINE, function(){
          var outer$ = helper.padOuter$;

          // for some reason appears a comment reply icon on top
          var $commentIcon = outer$('.comment-icon');
          expect($commentIcon.length).to.be(2);
          done();
        });
      });
    });

    it('keeps the comment text', function(done) {
      helperFunctions.createdCommentOnLine(SECOND_LINE, function(){
        var commentPastedText = helperFunctions.getTextOfCommentFromLine(SECOND_LINE);
        expect(commentPastedText).to.be(commentText);
        done();
      });
    });

    it('keeps the comment reply text', function(done) {
      helperFunctions.createdCommentOnLine(SECOND_LINE, function(){
        var commentReplyText = helperFunctions.getTextOfCommentReplyFromLine(SECOND_LINE);
        expect(commentReplyText).to.be(replyText);
        done();
      });
    });

    context('when user removes the original comment', function(){

      it('does not remove the comment pasted', function (done) {
        helperFunctions.createdCommentOnLine(SECOND_LINE, function(){
          helperFunctions.removeCommentFromLine(FIRST_LINE, function(){
            var inner$ = helper.padInner$;
            var commentsLength = inner$('.comment').length;
            expect(commentsLength).to.be(1);
            done();
          });
        });
      });
    });
  });
});

var ep_comments_page_test_helper = ep_comments_page_test_helper || {};
ep_comments_page_test_helper.copyAndPaste = {
  createPad: function(test, cb) {
    var self = this;
    helper.newPad(function(){
      self.createPadText();
      cb();
    });
    test.timeout(60000);
  },
  createPadText: function() {
    var inner$ = helper.padInner$;
    inner$('div').first().sendkeys('something \n');
  },
  addComentAndReplyToLine: function(line, textOfComment, textOfReply, callback) {
    var self = this;
    this.addCommentToLine(line, textOfComment, function(){
      self.addCommentReplyToLine(line, textOfReply, callback);
    });
  },
  deleteComment: function(callback){
    var chrome$ = helper.padChrome$;
    var outer$ = helper.padOuter$;

    //click on the settings button to make settings visible
    var $deleteButton = outer$(".comment-delete");
    $deleteButton.click();

    helper.waitFor(function() {
      return chrome$(".sidebar-comment").is(":visible") === false;
    })
    .done(callback);
  },
  addCommentReplyToLine: function(line, textOfReply, callback) {
    var outer$ = helper.padOuter$;
    var commentId = this.getCommentIdOfLine(line);
    var existingReplies = outer$(".sidebar-comment-reply").length;

    // if comment icons are enabled, make sure we display the comment box:
    if (this.commentIconsEnabled()) {
      // click on the icon
      var $commentIcon = outer$("#commentIcons #icon-"+commentId).first();
      $commentIcon.click();
    }

    // fill reply field
    var $replyField = outer$(".comment-reply-input");
    $replyField.val(textOfReply);

    // submit reply
    var $submitReplyButton = outer$("form.comment-reply input[type='submit']").first();
    $submitReplyButton.click();

    // wait for the reply to be saved
    helper.waitFor(function() {
      return outer$(".sidebar-comment-reply").length === existingReplies + 1;
    }).done(callback);
  },
  commentIconsEnabled: function() {
    return helper.padOuter$("#commentIcons").length > 0;
  },
  addCommentToLine: function(line, textOfComment, callback) {
    var outer$ = helper.padOuter$;
    var chrome$ = helper.padChrome$;
    var $line = this.getLine(line);
    $line.sendkeys('{selectall}'); // needs to select content to add comment to
    var $commentButton = chrome$(".addComment");
    $commentButton.click();

    // fill the comment form and submit it
    var $commentField = outer$("textarea.comment-content");
    $commentField.val(textOfComment);
    var $submittButton = outer$("input[type=submit]");
    $submittButton.click();

    // wait until comment is created and comment id is set
    this.createdCommentOnLine(line, callback);
  },
  removeCommentFromLine: function(line, cb) {
    var outer$ = helper.padOuter$;
    var commentId = this.getCommentIdOfLine(line);

    // click in the comment icon
    var $secondCommentIcon = outer$("#commentIcons #icon-"+ commentId);
    $secondCommentIcon.click();

    // press delete on sidebar comment
    var $deleteButton = outer$(".comment-delete").slice(line, line + 1);
    $deleteButton.click();
    cb();
  },
  createdCommentOnLine: function(line, cb) {
    var self = this;
    helper.waitFor(function() {
      return self.getCommentIdOfLine(line) !== null;
    }).done(cb);
  },
  copyLine: function(){
    var chrome$ = helper.padChrome$;
    var inner$ = helper.padInner$;

    // store data into a simple object, indexed by format
    var clipboardDataMock = {
     data: {},
     setData: function(format, value) {
       this.data[format] = value;
     },
     getData: function(format) {
       return this.data[format];
     }
    };

    var event = jQuery.Event("copy");
    var e = {clipboardData: clipboardDataMock};
    event.originalEvent = e;

    // Hack: we need to use the same jQuery instance that is registering the main window,
    // so we use "chrome$(inner$("div")[0])" instead of simply "inner$("div)"
    chrome$(inner$("div")[0]).trigger(event);
    return event;
  },
  pasteTextOnLine: function(event, line) {
    var chrome$ = helper.padChrome$;
    var inner$ = helper.padInner$;
    var e = event;
    e.type = "paste";

    // Hack: we need to use the same jQuery instance that is registering the main window,
    // so we use "chrome$(inner$("div")[0])" instead of simply "inner$("div)"
    chrome$(inner$("div")[0]).trigger(event);

    // as we can't trigger the paste on browser(chrome) natively using execCommand, we firstly trigger
    // the event and then insert the html.
    this.placeCaretOnLine(line, function(){
      var copiedHTML = event.originalEvent.clipboardData.getData('text/html');
      helper.padInner$.document.execCommand('insertHTML', true, copiedHTML);
    });
  },
  placeCaretOnLine: function(lineNum, cb) {
    var self = this;
    var $targetLine = this.getLine(lineNum);
    $targetLine.sendkeys("{selectall}");

    helper.waitFor(function() {
     var $targetLine = self.getLine(lineNum);
     var $lineWhereCaretIs = self.getLineWhereCaretIs();

     return $targetLine.get(0) === $lineWhereCaretIs.get(0);
    }).done(cb);
  },
  getLine: function(lineNum) {
    var inner$ = helper.padInner$;
    var $line = inner$('div').slice(lineNum, lineNum + 1);
    return $line;
  },
  getLineWhereCaretIs: function() {
    var inner$ = helper.padInner$;
    var nodeWhereCaretIs = inner$.document.getSelection().anchorNode;
    var $lineWhereCaretIs = $(nodeWhereCaretIs).closest("div");
    return $lineWhereCaretIs;
  },
  cleanText: function(text) {
    return text.replace(/\s/gi, " ");
  },
  getCommentIdOfLine: function(line) {
    var $line = this.getLine(line);
    var comment = $line.find(".comment");
    var cls = comment.attr('class');
    var classCommentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
    var commentId = (classCommentId) ? classCommentId[1] : null;

    return commentId;
  },
  getCommentDataValues: function(event) {
    var commentData = event.originalEvent.clipboardData.getData('text/objectComment');
    var commentDataJSON = JSON.parse(commentData);
    var commentDataValues = _.values(commentDataJSON)[0].data;
    return commentDataValues;
  },
  getCommentReplyDataValues: function(event) {
    var commentReplyData = event.originalEvent.clipboardData.getData('text/objectReply');
    var commentReplyDataJSON = JSON.parse(commentReplyData);
    var commentReplyDataValues = _.values(commentReplyDataJSON)[0];
    return commentReplyDataValues;
  },
  enlargeScreen: function(callback) {
    $('#iframe-container iframe').css("max-width", "1000px");
    callback();
  },
  getTextOfCommentFromLine: function (line) {
    var outer$ = helper.padOuter$;
    var $secondCommentIcon = outer$("#commentIcons #icon-"+ this.getCommentIdOfLine(line));
    $secondCommentIcon.click();

    // check modal is visible
    var commentPastedText = outer$("#comments .sidebar-comment:visible .comment-text").first().text();
    return commentPastedText;
  },
  getTextOfCommentReplyFromLine: function (line) {
    var outer$ = helper.padOuter$;
    var $secondCommentIcon = outer$("#commentIcons #icon-"+ this.getCommentIdOfLine(line));
    $secondCommentIcon.click();

    var commentPastedText = outer$("#" + this.getCommentIdOfLine(line) + " .comment-reply .comment-text").text();
    return commentPastedText;
  },
  finishTestIfIconsAreNotEnabled: function(done, theTest) {
    // #commentIcons will only be inserted if icons are enabled
    if (helper.padOuter$("#commentIcons").length === 0){
      done();
    }else{
      theTest(done);
    }
  },
};