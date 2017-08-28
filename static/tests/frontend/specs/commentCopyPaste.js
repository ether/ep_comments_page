describe('ep_comments_page - Comment copy and paste', function() {
  var helperFunctions, event;
  var utils = ep_comments_page_test_helper.utils;
  var apiUtils = ep_comments_page_test_helper.apiUtils;

  var FIRST_LINE = 0;
  var SECOND_LINE = 1;

  var COMMENT_TEXT = 'My comment';
  var REPLY_TEXT = 'A reply';

  before(function(){
    helperFunctions = ep_comments_page_test_helper.copyAndPaste;
  });

  before(function(done) {
    utils.createPad(this, function() {
      utils.addCommentAndReplyToLine(FIRST_LINE, COMMENT_TEXT, REPLY_TEXT, done);
    });
    this.timeout(10000);
  });

  context('when user copies a text with a comment', function(){
    before(function() {
      var $firstLine = helper.padInner$('div').eq(0);
      helper.selectLines($firstLine, $firstLine, 1, 8); //'omethin'
      event = helperFunctions.copySelectedText();
    });

    it('keeps the text copied on the buffer', function(done) {
      var dataFromGetData = event.originalEvent.clipboardData.getData('text/html');
      var $dataFromGetData = $(dataFromGetData);
      var textCopied = utils.cleanText($dataFromGetData.text());

      // we create two spans to avoid error on paste on chrome, when we copy only a text without tags
      var hasCopiedSpanTag = $dataFromGetData.filter('span').length === 2;
      expect(textCopied).to.be('omethin');
      expect(hasCopiedSpanTag).to.be(true);
      done();
    });

    it('generates a fake comment class', function(done) {
      var dataFromGetData = event.originalEvent.clipboardData.getData('text/html');
      var $dataFromGetData = $(dataFromGetData);
      var fakeCommentClass = $dataFromGetData.attr('class');
      expect(fakeCommentClass).to.match(/(fakecomment-)([a-zA-Z0-9]{16}$)/);
      done();
    });

    it('puts the comment data on the clipboardData', function(done) {
      var commentDataValues = helperFunctions.getCommentDataValues(event);
      var originalCommentId = utils.getCommentIdOfLine(FIRST_LINE);
      var textOfCommentOnClipboard = commentDataValues.text;
      var idOfOriginalCommentOnClipboard = commentDataValues.originalCommentId;
      expect(textOfCommentOnClipboard).to.be(COMMENT_TEXT);
      expect(idOfOriginalCommentOnClipboard).to.be(originalCommentId)
      done();
    });

    it('puts the comment reply data on the clipboardData', function(done) {
      var commentReplyDataValues = helperFunctions.getCommentReplyDataValues(event);
      var textOfCommentOnClipboard = commentReplyDataValues.text;
      expect(textOfCommentOnClipboard).to.be(REPLY_TEXT);
      done();
    });

    it('has the fields required to build a comment', function(done) {
      helperFunctions.testIfHasAllFieldsNecessaryToCreateAComment(event);
      done();
    });

    it('has the fields required to build a comment reply', function(done) {
      helperFunctions.testIfHasAllFieldsNecessaryToCreateACommementReply(event);
      done();
    });
  });

  context('when user pastes a text with comment', function() {
    before(function() {
      event = helperFunctions.copySelectedText();
      helperFunctions.pasteTextOnLine(event, SECOND_LINE);
    });

    it('generates a different comment id for the comment pasted', function(done) {
      var commentIdOriginal = utils.getCommentIdOfLine(FIRST_LINE);
      utils.waitForCommentToBeCreatedOnLine(SECOND_LINE, function(){
        var commentIdLinePasted = utils.getCommentIdOfLine(SECOND_LINE);
        expect(commentIdLinePasted).to.not.be(commentIdOriginal);
        done();
      });
    });

    it('creates a new icon for the comment pasted', function(done) {
      utils.waitForCommentToBeCreatedOnLine(SECOND_LINE, function(){
        var outer$ = helper.padOuter$;

        // 2 = the original comment and the pasted one
        var $commentIcon = outer$('.comment-icon');
        expect($commentIcon.length).to.be(2);
        done();
      });
    });

    it('creates the comment text field with the same text of the one copied', function(done) {
      utils.waitForCommentToBeCreatedOnLine(SECOND_LINE, function(){
        var commentPastedText = helperFunctions.getTextOfCommentFromLine(SECOND_LINE);
        expect(commentPastedText).to.be(COMMENT_TEXT);
        done();
      });
    });

    it('creates the comment reply text field with the same text of the one copied', function(done) {
      utils.waitForCommentToBeCreatedOnLine(SECOND_LINE, function(){
        var commentReplyText = helperFunctions.getTextOfCommentReplyFromLine(SECOND_LINE);
        expect(commentReplyText).to.be(REPLY_TEXT);
        done();
      });
    });

    context('when user removes the original comment', function() {
      before(function() {
        var commentId = utils.getCommentIdOfLine(FIRST_LINE);
        apiUtils.simulateCallToDeleteComment(commentId);
      });

      it('does not remove the comment pasted', function(done) {
        var inner$ = helper.padInner$;
        var commentsLength = inner$('.comment').length;
        expect(commentsLength).to.be(1);
        done();
      });
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
  getCommentIdOfLine: function(line) {
    return ep_comments_page_test_helper.utils.getCommentIdOfLine(line);
  },
  getCommentDataValues: function(event) {
    var commentData = event.originalEvent.clipboardData.getData('text/objectComment');
    var commentDataJSON = JSON.parse(commentData);
    var commentDataValues = _.values(commentDataJSON)[0];
    return commentDataValues;
  },
  getCommentReplyDataValues: function(event) {
    var commentReplyData = event.originalEvent.clipboardData.getData('text/objectReply');
    var commentReplyDataJSON = JSON.parse(commentReplyData);
    var commentReplyDataValues = _.values(commentReplyDataJSON)[0];
    return commentReplyDataValues;
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
  testIfHasAllFieldsNecessaryToCreateACommementReply: function(event) {
    var commentReplyDataValues = this.getCommentReplyDataValues(event);
    var keys = _.keys(commentReplyDataValues);
    var keysRequired = ["commentId", "text", "author", "name", "timestamp", "replyId", "formattedDate"];
    this.checkIfHasAllKeys(keysRequired, keys);
  },
  testIfHasAllFieldsNecessaryToCreateAComment(event) {
    var commentDataValues = this.getCommentDataValues(event);
    var keys = _.keys(commentDataValues);
    var keysRequired = ["author", "name", "text", "timestamp", "commentId", "date", "formattedDate", "originalCommentId"];
    this.checkIfHasAllKeys(keysRequired, keys);
  },
  checkIfHasAllKeys: function(keysRequired, keys) {
    _.each(keysRequired, function(keyRequired){
      expect(keys).to.contain(keyRequired);
    });
  },
};
