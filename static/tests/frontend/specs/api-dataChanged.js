describe('ep_comments_page - api - "data changed" event', function() {
  var utils = ep_comments_page_test_helper.utils;
  var apiUtils = ep_comments_page_test_helper.apiUtils;

  var textOfFirstCreatedComment = 'I was created first';
  var textOfLastCreatedComment = 'I was created later';

  before(function (done) {
    utils.createPad(this, done);
  });

  context('when user creates a comment', function() {
    before(function(done) {
      utils.addCommentToLine(1, textOfFirstCreatedComment, done);
    });

    it('sends the data of created comment', function(done) {
      var comments = apiUtils.getLastDataSent();

      expect(comments.length).to.be(1);
      expect(comments[0].text).to.be(textOfFirstCreatedComment);
      expect(comments[0].author).to.not.be(undefined);
      expect(comments[0].commentId).to.not.be(undefined);
      expect(comments[0].name).to.not.be(undefined);
      expect(comments[0].timestamp).to.not.be(undefined);

      done();
    });

    context('and user reloads the pad', function() {
      before(function(done) {
        apiUtils.resetData();
        utils.reloadPad(this, done);
      });

      it('sends the data of existing comment when pad finishes loading', function(done) {
        apiUtils.waitForDataToBeSent(function() {
          var comments = apiUtils.getLastDataSent();

          expect(comments.length).to.be(1);
          expect(comments[0].text).to.be(textOfFirstCreatedComment);

          done();
        });
      });
    });

    context('and user creates another comment before the first one', function() {
      before(function(done) {
        utils.addCommentToLine(0, textOfLastCreatedComment, done);
      });
      after(function() {
        utils.undo();
      });

      it('sends the comments on the order they appear on the pad text', function(done) {
        var comments = apiUtils.getLastDataSent();

        expect(comments.length).to.be(2);
        expect(comments[0].text).to.be(textOfLastCreatedComment);
        expect(comments[1].text).to.be(textOfFirstCreatedComment);

        done();
      });
    });

    context('and pad has scenes', function() {
      var LINE_BEFORE_1ST_SCENE           = 1;
      var LINE_ON_HEADING_OF_1ST_SCENE    = LINE_BEFORE_1ST_SCENE + 3; // SMs + heading
      var LINE_IN_THE_MIDDLE_OF_1ST_SCENE = LINE_ON_HEADING_OF_1ST_SCENE + 1;
      var LINE_ON_HEADING_OF_2ND_SCENE    = LINE_IN_THE_MIDDLE_OF_1ST_SCENE + 3; // SMs + heading
      var LINE_ON_SM_OF_2ND_SCENE         = LINE_ON_HEADING_OF_2ND_SCENE - 1;

      before(function(done) {
        var seUtils = ep_script_elements_test_helper.utils;
        var smUtils = ep_script_scene_marks_test_helper.utils;

        // insert some scenes on second line
        var synopsis = smUtils.synopsis();
        var headingOf1stScene = seUtils.heading('heading of 1st scene');
        var lineInTheMiddleOf1stScene = seUtils.general('line on 1st scene');
        var headingOf2ndScene = seUtils.heading('heading of 2nd scene');
        var someScenes = synopsis
                       + headingOf1stScene
                       + lineInTheMiddleOf1stScene
                       + synopsis
                       + headingOf2ndScene;
        utils.getLine(1).html(utils.getLine(1).html() + '<br>' + someScenes);

        // wait until all SMs are created
        helper.waitFor(function() {
          // each scene creates 2 synopsis lines (title & summary)
          return helper.padInner$('.withSceneSynopsis').length === 4;
        }).done(function() {
          // show SM that will receive a comment
          smUtils.clickOnSceneMarkButtonOfLine(LINE_ON_HEADING_OF_2ND_SCENE);

          // create comments
          utils.addCommentToLine(LINE_ON_HEADING_OF_1ST_SCENE, 'LINE_ON_HEADING_OF_1ST_SCENE', function() {
            utils.addCommentToLine(LINE_IN_THE_MIDDLE_OF_1ST_SCENE, 'LINE_IN_THE_MIDDLE_OF_1ST_SCENE', function() {
              utils.addCommentToLine(LINE_ON_HEADING_OF_2ND_SCENE, 'LINE_ON_HEADING_OF_2ND_SCENE', function() {
                utils.addCommentToLine(LINE_ON_SM_OF_2ND_SCENE, 'LINE_ON_SM_OF_2ND_SCENE', done);
              });
            });
          });
        });
      });

      it('sends no scene number on comment before 1st scene', function(done) {
        var comment = apiUtils.getLastDataSent()[0];
        expect(comment.scene).to.be(0);
        done();
      });

      it('sends scene 1 on comment on 1st heading', function(done) {
        var comment = apiUtils.getLastDataSent()[1];
        expect(comment.text).to.be('LINE_ON_HEADING_OF_1ST_SCENE');
        expect(comment.scene).to.be(1);
        done();
      });

      it('sends scene 1 on comment on line in the middle of 1st scene', function(done) {
        var comment = apiUtils.getLastDataSent()[2];
        expect(comment.text).to.be('LINE_IN_THE_MIDDLE_OF_1ST_SCENE');
        expect(comment.scene).to.be(1);
        done();
      });

      it('sends scene 2 on comment on a scene mark of 2nd scene', function(done) {
        var comment = apiUtils.getLastDataSent()[3];
        expect(comment.text).to.be('LINE_ON_SM_OF_2ND_SCENE');
        expect(comment.scene).to.be(2);
        done();
      });

      it('sends scene 2 on comment on 2nd heading', function(done) {
        var comment = apiUtils.getLastDataSent()[4];
        expect(comment.text).to.be('LINE_ON_HEADING_OF_2ND_SCENE');
        expect(comment.scene).to.be(2);
        done();
      });
    });
  });
});
