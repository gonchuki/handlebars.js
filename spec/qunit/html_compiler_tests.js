module("HTML-based compiler (output)", {
  teardown: function() {
    delete Handlebars.htmlHelpers.testing;
    delete Handlebars.htmlHelpers.RESOLVE;
    delete Handlebars.htmlHelpers.RESOLVE_ATTR;
  }
});

function equalHTML(fragment, html) {
  var div = document.createElement("div");
  div.appendChild(fragment.cloneNode(true));

  equal(div.innerHTML, html);
}

test("Simple content produces a document fragment", function() {
  var template = Handlebars.compileHTML("content");
  var fragment = template();

  equalHTML(fragment, "content");
});

test("Simple elements are created", function() {
  var template = Handlebars.compileHTML("<div>content</div>");
  var fragment = template();

  equalHTML(fragment, "<div>content</div>");
});

test("Simple elements can have attributes", function() {
  var template = Handlebars.compileHTML("<div class='foo' id='bar'>content</div>");
  var fragment = template();

  equalHTML(fragment, '<div class="foo" id="bar">content</div>');
});

test("The compiler can handle nesting", function() {
  var html = '<div class="foo"><p><span id="bar" data-foo="bar">hi!</span></p></div> More content';
  var template = Handlebars.compileHTML(html);
  var fragment = template();

  equalHTML(fragment, html);
});

test("The compiler can handle quotes", function() {
  compilesTo('<div>"This is a title," we\'re on a boat</div>');
});

function compilesTo(html, expected, context) {
  var template = Handlebars.compileHTML(html);
  var fragment = template(context);

  equalHTML(fragment, expected || html);
  return fragment;
}

test("The compiler can handle simple handlebars", function() {
  compilesTo('<div>{{title}}</div>', '<div>hello</div>', { title: 'hello' });
});

test("The compiler can handle paths", function() {
  compilesTo('<div>{{post.title}}</div>', '<div>hello</div>', { post: { title: 'hello' }});
});

test("The compiler can handle escaping HTML", function() {
  compilesTo('<div>{{title}}</div>', '<div>&lt;strong&gt;hello&lt;/strong&gt;</div>', { title: '<strong>hello</strong>' });
});

test("The compiler can handle unescaped HTML", function() {
  compilesTo('<div>{{{title}}}</div>', '<div><strong>hello</strong></div>', { title: '<strong>hello</strong>' });
});

test("The compiler can handle simple helpers", function() {
  Handlebars.registerHTMLHelper('testing', function(path, options) {
    return this[path[0]];
  });

  compilesTo('<div>{{testing title}}</div>', '<div>hello</div>', { title: 'hello' });
});

test("The compiler tells helpers what kind of expression the path is", function() {
  Handlebars.registerHTMLHelper('testing', function(path, options) {
    return options.types[0] + '-' + path;
  });

  compilesTo('<div>{{testing "title"}}</div>', '<div>string-title</div>');
  compilesTo('<div>{{testing 123}}</div>', '<div>number-123</div>');
  compilesTo('<div>{{testing true}}</div>', '<div>boolean-true</div>');
  compilesTo('<div>{{testing false}}</div>', '<div>boolean-false</div>');
});

test("The compiler passes along the hash arguments", function() {
  Handlebars.registerHTMLHelper('testing', function(options) {
    return options.hash.first + '-' + options.hash.second;
  });

  compilesTo('<div>{{testing first="one" second="two"}}</div>', '<div>one-two</div>');
});

test("The compiler passes along the types of the hash arguments", function() {
  Handlebars.registerHTMLHelper('testing', function(options) {
    return options.hashTypes.first + '-' + options.hash.first;
  });

  compilesTo('<div>{{testing first="one"}}</div>', '<div>string-one</div>');
  compilesTo('<div>{{testing first=one}}</div>', '<div>id-one</div>');
  compilesTo('<div>{{testing first=1}}</div>', '<div>number-1</div>');
  compilesTo('<div>{{testing first=true}}</div>', '<div>boolean-true</div>');
  compilesTo('<div>{{testing first=false}}</div>', '<div>boolean-false</div>');
});

test("The compiler provides the current element as an option", function() {
  var textNode;
  Handlebars.registerHTMLHelper('testing', function(options) {
    textNode = document.createTextNode("testy");
    options.element.appendChild(textNode);
  });

  compilesTo('<div>{{testing}}</div>', '<div>testy</div>');
  equal(textNode.textContent, 'testy');
});

test("It is possible to override the resolution mechanism", function() {
  Handlebars.registerHTMLHelper('RESOLVE', function(parts, options) {
    if (parts[0] === 'zomg') {
      options.element.appendChild(document.createTextNode(this.zomg));
    } else {
      options.element.appendChild(document.createTextNode(parts.join("-")));
    }
  });

  compilesTo('<div>{{foo}}</div>', '<div>foo</div>');
  compilesTo('<div>{{foo.bar}}</div>', '<div>foo-bar</div>');
  compilesTo('<div>{{zomg}}</div>', '<div>hello</div>', { zomg: 'hello' });
});

test("Simple data binding using text nodes", function() {
  var callback;

  Handlebars.registerHTMLHelper('RESOLVE', function(parts, options) {
    var context = this,
        textNode = document.createTextNode(context[parts[0]]);

    callback = function() {
      var value = context[parts[0]],
          parent = textNode.parentNode,
          originalText = textNode;

      textNode = document.createTextNode(value);
      parent.insertBefore(textNode, originalText);
      parent.removeChild(originalText);
    };

    options.element.appendChild(textNode);
  });

  var object = { title: 'hello' };
  var fragment = compilesTo('<div>{{title}} world</div>', '<div>hello world</div>', object);

  object.title = 'goodbye';
  callback();

  equalHTML(fragment, '<div>goodbye world</div>');

  object.title = 'brown cow';
  callback();

  equalHTML(fragment, '<div>brown cow world</div>');
});

