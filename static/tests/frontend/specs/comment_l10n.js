'use strict';

describe('ep_comments_page - Comment Localization', function () {
  // create a new pad with comment before each test run
  beforeEach(function (cb) {
    helper.newPad(() => {
      createComment(() => {
        // ensure we start on the default language
        changeEtherpadLanguageTo('en', cb);
      });
    });
    this.timeout(60000);
  });

  // ensure we go back to English to avoid breaking other tests:
  after(function (cb) {
    changeEtherpadLanguageTo('en', cb);
  });

  it('uses default values when language was not localized yet', function (done) {
    changeEtherpadLanguageTo('oc', () => {
      const outer$ = helper.padOuter$;

      // get the title of the comment
      const $changeToLabel = outer$('.comment-suggest').first();
      expect($changeToLabel.text()).to.be(
          '                                  Include suggested change             ');

      done();
    });
  });

  it('localizes comment when Etherpad language is changed', function (done) {
    changeEtherpadLanguageTo('pt-br', () => {
      const outer$ = helper.padOuter$;
      const commentId = getCommentId();

      // get the 'Suggested Change' label
      const $changeToLabel = outer$(`#${commentId} .from-label`).first();
      expect($changeToLabel.text()).to.be('Sugerir alteração de');

      done();
    });
  });

  it("localizes 'new comment' form when Etherpad language is changed", function (done) {
    // make sure form was created before changing the language
    const inner$ = helper.padInner$;
    const outer$ = helper.padOuter$;
    const chrome$ = helper.padChrome$;

    // get the first text element out of the inner iframe
    const $firstTextElement = inner$('div').first();

    // get the comment button and click it
    $firstTextElement.sendkeys('{selectall}'); // needs to select content to add comment to
    const $commentButton = chrome$('.addComment');
    $commentButton.click();

    changeEtherpadLanguageTo('pt-br', () => {
      // get the 'Include suggested change' label
      const $changeToLabel = outer$('.new-comment label.label-suggestion-checkbox').first();
      expect($changeToLabel.text()).to.be('Incluir alteração sugerida');

      done();
    });
  });

  /* ********** Helper functions ********** */

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

  const changeEtherpadLanguageTo = (lang, callback) => {
    const boldTitles = {
      'en': 'Bold (Ctrl+B)',
      'pt-br': 'Negrito (Ctrl-B)',
      'oc': 'Gras (Ctrl-B)',
    };
    const chrome$ = helper.padChrome$;

    // click on the settings button to make settings visible
    const $settingsButton = chrome$('.buttonicon-settings');
    $settingsButton.click();

    // select the language
    const $language = chrome$('#languagemenu');
    $language.val(lang);
    $language.change();

    // hide settings again
    $settingsButton.click();

    helper.waitFor(() => chrome$('.buttonicon-bold').parent()[0].title === boldTitles[lang])
        .done(callback);
  };

  const getCommentId = () => {
    const inner$ = helper.padInner$;
    const comment = inner$('.comment').first();
    const cls = comment.attr('class');
    const classCommentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
    const commentId = (classCommentId) ? classCommentId[1] : null;

    return commentId;
  };
});
