var lazypipe = require('lazypipe');
var clone = require('gulp-clone');
var filter = require('gulp-filter');

var fx = require('./fx');

var bind = Function.prototype.bind;
var slice = Array.prototype.slice;

var Ductor = fx.extend(function() {
  if (this === Ductor) {
    return this.create.apply(this, arguments);
  } else {
    return this.run.apply(this, arguments);
  }
});

Ductor.define({
  init: function(proc) {
    this.pipe = this.pipe.bind(this);
    this.filter = this.filter.bind(this);
    this.copy = this.copy.bind(this);

    this.queue = [];
    this.proc = proc;
  },

  run: function() {
    this.proc && this.proc.apply(this, [this].concat(slice.call(arguments)));

    return this.queue.splice(0, this.queue.length).reduce(function (prev, next) {
      return prev.pipe(next);
    }, lazypipe())();
  },
  
  pipe: function (newStream) {
    this.queue.push(function () {
      return newStream;
    });
    return this;
  },
  
  filter: function (glob) {
    var restore = arguments.length <= 1 || arguments[1] === undefined ? true : arguments[1];
    var pipe = this.pipe;

    var globFilter = filter(glob, { restore: restore });

    var filtered = Ductor();

    pipe(globFilter);
    this.queue.push(function () {
      return filtered();
    });
    pipe(globFilter.restore);

    return filtered;
  },
  
  copy: function (glob) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? { suffix: '-copy' } : arguments[1];
    var pipe = this.pipe;

    var globFilter = filter(glob, { restore: true });
    var sink = clone.sink();

    var copies = Ductor();
  
    pipe(globFilter);
    pipe(sink);
    this.queue.push(function () {
      return copies();
    });
    pipe(sink.tap());
    pipe(globFilter.restore);

    return copies;
  }
});

module.exports = Ductor;