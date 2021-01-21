'use strict';

describe('ep_comments_page - Comment copy and paste', function () {
  let helperFunctions, event;

  const FIRST_LINE = 0;
  const SECOND_LINE = 1;

  before(async function () {
    helperFunctions = copyAndPaste;
  });

  context('when user copies a text with a comment', function () {
    this.timeout(60000);
    const commentText = 'My comment';
    const replyText = 'A reply';
    before(function (cb) {
      helperFunctions.createPad(this, () => {
        helperFunctions.addComentAndReplyToLine(FIRST_LINE, commentText, replyText, () => {
          const $firstLine = helper.padInner$('div').eq(0);
          helper.selectLines($firstLine, $firstLine, 1, 8); // 'omethin'
          try {
            event = helperFunctions.copyLine();
          } catch (e) {
            // suppress e.preventDefault issue with certain browsers
          }
          cb();
        });
      });
      this.timeout(10000);
    });

    xit('keeps the text copied on the buffer', function (done) {
      const dataFromGetData = event.originalEvent.clipboardData.getData('text/html');
      const $dataFromGetData = $(dataFromGetData);
      const textCopied = helperFunctions.cleanText($dataFromGetData.text());

      // we create two spans to avoid error on paste on chrome, when we copy only a text without
      // tags
      const hasCopiedSpanTag = $dataFromGetData.filter('span').length === 2;
      // Skip if Edge
      if (document.documentMode || /Safari/.test(navigator.userAgent) ||
          /Edge/.test(navigator.userAgent)) {
        done();
      }
      expect(textCopied).to.be('omethin');
      expect(hasCopiedSpanTag).to.be(true);
      done();
    });

    xit('generates a fake comment class', function (done) {
      // Skip if Edge
      if (document.documentMode || /Safari/.test(navigator.userAgent) ||
          /Edge/.test(navigator.userAgent)) {
        done();
      }
      const dataFromGetData = event.originalEvent.clipboardData.getData('text/html');
      const $dataFromGetData = $(dataFromGetData);
      const fakeCommentClass = $dataFromGetData.attr('class');
      expect(fakeCommentClass).to.match(/(fakecomment-)([a-zA-Z0-9]{16}$)/);
      done();
    });

    xit('puts the comment data on the clipboardData', function (done) {
      // Skip if Edge
      if (document.documentMode || /Safari/.test(navigator.userAgent) ||
          /Edge/.test(navigator.userAgent)) {
        done();
      }
      const commentDataValues = helperFunctions.getCommentDataValues(event);
      const originalCommentId = helperFunctions.getCommentIdOfLine(FIRST_LINE);
      const textOfCommentOnClipboard = commentDataValues.text;
      const idOfOriginalCommentOnClipboard = commentDataValues.originalCommentId;
      expect(textOfCommentOnClipboard).to.be(commentText);
      expect(idOfOriginalCommentOnClipboard).to.be(originalCommentId);
      done();
    });

    xit('puts the comment reply data on the clipboardData', function (done) {
      // Skip if Edge
      if (document.documentMode || /Safari/.test(navigator.userAgent) ||
          /Edge/.test(navigator.userAgent)) {
        done();
      }
      const commentReplyDataValues = helperFunctions.getCommentReplyDataValues(event);
      const textOfCommentOnClipboard = commentReplyDataValues.text;
      expect(textOfCommentOnClipboard).to.be(replyText);
      done();
    });

    xit('has the fields required to build a comment', function (done) {
      // Skip if Edge
      if (document.documentMode || /Safari/.test(navigator.userAgent) ||
          /Edge/.test(navigator.userAgent)) {
        done();
      }
      helperFunctions.testIfHasAllFieldsNecessaryToCreateAComment(event);
      done();
    });

    xit('has the fields required to build a comment reply', function (done) {
      // Skip if Edge
      if (document.documentMode || /Safari/.test(navigator.userAgent) ||
          /Edge/.test(navigator.userAgent)) {
        done();
      }
      helperFunctions.testIfHasAllFieldsNecessaryToCreateACommementReply(event);
      done();
    });
  });

  context('when user pastes a text with comment', function () {
    const commentText = 'My comment 2';
    const replyText = 'Reply 2';
    before(function (cb) {
      helperFunctions.createPad(this, () => {
        helperFunctions.enlargeScreen(() => {
          helperFunctions.addComentAndReplyToLine(FIRST_LINE, commentText, replyText, () => {
            try {
              event = helperFunctions.copyLine();
            } catch (e) {
              // suppress e.preventDefault issue with certain browsers
            }
            try {
              helperFunctions.pasteTextOnLine(event, SECOND_LINE);
            } catch (e) {
              // allowing helper to fail silently.
            }
            cb();
          });
        });
      });
      this.timeout(20000);
    });

    xit('generates a different comment id for the comment pasted', function (done) {
      // Skip if Edge
      if (document.documentMode || /Safari/.test(navigator.userAgent) ||
          /Edge/.test(navigator.userAgent)) {
        done();
      }
      const commentIdOriginal = helperFunctions.getCommentIdOfLine(FIRST_LINE);
      let commentIdLinePasted = null;
      // wait for the new comment to be created
      helper.waitFor(() => {
        commentIdLinePasted = helperFunctions.getCommentIdOfLine(SECOND_LINE);
        return commentIdLinePasted != null;
      }).done(() => {
        // Skip if Edge
        if (document.documentMode || /Safari/.test(navigator.userAgent) ||
            /Edge/.test(navigator.userAgent)) {
          done();
        }
        expect(commentIdLinePasted).to.not.be(commentIdOriginal);
        done();
      });
    });

    xit('creates a new icon for the comment pasted', function (done) {
      // Skip if Edge
      if (document.documentMode || /Safari/.test(navigator.userAgent) ||
          /Edge/.test(navigator.userAgent)) {
        done();
      }
      helperFunctions.finishTestIfIconsAreNotEnabled(done, () => {
        helperFunctions.createdCommentOnLine(SECOND_LINE, () => {
          const outer$ = helper.padOuter$;

          // 2 = the original comment and the pasted one
          const $commentIcon = outer$('.comment-icon');
          expect($commentIcon.length).to.be(2);
          done();
        });
      });
    });

    xit('creates the comment text field with the same text of the one copied', function (done) {
      helperFunctions.createdCommentOnLine(SECOND_LINE, () => {
        const commentPastedText = helperFunctions.getTextOfCommentFromLine(SECOND_LINE);
        expect(commentPastedText).to.be(commentText);
        done();
      });
    });

    xit('creates comment reply text field with the same text of the one copied', function (done) {
      // Skip if Edge
      if (document.documentMode || /Safari/.test(navigator.userAgent) ||
          /Edge/.test(navigator.userAgent)) {
        done();
      }
      helperFunctions.createdCommentOnLine(SECOND_LINE, () => {
        const commentReplyText = helperFunctions.getTextOfCommentReplyFromLine(SECOND_LINE);
        expect(commentReplyText).to.be(replyText);
        done();
      });
    });

    context('when user removes the original comment', function () {
      xit('does not remove the comment pasted', function (done) {
        // Skip if Edge
        if (document.documentMode || /Safari/.test(navigator.userAgent) ||
            /Edge/.test(navigator.userAgent)) {
          done();
        }
        helperFunctions.removeCommentFromLine(FIRST_LINE, () => {
          const inner$ = helper.padInner$;
          const commentsLength = inner$('.comment').length;
          expect(commentsLength).to.be(1);
          done();
        });
      });
    });
  });
});

