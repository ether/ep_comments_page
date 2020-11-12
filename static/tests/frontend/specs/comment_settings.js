'use strict';

describe('ep_comments_page - Comment settings', function () {
  describe("when user unchecks 'Show Comments'", function () {
    // create a new pad and check "Show Comments" checkbox
    before(function (cb) {
      helper.newPad(() => {
        helper.waitFor(() => helper.padInner$).done(() => {
          chooseToShowComments(false, cb);
        });
      });
      this.timeout(60000);
    });

    xit('sidebar comments should not be visible when opening a new pad', function (done) {
      this.timeout(60000);
      // force to create a new pad, so validation would be on brand new pads
      helper.newPad(() => {
        const outer$ = helper.padOuter$;
        helper.waitFor(() => {
          const outer$ = helper.padOuter$;
          return outer$;
        }).done(() => {
          helper.waitFor(() => {
            const outer$ = helper.padOuter$;
            // hidden
            if (outer$('#comments').is(':visible') === false) {
              return true;
            }
          }).done(() => {
            expect(outer$('#comments').is(':visible')).to.be(false);
            done();
          });
        });
      });
    });

    xit('sidebar comments not visible when adding a new comment to a new pad', function (done) {
      this.timeout(60000);
      // force to create a new pad, so validation would be on brand new pads
      helper.newPad(() => {
        createComment(() => {
          const inner$ = helper.padInner$;
          const outer$ = helper.padOuter$;
          const chrome$ = helper.padChrome$;

          // get the first text element out of the inner iframe
          const $firstTextElement = inner$('div').first();
          $firstTextElement.sendkeys('{selectall}'); // needs to select content to add comment to

          // get the comment button and click it
          const $commentButton = chrome$('.addComment');
          $commentButton.click();

          expect(outer$('#comments:visible').length).to.be(0);
          done();
        });
      });
    });
  });

  /* ********** Helper functions ********** */

  const chooseToShowComments = (shouldShowComments, callback) => {
    const chrome$ = helper.padChrome$;

    // click on the settings button to make settings visible
    const $settingsButton = chrome$('.buttonicon-settings');
    console.log($settingsButton);
    $settingsButton.click();

    // check "Show Comments"
    const $showComments = chrome$('#options-comments');
    console.log($showComments);
    if ($showComments.is(':checked') !== shouldShowComments) {
      $showComments.click();
      console.log('clicking to disable');
    }

    // hide settings again
    $settingsButton.click();

    callback();
  };

  const createComment = (callback) => {
    const inner$ = helper.padInner$;
    const outer$ = helper.padOuter$;
    const chrome$ = helper.padChrome$;

    // get the first text element out of the inner iframe
    const $firstTextElement = inner$('div').first();

    // simulate key presses to delete content
    $firstTextElement.sendkeys('{selectall}'); // select all
    $firstTextElement.sendkeys('{del}'); // clear the first line
    $firstTextElement.sendkeys('This content will receive a comment'); // insert text

    // get the comment button and click it
    $firstTextElement.sendkeys('{selectall}'); // needs to select content to add comment to
    const $commentButton = chrome$('.addComment');
    $commentButton.click();

    // fill the comment form and submit it
    const $commentField = chrome$('textarea.comment-content');
    $commentField.val('My comment');
    const $hasSuggestion = outer$('.suggestion-checkbox');
    $hasSuggestion.click();
    const $suggestionField = outer$('textarea.to-value');
    $suggestionField.val('Change to this suggestion');
    const $submittButton = chrome$('.comment-buttons input[type=submit]');
    $submittButton.click();

    // wait until comment is created and comment id is set
    helper.waitFor(() => getCommentId() != null)
        .done(callback);
  };

  const getCommentId = () => {
    helper.waitFor(() => {
      const inner$ = helper.padInner$;
      if (inner$) return true;
    }).done(() => {
      const inner$ = helper.padInner$;
      const comment = inner$('.comment').first();
      const cls = comment.attr('class');
      const classCommentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
      const commentId = (classCommentId) ? classCommentId[1] : null;
      return commentId;
    });
  };
});
