'use strict';

const utils = require('../utils');

before(async function () {
  await utils.aNewPad();
  helper.padInner$('div').first()
      .sendkeys('{selectall}')
      .sendkeys('{del}')
      .text('commented text')
      .sendkeys('{selectall}');
});

it('new comment button focuses on comment textarea', async function () {
  helper.padChrome$('.addComment').click();
  expect(helper.padChrome$.document.activeElement)
      .to.be(helper.padChrome$('#newComment').find('.comment-content')[0]);
});
