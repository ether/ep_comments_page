describe('ep_comments_page - Comment Delete', function(){
  var helperFunctions;
  var textOfComment = 'original comment';
  var textOfReply = 'original reply';
  var FIRST_LINE = 0;

  // create pad with a comment and a reply
  beforeEach(function (done) {
    helper.waitFor(function(){
      return (ep_comments_page_test_helper !== 'undefined')
    });
    helperFunctions = ep_comments_page_test_helper.commentDelete;
    helperFunctions.createPad(this, function(){
      helperFunctions.addComentAndReplyToLine(FIRST_LINE, textOfComment, textOfReply, done);
    });
  });

  context('when user presses the delete button on a comment', function(){
    it("should delete comment", function(done){
      var outer$ = helper.padOuter$;
      var inner$ = helper.padInner$;
      outer$('.comment-delete').click();
      helper.waitFor(function(){
        return inner$('.comment').length === 0;
      }).done(function () {
        if(inner$('.comment').length !== 0) throw new Error("Error deleting comment");
        done();
      });
    });

  });

  context('when user presses the delete button on other users comment', function(){
    it('should not delete comment', async function () {
      var outer$ = helper.padOuter$;
      await new Promise((resolve) => setTimeout(resolve, 500));
      await new Promise((resolve) => helper.newPad(resolve, helperFunctions.padId));
      await helper.waitForPromise(() => {
        outer$ = helper.padOuter$;
        return !!outer$ && outer$('.comment-delete').length;
      });
      outer$('.comment-delete').click();
      await helper.waitForPromise(() => {
        const chrome$ = helper.padChrome$;
        return chrome$('#gritter-container').find('.error').length > 0;
      });
      const inner$ = helper.padInner$;
      if (inner$('.comment').length === 0) throw new Error('Comment should not have been deleted');
    });
  });
});

var ep_comments_page_test_helper = ep_comments_page_test_helper || {};
ep_comments_page_test_helper.commentDelete = {
  padId: undefined,
  createPad: function(test, cb) {
    var self = this;
    this.padId = helper.newPad(function(){
      self.enlargeScreen(function(){
        self.createOrResetPadText(function(){
          cb();
        });
      });
    });
    test.timeout(60000);
  },
  createOrResetPadText: function(cb) {
    this.cleanPad(function(){
      var inner$ = helper.padInner$;
      inner$('div').first().sendkeys('something\n anything');
      helper.waitFor(function(){
        var inner$ = helper.padInner$;
        var lineLength = inner$('div').length;

        return lineLength > 1;
      }).done(cb);
    });
  },
  reloadPad: function(test, cb){
    test.timeout(20000);
    var self = this;
    var padId = this.padId;
    // we do nothing for a second while we wait for content to be collected before reloading
    // this may be hacky, but we need time for CC to run so... :?
    setTimeout(function() {
      helper.newPad(function(){
        self.enlargeScreen(cb);
      }, padId);
    }, 1000);
  },
  cleanPad: function(callback) {
    var inner$ = helper.padInner$;
    var $padContent = inner$("#innerdocbody");
    $padContent.html(" ");

    // wait for Etherpad to re-create first line
    helper.waitFor(function(){
      var lineNumber = inner$("div").length;
      return lineNumber === 1;
    }, 20000).done(callback);
  },
  enlargeScreen: function(callback) {
    $('#iframe-container iframe').css("max-width", "3000px");
    callback();
  },
  addComentAndReplyToLine: function(line, textOfComment, textOfReply, callback) {
    var self = this;
    this.addCommentToLine(line, textOfComment, function(){
      self.addCommentReplyToLine(line, textOfReply, callback);
    });
  },
  addCommentToLine: function(line, textOfComment, callback) {
    var outer$ = helper.padOuter$;
    var chrome$ = helper.padChrome$;
    var $line = this.getLine(line);
    $line.sendkeys('{selectall}'); // needs to select content to add comment to
    var $commentButton = chrome$(".addComment");
    $commentButton.click();

    // fill the comment form and submit it
    var $commentField = chrome$("textarea.comment-content");
    $commentField.val(textOfComment);
    var $submittButton = chrome$(".comment-buttons input[type=submit]");
    $submittButton.click();

    // wait until comment is created and comment id is set
    this.createdCommentOnLine(line, callback);
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
    var $replyField = outer$(".comment-content");
    $replyField.val(textOfReply);

    // submit reply
    var $submitReplyButton = outer$("form.new-comment input[type='submit']").first();
    $submitReplyButton.click();

    // wait for the reply to be saved
    helper.waitFor(function() {
      var hasSavedReply = outer$(".sidebar-comment-reply").length === existingReplies + 1;
      return hasSavedReply;
    }).done(callback);
  },
  getLine: function(lineNum) {
    var inner$ = helper.padInner$;
    var $line = inner$('div').slice(lineNum, lineNum + 1);
    return $line;
  },
  createdCommentOnLine: function(line, cb) {
    var self = this;
    helper.waitFor(function() {
      return self.getCommentIdOfLine(line) !== null;
    }).done(cb);
  },
  getCommentIdOfLine: function(line) {
    var $line = this.getLine(line);
    var comment = $line.find(".comment");
    var cls = comment.attr('class');
    var classCommentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
    var commentId = (classCommentId) ? classCommentId[1] : null;

    return commentId;
  },
  commentIconsEnabled: function() {
    return helper.padOuter$("#commentIcons").length > 0;
  },
  clickEditCommentButton: function () {
    var outer$ = helper.padOuter$;
    var $editButton = outer$(".comment-edit").first();
    $editButton.click();
  },
  clickEditCommentReplyButton: function () {
    var outer$ = helper.padOuter$;
    var $editButton = outer$(".comment-edit").last();
    $editButton.click();
  },
  getEditForm: function () {
    var outer$ = helper.padOuter$;
    return outer$(".comment-edit-form");
  },
  checkIfOneFormEditWasAdded: function () {
    expect(this.getEditForm().length).to.be(1);
  },
  checkIfOneFormEditWasRemoved: function () {
    expect(this.getEditForm().length).to.be(0);
  },
  checkIfCommentFieldIsHidden: function (fieldClass) {
    var outer$ = helper.padOuter$;
    var $field = outer$('.' + fieldClass).first();
    expect($field.is(':visible')).to.be(false);
  },
  pressCancel: function () {
    var $cancelButton =  this.getEditForm().find('.comment-edit-cancel');
    $cancelButton.click();
  },
  pressSave: function () {
    var $saveButton =  this.getEditForm().find('.comment-edit-submit');
    $saveButton.click();
  },
  writeCommentText: function (commentText) {
    this.getEditForm().find('.comment-edit-text').text(commentText);
  },
};
