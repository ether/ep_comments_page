'use strict';

describe('ep_comments_page - Comment Suggestion', function () {
  // create a new pad before each test run
  beforeEach(function (cb) {
    helper.newPad(cb);
    this.timeout(60000);
  });

  it('Fills suggestion Change From field when adding a comment with suggestion', function (done) {
    const chrome$ = helper.padChrome$;

    // As in the function openCommentFormWithSuggestion we send all the text and call 'selectall',
    // we select the beginning of line as well. This situation does not happen in the browser, it's not possible
    // to select the beginning of first line of a selection. To fix this we add a first text without line attribute,
    // in this case  a <span>, to avoid select a '*'
    const targetText = '<span>A</span><ul><li> text with</li><li> line attributes</li></ul>';

    openCommentFormWithSuggestion(targetText);
    const $suggestionFrom = chrome$('.from-value');
    expect($suggestionFrom.text()).to.be('A\n text with\n line attributes');
    done();
  });

  it('Fills suggestion Change From field when canceling and trying again to add comment with suggestion', function (done) {
    const outer$ = helper.padOuter$;
    const chrome$ = helper.padChrome$;

    openCommentFormWithSuggestion('This content will receive a comment');

    // cancel
    const $cancelButton = chrome$('#comment-reset');
    $cancelButton.click();

    // wait for comment form to close
    helper.waitFor(() => outer$('#newComments.active').length === 0)
        .done(() => {
          openCommentFormWithSuggestion('New target for comment');

          const $suggestionFrom = chrome$('.from-value');
          expect($suggestionFrom.text()).to.be('New target for comment');
          done();
        });
  });

  it('Fills suggestion Change From field, adds sugestion', async function () {
    const outer$ = helper.padOuter$;
    const inner$ = helper.padInner$;
    const chrome$ = helper.padChrome$;
    const suggestedText = 'A new suggested text';
    openCommentFormWithSuggestion('This content will receive a comment');

    await new Promise(((resolve) => {
      helper.waitFor(() => chrome$('#newComment.popup-show').is(':visible')).done(() => {
        chrome$('#newComment').find('textarea.comment-content').val('A new comment text');
        chrome$('#newComment').find('textarea.to-value').val(suggestedText);
        chrome$('#comment-create-btn').click();
        return helper.waitFor(() => inner$('div').first().find('.comment').length).done(() => {
          const comment$ = inner$('div').first().find('.comment');
          comment$.click();
          resolve();
        });
      });
    }));
    await new Promise(((resolve) => {
      helper.waitFor(() => {
        outer$('.approve-suggestion-btn:visible').click();
        return true;
      }).done(resolve);
    }));
    await new Promise(((resolve) => {
      const comment$ = inner$('div').first().find('.comment');
      helper.waitFor(() => comment$.text() === suggestedText).done(() => {
        expect(comment$.text()).to.be(suggestedText);
        resolve();
      });
    }));
  });
});

function openCommentFormWithSuggestion(targetText) {
  const inner$ = helper.padInner$;
  const chrome$ = helper.padChrome$;

  // get the first text element out of the inner iframe
  const $firstTextElement = inner$('div').first();

  // simulate key presses to delete content
  $firstTextElement.sendkeys('{selectall}'); // select all
  $firstTextElement.sendkeys('{del}'); // clear the first line
  // to simulate a selection with more than one line we have to send the sendkeys selectall
  // at the same line. The sendkeys will be run before the line break.
  $firstTextElement.html(targetText).sendkeys('{selectall}');
  chrome$('.addComment').first().click();
  helper.waitFor(() => chrome$('#newComment.popup-show').find('.suggestion-checkbox').length).done(() => {
    chrome$('#newComment.popup-show').find('.suggestion-checkbox').first().click();
  });
}
