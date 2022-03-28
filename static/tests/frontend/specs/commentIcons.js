'use strict';

let freshPad = true;

before(async function () {
  await helper.aNewPad();
  // #commentIcons will only be inserted if icons are enabled
  if (!helper.padChrome$.window.clientVars.displayCommentAsIcon) this.skip();
});

// create a new pad with comment before each test run
beforeEach(async function () {
  this.timeout(60000);
  if (!freshPad) await helper.aNewPad();
  freshPad = false;
  // make sure Etherpad has enough space to display comment icons
  enlargeScreen();
  // force sidebar comments to be shown
  chooseToShowComments(true);
  await createComment();
});

after(async function () {
  // undo frame resize that was done on before()
  $('#iframe-container iframe').css('max-width', '');
});

it('adds a comment icon on the same height of commented text', async function () {
  const inner$ = helper.padInner$;
  const outer$ = helper.padOuter$;
  const commentId = await getCommentId();
  const $commentIcon = outer$(`#commentIcons #icon-${commentId}`);

  // check icon exists
  expect($commentIcon.length).to.be(1);

  // check height is the same
  const $commentedText = inner$(`.${commentId}`);
  // all icons are +5px down to adjust position
  const expectedTop = $commentedText.offset().top + 5;
  expect($commentIcon.offset().top).to.be(expectedTop);
});
// TODO: Needs fixing
xit('does not show comment icon when commented text is removed', async function () {
  const inner$ = helper.padInner$;
  const outer$ = helper.padOuter$;
  // remove commented text
  const $commentedLine = inner$('div .comment').parent();
  $commentedLine.sendkeys('{selectall}'); // select all
  $commentedLine.sendkeys('{del}'); // clear the first line
  // wait until comment deletion is done
  await helper.waitForPromise(() => {
    // check icon is not visible
    const $commentIcons = outer$('#commentIcons .comment-icon:visible');
    return $commentIcons.length === 0;
  });
});
// TODO: Needs fixing
xit('does not show comment icon when comment is deleted', async function () {
  const outer$ = helper.padOuter$;

  await deleteComment();
  // check icon is not visible
  const $commentIcons = outer$('#commentIcons .comment-icon:visible');
  expect($commentIcons.length).to.be(0);
});

it('updates comment icon height when commented text is moved to another line', async function () {
  // don't run this test in safari. borrowed from
  // https://stackoverflow.com/questions/7944460/detect-safari-browser
  const ua = navigator.userAgent.toLowerCase();
  if (ua.indexOf('safari') !== -1) {
    if (ua.indexOf('chrome') > -1) {
      // Chrome
    } else {
      return this.skip();
    }
  }

  const inner$ = helper.padInner$;
  const outer$ = helper.padOuter$;
  const commentId = await getCommentId();

  // adds some new lines on the beginning of the text
  const $firstTextElement = inner$('div').first();
  $firstTextElement.sendkeys('{leftarrow}{enter}{enter}');

  // wait until the new lines are split into separated .ace-line's
  await helper.waitForPromise(() => inner$('div').length > 2);

  // wait until comment is visible again
  await helper.waitForPromise(() => {
    const $commentIcons = outer$('#commentIcons .comment-icon:visible');
    return $commentIcons.length !== 0;
  });

  // check height is the same
  const $commentIcon = outer$(`#commentIcons #icon-${commentId}`);
  const $commentedText = inner$(`.${commentId}`);
  // all icons are +5px down to adjust position
  const expectedTop = $commentedText.offset().top + 5;
  expect($commentIcon.offset().top).to.be(expectedTop);
});

it('shows comment when user clicks on comment icon', async function () {
  const outer$ = helper.padOuter$;
  const commentId = await getCommentId();

  // click on the icon
  const $commentIcon = outer$(`#commentIcons #icon-${commentId}`).first();
  $commentIcon.click();

  // check sidebar comment is visible
  const $openedSidebarComments = outer$('#comments .sidebar-comment:visible');
  expect($openedSidebarComments.length).to.be(1);
});

it('hides comment when user clicks on comment icon twice', async function () {
  // don't run this test in safari. borrowed from
  // https://stackoverflow.com/questions/7944460/detect-safari-browser
  const ua = navigator.userAgent.toLowerCase();
  if (ua.indexOf('safari') !== -1) {
    if (ua.indexOf('chrome') > -1) {
      // Chrome
    } else {
      return this.skip();
    }
  }

  const outer$ = helper.padOuter$;
  const commentId = await getCommentId();

  // click on the icon to open, then click again to close
  const $commentIcon = outer$(`#commentIcons #icon-${commentId}`).first();
  $commentIcon.click();
  $commentIcon.click();

  // check sidebar comment is not visible
  const $openedSidebarComments = outer$('#comments .sidebar-comment:visible');
  expect($openedSidebarComments.length).to.be(0);
});

