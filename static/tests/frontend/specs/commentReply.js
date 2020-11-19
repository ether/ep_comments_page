'use strict';

describe('ep_comments_page - Comment Reply', function () {
  // create a new pad with comment before each test run
  beforeEach(function (cb) {
    helper.newPad(() => {
      chooseToShowComments(true, () => {
        createComment(() => {
          // make sure Etherpad has enough space to display comments
          $('#iframe-container iframe').css('max-width', '1000px');
          cb();
        });
      });
    });
    this.timeout(60000);
  });

  after(function (cb) {
    // undo what was done on before()
    $('#iframe-container iframe').css('max-width', '');
    cb();
  });

  xit('Ensures a comment can be replied', function (done) {
    createReply(false, () => {
      done();
    });
  });

  xit('Ensures a comment reply can have suggestion', function (done) {
    createReply(true, () => {
      const outer$ = helper.padOuter$;
      const $replySuggestion = outer$('.comment-changeTo-form');
      expect($replySuggestion.is(':visible')).to.be(true);
      done();
    });
  });

  xit('Clears the comment reply form after submitting a reply with suggestion', function (done) {
    createReply(true, () => {
      const outer$ = helper.padOuter$;
      const $replyForm = outer$('form.new-comment');
      const $replyField = $replyForm.find('.comment-content');
      const $replyWithSuggestionCheckbox = $replyForm.find('.suggestion-checkbox');
      const $replySuggestionTextarea = $replyForm.find('.to-value');
      expect($replyField.text()).to.be('');
      expect($replyWithSuggestionCheckbox.is(':checked')).to.be(false);
      expect($replySuggestionTextarea.text()).to.be('');
      done();
    });
  });

  xit('Replaces the original text with reply suggestion', function (done) {
    createReply(true, () => {
      const inner$ = helper.padInner$;
      const outer$ = helper.padOuter$;

      // click to accept suggested change of the reply
      const $replyAcceptChangeButton =
          outer$(".sidebar-comment-reply .comment-changeTo-form input[type='submit']")[0];
      $replyAcceptChangeButton.click();

      // check the pad text
      const $firstTextElement = inner$('div').first();
      // cake waitFor
      helper.waitFor(() => {
        console.log($firstTextElement.text());
        return $firstTextElement.text() === 'My suggestion';
      });
      expect($firstTextElement.text()).to.be('My suggestion');

      done();
    });
  });

  xit('Replaces orig with reply sugg. after replacing orig with comment sugg.', function (done) {
    createReply(true, () => {
      const inner$ = helper.padInner$;
      const outer$ = helper.padOuter$;

      // click to accept suggested change of the original comment
      const $commentAcceptChangeButton =
          outer$(".sidebar-comment .comment-changeTo-form input[type='submit']").first();
      $commentAcceptChangeButton.click();

      // click to accept suggested change of the reply
      const $replyAcceptChangeButton =
          outer$(".sidebar-comment-reply .comment-changeTo-form input[type='submit']");
      $replyAcceptChangeButton.click();

      // check the pad text
      const $firstTextElement = inner$('div').first();
      expect($firstTextElement.text()).to.be('My suggestion');

      done();
    });
  });

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

  const createReply = (withSuggestion, callback) => {
    const outer$ = helper.padOuter$;
    const commentId = getCommentId();
    const existingReplies = outer$('.sidebar-comment-reply').length;

    // if comment icons are enabled, make sure we display the comment box:
    if (commentIconsEnabled()) {
      // click on the icon
      const $commentIcon = outer$(`#commentIcons #icon-${commentId}`).first();
      $commentIcon.click();
    }

    // fill reply field
    const $replyField = outer$('.comment-content');
    $replyField.val('My reply');

    // fill suggestion
    if (withSuggestion) {
      // show suggestion field
      const $replySuggestionCheckbox = outer$('.suggestion-checkbox');
      $replySuggestionCheckbox.click();

      // fill suggestion field
      const $suggestionField = outer$('textarea.to-value');
      $suggestionField.val('My suggestion');
    }

    // submit reply
    const $submitReplyButton = outer$("form.new-comment input[type='submit']").first();
    $submitReplyButton.click();

    // wait for the reply to be saved
    helper.waitFor(() => outer$('.sidebar-comment-reply').length === existingReplies + 1)
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

  const chooseToShowComments = (shouldShowComments, callback) => {
    const chrome$ = helper.padChrome$;

    // click on the settings button to make settings visible
    const $settingsButton = chrome$('.buttonicon-settings');
    $settingsButton.click();

    // check "Show Comments"
    const $showComments = chrome$('#options-comments');
    if ($showComments.is(':checked') !== shouldShowComments) $showComments.click();

    // hide settings again
    $settingsButton.click();

    callback();
  };

  const commentIconsEnabled = () => helper.padOuter$('#commentIcons').length > 0;
});
