// Who says jsonp is not usefull when you have json and CORS
// Its called jsonp becouse its not really json, Its javasciprt
// 
// It will return the same thing as json but async and you can
// have more objects, such as Date, regex, blob, file
// 
// Usage:
// > asyncJSON.stringify({foo: new Date()}).then( => console.log ) 
// {foo : new Date(2133212332)}
//
//
(function(exports, undefined) {
  "use strict";

  var jsonStringify = JSON.stringify;
  var isArray = Array.isArray;
  var getKeys = Object.keys;
  var LIMIT = 200;

  var type = (function toType(global) {
    var c =({}).toString;
    return function(obj) {
      if (obj === global) {
        return "global";
      }
      var test = typeof obj;
      return (test !="object")?test:c.call(obj).slice(8,-1).toLowerCase()
    }
  })(this);

  var asap = type(window.setImmediate) === 'function' ? 
      function(callback) {
        setImmediate(callback);
      }: 
      function(callback) {
        setTimeout(callback, 0);
      };

  var identifier = /^[a-z_$][a-z0-9_$]*$/i;
  
  function is_identifier_string(str){
  	return identifier.test(str);
  }

  function stringifyAux(data, callback, errback, key, counter, context, opts) {
    switch (type(data)) {
      case "undefined": 
          callback("void 0")
        break
      case "boolean":
        callback("!" + (data ? 0:1));
        break
      case "date":
        callback("new Date(" + (+data) + ")");
        break
      case "string":
        callback(jsonStringify(data))
        break
      case "null":
        callback("null")
        break
      case "file":
      case "blob":
          var file = data;
          opts.b64toBlob = true;
          data = new Promise(function(resolve, reject){
            var reader = new FileReader();
            reader.onload = function() {
              var stringify = JSON.stringify;
              resolve("b64toBlob(" + stringify(this.result.split(",",2)[1]) +", "+ stringify(file.type) + (file.name ? ', '+stringify(file.name) : '') + ")");
            };
            reader.readAsDataURL(file);
          }).then(function(value) {
            callback(value);
          })
          break;
      case "promise":
        var then = data.then;
        then.call(data, function(value) {
          stringify(value, callback, errback, key, counter, undefined, opts);
        }, errback);
        break
      case "regexp":
          callback(data.toString())
        break;
      case "number":
        if(Number.isNaN(data))
          callback("NaN")
        else if(data === Infinity)
          callback("1/0")
        else if(data === -Infinity)
          callback("-1/0")
        else
          callback(jsonStringify(data))
        break
      case "array":
          internalStringifyArray(data, callback, errback, counter, opts);
        break
      case "object":
          internalStringifyObject(data, callback, errback, counter, opts);
          break
      case "function":
        if (data.length === 0) {
          // assume a sync function that returns a value
          stringify(data.call(context), callback, errback, key, counter, undefined, opts);
        } else {
          // assume an async function that takes a callback
          data.call(context, function(err, value) {
            if (err) {
              errback(err);
            } else {
              stringify(value, callback, errback, key, counter, undefined, opts);
            }
          });
        }
        break;
      default:
        callback(jsonStringify(data));
        break;
    }
  }

  function stringify(data, callback, errback, key, counter, context, opts) {
    if (!counter) {
      throw new Error("Expected counter");
    }
    try {
      stringifyAux(data, callback, errback, key, counter, context, opts);
    } catch (err) {
      errback(err);
    }
  }

  /**
   * Stringify an array
   *
   * @param {Array} array The array to stringify.
   * @param {Function} callback The callback to invoke when completed the stringification.
   * @api private
   *
   * @example internalStringifyArray([1, 2, 3], function(err, value) { value === "[1,2,3]"; });
   */
   function internalStringifyArray(array, callback, errback, counter, opts) {
    var len = array.length;
    if (len === 0) {
      callback("[]");
      return;
    }

    // buffer is our ultimate return value
    var buffer = "[";

    function step(n) {
      if (n === len) {
        // we're done
        buffer += "]";
        callback(buffer);
        return false;
      }

      var synchronous = true;
      var completedSynchronously = false;
      // asynchronously stringify the nth element.
      stringify(array[n], function(value) {
        if (n > 0) {
          buffer += ",";
        }

        if (value === undefined) {
          // JSON.stringify turns bad values in arrays into null, so we need to as well
          buffer += "null";
        } else {
          buffer += value;
        }

        // go to the next element
        if (counter.inc()) {
          asap(function() {
            run(n + 1);
          });
        } else if (synchronous) {
          completedSynchronously = true;
        } else {
          run(n + 1);
        }
      }, errback, String(n), counter, array, opts);
      synchronous = false;
      return completedSynchronously;
    }

    function run(start) {
      try {
        for (var i = start; step(i); ++i) {
          // nothing to do, as step's return value will cause a halt eventually
        }
      } catch (e) {
        errback(e);
      }
    }

    // let's pump, starting at index 0
    run(0);
  };

  /**
   * Stringify an object
   *
   * @param {Object} object The object to stringify.
   * @param {Function} callback The callback to invoke when completed the stringification.
   * @api private
   *
   * @example internalStringifyObject({alpha: 1, bravo: 2}, function(err, value) { value === '{"alpha":1,"bravo":2}'; });
   */
 function internalStringifyObject(object, callback, errback, counter, opts) {
    // getKeys _should_ be a reference to Object.keys
    // JSON.stringify gets the keys in the same order as this, but that is arbitrary.
    var keys = getKeys(object);
    var len = keys.length;
    if (len === 0) {
      callback("{}");
      return;
    }

    // whether or not we've placed the first element in yet.
    // can't rely on i === 0, since we might skip it if the value === undefined.
    var first = true;

    // buffer is our ultimate return value
    var buffer = "{";

    function step(n) {
      if (n === len) {
        buffer += "}";
        callback(buffer);
        return false;
      }

      var synchronous = true;
      var completedSynchronously = false;
      var key = keys[n];
      // asynchronously stringify the nth element in our list of keys
      stringify(object[key], function(value) {
        // if we get an undefined, rather than placing in null like the array does, we just skip it.
        if (value !== undefined) {
          if (first) {
            first = false;
          } else {
            buffer += ",";
          }

          buffer += is_identifier_string(key) ? key : jsonStringify(key);;
          buffer += ":";
          buffer += value;
        }

        // go to the next key
        if (counter.inc()) {
          asap(function() {
            run(n + 1);
          });
        } else if (synchronous) {
          completedSynchronously = true;
        } else {
          run(n + 1);
        }
      }, errback, key, counter, object, opts);
      synchronous = false;
      return completedSynchronously;
    };

    function run(start) {
      try {
        for (var i = start; step(i); ++i) {
          // nothing to do, as step's return value will cause a halt eventually
        }
      } catch (e) {
        errback(e);
      }
    };

    // let's pump, starting at index 0
    run(0);
  };

  var Counter = (function() {
    function Counter() {
      this.count = 0;
    }
    Counter.prototype.inc = function() {
      if (++this.count >= LIMIT) {
        this.count = 0;
        return true;
      } else {
        return false;
      }
    };
    return Counter;
  }());

  function runStringify(data, callback, errback) {
    asap(function(){
      var opts = {
        b64toBlob: false
      }
      var wr = function(d){
      	var wrapped = opts.b64toBlob || opts.b64toBlob;
      	if(!wrapped) return callback(d);

        d = "(function(){"+
           opts.b64toBlob ? b64toBlob.toString() : "" +
           "return "+d+
         "})()";
        callback(d);
      }
      stringify(data, wr, errback, undefined, new Counter(), undefined, opts);
    });
  }

  function stringifyPromise(data) {
    return new Promise(function(resolve, reject) {
      runStringify(data, resolve, reject);
    });
  };

  function stringifyNode(data, callback) {
    // the inner callbacks are wrapped in asap to prevent an error potentially
    // being thrown by invoking the callback being handled by an outer caller
    runStringify(data, function (value) {
      asap(function () {
        callback(null, value);
      });
    }, function (error) {
      asap(function () {
        callback(error);
      });
    });
  };

  /**
   * Asynchronously convert a JavaScript object to JSON.
   * If any functions are supplied in the data, it will be invoked.
   * If the function has 0 parameters, it will be invoked and treated as synchronous, its return value being its replacement.
   * Otherwise, the first parameter is assumed to be a callback which should be invoked as callback(error, result)
   *
   * @param {Any} data Any JavaScript object.
   * @param {Function or null} callback A callback that takes an error and the result as parameters.
   * @api public
   * @return {Promise or undefined} If a callback is not provided, a Promise will be returned.
   *
   * @example stringify({some: "data"}, function(err, value) { if (err) { throw err; } value === '{"some":"data"}' })
   * @example stringify({some: "data"}.then(function(value) { assert(value === '{"some":"data"}') })
   */
  exports.stringify = function(data, callback) {
    if (callback == null) {
      return stringifyPromise(data);
    } else {
      return stringifyNode(data, callback);
    }
  };
}(undefined || (window.asyncJSON = {})));

function b64toBlob(r,t,e){for(var a=1024,n=atob(r),o=n.length,i=Math.ceil(o/a),l=Array(i),y=0;i>y;++y){for(var b=y*a,h=Math.min(b+a,o),A=Array(h-b),c=b,f=0;h>c;++f,++c)A[f]=n[c].charCodeAt(0);l[y]=new Uint8Array(A)}return e===""+e?new File(l,e,{type:t||""}):new Blob(l,{type:t||""})}