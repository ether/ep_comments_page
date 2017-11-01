describe('ep_comments_page - Comment copy and paste', function() {
  var helperFunctions, originalCommentId, originalReplyId;
  var utils = ep_comments_page_test_helper.utils;
  var apiUtils = ep_comments_page_test_helper.apiUtils;

  var LINE_WITH_ORIGINAL_COMMENT = 0;
  var LINE_WITH_PASTED_COMMENT = 1;

  var COMMENT_TEXT = 'My comment';
  var REPLY_TEXT = 'A reply';

  before(function(done) {
    helperFunctions = ep_comments_page_test_helper.copyAndPaste;
    utils.createPad(this, function() {
      utils.addCommentAndReplyToLine(LINE_WITH_ORIGINAL_COMMENT, COMMENT_TEXT, REPLY_TEXT, function() {
        originalCommentId = utils.getCommentIdOfLine(LINE_WITH_ORIGINAL_COMMENT);
        originalReplyId = utils.getReplyIdOfLine(LINE_WITH_ORIGINAL_COMMENT);
        done();
      });
    });
    this.timeout(60000);
  });

  context('when user copies and pastes a text with comment and reply', function() {
    before(function(done) {
      var $firstLine = helper.padInner$('div').eq(0);
      helper.selectLines($firstLine, $firstLine, 1, 8); //'omethin'

      utils.copySelection();
      utils.pasteOnLine(LINE_WITH_PASTED_COMMENT, function() {
        utils.waitForCommentToBeCreatedOnLine(LINE_WITH_PASTED_COMMENT, done);
      });
    });

    after(function(done) {
      helperFunctions.performActionAndWaitForDataToBeSent(utils.undo, done);
    });

    it('generates a different comment id for the comment pasted', function(done) {
      var commentIdLinePasted = utils.getCommentIdOfLine(LINE_WITH_PASTED_COMMENT);
      expect(commentIdLinePasted).to.not.be(originalCommentId);
      done();
    });

    it('generates a different reply id for the reply pasted', function(done) {
      var replyIdLinePasted = utils.getReplyIdOfLine(LINE_WITH_PASTED_COMMENT);
      expect(replyIdLinePasted).to.not.be(originalReplyId);
      done();
    });

    it('creates a new icon for the comment pasted', function(done) {
      var outer$ = helper.padOuter$;

      helper.waitFor(function() {
        var $commentIcon = outer$('.comment-icon.withReply:visible');
        // 2 = the original comment and the pasted one
        return $commentIcon.length === 2;
      }).done(done);
    });

    it('creates the comment text field with the same text of the one copied', function(done) {
      var commentPastedText = helperFunctions.getTextOfCommentFromLine(LINE_WITH_PASTED_COMMENT);
      expect(commentPastedText).to.be(COMMENT_TEXT);
      done();
    });

    it('creates the comment reply text field with the same text of the one copied', function(done) {
      var commentReplyText = helperFunctions.getTextOfCommentReplyFromLine(LINE_WITH_PASTED_COMMENT);
      expect(commentReplyText).to.be(REPLY_TEXT);
      done();
    });

    context('when user removes the original comment', function() {
      before(function() {
        apiUtils.simulateCallToDeleteComment(originalCommentId);
      });

      after(function(done) {
        helperFunctions.performActionAndWaitForDataToBeSent(utils.undo, done);
      });

      it('does not remove the comment pasted', function(done) {
        var inner$ = helper.padInner$;
        var commentsLength = inner$('.comment').length;
        expect(commentsLength).to.be(1);
        done();
      });
    });
  });

  context('when user copies and pastes a text with only comment', function() {
    before(function(done) {
      apiUtils.resetData();
      apiUtils.simulateCallToDeleteReply(originalReplyId, originalCommentId);

      // remove reply to run this context
      apiUtils.waitForDataToBeSent(function() {
        var $firstLine = helper.padInner$('div').eq(0);
        helper.selectLines($firstLine, $firstLine, 1, 8); //'omethin'

        utils.copySelection();
        utils.pasteOnLine(LINE_WITH_PASTED_COMMENT, function() {
          utils.waitForCommentToBeCreatedOnLine(LINE_WITH_PASTED_COMMENT, done);
        });
      });
    });

    after(function(done) {
      helperFunctions.performActionAndWaitForDataToBeSent(function() {
        utils.undo(); // paste
        utils.undo(); // reply deletion
      }, done);
    });

    it('generates a different comment id for the comment pasted', function(done) {
      var commentIdLinePasted = utils.getCommentIdOfLine(LINE_WITH_PASTED_COMMENT);
      expect(commentIdLinePasted).to.not.be(originalCommentId);
      done();
    });

    it('creates a new icon for the comment pasted', function(done) {
      var outer$ = helper.padOuter$;

      helper.waitFor(function() {
        var $commentIcon = outer$('.comment-icon:visible');
        // 2 = the original comment and the pasted one
        return $commentIcon.length === 2;
      }).done(done);
    });

    it('creates the comment text field with the same text of the one copied', function(done) {
      var commentPastedText = helperFunctions.getTextOfCommentFromLine(LINE_WITH_PASTED_COMMENT);
      expect(commentPastedText).to.be(COMMENT_TEXT);
      done();
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

      utils.copySelection();
      utils.pasteOnLine(LINE_WITH_PASTED_COMMENT, function() {
        utils.waitForCommentToBeCreatedOnLine(LINE_WITH_PASTED_COMMENT, done);
      });
    });

    it('pastes a new comment', function(done) {
      var commentIdLinePasted = utils.getCommentIdOfLine(LINE_WITH_PASTED_COMMENT);
      expect(commentIdLinePasted).to.not.be(undefined);
      done();
    });

    it('pastes a new reply', function(done) {
      var replyIdLinePasted = utils.getReplyIdOfLine(LINE_WITH_PASTED_COMMENT);
      expect(replyIdLinePasted).to.not.be(undefined);
      done();
    });

    it('pastes content with the outer formatting', function(done) {
      var $pastedContent = utils.getLine(LINE_WITH_PASTED_COMMENT);
      expect($pastedContent.find('b').length).to.not.be(0);
      done();
    });

    it('pastes content with the formatting in the middle', function(done) {
      var $pastedContent = utils.getLine(LINE_WITH_PASTED_COMMENT);
      expect($pastedContent.find('i').length).to.not.be(0);
      done();
    });

    it('pastes content with the inner formatting', function(done) {
      var $pastedContent = utils.getLine(LINE_WITH_PASTED_COMMENT);
      expect($pastedContent.find('u').length).to.not.be(0);
      done();
    });
  });
});

var ep_comments_page_test_helper = ep_comments_page_test_helper || {};
ep_comments_page_test_helper.copyAndPaste = {
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

  performActionAndWaitForDataToBeSent: function(action, done) {
    var apiUtils = ep_comments_page_test_helper.apiUtils;
    apiUtils.resetData();
    action();
    // wait until all data is restored
    apiUtils.waitForDataToBeSent(done);
  }
};
