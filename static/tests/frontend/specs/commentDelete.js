'use strict';

const utils = require('../utils');

let helperFunctions;
const textOfComment = 'original comment';
const textOfReply = 'original reply';
const FIRST_LINE = 0;

// create pad with a comment and a reply
beforeEach(async function () {
  helperFunctions = commentDelete;
  await helperFunctions.createPad(this);
  await helperFunctions.addCommentAndReplyToLine(FIRST_LINE, textOfComment, textOfReply);
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
    await utils.aNewPad({id: helperFunctions.padId});
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

const commentDelete = {
  padId: undefined,
  async createPad(test) {
    test.timeout(60000);
    this.padId = await utils.aNewPad();
    this.enlargeScreen();
    await this.createOrResetPadText();
  },
  async createOrResetPadText() {
    await this.cleanPad();
    const inner$ = helper.padInner$;
    inner$('div').first().sendkeys('something\n anything');
    await helper.waitForPromise(() => {
      const inner$ = helper.padInner$;
      const lineLength = inner$('div').length;
      return lineLength > 1;
    });
  },
  async cleanPad() {
    const inner$ = helper.padInner$;
    const $padContent = inner$('#innerdocbody');
    $padContent.html(' ');

    // wait for Etherpad to re-create first line
    await helper.waitForPromise(() => {
      const lineNumber = inner$('div').length;
      return lineNumber === 1;
    }, 20000);
  },
  enlargeScreen() {
    $('#iframe-container iframe').css('max-width', '3000px');
  },
  async addCommentAndReplyToLine(line, textOfComment, textOfReply) {
    await this.addCommentToLine(line, textOfComment);
    await this.addCommentReplyToLine(line, textOfReply);
  },
  async addCommentToLine(line, textOfComment) {
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
    await this.createdCommentOnLine(line);
  },
  async addCommentReplyToLine(line, textOfReply) {
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
    await helper.waitForPromise(() => {
      const hasSavedReply = outer$('.sidebar-comment-reply').length === existingReplies + 1;
      return hasSavedReply;
    });
  },
  getLine(lineNum) {
    const inner$ = helper.padInner$;
    const $line = inner$('div').slice(lineNum, lineNum + 1);
    return $line;
  },
  async createdCommentOnLine(line) {
    await helper.waitForPromise(() => this.getCommentIdOfLine(line) != null);
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
};