test("Simple data binding on fragments", function() {
  var callback;

  Handlebars.registerHTMLHelper('RESOLVE', function(parts, options) {
    var context = this,
        fragment = Handlebars.dom.frag(options.element, context[parts[0]]);

    var firstChild = fragment.firstChild,
        lastChild = fragment.lastChild;

    callback = function() {
      var range = document.createRange();
      range.setStartBefore(firstChild);
      range.setEndAfter(lastChild);

      var value = context[parts[0]],
          fragment = range.createContextualFragment(value);

      firstChild = fragment.firstChild;
      lastChild = fragment.lastChild;

      range.deleteContents();
      range.insertNode(fragment);
    };

    options.element.appendChild(fragment);
  });

  var object = { title: '<p>hello</p> to the' };
  var fragment = compilesTo('<div>{{title}} world</div>', '<div><p>hello</p> to the world</div>', object);

  object.title = '<p>goodbye</p> to the';
  callback();

  equalHTML(fragment, '<div><p>goodbye</p> to the world</div>');

  object.title = '<p>brown cow</p> to the';
  callback();

  equalHTML(fragment, '<div><p>brown cow</p> to the world</div>');
});

test("RESOLVE hook receives escaping information", function() {
  expect(3);

  Handlebars.registerHTMLHelper('RESOLVE', function(parts, options) {
    if (parts[0] === 'escaped') {
      equal(options.escaped, true);
    } else if (parts[0] === 'unescaped') {
      equal(options.escaped, false);
    }

    options.element.appendChild(document.createTextNode(parts[0]))
  });

  compilesTo('<div>{{escaped}}-{{{unescaped}}</div>', '<div>escaped-unescaped</div>');
});

test("Helpers receive escaping information", function() {
  Handlebars.registerHTMLHelper('testing', function(path, options) {
    if (path === 'escaped') {
      equal(options.escaped, true);
    } else if (path === 'unescaped') {
      equal(options.escaped, false);
    }

    options.element.appendChild(document.createTextNode(path))
  });

  compilesTo('<div>{{testing escaped}}-{{{testing unescaped}}</div>', '<div>escaped-unescaped</div>');
});

test("Attributes can use computed values", function() {
  compilesTo('<a href="{{url}}">linky</a>', '<a href="linky.html">linky</a>', { url: 'linky.html' });
});

test("Attributes can use computed paths", function() {
  compilesTo('<a href="{{post.url}}">linky</a>', '<a href="linky.html">linky</a>', { post: { url: 'linky.html' }});
});

test("It is possible to override the resolution mechanism for attributes", function() {
  Handlebars.registerHTMLHelper('RESOLVE_ATTR', function(parts, options) {
    options.element.setAttribute(options.attrName, 'http://google.com/' + this[parts[0]]);
  });

  compilesTo('<a href="{{url}}">linky</a>', '<a href="http://google.com/linky.html">linky</a>', { url: 'linky.html' });
});

test("It is possible to use RESOLVE_ATTR for data binding", function() {
  var callback;

  Handlebars.registerHTMLHelper('RESOLVE_ATTR', function(parts, options) {
    var element = options.element,
        attrName = options.attrName,
        context = this;

    callback = function() {
      var value = context[parts[0]];
      element.setAttribute(attrName, value);
    }

    element.setAttribute(attrName, context[parts[0]]);
  });

  var object = { url: 'linky.html' };
  var fragment = compilesTo('<a href="{{url}}">linky</a>', '<a href="linky.html">linky</a>', object);

  object.url = 'clippy.html';
  callback();

  equalHTML(fragment, '<a href="clippy.html">linky</a>');

  object.url = 'zippy.html';
  callback();

  equalHTML(fragment, '<a href="zippy.html">linky</a>');
});

test("Attributes can be populated with helpers that generate a string", function() {
  Handlebars.registerHTMLHelper('testing', function(path, options) {
    return this[path];
  });

  compilesTo('<a href="{{testing url}}">linky</a>', '<a href="linky.html">linky</a>', { url: 'linky.html'});
});

test("A helper can choose to insert the attribute itself", function() {
  Handlebars.registerHTMLHelper('testing', function(path, options) {
    options.element.setAttribute(options.attrName, this[path]);
  });

  compilesTo('<a href="{{testing url}}">linky</a>', '<a href="linky.html">linky</a>', { url: 'linky.html'});
});

test("Attribute helpers take a hash", function() {
  Handlebars.registerHTMLHelper('testing', function(options) {
    options.element.setAttribute(options.attrName, this[options.hash.path]);
  });

  compilesTo('<a href="{{testing path=url}}">linky</a>', '<a href="linky.html">linky</a>', { url: 'linky.html' });
});

test("Attribute helpers can use the hash for data binding", function() {
  var callback;

  Handlebars.registerHTMLHelper('testing', function(path, options) {
    var element = options.element,
        context = this;

    callback = function() {
      var value = context[path];
      element.setAttribute(options.attrName, value ? options.hash.truthy : options.hash.falsy);
    }

    callback();
  });

  var object = { on: true };
  var fragment = compilesTo('<div class="{{testing on truthy="yeah" falsy="nope"}}">hi</div>', '<div class="yeah">hi</div>', object);

  object.on = false;
  callback();
  equalHTML(fragment, '<div class="nope">hi</div>')
});