it('hides comment when user clicks outside of comment box', async function () {
  // don't run this test in safari. borrowed from
  // https://stackoverflow.com/questions/7944460/detect-safari-browser
  const ua = navigator.userAgent.toLowerCase();
  if (ua.indexOf('safari') !== -1) {
    if (ua.indexOf('chrome') > -1) {
      // Chrome
    } else {
      return this.skip();
    }
  }

  const outer$ = helper.padOuter$;
  const commentId = await getCommentId();

  // click on the icon to open
  const $commentIcon = outer$(`#commentIcons #icon-${commentId}`).first();
  $commentIcon.click();

  // click outside the comment to hide it
  outer$('#outerdocbody').click();

  // check sidebar comment is not visible
  const $openedSidebarComments = outer$('#comments .sidebar-comment:visible');
  expect($openedSidebarComments.length).to.be(0);
});

it('hides 1st, shows 2nd comment when user clicks on one then another icon', async function () {
  // don't run this test in safari. borrowed from
  // https://stackoverflow.com/questions/7944460/detect-safari-browser
  const ua = navigator.userAgent.toLowerCase();
  if (ua.indexOf('safari') !== -1) {
    if (ua.indexOf('chrome') > -1) {
      // Chrome
    } else {
      return this.skip();
    }
  }

  const inner$ = helper.padInner$;
  const outer$ = helper.padOuter$;

  // add a second line...
  const $lastTextElement = inner$('div').last();
  $lastTextElement.sendkeys('Second line{enter}');

  // wait until the new line is split into a separated .ace-line
  await helper.waitForPromise(() => inner$('div').length > 2);

  // ... then add a comment to second line
  const $secondLine = inner$('div').eq(1);
  $secondLine.sendkeys('{selectall}');
  await addComment('Second Comment');

  // click on the icon of first comment...
  const $firstCommentIcon = outer$(`#commentIcons #icon-${await getCommentId(0)}`).first();
  $firstCommentIcon.click();
  // ... then click on the icon of last comment
  const $secondCommentIcon = outer$(`#commentIcons #icon-${await getCommentId(1)}`).first();
  $secondCommentIcon.click();

  // check modal is visible
  const $commentText = outer$('#comments .sidebar-comment:visible .comment-text').text();
  expect($commentText).to.be('Second Comment');
});

/* ********** Helper functions ********** */

const createComment = async () => {
  const inner$ = helper.padInner$;

  // get the first text element out of the inner iframe
  const $firstTextElement = inner$('div').first();

  // simulate key presses to delete content
  $firstTextElement.sendkeys('{selectall}'); // select all
  $firstTextElement.sendkeys('{del}'); // clear the first line
  $firstTextElement.sendkeys('This content will receive a comment{enter}'); // insert text
  // wait until the two lines are split into two .ace-line's
  await helper.waitForPromise(() => inner$('div').length > 1);

  // add comment to last line of the text
  const $lastTextElement = inner$('div').first();
  $lastTextElement.sendkeys('{selectall}'); // need to select content to add comment to

  await addComment('My comment');
};

// Assumes text is already selected, then add comment to the selected text
const addComment = async (commentText) => {
  const inner$ = helper.padInner$;
  const chrome$ = helper.padChrome$;

  // get original number of comments, so can check if a new comment was created
  const numberOfComments = inner$('.comment:visible').length;

  // get the comment button and click it
  const $commentButton = chrome$('.addComment');
  $commentButton.click();

  // fill the comment form and submit it
  const $commentField = chrome$('textarea.comment-content');
  $commentField.val(commentText);
  // we don't need comment suggestion to be filled for these tests, but here's how to do it:
  // var $hasSuggestion = outer$(".suggestion-checkbox");
  // $hasSuggestion.click();
  // var $suggestionField = outer$("textarea.to-value");
  // $suggestionField.val("Change to this suggestion");
  const $submittButton = chrome$('.comment-buttons input[type=submit]');
  $submittButton.click();

  // wait until comment is created and comment id is set
  await helper.waitForPromise(async () => await getCommentId(numberOfComments) != null);
};

const deleteComment = async () => {
  const chrome$ = helper.padChrome$;
  const outer$ = helper.padOuter$;

  // click on the delete button
  const $deleteButton = outer$('.comment-delete');
  $deleteButton.click();

  await helper.waitForPromise(() => chrome$('.sidebar-comment').is(':visible') === false);
};


const getCommentId = async (numberOfComments) => {
  const nthComment = numberOfComments || 0;
  await helper.waitForPromise(() => helper.padInner$);
  const inner$ = helper.padInner$;
  const comment = inner$('.comment').eq(nthComment);
  const cls = comment.attr('class');
  const classCommentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
  const commentId = (classCommentId) ? classCommentId[1] : null;
  return commentId;
};

const chooseToShowComments = (shouldShowComments) => {
  const chrome$ = helper.padChrome$;

  // click on the settings button to make settings visible
  const $settingsButton = chrome$('.buttonicon-settings');
  $settingsButton.click();

  // check "Show Comments"
  const $showComments = chrome$('#options-comments');
  if ($showComments.is(':checked') !== shouldShowComments) $showComments.click();

  // hide settings again
  $settingsButton.click();
};

const enlargeScreen = () => {
  $('#iframe-container iframe').css('max-width', '1000px');
};
