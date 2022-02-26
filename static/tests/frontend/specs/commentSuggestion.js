'use strict';

const utils = require('../utils');

// create a new pad before each test run
beforeEach(async function () {
  this.timeout(60000);
  await utils.aNewPad();
});

it('Fills suggestion Change From field when adding a comment with suggestion', async function () {
  const chrome$ = helper.padChrome$;

  // As in the function openCommentFormWithSuggestion we send all the text and call 'selectall',
  // we select the beginning of line as well. This situation does not happen in the browser, it's
  // not possible to select the beginning of first line of a selection. To fix this we add a first
  // text without line attribute, in this case a <span>, to avoid select a '*'
  const targetText = '<span>A</span><ul><li> text with</li><li> line attributes</li></ul>';

  await openCommentFormWithSuggestion(targetText);
  const $suggestionFrom = chrome$('.from-value');
  expect($suggestionFrom.text()).to.be('A\n text with\n line attributes');
});

it('Cancel suggestion and try again fills suggestion Change From field', async function () {
  const outer$ = helper.padOuter$;
  const chrome$ = helper.padChrome$;

  await openCommentFormWithSuggestion('This content will receive a comment');

  // cancel
  const $cancelButton = chrome$('#comment-reset');
  $cancelButton.click();

  // wait for comment form to close
  await helper.waitForPromise(() => outer$('#newComments.active').length === 0);
  await openCommentFormWithSuggestion('New target for comment');

  const $suggestionFrom = chrome$('.from-value');
  expect($suggestionFrom.text()).to.be('New target for comment');
});

it('Fills suggestion Change From field, adds sugestion', async function () {
  const outer$ = helper.padOuter$;
  const inner$ = helper.padInner$;
  const chrome$ = helper.padChrome$;
  const origText = 'This content will receive a comment';
  const suggestedText = 'amp: & dq: " sq: \' lt: < gt: > bs: \\ end';
  await openCommentFormWithSuggestion(origText);

  await helper.waitForPromise(() => chrome$('#newComment.popup-show').is(':visible'));
  chrome$('#newComment').find('textarea.comment-content').val('A new comment text');
  chrome$('#newComment').find('suggestion-checkbox').click();
  let newCommentSuggestion;
  await helper.waitForPromise(() => {
    newCommentSuggestion = chrome$('#newComment').find('textarea.to-value');
    return newCommentSuggestion.length > 0 && newCommentSuggestion.is(':visible');
  });
  newCommentSuggestion.val(suggestedText);
  chrome$('#comment-create-btn').click();

  let commentedText$;
  await helper.waitForPromise(() => {
    commentedText$ = inner$('div').first().find('.comment');
    return commentedText$.length > 0;
  });
  commentedText$.click();
  let comment$;
  await helper.waitForPromise(() => {
    comment$ = outer$('.comment-container');
    const fd$ = comment$.find('.full-display-content');
    return comment$.length > 0 && fd$.length > 0 && fd$.is(':visible');
  });
  await helper.waitForPromise(
      () => comment$.find('.comment-title-wrapper .from-label').text().includes(suggestedText));

  outer$('.approve-suggestion-btn:visible').click();
  commentedText$ = inner$('div').first().find('.comment');
  await helper.waitForPromise(
      () => inner$('div').first().find('.comment').text() === suggestedText);
});

const openCommentFormWithSuggestion = async (targetText) => {
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
  await helper.waitForPromise(
      () => chrome$('#newComment.popup-show').find('.suggestion-checkbox').length);
  chrome$('#newComment.popup-show').find('.suggestion-checkbox').first().click();
};
