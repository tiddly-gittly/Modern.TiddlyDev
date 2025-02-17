describe('Filter tests', function() {
  // Test copy from https://github.com/Jermolene/TiddlyWiki5/blob/31ec1bdd50ce7fa58e4e2c8701106bd809c47dc3/editions/test/tiddlers/tests/test-filters.js
  it('should parse new-style rich operator suffixes', function() {
    expect($tw.wiki.parseFilter('[search:: four, , five,, six [operand]]')).toEqual(
      [{ prefix: '', operators: [{ operator: 'search', suffix: ': four, , five,, six ', suffixes: [[], ['four', 'five', 'six']], operands: [{ text: 'operand' }] }] }],
    );
  });
});
