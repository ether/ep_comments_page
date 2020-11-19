'use strict';

describe('ep_comments_page - Comment Edit', function () {
  let helperFunctions;
  const textOfComment = 'original comment';
  const textOfReply = 'original reply';
  const FIRST_LINE = 0;

  // create pad with a comment and a reply
  before(function (done) {
    helperFunctions = commentEdit;
    helperFunctions.createPad(this, () => {
      helperFunctions.addComentAndReplyToLine(FIRST_LINE, textOfComment, textOfReply, done);
    });
  });

  context('when user presses the button edit on a comment', function () {
    before(async function () {
      helperFunctions.clickEditCommentButton();
    });

    it('should add a comment form', function (done) {
      helperFunctions.checkIfOneFormEditWasAdded();
      done();
    });

    it('should show the original comment text on the edit form', function (done) {
      const editFormText = helperFunctions.getEditForm().find('.comment-edit-text').text();
      expect(editFormText).to.be(textOfComment);
      done();
    });

    context('and presses edit button again', function () {
      before(async function () {
        helperFunctions.clickEditCommentButton();
      });

      it('should not add a new form', function (done) {
        helperFunctions.checkIfOneFormEditWasAdded();
        done();
      });
    });

    context('and presses cancel', function () {
      before(async function () {
        helperFunctions.pressCancel();
      });

      it('should remove the edit form', function (done) {
        helperFunctions.checkIfOneFormEditWasRemoved();
        done();
      });
    });

    context('and writes a new comment text', function () {
      const updatedText = 'this comment was edited';
      before(async function () {
        helperFunctions.clickEditCommentButton();
        helperFunctions.writeCommentText(updatedText);
      });

      context('and presses save', function () {
        beforeEach(async function () {
          helperFunctions.pressSave();
        });

        it('should update the comment text', function (done) {
          helper.waitFor(() => {
            const outer$ = helper.padOuter$;
            const commentText = outer$('.comment-text').first().text();
            return (commentText === updatedText);
          }).done(() => {
            const outer$ = helper.padOuter$;
            const commentText = outer$('.comment-text').first().text();
            expect(commentText).to.be(updatedText);
            done();
          });
        });

        // ensure that the comment was saved in database
        context('and reloads the page', function () {
          before(function (done) {
            helperFunctions.reloadPad(this, done);
            this.timeout(20000);
          });

          it('shows the comment text updated', function (done) {
            const outer$ = helper.padOuter$;
            helper.waitFor(() => {
              const commentText = outer$('.comment-text').first().text();
              return (commentText === updatedText);
            }, 2000).done(() => {
              const commentText = outer$('.comment-text').first().text();
              expect(commentText).to.be(updatedText);
              done();
            });
          });
        });
      });
    });

    context('new user tries editing', function () {
      const updatedText2 = 'this comment was edited again';

      it('should not update the comment text', async function () {
        let outer$ = helper.padOuter$;
        await new Promise((resolve) => setTimeout(resolve, 500));
        await new Promise((resolve) => helper.newPad(resolve, helperFunctions.padId));
        await helper.waitForPromise(() => {
          outer$ = helper.padOuter$;
          return !!outer$ && outer$('#comments').find('.comment-edit').length;
        });
        helperFunctions.clickEditCommentButton();
        helperFunctions.writeCommentText(updatedText2);
        helperFunctions.pressSave();

        await helper.waitForPromise(() => {
          // Error message is shown
          const chrome$ = helper.padChrome$;
          return chrome$('#gritter-container').find('.error').length > 0;
        });
        await helper.waitForPromise(() => {
          outer$ = helper.padOuter$;
          const commentText = outer$('.comment-text').first().text();
          return (commentText !== updatedText2);
        });
        const commentText = outer$('.comment-text').first().text();
        expect(commentText).to.not.be(updatedText2);
      });
    });
  });
});

