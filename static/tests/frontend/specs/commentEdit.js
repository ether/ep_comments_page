describe('ep_comments_page - Comment Edit', function(){
  var helperFunctions;
  var textOfComment = 'original comment';
  var textOfReply = 'original reply';
  var FIRST_LINE = 0;

  // create pad with a comment and a reply
  before(function (done) {
    helperFunctions = ep_comments_page_test_helper.commentEdit;
    helperFunctions.createPad(this, function(){
      helperFunctions.addComentAndReplyToLine(FIRST_LINE, textOfComment, textOfReply, done);
    });
  });

  context('when user presses the button edit on a comment', function(){
    before(function () {
      helperFunctions.clickEditCommentButton();
    });

    it('should add a comment form', function (done) {
      helperFunctions.checkIfOneFormEditWasAdded();
      done();
    });

    it('should hide the author and the comment text', function (done) {
      helperFunctions.checkIfCommentFieldIsHidden('comment-author-name')
      helperFunctions.checkIfCommentFieldIsHidden('comment-author-text')
      done();
    });

    it('should show the original comment text on the edit form', function (done) {
      var editFormText = helperFunctions.getEditForm().find('.comment-edit-text').text();
      expect(editFormText).to.be(textOfComment);
      done();
    });

    context('and presses edit button again', function(){
      before(function () {
        helperFunctions.clickEditCommentButton();
      });

      it('should not add a new form', function (done) {
        helperFunctions.checkIfOneFormEditWasAdded();
        done();
      });
    });

    context('and presses cancel', function(){
      before(function () {
        helperFunctions.pressCancel();
      });

      it('should remove the edit form', function (done) {
        helperFunctions.checkIfOneFormEditWasRemoved();
        done();
      });
    });

    context('and writes a new comment text', function(){
      var updatedText = 'this comment was edited';
      before(function () {
        helperFunctions.clickEditCommentButton();
        helperFunctions.writeCommentText(updatedText)
      });

      context('and presses save', function(){
        beforeEach(function () {
          helperFunctions.pressSave();
        });

        it('should update the comment text', function (done) {
          helper.waitFor(function () {
            var outer$ = helper.padOuter$;
            var commentText = outer$('section.comment-text').first().text();
            return commentText.length;
          }).done(function(){
            var outer$ = helper.padOuter$;
            var commentText = outer$('section.comment-text').first().text();
            expect(commentText).to.be(updatedText);
            done();
          });
        });

        // ensure that the comment was saved in database
        context('and reloads the page',  function () {
          before(function (done) {
            helperFunctions.reloadPad(done);
            this.timeout(10000);
          });

          it('shows the comment text updated', function (done) {
            var outer$ = helper.padOuter$;
            var commentText = outer$('section.comment-text').first().text();
            expect(commentText).to.be(updatedText);
            done();
          });
        });
      });
    });
  });

  context('when user presses the button edit on a comment reply', function(){
    before(function () {
      helperFunctions.clickEditCommentReplyButton();
    });

    it('should show the edit form', function (done) {
      helperFunctions.checkIfOneFormEditWasAdded();
      done();
    });

    it('should show the original comment reply text on the edit form', function (done) {
      var editFormText = helperFunctions.getEditForm().find('.comment-edit-text').text();
      expect(editFormText).to.be(textOfReply);
      done();
    });

    context('and user writes a new comment reply text', function(){
      var updatedText = 'comment reply edited';
      context('and presses save', function(){
        before(function () {
          helperFunctions.writeCommentText(updatedText);
          helperFunctions.pressSave();
        });

        it('should update the comment text', function (done) {
          helper.waitFor(function () {
            var outer$ = helper.padOuter$;
            var commentReplyText = outer$('section.comment-text').last().text();
            return commentReplyText.length;
          }).done(function(){
            var outer$ = helper.padOuter$;
            var commentReplyText = outer$('section.comment-text').last().text();
            expect(commentReplyText).to.be(updatedText);
            done();
          });
        });

        context('and reloads the page', function(){
          before(function (done) {
            helperFunctions.reloadPad(done);
            this.timeout(10000);
          });

          it('should update the comment text', function(done){
            var outer$ = helper.padOuter$;
            var commentReplyText = outer$('section.comment-text').last().text();
            expect(commentReplyText).to.be(updatedText);
            done();
          });
        });
      });
    });
  });
});

var ep_comments_page_test_helper = ep_comments_page_test_helper || {};
ep_comments_page_test_helper.commentEdit = {
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
  reloadPad: function(cb){
    var self = this;
    var padId = this.padId;
    setTimeout(function() {
      helper.newPad(function(){
        self.enlargeScreen(cb);
      }, padId);
    }, 1000);
  },
  cleanPad: function(callback) {
    var inner$ = helper.padInner$;
    var $padContent = inner$("#innerdocbody");
    $padContent.html("");

    // wait for Etherpad to re-create first line
    helper.waitFor(function(){
      var lineNumber = inner$("div").length;
      return lineNumber === 1;
    }, 2000).done(callback);
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
    var $commentField = outer$("textarea.comment-content");
    $commentField.val(textOfComment);
    var $submittButton = outer$("input[type=submit]");
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
    var $replyField = outer$(".comment-reply-input");
    $replyField.val(textOfReply);

    // submit reply
    var $submitReplyButton = outer$("form.comment-reply input[type='submit']").first();
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
