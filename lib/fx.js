var slice = Array.prototype.slice;
var concat = Array.prototype.concat;
var split = String.prototype.split;

// Assign own-enumerable properties from sources on target
function assign(target) {
  for(var a = 1; a < arguments.length; a++) {
    var keys = Object.keys(arguments[a]);
    for(var i = 0; i < keys.length; i++) {
      target[keys[i]] = arguments[a][keys[i]]
    }
  }
  return target;
}

// Define own properties of source on target
function define(target, _config, _source) {
  var source = _source || _config;
  var config = _source && _config || undefined;
  var keys = Object.getOwnPropertyNames(source);

  var descs = {};
  for(var i = 0; i < keys.length; i++) {
    descs[keys[i]] = assign(
      Object.getOwnPropertyDescriptor(source, keys[i]), config
    );
  }

  return Object.defineProperties(target, descs);
}

// get/set prototypeOf
function proto(target, newProto) {
  if(!newProto) {
    return target.__proto__;
  }
  target.__proto__ = newProto;
  return target;
}

function proxy(_name, _parent) {
  var name = _name || '$proxy$';
  var parent = _parent || proxy;

  var _construct = proxy.__createFunction(name);

  var construct = function(_proto) {
    return proto(_construct(), _proto || parent).define({
      _context: undefined
    });
  };

  return construct().define({ _name: name, _target: construct });
};

// Extension
define(proxy, { enumerable: false }, {
  define: function(_config, _source) {
    var source = _source || _config;
    var config = _source && _config || {enumerable: false};
    return define(this, config, source);
  },
  assign: function() {
    return assign.apply(null, [this].concat(slice.call(arguments)));
  }
});

// Public API
proxy.define({
  invoke: function() {
    return this._invoke.apply(this, arguments);
  },
  construct: function() {
    return this._construct(this);
  },
  extend: function() {
    return this._extend.apply(this, arguments);
  }
});

// Private API
proxy.define({
  writable: false,
  configurable: false
}, {
  _invoke: function() {
    var target = this._target;
    return (typeof target === 'function' ? target : this[target]).apply(this, arguments);
  },
  _extend: function(_name, _target) {
    var useDefault = (typeof _name !== 'function');
    var target = (useDefault ? _target : _name) || this._target || 'extend';
    var name = (useDefault ? _name : target.name) || this.name;
    var _construct = this._construct;
    var exts = {};

    if(!_construct || name !== _construct._name) {
      exts._construct = _construct = proxy(name);
    }

    if(target !== this._target) {
      exts._target = target;
    }

    return _construct(this).define(exts);
  }
});

// Internal Meta API
proxy.__meta = {
  regex: /_\$([$A-Z_][0-9A-Z_$]*)\$_/gi,
  types: {
    LITERAL: 1,
    LOOKUP: 2
  },
  extract: function(fn, _src) {
    var src = _src || fn.toString();
    return {
      name: src.slice(8, src.indexOf('(')).trim() || fn.name,
      body: src.slice(src.indexOf('{') + 1, src.length-1),
      args: src.slice(src.indexOf('(') + 1, src.indexOf(')'))
           .split(/\s*,\s*/)
    };
  },
  parse: function(spec, proc) {
    return split.call(spec, this.regex).map(function(raw, idx) {
      var safe = JSON.stringify(raw);
      var type = (idx % 2) ? this.types.LOOKUP : this.types.LITERAL;
      return proc.call(this.types, type, safe, raw);
    }, this);
  },
  compile: function(spec) {
    var info = this.extract(spec);

    var raw = [].concat(
      'var t = "";',
      this.parse(info.body, function(type, safe, raw) {
        return 't += ' + (type === this.LOOKUP ? '__lookup__.'+ raw +' || ' : '') + safe + ';';
      }),
      'return t;'
    ).join('\n');

    return Function(['__lookup__'], raw);
  }
};

proxy.define({
  writable: false,
  configurable: false
}, {
  __meta: proxy.__meta,
  __template: proxy.__meta.compile(function(){
    return function _$name$_(_$args$_) {
      _$name$_._context = this;
      var ret = _$name$_.invoke.apply(_$name$_, arguments);
      _$name$_._context = undefined;
      return ret;
    };
  }),
  __createFunction: function(name, args) {
    return Function(proxy.__template({ name: name, args: args || ' ' }));
  }
});

// Default export
var fx = proxy.extend('fx').define({
  extend: function(name, target) {
    return this._extend(name, target || 'create');
  },
  create: function() {
    var factory = this.construct();
    var ret = !factory.init ? factory : factory.init.apply(factory, arguments);
    return typeof ret !== 'undefined' ? ret : factory;
  }
});

module.exports = fx;