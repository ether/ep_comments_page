'use strict';

describe('ep_comments_page - Comment Delete', function () {
  let helperFunctions;
  const textOfComment = 'original comment';
  const textOfReply = 'original reply';
  const FIRST_LINE = 0;

  // create pad with a comment and a reply
  beforeEach(function (done) {
    helperFunctions = commentDelete;
    helperFunctions.createPad(this, () => {
      helperFunctions.addComentAndReplyToLine(FIRST_LINE, textOfComment, textOfReply, done);
    });
  });

  context('when user presses the delete button on a comment', function () {
    it('should delete comment', function (done) {
      const outer$ = helper.padOuter$;
      const inner$ = helper.padInner$;
      outer$('.comment-delete').click();
      helper.waitFor(() => inner$('.comment').length === 0).done(() => {
        if (inner$('.comment').length !== 0) throw new Error('Error deleting comment');
        done();
      });
    });
  });

  context('when user presses the delete button on other users comment', function () {
    it('should not delete comment', async function () {
      let outer$ = helper.padOuter$;
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

const commentDelete = {
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