const commentEdit = {
  padId: undefined,
  createPad(test, cb) {
    const self = this;
    this.padId = helper.newPad(() => {
      self.enlargeScreen(() => {
        self.createOrResetPadText(() => {
          cb();
        });
      });
    });
    test.timeout(60000);
  },
  createOrResetPadText(cb) {
    this.cleanPad(() => {
      const inner$ = helper.padInner$;
      inner$('div').first().sendkeys('something\n anything');
      helper.waitFor(() => {
        const inner$ = helper.padInner$;
        const lineLength = inner$('div').length;

        return lineLength > 1;
      }).done(cb);
    });
  },
  reloadPad(test, cb) {
    test.timeout(20000);
    const self = this;
    const padId = this.padId;
    // we do nothing for a second while we wait for content to be collected before reloading
    // this may be hacky, but we need time for CC to run so... :?
    setTimeout(() => {
      helper.newPad(() => {
        self.enlargeScreen(cb);
      }, padId);
    }, 1000);
  },
  cleanPad(callback) {
    const inner$ = helper.padInner$;
    const $padContent = inner$('#innerdocbody');
    $padContent.html(' ');

    // wait for Etherpad to re-create first line
    helper.waitFor(() => {
      const lineNumber = inner$('div').length;
      return lineNumber === 1;
    }, 20000).done(callback);
  },
  enlargeScreen(callback) {
    $('#iframe-container iframe').css('max-width', '3000px');
    callback();
  },
  addComentAndReplyToLine(line, textOfComment, textOfReply, callback) {
    const self = this;
    this.addCommentToLine(line, textOfComment, () => {
      self.addCommentReplyToLine(line, textOfReply, callback);
    });
  },
  addCommentToLine(line, textOfComment, callback) {
    const chrome$ = helper.padChrome$;
    const $line = this.getLine(line);
    $line.sendkeys('{selectall}'); // needs to select content to add comment to
    const $commentButton = chrome$('.addComment');
    $commentButton.click();

    // fill the comment form and submit it
    const $commentField = chrome$('textarea.comment-content');
    $commentField.val(textOfComment);
    const $submittButton = chrome$('.comment-buttons input[type=submit]');
    $submittButton.click();

    // wait until comment is created and comment id is set
    this.createdCommentOnLine(line, callback);
  },
  addCommentReplyToLine(line, textOfReply, callback) {
    const outer$ = helper.padOuter$;
    const commentId = this.getCommentIdOfLine(line);
    const existingReplies = outer$('.sidebar-comment-reply').length;

    // if comment icons are enabled, make sure we display the comment box:
    if (this.commentIconsEnabled()) {
      // click on the icon
      const $commentIcon = outer$(`#commentIcons #icon-${commentId}`).first();
      $commentIcon.click();
    }

    // fill reply field
    const $replyField = outer$('.comment-content');
    $replyField.val(textOfReply);

    // submit reply
    const $submitReplyButton = outer$("form.new-comment input[type='submit']").first();
    $submitReplyButton.click();

    // wait for the reply to be saved
    helper.waitFor(() => {
      const hasSavedReply = outer$('.sidebar-comment-reply').length === existingReplies + 1;
      return hasSavedReply;
    }).done(callback);
  },
  getLine(lineNum) {
    const inner$ = helper.padInner$;
    const $line = inner$('div').slice(lineNum, lineNum + 1);
    return $line;
  },
  createdCommentOnLine(line, cb) {
    const self = this;
    helper.waitFor(() => self.getCommentIdOfLine(line) != null).done(cb);
  },
  getCommentIdOfLine(line) {
    const $line = this.getLine(line);
    const comment = $line.find('.comment');
    const cls = comment.attr('class');
    const classCommentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
    const commentId = (classCommentId) ? classCommentId[1] : null;

    return commentId;
  },
  commentIconsEnabled() {
    return helper.padOuter$('#commentIcons').length > 0;
  },
  clickEditCommentButton() {
    const outer$ = helper.padOuter$;
    const $editButton = outer$('.comment-edit').first();
    $editButton.click();
  },
  clickEditCommentReplyButton() {
    const outer$ = helper.padOuter$;
    const $editButton = outer$('.comment-edit').last();
    $editButton.click();
  },
  getEditForm() {
    const outer$ = helper.padOuter$;
    return outer$('.comment-edit-form');
  },
  checkIfOneFormEditWasAdded() {
    expect(this.getEditForm().length).to.be(1);
  },
  checkIfOneFormEditWasRemoved() {
    expect(this.getEditForm().length).to.be(0);
  },
  checkIfCommentFieldIsHidden(fieldClass) {
    const outer$ = helper.padOuter$;
    const $field = outer$(`.${fieldClass}`).first();
    expect($field.is(':visible')).to.be(false);
  },
  pressCancel() {
    const $cancelButton = this.getEditForm().find('.comment-edit-cancel');
    $cancelButton.click();
  },
  pressSave() {
    const $saveButton = this.getEditForm().find('.comment-edit-submit');
    $saveButton.click();
  },
  writeCommentText(commentText) {
    this.getEditForm().find('.comment-edit-text').text(commentText);
  },
};
