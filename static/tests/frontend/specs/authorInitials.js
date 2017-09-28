describe('ep_comments_page - Author initials', function() {
  var utils = ep_comments_page_test_helper.utils;

  before(function(done) {
    utils.createPad(this, done);
    this.timeout(60000);
  });

  context('when author name has only first and last name', function() {
    before(function(done) {
      setUserName('John Doe', this, done);
    });

    it('shows first char of each name as initials', function(done) {
      var $authorInitials = helper.padOuter$('authoricon').first();
      expect($authorInitials.text()).to.be('JD');
      done();
    });
  });

  context('when author name has mistyped whitespaces at the beginning and at te end', function() {
    before(function(done) {
      setUserName(' John Doe ', this, done);
    });

    it('ignores the whitespace and shows first char of each name as initials', function(done) {
      var $authorInitials = helper.padOuter$('authoricon').first();
      expect($authorInitials.text()).to.be('JD');
      done();
    });
  });

  context('when author name has more than 2 names', function() {
    before(function(done) {
      setUserName('John Frank Doe', this, done);
    });

    it('shows first char of first and last names as initials', function(done) {
      var $authorInitials = helper.padOuter$('authoricon').first();
      expect($authorInitials.text()).to.be('JD');
      done();
    });
  });

  context('when author name has only first name', function() {
    before(function(done) {
      setUserName('John', this, done);
    });

    it('shows first two chars of name as initials', function(done) {
      var $authorInitials = helper.padOuter$('authoricon').first();
      expect($authorInitials.text()).to.be('JO');
      done();
    });
  });

  var setUserName = function(name, test, done) {
    test.timeout(60000);
    // author initials are set when pad is loaded, so we need to reload it to change
    // author name for each context
    helper.newPad(done, utils.padId + '?userName=' + name);
  }
});
