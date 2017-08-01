var ep_comments_page_test_helper = ep_comments_page_test_helper || {};
ep_comments_page_test_helper.utils = {
  padId: undefined,

  _loadPad: function(test, done) {
    var self = this;

    test.timeout(60000);

    this.padId = helper.newPad(function() {
      ep_comments_page_test_helper.apiUtils.startListeningToApiEvents();
      self._enlargeScreen();
      done();
    }, this.padId);
  },

  createPad: function(test, done) {
    var self = this;
    self._loadPad(test, function() {
      self._createOrResetPadText(done);
    });
  },

  reloadPad: function(test, done) {
    var self = this;
    setTimeout(function() {
      self._loadPad(test, done);
    }, 1000);
  },

  _createOrResetPadText: function(done) {
    this._cleanPad(function() {
      var inner$ = helper.padInner$;
      inner$('div').first().sendkeys('something\n anything');
      helper.waitFor(function() {
        var inner$ = helper.padInner$;
        var lineLength = inner$('div').length;

        return lineLength > 1;
      }).done(done);
    });
  },

  _cleanPad: function(done) {
    var inner$ = helper.padInner$;
    var $padContent = inner$('#innerdocbody');
    $padContent.html('');

    // wait for Etherpad to re-create first line
    helper.waitFor(function() {
      var lineNumber = inner$('div').length;
      return lineNumber === 1;
    }, 2000).done(done);
  },

  _enlargeScreen: function() {
    $('#iframe-container iframe').css('max-width', '3000px');
  },

  addComentAndReplyToLine: function(line, textOfComment, textOfReply, done) {
    var self = this;
    this.addCommentToLine(line, textOfComment, function() {
      self.addCommentReplyToLine(line, textOfReply, done);
    });
  },

  addCommentToLine: function(line, textOfComment, done) {
    var outer$ = helper.padOuter$;
    var chrome$ = helper.padChrome$;
    var $line = this.getLine(line);
    $line.sendkeys('{selectall}'); // needs to select content to add comment to
    var $commentButton = chrome$('.addComment');
    $commentButton.click();

    // fill the comment form and submit it
    var $commentField = outer$('textarea.comment-content');
    $commentField.val(textOfComment);
    var $submittButton = outer$('input[type=submit]');
    $submittButton.click();

    // wait until comment is created and comment id is set
    this._createdCommentOnLine(line, done);
  },

  addCommentReplyToLine: function(line, textOfReply, done) {
    var outer$ = helper.padOuter$;
    var commentId = this.getCommentIdOfLine(line);
    var existingReplies = outer$('.sidebar-comment-reply').length;

    // if comment icons are enabled, make sure we display the comment box:
    if (this.commentIconsEnabled()) {
      // click on the icon
      var $commentIcon = outer$('#commentIcons #icon-'+commentId).first();
      $commentIcon.click();
    }

    // fill reply field
    var $replyField = outer$('.comment-reply-input');
    $replyField.val(textOfReply);

    // submit reply
    var $submitReplyButton = outer$("form.comment-reply input[type='submit']").first();
    $submitReplyButton.click();

    // wait for the reply to be saved
    helper.waitFor(function() {
      var hasSavedReply = outer$('.sidebar-comment-reply').length === existingReplies + 1;
      return hasSavedReply;
    }).done(done);
  },

  getLine: function(lineNum) {
    return helper.padInner$('div:eq(' + lineNum + ')');
  },

  _createdCommentOnLine: function(line, done) {
    var self = this;
    helper.waitFor(function() {
      return self.getCommentIdOfLine(line) !== null;
    }).done(done);
  },

  getCommentIdOfLine: function(line) {
    var $line = this.getLine(line);
    var comment = $line.find('.comment');
    var cls = comment.attr('class');
    var classCommentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
    var commentId = (classCommentId) ? classCommentId[1] : null;

    return commentId;
  },

  commentIconsEnabled: function() {
    return helper.padOuter$('#commentIcons').length > 0;
  },

  clickEditCommentButton: function () {
    var outer$ = helper.padOuter$;
    var $editButton = outer$('.comment-edit').first();
    $editButton.click();
  },

  clickEditCommentReplyButton: function () {
    var outer$ = helper.padOuter$;
    var $threeDots = outer$('.comment-options-button').last();
    $threeDots.click();
    var $editButton = outer$('.comment-edit').last();
    $editButton.click();
  },

  getEditForm: function () {
    var outer$ = helper.padOuter$;
    return outer$('.comment-edit-form');
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
}