const copyAndPaste = {
  createPad(test, cb) {
    const self = this;
    helper.newPad(() => {
      self.createOrResetPadText(cb);
    });
    test.timeout(60000);
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
  addComentAndReplyToLine(line, textOfComment, textOfReply, callback) {
    const self = this;
    this.addCommentToLine(line, textOfComment, () => {
      self.addCommentReplyToLine(line, textOfReply, callback);
    });
  },
  deleteComment(callback) {
    const chrome$ = helper.padChrome$;
    const outer$ = helper.padOuter$;

    // click on the settings button to make settings visible
    const $deleteButton = outer$('.comment-delete');
    $deleteButton.click();
    helper.waitFor(() => chrome$('.sidebar-comment').is(':visible') === false)
        .done(callback);
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
  commentIconsEnabled() {
    return helper.padOuter$('#commentIcons').length > 0;
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
  removeCommentFromLine(line, cb) {
    const outer$ = helper.padOuter$;
    const commentId = this.getCommentIdOfLine(line);

    // click in the comment icon
    const $secondCommentIcon = outer$(`#commentIcons #icon-${commentId}`);
    $secondCommentIcon.click();

    // press delete on sidebar comment
    const $deleteButton = outer$('.comment-delete').slice(line, line + 1);
    $deleteButton.click();
    cb();
  },
  createdCommentOnLine(line, cb) {
    const self = this;
    helper.waitFor(() => self.getCommentIdOfLine(line) != null).done(cb);
  },
  copyLine() {
    const chrome$ = helper.padChrome$;
    const inner$ = helper.padInner$;

    // store data into a simple object, indexed by format
    const clipboardDataMock = {
      data: {},
      setData(format, value) {
        this.data[format] = value;
      },
      getData(format) {
        return this.data[format];
      },
    };

    const event = new jQuery.Event('copy');
    const e = {clipboardData: clipboardDataMock};
    event.originalEvent = e;

    // Hack: we need to use the same jQuery instance that is registering the main window,
    // so we use "chrome$(inner$("div")[0])" instead of simply "inner$("div)"
    chrome$(inner$('div')[0]).trigger(event);
    return event;
  },
  pasteTextOnLine(event, line) {
    const chrome$ = helper.padChrome$;
    const inner$ = helper.padInner$;
    const e = event;
    e.type = 'paste';

    // Hack: we need to use the same jQuery instance that is registering the main window,
    // so we use "chrome$(inner$("div")[0])" instead of simply "inner$("div)"
    chrome$(inner$('div')[0]).trigger(event);

    // as we can't trigger the paste on browser(chrome) natively using execCommand, we firstly
    // trigger the event and then insert the html.
    this.placeCaretOnLine(line, () => {
      const copiedHTML = event.originalEvent.clipboardData.getData('text/html');
      helper.padInner$.document.execCommand('insertHTML', false, copiedHTML);
    });
  },
  placeCaretOnLine(lineNum, cb) {
    const self = this;
    const $targetLine = this.getLine(lineNum);
    $targetLine.sendkeys('{selectall}');

    helper.waitFor(() => {
      const $targetLine = self.getLine(lineNum);
      const $lineWhereCaretIs = self.getLineWhereCaretIs();

      return $targetLine.get(0) === $lineWhereCaretIs.get(0);
    }).done(cb);
  },
  getLine(lineNum) {
    const inner$ = helper.padInner$;
    const $line = inner$('div').slice(lineNum, lineNum + 1);
    return $line;
  },
  getLineWhereCaretIs() {
    const inner$ = helper.padInner$;
    const nodeWhereCaretIs = inner$.document.getSelection().anchorNode;
    const $lineWhereCaretIs = $(nodeWhereCaretIs).closest('div');
    return $lineWhereCaretIs;
  },
  cleanText(text) {
    return text.replace(/\s/gi, ' ');
  },
  getCommentIdOfLine(line) {
    const $line = this.getLine(line);
    const comment = $line.find('.comment');
    const cls = comment.attr('class');
    const classCommentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
    const commentId = (classCommentId) ? classCommentId[1] : null;

    return commentId;
  },
  getCommentDataValues(event) {
    const commentData = event.originalEvent.clipboardData.getData('text/objectComment');
    const commentDataJSON = JSON.parse(commentData);
    /* eslint-disable-next-line you-dont-need-lodash-underscore/values */
    const commentDataValues = _.values(commentDataJSON)[0].data;
    return commentDataValues;
  },
  getCommentReplyDataValues(event) {
    const commentReplyData = event.originalEvent.clipboardData.getData('text/objectReply');
    const commentReplyDataJSON = JSON.parse(commentReplyData);
    /* eslint-disable-next-line you-dont-need-lodash-underscore/values */
    const commentReplyDataValues = _.values(commentReplyDataJSON)[0];
    return commentReplyDataValues;
  },
  enlargeScreen(callback) {
    $('#iframe-container iframe').css('max-width', '1000px');
    callback();
  },
  getTextOfCommentFromLine(line) {
    const outer$ = helper.padOuter$;
    const $secondCommentIcon = outer$(`#commentIcons #icon-${this.getCommentIdOfLine(line)}`);
    $secondCommentIcon.click();

    // check modal is visible
    const commentPastedText =
      outer$('#comments .sidebar-comment:visible .comment-text').first().text();
    return commentPastedText;
  },
  getTextOfCommentReplyFromLine(line) {
    const outer$ = helper.padOuter$;
    const $secondCommentIcon = outer$(`#commentIcons #icon-${this.getCommentIdOfLine(line)}`);
    $secondCommentIcon.click();

    const commentPastedText =
      outer$(`#${this.getCommentIdOfLine(line)} .comment-reply .comment-text`).text();
    return commentPastedText;
  },
  finishTestIfIconsAreNotEnabled(done, theTest) {
    // #commentIcons will only be inserted if icons are enabled
    if (helper.padOuter$('#commentIcons').length === 0) {
      done();
    } else {
      theTest(done);
    }
  },
  testIfHasAllFieldsNecessaryToCreateACommementReply(event) {
    const commentReplyDataValues = this.getCommentReplyDataValues(event);
    const keys = Object.keys(commentReplyDataValues);
    const keysRequired = [
      'commentId',
      'text',
      'changeTo',
      'changeFrom',
      'author',
      'name',
      'timestamp',
      'replyId',
      'formattedDate',
    ];
    this.checkIfHasAllKeys(keysRequired, keys);
  },
  testIfHasAllFieldsNecessaryToCreateAComment(event) {
    const commentDataValues = this.getCommentDataValues(event);
    const keys = Object.keys(commentDataValues);
    const keysRequired = [
      'author',
      'name',
      'text',
      'timestamp',
      'commentId',
      'date',
      'formattedDate',
      'originalCommentId',
    ];
    this.checkIfHasAllKeys(keysRequired, keys);
  },
  checkIfHasAllKeys(keysRequired, keys) {
    _.each(keysRequired, (keyRequired) => {
      expect(keys).to.contain(keyRequired);
    });
  },
};
