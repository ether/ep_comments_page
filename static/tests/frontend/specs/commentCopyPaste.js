describe('ep_comments_page - Comment copy and paste', function() {
  var helperFunctions, event;
  var utils = ep_comments_page_test_helper.utils;
  var apiUtils = ep_comments_page_test_helper.apiUtils;

  var FIRST_LINE = 0;
  var SECOND_LINE = 1;

  var COMMENT_TEXT = 'My comment';
  var REPLY_TEXT = 'A reply';

  before(function(done) {
    helperFunctions = ep_comments_page_test_helper.copyAndPaste;
    utils.createPad(this, function() {
      utils.addCommentAndReplyToLine(FIRST_LINE, COMMENT_TEXT, REPLY_TEXT, done);
    });
    this.timeout(10000);
  });

  context('when user copies and pastes a text with comment and reply', function() {
    var originalCommentId, originalReplyId;

    before(function(done) {
      var $firstLine = helper.padInner$('div').eq(0);
      helper.selectLines($firstLine, $firstLine, 1, 8); //'omethin'

      originalCommentId = utils.getCommentIdOfLine(FIRST_LINE);
      originalReplyId = utils.getReplyIdOfLine(FIRST_LINE);

      event = helperFunctions.copySelectedText();
      helperFunctions.pasteTextOnLine(event, SECOND_LINE);

      utils.waitForCommentToBeCreatedOnLine(SECOND_LINE, done);
    });

    it('generates a different comment id for the comment pasted', function(done) {
      var commentIdLinePasted = utils.getCommentIdOfLine(SECOND_LINE);
      expect(commentIdLinePasted).to.not.be(originalCommentId);
      done();
    });

    it('generates a different reply id for the reply pasted', function(done) {
      var replyIdLinePasted = utils.getReplyIdOfLine(SECOND_LINE);
      expect(replyIdLinePasted).to.not.be(originalReplyId);
      done();
    });

    it('creates a new icon for the comment pasted', function(done) {
      var outer$ = helper.padOuter$;

      helper.waitFor(function() {
        var $commentIcon = outer$('.comment-icon.withReply');
        // 2 = the original comment and the pasted one
        return $commentIcon.length === 2;
      }).done(done);
    });

    it('creates the comment text field with the same text of the one copied', function(done) {
      var commentPastedText = helperFunctions.getTextOfCommentFromLine(SECOND_LINE);
      expect(commentPastedText).to.be(COMMENT_TEXT);
      done();
    });

    it('creates the comment reply text field with the same text of the one copied', function(done) {
      var commentReplyText = helperFunctions.getTextOfCommentReplyFromLine(SECOND_LINE);
      expect(commentReplyText).to.be(REPLY_TEXT);
      done();
    });

    context('when user removes the original comment', function() {
      before(function() {
        apiUtils.simulateCallToDeleteComment(originalCommentId);
      });

      after(function() {
        utils.undo();
      });

      it('does not remove the comment pasted', function(done) {
        var inner$ = helper.padInner$;
        var commentsLength = inner$('.comment').length;
        expect(commentsLength).to.be(1);
        done();
      });
    });
  });

  context('when user copies and pastes a formatted text with comment and reply', function() {
    before(function(done) {
      var $firstLine = utils.getLine(0);
      helper.selectLines($firstLine, $firstLine); //'something'
      helper.padChrome$('.buttonicon-bold').click();

      var $firstLine = utils.getLine(0);
      helper.selectLines($firstLine, $firstLine, 1, 8); //'omethin'
      helper.padChrome$('.buttonicon-italic').click();

      var $firstLine = utils.getLine(0);
      helper.selectLines($firstLine, $firstLine, 2, 7); //'methi'
      helper.padChrome$('.buttonicon-underline').click();

      var $firstLine = utils.getLine(0);
      helper.selectLines($firstLine, $firstLine, 3, 6); //'eth'
      event = helperFunctions.copySelectedText();
      helperFunctions.pasteTextOnLine(event, SECOND_LINE);

      utils.waitForCommentToBeCreatedOnLine(SECOND_LINE, done);
    });

    it('pastes a new comment', function(done) {
      var commentIdLinePasted = utils.getCommentIdOfLine(SECOND_LINE);
      expect(commentIdLinePasted).to.not.be(undefined);
      done();
    });

    it('pastes a new reply', function(done) {
      var replyIdLinePasted = utils.getReplyIdOfLine(SECOND_LINE);
      expect(replyIdLinePasted).to.not.be(undefined);
      done();
    });

    it('pastes content with the outer formatting', function(done) {
      var $pastedContent = utils.getLine(SECOND_LINE);
      expect($pastedContent.find('b').length).to.not.be(0);
      done();
    });

    it('pastes content with the formatting in the middle', function(done) {
      var $pastedContent = utils.getLine(SECOND_LINE);
      expect($pastedContent.find('i').length).to.not.be(0);
      done();
    });

    it('pastes content with the inner formatting', function(done) {
      var $pastedContent = utils.getLine(SECOND_LINE);
      expect($pastedContent.find('u').length).to.not.be(0);
      done();
    });
  });
});

var ep_comments_page_test_helper = ep_comments_page_test_helper || {};
ep_comments_page_test_helper.copyAndPaste = {
  copySelectedText: function(){
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
    ep_comments_page_test_helper.utils.placeCaretOnLine(line, function() {
      var copiedHTML = event.originalEvent.clipboardData.getData('text/html');
      helper.padInner$.document.execCommand('insertHTML', false, copiedHTML);
    });
  },
  getTextOfCommentFromLine: function(lineNumber) {
    var utils = ep_comments_page_test_helper.utils;
    var commentData = utils.getCommentDataOfLine(lineNumber);
    return commentData.text;
  },
  getTextOfCommentReplyFromLine: function(lineNumber) {
    var utils = ep_comments_page_test_helper.utils;
    var commentData = utils.getCommentDataOfLine(lineNumber);
    var replyIds = Object.keys(commentData.replies);
    return commentData.replies[replyIds[0]].text;
  },
};
