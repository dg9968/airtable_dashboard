var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined")
    return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// ../../node_modules/airtable/lib/airtable.umd.js
var require_airtable_umd = __commonJS((exports, module) => {
  (function(f) {
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = f();
    } else if (typeof define === "function" && define.amd) {
      define([], f);
    } else {
      var g;
      if (typeof window !== "undefined") {
        g = window;
      } else if (typeof global !== "undefined") {
        g = global;
      } else if (typeof self !== "undefined") {
        g = self;
      } else {
        g = this;
      }
      g.Airtable = f();
    }
  })(function() {
    var define2, module2, exports2;
    return function() {
      function r(e, n, t) {
        function o(i2, f) {
          if (!n[i2]) {
            if (!e[i2]) {
              var c = __require;
              if (!f && c)
                return c(i2, true);
              if (u)
                return u(i2, true);
              var a = new Error("Cannot find module '" + i2 + "'");
              throw a.code = "MODULE_NOT_FOUND", a;
            }
            var p = n[i2] = { exports: {} };
            e[i2][0].call(p.exports, function(r2) {
              var n2 = e[i2][1][r2];
              return o(n2 || r2);
            }, p, p.exports, r, e, n, t);
          }
          return n[i2].exports;
        }
        for (var u = __require, i = 0;i < t.length; i++)
          o(t[i]);
        return o;
      }
      return r;
    }()({ 1: [function(require2, module3, exports3) {
      var AbortController;
      var browserGlobal = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : null;
      if (!browserGlobal) {
        AbortController = require2("abort-controller");
      } else if ("signal" in new Request("https://airtable.com")) {
        AbortController = browserGlobal.AbortController;
      } else {
        var polyfill = require2("abortcontroller-polyfill/dist/cjs-ponyfill");
        AbortController = polyfill.AbortController;
      }
      module3.exports = AbortController;
    }, { "abort-controller": 20, "abortcontroller-polyfill/dist/cjs-ponyfill": 19 }], 2: [function(require2, module3, exports3) {
      var AirtableError = function() {
        function AirtableError2(error, message, statusCode) {
          this.error = error;
          this.message = message;
          this.statusCode = statusCode;
        }
        AirtableError2.prototype.toString = function() {
          return [
            this.message,
            "(",
            this.error,
            ")",
            this.statusCode ? "[Http code " + this.statusCode + "]" : ""
          ].join("");
        };
        return AirtableError2;
      }();
      module3.exports = AirtableError;
    }, {}], 3: [function(require2, module3, exports3) {
      var __assign = this && this.__assign || function() {
        __assign = Object.assign || function(t) {
          for (var s, i = 1, n = arguments.length;i < n; i++) {
            s = arguments[i];
            for (var p in s)
              if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
          }
          return t;
        };
        return __assign.apply(this, arguments);
      };
      var __importDefault = this && this.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
      var get_1 = __importDefault(require2("lodash/get"));
      var isPlainObject_1 = __importDefault(require2("lodash/isPlainObject"));
      var keys_1 = __importDefault(require2("lodash/keys"));
      var fetch_1 = __importDefault(require2("./fetch"));
      var abort_controller_1 = __importDefault(require2("./abort-controller"));
      var object_to_query_param_string_1 = __importDefault(require2("./object_to_query_param_string"));
      var airtable_error_1 = __importDefault(require2("./airtable_error"));
      var table_1 = __importDefault(require2("./table"));
      var http_headers_1 = __importDefault(require2("./http_headers"));
      var run_action_1 = __importDefault(require2("./run_action"));
      var package_version_1 = __importDefault(require2("./package_version"));
      var exponential_backoff_with_jitter_1 = __importDefault(require2("./exponential_backoff_with_jitter"));
      var userAgent = "Airtable.js/" + package_version_1.default;
      var Base = function() {
        function Base2(airtable, baseId) {
          this._airtable = airtable;
          this._id = baseId;
        }
        Base2.prototype.table = function(tableName) {
          return new table_1.default(this, null, tableName);
        };
        Base2.prototype.makeRequest = function(options) {
          var _this = this;
          var _a;
          if (options === undefined) {
            options = {};
          }
          var method = get_1.default(options, "method", "GET").toUpperCase();
          var url = this._airtable._endpointUrl + "/v" + this._airtable._apiVersionMajor + "/" + this._id + get_1.default(options, "path", "/") + "?" + object_to_query_param_string_1.default(get_1.default(options, "qs", {}));
          var controller = new abort_controller_1.default;
          var headers = this._getRequestHeaders(Object.assign({}, this._airtable._customHeaders, (_a = options.headers) !== null && _a !== undefined ? _a : {}));
          var requestOptions = {
            method,
            headers,
            signal: controller.signal
          };
          if ("body" in options && _canRequestMethodIncludeBody(method)) {
            requestOptions.body = JSON.stringify(options.body);
          }
          var timeout = setTimeout(function() {
            controller.abort();
          }, this._airtable._requestTimeout);
          return new Promise(function(resolve, reject) {
            fetch_1.default(url, requestOptions).then(function(resp) {
              clearTimeout(timeout);
              if (resp.status === 429 && !_this._airtable._noRetryIfRateLimited) {
                var numAttempts_1 = get_1.default(options, "_numAttempts", 0);
                var backoffDelayMs = exponential_backoff_with_jitter_1.default(numAttempts_1);
                setTimeout(function() {
                  var newOptions = __assign(__assign({}, options), { _numAttempts: numAttempts_1 + 1 });
                  _this.makeRequest(newOptions).then(resolve).catch(reject);
                }, backoffDelayMs);
              } else {
                resp.json().then(function(body) {
                  var err = _this._checkStatusForError(resp.status, body) || _getErrorForNonObjectBody(resp.status, body);
                  if (err) {
                    reject(err);
                  } else {
                    resolve({
                      statusCode: resp.status,
                      headers: resp.headers,
                      body
                    });
                  }
                }).catch(function() {
                  var err = _getErrorForNonObjectBody(resp.status);
                  reject(err);
                });
              }
            }).catch(function(err) {
              clearTimeout(timeout);
              err = new airtable_error_1.default("CONNECTION_ERROR", err.message, null);
              reject(err);
            });
          });
        };
        Base2.prototype.runAction = function(method, path, queryParams, bodyData, callback) {
          run_action_1.default(this, method, path, queryParams, bodyData, callback, 0);
        };
        Base2.prototype._getRequestHeaders = function(headers) {
          var result = new http_headers_1.default;
          result.set("Authorization", "Bearer " + this._airtable._apiKey);
          result.set("User-Agent", userAgent);
          result.set("Content-Type", "application/json");
          for (var _i = 0, _a = keys_1.default(headers);_i < _a.length; _i++) {
            var headerKey = _a[_i];
            result.set(headerKey, headers[headerKey]);
          }
          return result.toJSON();
        };
        Base2.prototype._checkStatusForError = function(statusCode, body) {
          var _a = (body !== null && body !== undefined ? body : { error: {} }).error, error = _a === undefined ? {} : _a;
          var { type, message } = error;
          if (statusCode === 401) {
            return new airtable_error_1.default("AUTHENTICATION_REQUIRED", "You should provide valid api key to perform this operation", statusCode);
          } else if (statusCode === 403) {
            return new airtable_error_1.default("NOT_AUTHORIZED", "You are not authorized to perform this operation", statusCode);
          } else if (statusCode === 404) {
            return new airtable_error_1.default("NOT_FOUND", message !== null && message !== undefined ? message : "Could not find what you are looking for", statusCode);
          } else if (statusCode === 413) {
            return new airtable_error_1.default("REQUEST_TOO_LARGE", "Request body is too large", statusCode);
          } else if (statusCode === 422) {
            return new airtable_error_1.default(type !== null && type !== undefined ? type : "UNPROCESSABLE_ENTITY", message !== null && message !== undefined ? message : "The operation cannot be processed", statusCode);
          } else if (statusCode === 429) {
            return new airtable_error_1.default("TOO_MANY_REQUESTS", "You have made too many requests in a short period of time. Please retry your request later", statusCode);
          } else if (statusCode === 500) {
            return new airtable_error_1.default("SERVER_ERROR", "Try again. If the problem persists, contact support.", statusCode);
          } else if (statusCode === 503) {
            return new airtable_error_1.default("SERVICE_UNAVAILABLE", "The service is temporarily unavailable. Please retry shortly.", statusCode);
          } else if (statusCode >= 400) {
            return new airtable_error_1.default(type !== null && type !== undefined ? type : "UNEXPECTED_ERROR", message !== null && message !== undefined ? message : "An unexpected error occurred", statusCode);
          } else {
            return null;
          }
        };
        Base2.prototype.doCall = function(tableName) {
          return this.table(tableName);
        };
        Base2.prototype.getId = function() {
          return this._id;
        };
        Base2.createFunctor = function(airtable, baseId) {
          var base = new Base2(airtable, baseId);
          var baseFn = function(tableName) {
            return base.doCall(tableName);
          };
          baseFn._base = base;
          baseFn.table = base.table.bind(base);
          baseFn.makeRequest = base.makeRequest.bind(base);
          baseFn.runAction = base.runAction.bind(base);
          baseFn.getId = base.getId.bind(base);
          return baseFn;
        };
        return Base2;
      }();
      function _canRequestMethodIncludeBody(method) {
        return method !== "GET" && method !== "DELETE";
      }
      function _getErrorForNonObjectBody(statusCode, body) {
        if (isPlainObject_1.default(body)) {
          return null;
        } else {
          return new airtable_error_1.default("UNEXPECTED_ERROR", "The response from Airtable was invalid JSON. Please try again soon.", statusCode);
        }
      }
      module3.exports = Base;
    }, { "./abort-controller": 1, "./airtable_error": 2, "./exponential_backoff_with_jitter": 6, "./fetch": 7, "./http_headers": 9, "./object_to_query_param_string": 11, "./package_version": 12, "./run_action": 16, "./table": 17, "lodash/get": 77, "lodash/isPlainObject": 89, "lodash/keys": 93 }], 4: [function(require2, module3, exports3) {
      function callbackToPromise(fn, context, callbackArgIndex) {
        if (callbackArgIndex === undefined) {
          callbackArgIndex = undefined;
        }
        return function() {
          var callArgs = [];
          for (var _i = 0;_i < arguments.length; _i++) {
            callArgs[_i] = arguments[_i];
          }
          var thisCallbackArgIndex;
          if (callbackArgIndex === undefined) {
            thisCallbackArgIndex = callArgs.length > 0 ? callArgs.length - 1 : 0;
          } else {
            thisCallbackArgIndex = callbackArgIndex;
          }
          var callbackArg = callArgs[thisCallbackArgIndex];
          if (typeof callbackArg === "function") {
            fn.apply(context, callArgs);
            return;
          } else {
            var args_1 = [];
            var argLen = Math.max(callArgs.length, thisCallbackArgIndex);
            for (var i = 0;i < argLen; i++) {
              args_1.push(callArgs[i]);
            }
            return new Promise(function(resolve, reject) {
              args_1.push(function(err, result) {
                if (err) {
                  reject(err);
                } else {
                  resolve(result);
                }
              });
              fn.apply(context, args_1);
            });
          }
        };
      }
      module3.exports = callbackToPromise;
    }, {}], 5: [function(require2, module3, exports3) {
      var didWarnForDeprecation = {};
      function deprecate(fn, key, message) {
        return function() {
          var args = [];
          for (var _i = 0;_i < arguments.length; _i++) {
            args[_i] = arguments[_i];
          }
          if (!didWarnForDeprecation[key]) {
            didWarnForDeprecation[key] = true;
            console.warn(message);
          }
          fn.apply(this, args);
        };
      }
      module3.exports = deprecate;
    }, {}], 6: [function(require2, module3, exports3) {
      var __importDefault = this && this.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
      var internal_config_json_1 = __importDefault(require2("./internal_config.json"));
      function exponentialBackoffWithJitter(numberOfRetries) {
        var rawBackoffTimeMs = internal_config_json_1.default.INITIAL_RETRY_DELAY_IF_RATE_LIMITED * Math.pow(2, numberOfRetries);
        var clippedBackoffTimeMs = Math.min(internal_config_json_1.default.MAX_RETRY_DELAY_IF_RATE_LIMITED, rawBackoffTimeMs);
        var jitteredBackoffTimeMs = Math.random() * clippedBackoffTimeMs;
        return jitteredBackoffTimeMs;
      }
      module3.exports = exponentialBackoffWithJitter;
    }, { "./internal_config.json": 10 }], 7: [function(require2, module3, exports3) {
      var __importDefault = this && this.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
      var node_fetch_1 = __importDefault(require2("node-fetch"));
      var browserGlobal = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : null;
      module3.exports = !browserGlobal ? node_fetch_1.default : browserGlobal.fetch.bind(browserGlobal);
    }, { "node-fetch": 20 }], 8: [function(require2, module3, exports3) {
      function has(object, property) {
        return Object.prototype.hasOwnProperty.call(object, property);
      }
      module3.exports = has;
    }, {}], 9: [function(require2, module3, exports3) {
      var __importDefault = this && this.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
      var keys_1 = __importDefault(require2("lodash/keys"));
      var isBrowser = typeof window !== "undefined";
      var HttpHeaders = function() {
        function HttpHeaders2() {
          this._headersByLowercasedKey = {};
        }
        HttpHeaders2.prototype.set = function(headerKey, headerValue) {
          var lowercasedKey = headerKey.toLowerCase();
          if (lowercasedKey === "x-airtable-user-agent") {
            lowercasedKey = "user-agent";
            headerKey = "User-Agent";
          }
          this._headersByLowercasedKey[lowercasedKey] = {
            headerKey,
            headerValue
          };
        };
        HttpHeaders2.prototype.toJSON = function() {
          var result = {};
          for (var _i = 0, _a = keys_1.default(this._headersByLowercasedKey);_i < _a.length; _i++) {
            var lowercasedKey = _a[_i];
            var headerDefinition = this._headersByLowercasedKey[lowercasedKey];
            var headerKey = undefined;
            if (isBrowser && lowercasedKey === "user-agent") {
              headerKey = "X-Airtable-User-Agent";
            } else {
              headerKey = headerDefinition.headerKey;
            }
            result[headerKey] = headerDefinition.headerValue;
          }
          return result;
        };
        return HttpHeaders2;
      }();
      module3.exports = HttpHeaders;
    }, { "lodash/keys": 93 }], 10: [function(require2, module3, exports3) {
      module3.exports = {
        INITIAL_RETRY_DELAY_IF_RATE_LIMITED: 5000,
        MAX_RETRY_DELAY_IF_RATE_LIMITED: 600000
      };
    }, {}], 11: [function(require2, module3, exports3) {
      var __importDefault = this && this.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
      var isArray_1 = __importDefault(require2("lodash/isArray"));
      var isNil_1 = __importDefault(require2("lodash/isNil"));
      var keys_1 = __importDefault(require2("lodash/keys"));
      function buildParams(prefix, obj, addFn) {
        if (isArray_1.default(obj)) {
          for (var index = 0;index < obj.length; index++) {
            var value = obj[index];
            if (/\[\]$/.test(prefix)) {
              addFn(prefix, value);
            } else {
              buildParams(prefix + "[" + (typeof value === "object" && value !== null ? index : "") + "]", value, addFn);
            }
          }
        } else if (typeof obj === "object") {
          for (var _i = 0, _a = keys_1.default(obj);_i < _a.length; _i++) {
            var key = _a[_i];
            var value = obj[key];
            buildParams(prefix + "[" + key + "]", value, addFn);
          }
        } else {
          addFn(prefix, obj);
        }
      }
      function objectToQueryParamString(obj) {
        var parts = [];
        var addFn = function(key2, value2) {
          value2 = isNil_1.default(value2) ? "" : value2;
          parts.push(encodeURIComponent(key2) + "=" + encodeURIComponent(value2));
        };
        for (var _i = 0, _a = keys_1.default(obj);_i < _a.length; _i++) {
          var key = _a[_i];
          var value = obj[key];
          buildParams(key, value, addFn);
        }
        return parts.join("&").replace(/%20/g, "+");
      }
      module3.exports = objectToQueryParamString;
    }, { "lodash/isArray": 79, "lodash/isNil": 85, "lodash/keys": 93 }], 12: [function(require2, module3, exports3) {
      module3.exports = "0.12.2";
    }, {}], 13: [function(require2, module3, exports3) {
      var __assign = this && this.__assign || function() {
        __assign = Object.assign || function(t) {
          for (var s, i = 1, n = arguments.length;i < n; i++) {
            s = arguments[i];
            for (var p in s)
              if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
          }
          return t;
        };
        return __assign.apply(this, arguments);
      };
      var __importDefault = this && this.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
      var isFunction_1 = __importDefault(require2("lodash/isFunction"));
      var keys_1 = __importDefault(require2("lodash/keys"));
      var record_1 = __importDefault(require2("./record"));
      var callback_to_promise_1 = __importDefault(require2("./callback_to_promise"));
      var has_1 = __importDefault(require2("./has"));
      var query_params_1 = require2("./query_params");
      var object_to_query_param_string_1 = __importDefault(require2("./object_to_query_param_string"));
      var Query = function() {
        function Query2(table, params) {
          this._table = table;
          this._params = params;
          this.firstPage = callback_to_promise_1.default(firstPage, this);
          this.eachPage = callback_to_promise_1.default(eachPage, this, 1);
          this.all = callback_to_promise_1.default(all, this);
        }
        Query2.validateParams = function(params) {
          var validParams = {};
          var ignoredKeys = [];
          var errors = [];
          for (var _i = 0, _a = keys_1.default(params);_i < _a.length; _i++) {
            var key = _a[_i];
            var value = params[key];
            if (has_1.default(Query2.paramValidators, key)) {
              var validator = Query2.paramValidators[key];
              var validationResult = validator(value);
              if (validationResult.pass) {
                validParams[key] = value;
              } else {
                errors.push(validationResult.error);
              }
            } else {
              ignoredKeys.push(key);
            }
          }
          return {
            validParams,
            ignoredKeys,
            errors
          };
        };
        Query2.paramValidators = query_params_1.paramValidators;
        return Query2;
      }();
      function firstPage(done) {
        if (!isFunction_1.default(done)) {
          throw new Error("The first parameter to `firstPage` must be a function");
        }
        this.eachPage(function(records) {
          done(null, records);
        }, function(error) {
          done(error, null);
        });
      }
      function eachPage(pageCallback, done) {
        var _this = this;
        if (!isFunction_1.default(pageCallback)) {
          throw new Error("The first parameter to `eachPage` must be a function");
        }
        if (!isFunction_1.default(done) && done !== undefined) {
          throw new Error("The second parameter to `eachPage` must be a function or undefined");
        }
        var params = __assign({}, this._params);
        var pathAndParamsAsString = "/" + this._table._urlEncodedNameOrId() + "?" + object_to_query_param_string_1.default(params);
        var queryParams = {};
        var requestData = null;
        var method;
        var path;
        if (params.method === "post" || pathAndParamsAsString.length > query_params_1.URL_CHARACTER_LENGTH_LIMIT) {
          requestData = params;
          method = "post";
          path = "/" + this._table._urlEncodedNameOrId() + "/listRecords";
          var paramNames = Object.keys(params);
          for (var _i = 0, paramNames_1 = paramNames;_i < paramNames_1.length; _i++) {
            var paramName = paramNames_1[_i];
            if (query_params_1.shouldListRecordsParamBePassedAsParameter(paramName)) {
              queryParams[paramName] = params[paramName];
            } else {
              requestData[paramName] = params[paramName];
            }
          }
        } else {
          method = "get";
          queryParams = params;
          path = "/" + this._table._urlEncodedNameOrId();
        }
        var inner = function() {
          _this._table._base.runAction(method, path, queryParams, requestData, function(err, response, result) {
            if (err) {
              done(err, null);
            } else {
              var next = undefined;
              if (result.offset) {
                params.offset = result.offset;
                next = inner;
              } else {
                next = function() {
                  done(null);
                };
              }
              var records = result.records.map(function(recordJson) {
                return new record_1.default(_this._table, null, recordJson);
              });
              pageCallback(records, next);
            }
          });
        };
        inner();
      }
      function all(done) {
        if (!isFunction_1.default(done)) {
          throw new Error("The first parameter to `all` must be a function");
        }
        var allRecords = [];
        this.eachPage(function(pageRecords, fetchNextPage) {
          allRecords.push.apply(allRecords, pageRecords);
          fetchNextPage();
        }, function(err) {
          if (err) {
            done(err, null);
          } else {
            done(null, allRecords);
          }
        });
      }
      module3.exports = Query;
    }, { "./callback_to_promise": 4, "./has": 8, "./object_to_query_param_string": 11, "./query_params": 14, "./record": 15, "lodash/isFunction": 83, "lodash/keys": 93 }], 14: [function(require2, module3, exports3) {
      var __importDefault = this && this.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
      Object.defineProperty(exports3, "__esModule", { value: true });
      exports3.shouldListRecordsParamBePassedAsParameter = exports3.URL_CHARACTER_LENGTH_LIMIT = exports3.paramValidators = undefined;
      var typecheck_1 = __importDefault(require2("./typecheck"));
      var isString_1 = __importDefault(require2("lodash/isString"));
      var isNumber_1 = __importDefault(require2("lodash/isNumber"));
      var isPlainObject_1 = __importDefault(require2("lodash/isPlainObject"));
      var isBoolean_1 = __importDefault(require2("lodash/isBoolean"));
      exports3.paramValidators = {
        fields: typecheck_1.default(typecheck_1.default.isArrayOf(isString_1.default), "the value for `fields` should be an array of strings"),
        filterByFormula: typecheck_1.default(isString_1.default, "the value for `filterByFormula` should be a string"),
        maxRecords: typecheck_1.default(isNumber_1.default, "the value for `maxRecords` should be a number"),
        pageSize: typecheck_1.default(isNumber_1.default, "the value for `pageSize` should be a number"),
        offset: typecheck_1.default(isNumber_1.default, "the value for `offset` should be a number"),
        sort: typecheck_1.default(typecheck_1.default.isArrayOf(function(obj) {
          return isPlainObject_1.default(obj) && isString_1.default(obj.field) && (obj.direction === undefined || ["asc", "desc"].includes(obj.direction));
        }), "the value for `sort` should be an array of sort objects. " + "Each sort object must have a string `field` value, and an optional " + '`direction` value that is "asc" or "desc".'),
        view: typecheck_1.default(isString_1.default, "the value for `view` should be a string"),
        cellFormat: typecheck_1.default(function(cellFormat) {
          return isString_1.default(cellFormat) && ["json", "string"].includes(cellFormat);
        }, 'the value for `cellFormat` should be "json" or "string"'),
        timeZone: typecheck_1.default(isString_1.default, "the value for `timeZone` should be a string"),
        userLocale: typecheck_1.default(isString_1.default, "the value for `userLocale` should be a string"),
        method: typecheck_1.default(function(method) {
          return isString_1.default(method) && ["get", "post"].includes(method);
        }, 'the value for `method` should be "get" or "post"'),
        returnFieldsByFieldId: typecheck_1.default(isBoolean_1.default, "the value for `returnFieldsByFieldId` should be a boolean"),
        recordMetadata: typecheck_1.default(typecheck_1.default.isArrayOf(isString_1.default), "the value for `recordMetadata` should be an array of strings")
      };
      exports3.URL_CHARACTER_LENGTH_LIMIT = 15000;
      exports3.shouldListRecordsParamBePassedAsParameter = function(paramName) {
        return paramName === "timeZone" || paramName === "userLocale";
      };
    }, { "./typecheck": 18, "lodash/isBoolean": 81, "lodash/isNumber": 86, "lodash/isPlainObject": 89, "lodash/isString": 90 }], 15: [function(require2, module3, exports3) {
      var __assign = this && this.__assign || function() {
        __assign = Object.assign || function(t) {
          for (var s, i = 1, n = arguments.length;i < n; i++) {
            s = arguments[i];
            for (var p in s)
              if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
          }
          return t;
        };
        return __assign.apply(this, arguments);
      };
      var __importDefault = this && this.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
      var callback_to_promise_1 = __importDefault(require2("./callback_to_promise"));
      var Record = function() {
        function Record2(table, recordId, recordJson) {
          this._table = table;
          this.id = recordId || recordJson.id;
          if (recordJson) {
            this.commentCount = recordJson.commentCount;
          }
          this.setRawJson(recordJson);
          this.save = callback_to_promise_1.default(save, this);
          this.patchUpdate = callback_to_promise_1.default(patchUpdate, this);
          this.putUpdate = callback_to_promise_1.default(putUpdate, this);
          this.destroy = callback_to_promise_1.default(destroy, this);
          this.fetch = callback_to_promise_1.default(fetch2, this);
          this.updateFields = this.patchUpdate;
          this.replaceFields = this.putUpdate;
        }
        Record2.prototype.getId = function() {
          return this.id;
        };
        Record2.prototype.get = function(columnName) {
          return this.fields[columnName];
        };
        Record2.prototype.set = function(columnName, columnValue) {
          this.fields[columnName] = columnValue;
        };
        Record2.prototype.setRawJson = function(rawJson) {
          this._rawJson = rawJson;
          this.fields = this._rawJson && this._rawJson.fields || {};
        };
        return Record2;
      }();
      function save(done) {
        this.putUpdate(this.fields, done);
      }
      function patchUpdate(cellValuesByName, opts, done) {
        var _this = this;
        if (!done) {
          done = opts;
          opts = {};
        }
        var updateBody = __assign({ fields: cellValuesByName }, opts);
        this._table._base.runAction("patch", "/" + this._table._urlEncodedNameOrId() + "/" + this.id, {}, updateBody, function(err, response, results) {
          if (err) {
            done(err);
            return;
          }
          _this.setRawJson(results);
          done(null, _this);
        });
      }
      function putUpdate(cellValuesByName, opts, done) {
        var _this = this;
        if (!done) {
          done = opts;
          opts = {};
        }
        var updateBody = __assign({ fields: cellValuesByName }, opts);
        this._table._base.runAction("put", "/" + this._table._urlEncodedNameOrId() + "/" + this.id, {}, updateBody, function(err, response, results) {
          if (err) {
            done(err);
            return;
          }
          _this.setRawJson(results);
          done(null, _this);
        });
      }
      function destroy(done) {
        var _this = this;
        this._table._base.runAction("delete", "/" + this._table._urlEncodedNameOrId() + "/" + this.id, {}, null, function(err) {
          if (err) {
            done(err);
            return;
          }
          done(null, _this);
        });
      }
      function fetch2(done) {
        var _this = this;
        this._table._base.runAction("get", "/" + this._table._urlEncodedNameOrId() + "/" + this.id, {}, null, function(err, response, results) {
          if (err) {
            done(err);
            return;
          }
          _this.setRawJson(results);
          done(null, _this);
        });
      }
      module3.exports = Record;
    }, { "./callback_to_promise": 4 }], 16: [function(require2, module3, exports3) {
      var __importDefault = this && this.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
      var exponential_backoff_with_jitter_1 = __importDefault(require2("./exponential_backoff_with_jitter"));
      var object_to_query_param_string_1 = __importDefault(require2("./object_to_query_param_string"));
      var package_version_1 = __importDefault(require2("./package_version"));
      var fetch_1 = __importDefault(require2("./fetch"));
      var abort_controller_1 = __importDefault(require2("./abort-controller"));
      var userAgent = "Airtable.js/" + package_version_1.default;
      function runAction(base, method, path, queryParams, bodyData, callback, numAttempts) {
        var url = base._airtable._endpointUrl + "/v" + base._airtable._apiVersionMajor + "/" + base._id + path + "?" + object_to_query_param_string_1.default(queryParams);
        var headers = {
          authorization: "Bearer " + base._airtable._apiKey,
          "x-api-version": base._airtable._apiVersion,
          "x-airtable-application-id": base.getId(),
          "content-type": "application/json"
        };
        var isBrowser = typeof window !== "undefined";
        if (isBrowser) {
          headers["x-airtable-user-agent"] = userAgent;
        } else {
          headers["User-Agent"] = userAgent;
        }
        var controller = new abort_controller_1.default;
        var normalizedMethod = method.toUpperCase();
        var options = {
          method: normalizedMethod,
          headers,
          signal: controller.signal
        };
        if (bodyData !== null) {
          if (normalizedMethod === "GET" || normalizedMethod === "HEAD") {
            console.warn("body argument to runAction are ignored with GET or HEAD requests");
          } else {
            options.body = JSON.stringify(bodyData);
          }
        }
        var timeout = setTimeout(function() {
          controller.abort();
        }, base._airtable._requestTimeout);
        fetch_1.default(url, options).then(function(resp) {
          clearTimeout(timeout);
          if (resp.status === 429 && !base._airtable._noRetryIfRateLimited) {
            var backoffDelayMs = exponential_backoff_with_jitter_1.default(numAttempts);
            setTimeout(function() {
              runAction(base, method, path, queryParams, bodyData, callback, numAttempts + 1);
            }, backoffDelayMs);
          } else {
            resp.json().then(function(body) {
              var error = base._checkStatusForError(resp.status, body);
              var r = {};
              Object.keys(resp).forEach(function(property) {
                r[property] = resp[property];
              });
              r.body = body;
              r.statusCode = resp.status;
              callback(error, r, body);
            }).catch(function() {
              callback(base._checkStatusForError(resp.status));
            });
          }
        }).catch(function(error) {
          clearTimeout(timeout);
          callback(error);
        });
      }
      module3.exports = runAction;
    }, { "./abort-controller": 1, "./exponential_backoff_with_jitter": 6, "./fetch": 7, "./object_to_query_param_string": 11, "./package_version": 12 }], 17: [function(require2, module3, exports3) {
      var __assign = this && this.__assign || function() {
        __assign = Object.assign || function(t) {
          for (var s, i = 1, n = arguments.length;i < n; i++) {
            s = arguments[i];
            for (var p in s)
              if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
          }
          return t;
        };
        return __assign.apply(this, arguments);
      };
      var __importDefault = this && this.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
      var isPlainObject_1 = __importDefault(require2("lodash/isPlainObject"));
      var deprecate_1 = __importDefault(require2("./deprecate"));
      var query_1 = __importDefault(require2("./query"));
      var query_params_1 = require2("./query_params");
      var object_to_query_param_string_1 = __importDefault(require2("./object_to_query_param_string"));
      var record_1 = __importDefault(require2("./record"));
      var callback_to_promise_1 = __importDefault(require2("./callback_to_promise"));
      var Table = function() {
        function Table2(base, tableId, tableName) {
          if (!tableId && !tableName) {
            throw new Error("Table name or table ID is required");
          }
          this._base = base;
          this.id = tableId;
          this.name = tableName;
          this.find = callback_to_promise_1.default(this._findRecordById, this);
          this.select = this._selectRecords.bind(this);
          this.create = callback_to_promise_1.default(this._createRecords, this);
          this.update = callback_to_promise_1.default(this._updateRecords.bind(this, false), this);
          this.replace = callback_to_promise_1.default(this._updateRecords.bind(this, true), this);
          this.destroy = callback_to_promise_1.default(this._destroyRecord, this);
          this.list = deprecate_1.default(this._listRecords.bind(this), "table.list", "Airtable: `list()` is deprecated. Use `select()` instead.");
          this.forEach = deprecate_1.default(this._forEachRecord.bind(this), "table.forEach", "Airtable: `forEach()` is deprecated. Use `select()` instead.");
        }
        Table2.prototype._findRecordById = function(recordId, done) {
          var record = new record_1.default(this, recordId);
          record.fetch(done);
        };
        Table2.prototype._selectRecords = function(params) {
          if (params === undefined) {
            params = {};
          }
          if (arguments.length > 1) {
            console.warn("Airtable: `select` takes only one parameter, but it was given " + arguments.length + " parameters. Use `eachPage` or `firstPage` to fetch records.");
          }
          if (isPlainObject_1.default(params)) {
            var validationResults = query_1.default.validateParams(params);
            if (validationResults.errors.length) {
              var formattedErrors = validationResults.errors.map(function(error) {
                return "  * " + error;
              });
              throw new Error("Airtable: invalid parameters for `select`:\n" + formattedErrors.join(`
`));
            }
            if (validationResults.ignoredKeys.length) {
              console.warn("Airtable: the following parameters to `select` will be ignored: " + validationResults.ignoredKeys.join(", "));
            }
            return new query_1.default(this, validationResults.validParams);
          } else {
            throw new Error("Airtable: the parameter for `select` should be a plain object or undefined.");
          }
        };
        Table2.prototype._urlEncodedNameOrId = function() {
          return this.id || encodeURIComponent(this.name);
        };
        Table2.prototype._createRecords = function(recordsData, optionalParameters, done) {
          var _this = this;
          var isCreatingMultipleRecords = Array.isArray(recordsData);
          if (!done) {
            done = optionalParameters;
            optionalParameters = {};
          }
          var requestData;
          if (isCreatingMultipleRecords) {
            requestData = __assign({ records: recordsData }, optionalParameters);
          } else {
            requestData = __assign({ fields: recordsData }, optionalParameters);
          }
          this._base.runAction("post", "/" + this._urlEncodedNameOrId() + "/", {}, requestData, function(err, resp, body) {
            if (err) {
              done(err);
              return;
            }
            var result;
            if (isCreatingMultipleRecords) {
              result = body.records.map(function(record) {
                return new record_1.default(_this, record.id, record);
              });
            } else {
              result = new record_1.default(_this, body.id, body);
            }
            done(null, result);
          });
        };
        Table2.prototype._updateRecords = function(isDestructiveUpdate, recordsDataOrRecordId, recordDataOrOptsOrDone, optsOrDone, done) {
          var _this = this;
          var opts;
          if (Array.isArray(recordsDataOrRecordId)) {
            var recordsData = recordsDataOrRecordId;
            opts = isPlainObject_1.default(recordDataOrOptsOrDone) ? recordDataOrOptsOrDone : {};
            done = optsOrDone || recordDataOrOptsOrDone;
            var method = isDestructiveUpdate ? "put" : "patch";
            var requestData = __assign({ records: recordsData }, opts);
            this._base.runAction(method, "/" + this._urlEncodedNameOrId() + "/", {}, requestData, function(err, resp, body) {
              if (err) {
                done(err);
                return;
              }
              var result = body.records.map(function(record2) {
                return new record_1.default(_this, record2.id, record2);
              });
              done(null, result);
            });
          } else {
            var recordId = recordsDataOrRecordId;
            var recordData = recordDataOrOptsOrDone;
            opts = isPlainObject_1.default(optsOrDone) ? optsOrDone : {};
            done = done || optsOrDone;
            var record = new record_1.default(this, recordId);
            if (isDestructiveUpdate) {
              record.putUpdate(recordData, opts, done);
            } else {
              record.patchUpdate(recordData, opts, done);
            }
          }
        };
        Table2.prototype._destroyRecord = function(recordIdsOrId, done) {
          var _this = this;
          if (Array.isArray(recordIdsOrId)) {
            var queryParams = { records: recordIdsOrId };
            this._base.runAction("delete", "/" + this._urlEncodedNameOrId(), queryParams, null, function(err, response, results) {
              if (err) {
                done(err);
                return;
              }
              var records = results.records.map(function(_a) {
                var id = _a.id;
                return new record_1.default(_this, id, null);
              });
              done(null, records);
            });
          } else {
            var record = new record_1.default(this, recordIdsOrId);
            record.destroy(done);
          }
        };
        Table2.prototype._listRecords = function(pageSize, offset, opts, done) {
          var _this = this;
          if (!done) {
            done = opts;
            opts = {};
          }
          var pathAndParamsAsString = "/" + this._urlEncodedNameOrId() + "?" + object_to_query_param_string_1.default(opts);
          var path;
          var listRecordsParameters = {};
          var listRecordsData = null;
          var method;
          if (typeof opts !== "function" && opts.method === "post" || pathAndParamsAsString.length > query_params_1.URL_CHARACTER_LENGTH_LIMIT) {
            path = "/" + this._urlEncodedNameOrId() + "/listRecords";
            listRecordsData = __assign(__assign({}, pageSize && { pageSize }), offset && { offset });
            method = "post";
            var paramNames = Object.keys(opts);
            for (var _i = 0, paramNames_1 = paramNames;_i < paramNames_1.length; _i++) {
              var paramName = paramNames_1[_i];
              if (query_params_1.shouldListRecordsParamBePassedAsParameter(paramName)) {
                listRecordsParameters[paramName] = opts[paramName];
              } else {
                listRecordsData[paramName] = opts[paramName];
              }
            }
          } else {
            method = "get";
            path = "/" + this._urlEncodedNameOrId() + "/";
            listRecordsParameters = __assign({ limit: pageSize, offset }, opts);
          }
          this._base.runAction(method, path, listRecordsParameters, listRecordsData, function(err, response, results) {
            if (err) {
              done(err);
              return;
            }
            var records = results.records.map(function(recordJson) {
              return new record_1.default(_this, null, recordJson);
            });
            done(null, records, results.offset);
          });
        };
        Table2.prototype._forEachRecord = function(opts, callback, done) {
          var _this = this;
          if (arguments.length === 2) {
            done = callback;
            callback = opts;
            opts = {};
          }
          var limit = Table2.__recordsPerPageForIteration || 100;
          var offset = null;
          var nextPage = function() {
            _this._listRecords(limit, offset, opts, function(err, page, newOffset) {
              if (err) {
                done(err);
                return;
              }
              for (var index = 0;index < page.length; index++) {
                callback(page[index]);
              }
              if (newOffset) {
                offset = newOffset;
                nextPage();
              } else {
                done();
              }
            });
          };
          nextPage();
        };
        return Table2;
      }();
      module3.exports = Table;
    }, { "./callback_to_promise": 4, "./deprecate": 5, "./object_to_query_param_string": 11, "./query": 13, "./query_params": 14, "./record": 15, "lodash/isPlainObject": 89 }], 18: [function(require2, module3, exports3) {
      function check(fn, error) {
        return function(value) {
          if (fn(value)) {
            return { pass: true };
          } else {
            return { pass: false, error };
          }
        };
      }
      check.isOneOf = function isOneOf(options) {
        return options.includes.bind(options);
      };
      check.isArrayOf = function(itemValidator) {
        return function(value) {
          return Array.isArray(value) && value.every(itemValidator);
        };
      };
      module3.exports = check;
    }, {}], 19: [function(require2, module3, exports3) {
      Object.defineProperty(exports3, "__esModule", { value: true });
      function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
          throw new TypeError("Cannot call a class as a function");
        }
      }
      function _defineProperties(target, props) {
        for (var i = 0;i < props.length; i++) {
          var descriptor = props[i];
          descriptor.enumerable = descriptor.enumerable || false;
          descriptor.configurable = true;
          if ("value" in descriptor)
            descriptor.writable = true;
          Object.defineProperty(target, descriptor.key, descriptor);
        }
      }
      function _createClass(Constructor, protoProps, staticProps) {
        if (protoProps)
          _defineProperties(Constructor.prototype, protoProps);
        if (staticProps)
          _defineProperties(Constructor, staticProps);
        return Constructor;
      }
      function _inherits(subClass, superClass) {
        if (typeof superClass !== "function" && superClass !== null) {
          throw new TypeError("Super expression must either be null or a function");
        }
        subClass.prototype = Object.create(superClass && superClass.prototype, {
          constructor: {
            value: subClass,
            writable: true,
            configurable: true
          }
        });
        if (superClass)
          _setPrototypeOf(subClass, superClass);
      }
      function _getPrototypeOf(o) {
        _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o2) {
          return o2.__proto__ || Object.getPrototypeOf(o2);
        };
        return _getPrototypeOf(o);
      }
      function _setPrototypeOf(o, p) {
        _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o2, p2) {
          o2.__proto__ = p2;
          return o2;
        };
        return _setPrototypeOf(o, p);
      }
      function _assertThisInitialized(self2) {
        if (self2 === undefined) {
          throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
        }
        return self2;
      }
      function _possibleConstructorReturn(self2, call) {
        if (call && (typeof call === "object" || typeof call === "function")) {
          return call;
        }
        return _assertThisInitialized(self2);
      }
      function _superPropBase(object, property) {
        while (!Object.prototype.hasOwnProperty.call(object, property)) {
          object = _getPrototypeOf(object);
          if (object === null)
            break;
        }
        return object;
      }
      function _get(target, property, receiver) {
        if (typeof Reflect !== "undefined" && Reflect.get) {
          _get = Reflect.get;
        } else {
          _get = function _get(target2, property2, receiver2) {
            var base = _superPropBase(target2, property2);
            if (!base)
              return;
            var desc = Object.getOwnPropertyDescriptor(base, property2);
            if (desc.get) {
              return desc.get.call(receiver2);
            }
            return desc.value;
          };
        }
        return _get(target, property, receiver || target);
      }
      var Emitter = /* @__PURE__ */ function() {
        function Emitter2() {
          _classCallCheck(this, Emitter2);
          Object.defineProperty(this, "listeners", {
            value: {},
            writable: true,
            configurable: true
          });
        }
        _createClass(Emitter2, [{
          key: "addEventListener",
          value: function addEventListener(type, callback) {
            if (!(type in this.listeners)) {
              this.listeners[type] = [];
            }
            this.listeners[type].push(callback);
          }
        }, {
          key: "removeEventListener",
          value: function removeEventListener(type, callback) {
            if (!(type in this.listeners)) {
              return;
            }
            var stack = this.listeners[type];
            for (var i = 0, l = stack.length;i < l; i++) {
              if (stack[i] === callback) {
                stack.splice(i, 1);
                return;
              }
            }
          }
        }, {
          key: "dispatchEvent",
          value: function dispatchEvent(event) {
            var _this = this;
            if (!(event.type in this.listeners)) {
              return;
            }
            var debounce = function debounce(callback) {
              setTimeout(function() {
                return callback.call(_this, event);
              });
            };
            var stack = this.listeners[event.type];
            for (var i = 0, l = stack.length;i < l; i++) {
              debounce(stack[i]);
            }
            return !event.defaultPrevented;
          }
        }]);
        return Emitter2;
      }();
      var AbortSignal = /* @__PURE__ */ function(_Emitter) {
        _inherits(AbortSignal2, _Emitter);
        function AbortSignal2() {
          var _this2;
          _classCallCheck(this, AbortSignal2);
          _this2 = _possibleConstructorReturn(this, _getPrototypeOf(AbortSignal2).call(this));
          if (!_this2.listeners) {
            Emitter.call(_assertThisInitialized(_this2));
          }
          Object.defineProperty(_assertThisInitialized(_this2), "aborted", {
            value: false,
            writable: true,
            configurable: true
          });
          Object.defineProperty(_assertThisInitialized(_this2), "onabort", {
            value: null,
            writable: true,
            configurable: true
          });
          return _this2;
        }
        _createClass(AbortSignal2, [{
          key: "toString",
          value: function toString() {
            return "[object AbortSignal]";
          }
        }, {
          key: "dispatchEvent",
          value: function dispatchEvent(event) {
            if (event.type === "abort") {
              this.aborted = true;
              if (typeof this.onabort === "function") {
                this.onabort.call(this, event);
              }
            }
            _get(_getPrototypeOf(AbortSignal2.prototype), "dispatchEvent", this).call(this, event);
          }
        }]);
        return AbortSignal2;
      }(Emitter);
      var AbortController = /* @__PURE__ */ function() {
        function AbortController2() {
          _classCallCheck(this, AbortController2);
          Object.defineProperty(this, "signal", {
            value: new AbortSignal,
            writable: true,
            configurable: true
          });
        }
        _createClass(AbortController2, [{
          key: "abort",
          value: function abort() {
            var event;
            try {
              event = new Event("abort");
            } catch (e) {
              if (typeof document !== "undefined") {
                if (!document.createEvent) {
                  event = document.createEventObject();
                  event.type = "abort";
                } else {
                  event = document.createEvent("Event");
                  event.initEvent("abort", false, false);
                }
              } else {
                event = {
                  type: "abort",
                  bubbles: false,
                  cancelable: false
                };
              }
            }
            this.signal.dispatchEvent(event);
          }
        }, {
          key: "toString",
          value: function toString() {
            return "[object AbortController]";
          }
        }]);
        return AbortController2;
      }();
      if (typeof Symbol !== "undefined" && Symbol.toStringTag) {
        AbortController.prototype[Symbol.toStringTag] = "AbortController";
        AbortSignal.prototype[Symbol.toStringTag] = "AbortSignal";
      }
      function polyfillNeeded(self2) {
        if (self2.__FORCE_INSTALL_ABORTCONTROLLER_POLYFILL) {
          console.log("__FORCE_INSTALL_ABORTCONTROLLER_POLYFILL=true is set, will force install polyfill");
          return true;
        }
        return typeof self2.Request === "function" && !self2.Request.prototype.hasOwnProperty("signal") || !self2.AbortController;
      }
      function abortableFetchDecorator(patchTargets) {
        if (typeof patchTargets === "function") {
          patchTargets = {
            fetch: patchTargets
          };
        }
        var _patchTargets = patchTargets, fetch2 = _patchTargets.fetch, _patchTargets$Request = _patchTargets.Request, NativeRequest = _patchTargets$Request === undefined ? fetch2.Request : _patchTargets$Request, NativeAbortController = _patchTargets.AbortController, _patchTargets$__FORCE = _patchTargets.__FORCE_INSTALL_ABORTCONTROLLER_POLYFILL, __FORCE_INSTALL_ABORTCONTROLLER_POLYFILL = _patchTargets$__FORCE === undefined ? false : _patchTargets$__FORCE;
        if (!polyfillNeeded({
          fetch: fetch2,
          Request: NativeRequest,
          AbortController: NativeAbortController,
          __FORCE_INSTALL_ABORTCONTROLLER_POLYFILL
        })) {
          return {
            fetch: fetch2,
            Request: Request2
          };
        }
        var Request2 = NativeRequest;
        if (Request2 && !Request2.prototype.hasOwnProperty("signal") || __FORCE_INSTALL_ABORTCONTROLLER_POLYFILL) {
          Request2 = function Request(input, init) {
            var signal;
            if (init && init.signal) {
              signal = init.signal;
              delete init.signal;
            }
            var request = new NativeRequest(input, init);
            if (signal) {
              Object.defineProperty(request, "signal", {
                writable: false,
                enumerable: false,
                configurable: true,
                value: signal
              });
            }
            return request;
          };
          Request2.prototype = NativeRequest.prototype;
        }
        var realFetch = fetch2;
        var abortableFetch = function abortableFetch(input, init) {
          var signal = Request2 && Request2.prototype.isPrototypeOf(input) ? input.signal : init ? init.signal : undefined;
          if (signal) {
            var abortError;
            try {
              abortError = new DOMException("Aborted", "AbortError");
            } catch (err) {
              abortError = new Error("Aborted");
              abortError.name = "AbortError";
            }
            if (signal.aborted) {
              return Promise.reject(abortError);
            }
            var cancellation = new Promise(function(_, reject) {
              signal.addEventListener("abort", function() {
                return reject(abortError);
              }, {
                once: true
              });
            });
            if (init && init.signal) {
              delete init.signal;
            }
            return Promise.race([cancellation, realFetch(input, init)]);
          }
          return realFetch(input, init);
        };
        return {
          fetch: abortableFetch,
          Request: Request2
        };
      }
      exports3.AbortController = AbortController;
      exports3.AbortSignal = AbortSignal;
      exports3.abortableFetch = abortableFetchDecorator;
    }, {}], 20: [function(require2, module3, exports3) {}, {}], 21: [function(require2, module3, exports3) {
      var hashClear = require2("./_hashClear"), hashDelete = require2("./_hashDelete"), hashGet = require2("./_hashGet"), hashHas = require2("./_hashHas"), hashSet = require2("./_hashSet");
      function Hash(entries) {
        var index = -1, length = entries == null ? 0 : entries.length;
        this.clear();
        while (++index < length) {
          var entry = entries[index];
          this.set(entry[0], entry[1]);
        }
      }
      Hash.prototype.clear = hashClear;
      Hash.prototype["delete"] = hashDelete;
      Hash.prototype.get = hashGet;
      Hash.prototype.has = hashHas;
      Hash.prototype.set = hashSet;
      module3.exports = Hash;
    }, { "./_hashClear": 46, "./_hashDelete": 47, "./_hashGet": 48, "./_hashHas": 49, "./_hashSet": 50 }], 22: [function(require2, module3, exports3) {
      var listCacheClear = require2("./_listCacheClear"), listCacheDelete = require2("./_listCacheDelete"), listCacheGet = require2("./_listCacheGet"), listCacheHas = require2("./_listCacheHas"), listCacheSet = require2("./_listCacheSet");
      function ListCache(entries) {
        var index = -1, length = entries == null ? 0 : entries.length;
        this.clear();
        while (++index < length) {
          var entry = entries[index];
          this.set(entry[0], entry[1]);
        }
      }
      ListCache.prototype.clear = listCacheClear;
      ListCache.prototype["delete"] = listCacheDelete;
      ListCache.prototype.get = listCacheGet;
      ListCache.prototype.has = listCacheHas;
      ListCache.prototype.set = listCacheSet;
      module3.exports = ListCache;
    }, { "./_listCacheClear": 56, "./_listCacheDelete": 57, "./_listCacheGet": 58, "./_listCacheHas": 59, "./_listCacheSet": 60 }], 23: [function(require2, module3, exports3) {
      var getNative = require2("./_getNative"), root = require2("./_root");
      var Map2 = getNative(root, "Map");
      module3.exports = Map2;
    }, { "./_getNative": 42, "./_root": 72 }], 24: [function(require2, module3, exports3) {
      var mapCacheClear = require2("./_mapCacheClear"), mapCacheDelete = require2("./_mapCacheDelete"), mapCacheGet = require2("./_mapCacheGet"), mapCacheHas = require2("./_mapCacheHas"), mapCacheSet = require2("./_mapCacheSet");
      function MapCache(entries) {
        var index = -1, length = entries == null ? 0 : entries.length;
        this.clear();
        while (++index < length) {
          var entry = entries[index];
          this.set(entry[0], entry[1]);
        }
      }
      MapCache.prototype.clear = mapCacheClear;
      MapCache.prototype["delete"] = mapCacheDelete;
      MapCache.prototype.get = mapCacheGet;
      MapCache.prototype.has = mapCacheHas;
      MapCache.prototype.set = mapCacheSet;
      module3.exports = MapCache;
    }, { "./_mapCacheClear": 61, "./_mapCacheDelete": 62, "./_mapCacheGet": 63, "./_mapCacheHas": 64, "./_mapCacheSet": 65 }], 25: [function(require2, module3, exports3) {
      var root = require2("./_root");
      var Symbol2 = root.Symbol;
      module3.exports = Symbol2;
    }, { "./_root": 72 }], 26: [function(require2, module3, exports3) {
      var baseTimes = require2("./_baseTimes"), isArguments = require2("./isArguments"), isArray = require2("./isArray"), isBuffer = require2("./isBuffer"), isIndex = require2("./_isIndex"), isTypedArray = require2("./isTypedArray");
      var objectProto = Object.prototype;
      var hasOwnProperty = objectProto.hasOwnProperty;
      function arrayLikeKeys(value, inherited) {
        var isArr = isArray(value), isArg = !isArr && isArguments(value), isBuff = !isArr && !isArg && isBuffer(value), isType = !isArr && !isArg && !isBuff && isTypedArray(value), skipIndexes = isArr || isArg || isBuff || isType, result = skipIndexes ? baseTimes(value.length, String) : [], length = result.length;
        for (var key in value) {
          if ((inherited || hasOwnProperty.call(value, key)) && !(skipIndexes && (key == "length" || isBuff && (key == "offset" || key == "parent") || isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || isIndex(key, length)))) {
            result.push(key);
          }
        }
        return result;
      }
      module3.exports = arrayLikeKeys;
    }, { "./_baseTimes": 35, "./_isIndex": 51, "./isArguments": 78, "./isArray": 79, "./isBuffer": 82, "./isTypedArray": 92 }], 27: [function(require2, module3, exports3) {
      function arrayMap(array, iteratee) {
        var index = -1, length = array == null ? 0 : array.length, result = Array(length);
        while (++index < length) {
          result[index] = iteratee(array[index], index, array);
        }
        return result;
      }
      module3.exports = arrayMap;
    }, {}], 28: [function(require2, module3, exports3) {
      var eq = require2("./eq");
      function assocIndexOf(array, key) {
        var length = array.length;
        while (length--) {
          if (eq(array[length][0], key)) {
            return length;
          }
        }
        return -1;
      }
      module3.exports = assocIndexOf;
    }, { "./eq": 76 }], 29: [function(require2, module3, exports3) {
      var castPath = require2("./_castPath"), toKey = require2("./_toKey");
      function baseGet(object, path) {
        path = castPath(path, object);
        var index = 0, length = path.length;
        while (object != null && index < length) {
          object = object[toKey(path[index++])];
        }
        return index && index == length ? object : undefined;
      }
      module3.exports = baseGet;
    }, { "./_castPath": 38, "./_toKey": 74 }], 30: [function(require2, module3, exports3) {
      var Symbol2 = require2("./_Symbol"), getRawTag = require2("./_getRawTag"), objectToString = require2("./_objectToString");
      var nullTag = "[object Null]", undefinedTag = "[object Undefined]";
      var symToStringTag = Symbol2 ? Symbol2.toStringTag : undefined;
      function baseGetTag(value) {
        if (value == null) {
          return value === undefined ? undefinedTag : nullTag;
        }
        return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
      }
      module3.exports = baseGetTag;
    }, { "./_Symbol": 25, "./_getRawTag": 44, "./_objectToString": 70 }], 31: [function(require2, module3, exports3) {
      var baseGetTag = require2("./_baseGetTag"), isObjectLike = require2("./isObjectLike");
      var argsTag = "[object Arguments]";
      function baseIsArguments(value) {
        return isObjectLike(value) && baseGetTag(value) == argsTag;
      }
      module3.exports = baseIsArguments;
    }, { "./_baseGetTag": 30, "./isObjectLike": 88 }], 32: [function(require2, module3, exports3) {
      var isFunction = require2("./isFunction"), isMasked = require2("./_isMasked"), isObject = require2("./isObject"), toSource = require2("./_toSource");
      var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
      var reIsHostCtor = /^\[object .+?Constructor\]$/;
      var funcProto = Function.prototype, objectProto = Object.prototype;
      var funcToString = funcProto.toString;
      var hasOwnProperty = objectProto.hasOwnProperty;
      var reIsNative = RegExp("^" + funcToString.call(hasOwnProperty).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$");
      function baseIsNative(value) {
        if (!isObject(value) || isMasked(value)) {
          return false;
        }
        var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
        return pattern.test(toSource(value));
      }
      module3.exports = baseIsNative;
    }, { "./_isMasked": 54, "./_toSource": 75, "./isFunction": 83, "./isObject": 87 }], 33: [function(require2, module3, exports3) {
      var baseGetTag = require2("./_baseGetTag"), isLength = require2("./isLength"), isObjectLike = require2("./isObjectLike");
      var argsTag = "[object Arguments]", arrayTag = "[object Array]", boolTag = "[object Boolean]", dateTag = "[object Date]", errorTag = "[object Error]", funcTag = "[object Function]", mapTag = "[object Map]", numberTag = "[object Number]", objectTag = "[object Object]", regexpTag = "[object RegExp]", setTag = "[object Set]", stringTag = "[object String]", weakMapTag = "[object WeakMap]";
      var arrayBufferTag = "[object ArrayBuffer]", dataViewTag = "[object DataView]", float32Tag = "[object Float32Array]", float64Tag = "[object Float64Array]", int8Tag = "[object Int8Array]", int16Tag = "[object Int16Array]", int32Tag = "[object Int32Array]", uint8Tag = "[object Uint8Array]", uint8ClampedTag = "[object Uint8ClampedArray]", uint16Tag = "[object Uint16Array]", uint32Tag = "[object Uint32Array]";
      var typedArrayTags = {};
      typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
      typedArrayTags[argsTag] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
      function baseIsTypedArray(value) {
        return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
      }
      module3.exports = baseIsTypedArray;
    }, { "./_baseGetTag": 30, "./isLength": 84, "./isObjectLike": 88 }], 34: [function(require2, module3, exports3) {
      var isPrototype = require2("./_isPrototype"), nativeKeys = require2("./_nativeKeys");
      var objectProto = Object.prototype;
      var hasOwnProperty = objectProto.hasOwnProperty;
      function baseKeys(object) {
        if (!isPrototype(object)) {
          return nativeKeys(object);
        }
        var result = [];
        for (var key in Object(object)) {
          if (hasOwnProperty.call(object, key) && key != "constructor") {
            result.push(key);
          }
        }
        return result;
      }
      module3.exports = baseKeys;
    }, { "./_isPrototype": 55, "./_nativeKeys": 68 }], 35: [function(require2, module3, exports3) {
      function baseTimes(n, iteratee) {
        var index = -1, result = Array(n);
        while (++index < n) {
          result[index] = iteratee(index);
        }
        return result;
      }
      module3.exports = baseTimes;
    }, {}], 36: [function(require2, module3, exports3) {
      var Symbol2 = require2("./_Symbol"), arrayMap = require2("./_arrayMap"), isArray = require2("./isArray"), isSymbol = require2("./isSymbol");
      var INFINITY = 1 / 0;
      var symbolProto = Symbol2 ? Symbol2.prototype : undefined, symbolToString = symbolProto ? symbolProto.toString : undefined;
      function baseToString(value) {
        if (typeof value == "string") {
          return value;
        }
        if (isArray(value)) {
          return arrayMap(value, baseToString) + "";
        }
        if (isSymbol(value)) {
          return symbolToString ? symbolToString.call(value) : "";
        }
        var result = value + "";
        return result == "0" && 1 / value == -INFINITY ? "-0" : result;
      }
      module3.exports = baseToString;
    }, { "./_Symbol": 25, "./_arrayMap": 27, "./isArray": 79, "./isSymbol": 91 }], 37: [function(require2, module3, exports3) {
      function baseUnary(func) {
        return function(value) {
          return func(value);
        };
      }
      module3.exports = baseUnary;
    }, {}], 38: [function(require2, module3, exports3) {
      var isArray = require2("./isArray"), isKey = require2("./_isKey"), stringToPath = require2("./_stringToPath"), toString = require2("./toString");
      function castPath(value, object) {
        if (isArray(value)) {
          return value;
        }
        return isKey(value, object) ? [value] : stringToPath(toString(value));
      }
      module3.exports = castPath;
    }, { "./_isKey": 52, "./_stringToPath": 73, "./isArray": 79, "./toString": 96 }], 39: [function(require2, module3, exports3) {
      var root = require2("./_root");
      var coreJsData = root["__core-js_shared__"];
      module3.exports = coreJsData;
    }, { "./_root": 72 }], 40: [function(require2, module3, exports3) {
      (function(global2) {
        var freeGlobal = typeof global2 == "object" && global2 && global2.Object === Object && global2;
        module3.exports = freeGlobal;
      }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});
    }, {}], 41: [function(require2, module3, exports3) {
      var isKeyable = require2("./_isKeyable");
      function getMapData(map, key) {
        var data = map.__data__;
        return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
      }
      module3.exports = getMapData;
    }, { "./_isKeyable": 53 }], 42: [function(require2, module3, exports3) {
      var baseIsNative = require2("./_baseIsNative"), getValue = require2("./_getValue");
      function getNative(object, key) {
        var value = getValue(object, key);
        return baseIsNative(value) ? value : undefined;
      }
      module3.exports = getNative;
    }, { "./_baseIsNative": 32, "./_getValue": 45 }], 43: [function(require2, module3, exports3) {
      var overArg = require2("./_overArg");
      var getPrototype = overArg(Object.getPrototypeOf, Object);
      module3.exports = getPrototype;
    }, { "./_overArg": 71 }], 44: [function(require2, module3, exports3) {
      var Symbol2 = require2("./_Symbol");
      var objectProto = Object.prototype;
      var hasOwnProperty = objectProto.hasOwnProperty;
      var nativeObjectToString = objectProto.toString;
      var symToStringTag = Symbol2 ? Symbol2.toStringTag : undefined;
      function getRawTag(value) {
        var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
        try {
          value[symToStringTag] = undefined;
          var unmasked = true;
        } catch (e) {}
        var result = nativeObjectToString.call(value);
        if (unmasked) {
          if (isOwn) {
            value[symToStringTag] = tag;
          } else {
            delete value[symToStringTag];
          }
        }
        return result;
      }
      module3.exports = getRawTag;
    }, { "./_Symbol": 25 }], 45: [function(require2, module3, exports3) {
      function getValue(object, key) {
        return object == null ? undefined : object[key];
      }
      module3.exports = getValue;
    }, {}], 46: [function(require2, module3, exports3) {
      var nativeCreate = require2("./_nativeCreate");
      function hashClear() {
        this.__data__ = nativeCreate ? nativeCreate(null) : {};
        this.size = 0;
      }
      module3.exports = hashClear;
    }, { "./_nativeCreate": 67 }], 47: [function(require2, module3, exports3) {
      function hashDelete(key) {
        var result = this.has(key) && delete this.__data__[key];
        this.size -= result ? 1 : 0;
        return result;
      }
      module3.exports = hashDelete;
    }, {}], 48: [function(require2, module3, exports3) {
      var nativeCreate = require2("./_nativeCreate");
      var HASH_UNDEFINED = "__lodash_hash_undefined__";
      var objectProto = Object.prototype;
      var hasOwnProperty = objectProto.hasOwnProperty;
      function hashGet(key) {
        var data = this.__data__;
        if (nativeCreate) {
          var result = data[key];
          return result === HASH_UNDEFINED ? undefined : result;
        }
        return hasOwnProperty.call(data, key) ? data[key] : undefined;
      }
      module3.exports = hashGet;
    }, { "./_nativeCreate": 67 }], 49: [function(require2, module3, exports3) {
      var nativeCreate = require2("./_nativeCreate");
      var objectProto = Object.prototype;
      var hasOwnProperty = objectProto.hasOwnProperty;
      function hashHas(key) {
        var data = this.__data__;
        return nativeCreate ? data[key] !== undefined : hasOwnProperty.call(data, key);
      }
      module3.exports = hashHas;
    }, { "./_nativeCreate": 67 }], 50: [function(require2, module3, exports3) {
      var nativeCreate = require2("./_nativeCreate");
      var HASH_UNDEFINED = "__lodash_hash_undefined__";
      function hashSet(key, value) {
        var data = this.__data__;
        this.size += this.has(key) ? 0 : 1;
        data[key] = nativeCreate && value === undefined ? HASH_UNDEFINED : value;
        return this;
      }
      module3.exports = hashSet;
    }, { "./_nativeCreate": 67 }], 51: [function(require2, module3, exports3) {
      var MAX_SAFE_INTEGER = 9007199254740991;
      var reIsUint = /^(?:0|[1-9]\d*)$/;
      function isIndex(value, length) {
        var type = typeof value;
        length = length == null ? MAX_SAFE_INTEGER : length;
        return !!length && (type == "number" || type != "symbol" && reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length);
      }
      module3.exports = isIndex;
    }, {}], 52: [function(require2, module3, exports3) {
      var isArray = require2("./isArray"), isSymbol = require2("./isSymbol");
      var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/, reIsPlainProp = /^\w*$/;
      function isKey(value, object) {
        if (isArray(value)) {
          return false;
        }
        var type = typeof value;
        if (type == "number" || type == "symbol" || type == "boolean" || value == null || isSymbol(value)) {
          return true;
        }
        return reIsPlainProp.test(value) || !reIsDeepProp.test(value) || object != null && value in Object(object);
      }
      module3.exports = isKey;
    }, { "./isArray": 79, "./isSymbol": 91 }], 53: [function(require2, module3, exports3) {
      function isKeyable(value) {
        var type = typeof value;
        return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
      }
      module3.exports = isKeyable;
    }, {}], 54: [function(require2, module3, exports3) {
      var coreJsData = require2("./_coreJsData");
      var maskSrcKey = function() {
        var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
        return uid ? "Symbol(src)_1." + uid : "";
      }();
      function isMasked(func) {
        return !!maskSrcKey && maskSrcKey in func;
      }
      module3.exports = isMasked;
    }, { "./_coreJsData": 39 }], 55: [function(require2, module3, exports3) {
      var objectProto = Object.prototype;
      function isPrototype(value) {
        var Ctor = value && value.constructor, proto = typeof Ctor == "function" && Ctor.prototype || objectProto;
        return value === proto;
      }
      module3.exports = isPrototype;
    }, {}], 56: [function(require2, module3, exports3) {
      function listCacheClear() {
        this.__data__ = [];
        this.size = 0;
      }
      module3.exports = listCacheClear;
    }, {}], 57: [function(require2, module3, exports3) {
      var assocIndexOf = require2("./_assocIndexOf");
      var arrayProto = Array.prototype;
      var splice = arrayProto.splice;
      function listCacheDelete(key) {
        var data = this.__data__, index = assocIndexOf(data, key);
        if (index < 0) {
          return false;
        }
        var lastIndex = data.length - 1;
        if (index == lastIndex) {
          data.pop();
        } else {
          splice.call(data, index, 1);
        }
        --this.size;
        return true;
      }
      module3.exports = listCacheDelete;
    }, { "./_assocIndexOf": 28 }], 58: [function(require2, module3, exports3) {
      var assocIndexOf = require2("./_assocIndexOf");
      function listCacheGet(key) {
        var data = this.__data__, index = assocIndexOf(data, key);
        return index < 0 ? undefined : data[index][1];
      }
      module3.exports = listCacheGet;
    }, { "./_assocIndexOf": 28 }], 59: [function(require2, module3, exports3) {
      var assocIndexOf = require2("./_assocIndexOf");
      function listCacheHas(key) {
        return assocIndexOf(this.__data__, key) > -1;
      }
      module3.exports = listCacheHas;
    }, { "./_assocIndexOf": 28 }], 60: [function(require2, module3, exports3) {
      var assocIndexOf = require2("./_assocIndexOf");
      function listCacheSet(key, value) {
        var data = this.__data__, index = assocIndexOf(data, key);
        if (index < 0) {
          ++this.size;
          data.push([key, value]);
        } else {
          data[index][1] = value;
        }
        return this;
      }
      module3.exports = listCacheSet;
    }, { "./_assocIndexOf": 28 }], 61: [function(require2, module3, exports3) {
      var Hash = require2("./_Hash"), ListCache = require2("./_ListCache"), Map2 = require2("./_Map");
      function mapCacheClear() {
        this.size = 0;
        this.__data__ = {
          hash: new Hash,
          map: new (Map2 || ListCache),
          string: new Hash
        };
      }
      module3.exports = mapCacheClear;
    }, { "./_Hash": 21, "./_ListCache": 22, "./_Map": 23 }], 62: [function(require2, module3, exports3) {
      var getMapData = require2("./_getMapData");
      function mapCacheDelete(key) {
        var result = getMapData(this, key)["delete"](key);
        this.size -= result ? 1 : 0;
        return result;
      }
      module3.exports = mapCacheDelete;
    }, { "./_getMapData": 41 }], 63: [function(require2, module3, exports3) {
      var getMapData = require2("./_getMapData");
      function mapCacheGet(key) {
        return getMapData(this, key).get(key);
      }
      module3.exports = mapCacheGet;
    }, { "./_getMapData": 41 }], 64: [function(require2, module3, exports3) {
      var getMapData = require2("./_getMapData");
      function mapCacheHas(key) {
        return getMapData(this, key).has(key);
      }
      module3.exports = mapCacheHas;
    }, { "./_getMapData": 41 }], 65: [function(require2, module3, exports3) {
      var getMapData = require2("./_getMapData");
      function mapCacheSet(key, value) {
        var data = getMapData(this, key), size = data.size;
        data.set(key, value);
        this.size += data.size == size ? 0 : 1;
        return this;
      }
      module3.exports = mapCacheSet;
    }, { "./_getMapData": 41 }], 66: [function(require2, module3, exports3) {
      var memoize = require2("./memoize");
      var MAX_MEMOIZE_SIZE = 500;
      function memoizeCapped(func) {
        var result = memoize(func, function(key) {
          if (cache.size === MAX_MEMOIZE_SIZE) {
            cache.clear();
          }
          return key;
        });
        var cache = result.cache;
        return result;
      }
      module3.exports = memoizeCapped;
    }, { "./memoize": 94 }], 67: [function(require2, module3, exports3) {
      var getNative = require2("./_getNative");
      var nativeCreate = getNative(Object, "create");
      module3.exports = nativeCreate;
    }, { "./_getNative": 42 }], 68: [function(require2, module3, exports3) {
      var overArg = require2("./_overArg");
      var nativeKeys = overArg(Object.keys, Object);
      module3.exports = nativeKeys;
    }, { "./_overArg": 71 }], 69: [function(require2, module3, exports3) {
      var freeGlobal = require2("./_freeGlobal");
      var freeExports = typeof exports3 == "object" && exports3 && !exports3.nodeType && exports3;
      var freeModule = freeExports && typeof module3 == "object" && module3 && !module3.nodeType && module3;
      var moduleExports = freeModule && freeModule.exports === freeExports;
      var freeProcess = moduleExports && freeGlobal.process;
      var nodeUtil = function() {
        try {
          var types = freeModule && freeModule.require && freeModule.require("util").types;
          if (types) {
            return types;
          }
          return freeProcess && freeProcess.binding && freeProcess.binding("util");
        } catch (e) {}
      }();
      module3.exports = nodeUtil;
    }, { "./_freeGlobal": 40 }], 70: [function(require2, module3, exports3) {
      var objectProto = Object.prototype;
      var nativeObjectToString = objectProto.toString;
      function objectToString(value) {
        return nativeObjectToString.call(value);
      }
      module3.exports = objectToString;
    }, {}], 71: [function(require2, module3, exports3) {
      function overArg(func, transform) {
        return function(arg) {
          return func(transform(arg));
        };
      }
      module3.exports = overArg;
    }, {}], 72: [function(require2, module3, exports3) {
      var freeGlobal = require2("./_freeGlobal");
      var freeSelf = typeof self == "object" && self && self.Object === Object && self;
      var root = freeGlobal || freeSelf || Function("return this")();
      module3.exports = root;
    }, { "./_freeGlobal": 40 }], 73: [function(require2, module3, exports3) {
      var memoizeCapped = require2("./_memoizeCapped");
      var rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;
      var reEscapeChar = /\\(\\)?/g;
      var stringToPath = memoizeCapped(function(string) {
        var result = [];
        if (string.charCodeAt(0) === 46) {
          result.push("");
        }
        string.replace(rePropName, function(match2, number, quote, subString) {
          result.push(quote ? subString.replace(reEscapeChar, "$1") : number || match2);
        });
        return result;
      });
      module3.exports = stringToPath;
    }, { "./_memoizeCapped": 66 }], 74: [function(require2, module3, exports3) {
      var isSymbol = require2("./isSymbol");
      var INFINITY = 1 / 0;
      function toKey(value) {
        if (typeof value == "string" || isSymbol(value)) {
          return value;
        }
        var result = value + "";
        return result == "0" && 1 / value == -INFINITY ? "-0" : result;
      }
      module3.exports = toKey;
    }, { "./isSymbol": 91 }], 75: [function(require2, module3, exports3) {
      var funcProto = Function.prototype;
      var funcToString = funcProto.toString;
      function toSource(func) {
        if (func != null) {
          try {
            return funcToString.call(func);
          } catch (e) {}
          try {
            return func + "";
          } catch (e) {}
        }
        return "";
      }
      module3.exports = toSource;
    }, {}], 76: [function(require2, module3, exports3) {
      function eq(value, other) {
        return value === other || value !== value && other !== other;
      }
      module3.exports = eq;
    }, {}], 77: [function(require2, module3, exports3) {
      var baseGet = require2("./_baseGet");
      function get(object, path, defaultValue) {
        var result = object == null ? undefined : baseGet(object, path);
        return result === undefined ? defaultValue : result;
      }
      module3.exports = get;
    }, { "./_baseGet": 29 }], 78: [function(require2, module3, exports3) {
      var baseIsArguments = require2("./_baseIsArguments"), isObjectLike = require2("./isObjectLike");
      var objectProto = Object.prototype;
      var hasOwnProperty = objectProto.hasOwnProperty;
      var propertyIsEnumerable = objectProto.propertyIsEnumerable;
      var isArguments = baseIsArguments(function() {
        return arguments;
      }()) ? baseIsArguments : function(value) {
        return isObjectLike(value) && hasOwnProperty.call(value, "callee") && !propertyIsEnumerable.call(value, "callee");
      };
      module3.exports = isArguments;
    }, { "./_baseIsArguments": 31, "./isObjectLike": 88 }], 79: [function(require2, module3, exports3) {
      var isArray = Array.isArray;
      module3.exports = isArray;
    }, {}], 80: [function(require2, module3, exports3) {
      var isFunction = require2("./isFunction"), isLength = require2("./isLength");
      function isArrayLike(value) {
        return value != null && isLength(value.length) && !isFunction(value);
      }
      module3.exports = isArrayLike;
    }, { "./isFunction": 83, "./isLength": 84 }], 81: [function(require2, module3, exports3) {
      var baseGetTag = require2("./_baseGetTag"), isObjectLike = require2("./isObjectLike");
      var boolTag = "[object Boolean]";
      function isBoolean(value) {
        return value === true || value === false || isObjectLike(value) && baseGetTag(value) == boolTag;
      }
      module3.exports = isBoolean;
    }, { "./_baseGetTag": 30, "./isObjectLike": 88 }], 82: [function(require2, module3, exports3) {
      var root = require2("./_root"), stubFalse = require2("./stubFalse");
      var freeExports = typeof exports3 == "object" && exports3 && !exports3.nodeType && exports3;
      var freeModule = freeExports && typeof module3 == "object" && module3 && !module3.nodeType && module3;
      var moduleExports = freeModule && freeModule.exports === freeExports;
      var Buffer = moduleExports ? root.Buffer : undefined;
      var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;
      var isBuffer = nativeIsBuffer || stubFalse;
      module3.exports = isBuffer;
    }, { "./_root": 72, "./stubFalse": 95 }], 83: [function(require2, module3, exports3) {
      var baseGetTag = require2("./_baseGetTag"), isObject = require2("./isObject");
      var asyncTag = "[object AsyncFunction]", funcTag = "[object Function]", genTag = "[object GeneratorFunction]", proxyTag = "[object Proxy]";
      function isFunction(value) {
        if (!isObject(value)) {
          return false;
        }
        var tag = baseGetTag(value);
        return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
      }
      module3.exports = isFunction;
    }, { "./_baseGetTag": 30, "./isObject": 87 }], 84: [function(require2, module3, exports3) {
      var MAX_SAFE_INTEGER = 9007199254740991;
      function isLength(value) {
        return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
      }
      module3.exports = isLength;
    }, {}], 85: [function(require2, module3, exports3) {
      function isNil(value) {
        return value == null;
      }
      module3.exports = isNil;
    }, {}], 86: [function(require2, module3, exports3) {
      var baseGetTag = require2("./_baseGetTag"), isObjectLike = require2("./isObjectLike");
      var numberTag = "[object Number]";
      function isNumber(value) {
        return typeof value == "number" || isObjectLike(value) && baseGetTag(value) == numberTag;
      }
      module3.exports = isNumber;
    }, { "./_baseGetTag": 30, "./isObjectLike": 88 }], 87: [function(require2, module3, exports3) {
      function isObject(value) {
        var type = typeof value;
        return value != null && (type == "object" || type == "function");
      }
      module3.exports = isObject;
    }, {}], 88: [function(require2, module3, exports3) {
      function isObjectLike(value) {
        return value != null && typeof value == "object";
      }
      module3.exports = isObjectLike;
    }, {}], 89: [function(require2, module3, exports3) {
      var baseGetTag = require2("./_baseGetTag"), getPrototype = require2("./_getPrototype"), isObjectLike = require2("./isObjectLike");
      var objectTag = "[object Object]";
      var funcProto = Function.prototype, objectProto = Object.prototype;
      var funcToString = funcProto.toString;
      var hasOwnProperty = objectProto.hasOwnProperty;
      var objectCtorString = funcToString.call(Object);
      function isPlainObject(value) {
        if (!isObjectLike(value) || baseGetTag(value) != objectTag) {
          return false;
        }
        var proto = getPrototype(value);
        if (proto === null) {
          return true;
        }
        var Ctor = hasOwnProperty.call(proto, "constructor") && proto.constructor;
        return typeof Ctor == "function" && Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString;
      }
      module3.exports = isPlainObject;
    }, { "./_baseGetTag": 30, "./_getPrototype": 43, "./isObjectLike": 88 }], 90: [function(require2, module3, exports3) {
      var baseGetTag = require2("./_baseGetTag"), isArray = require2("./isArray"), isObjectLike = require2("./isObjectLike");
      var stringTag = "[object String]";
      function isString(value) {
        return typeof value == "string" || !isArray(value) && isObjectLike(value) && baseGetTag(value) == stringTag;
      }
      module3.exports = isString;
    }, { "./_baseGetTag": 30, "./isArray": 79, "./isObjectLike": 88 }], 91: [function(require2, module3, exports3) {
      var baseGetTag = require2("./_baseGetTag"), isObjectLike = require2("./isObjectLike");
      var symbolTag = "[object Symbol]";
      function isSymbol(value) {
        return typeof value == "symbol" || isObjectLike(value) && baseGetTag(value) == symbolTag;
      }
      module3.exports = isSymbol;
    }, { "./_baseGetTag": 30, "./isObjectLike": 88 }], 92: [function(require2, module3, exports3) {
      var baseIsTypedArray = require2("./_baseIsTypedArray"), baseUnary = require2("./_baseUnary"), nodeUtil = require2("./_nodeUtil");
      var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
      var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;
      module3.exports = isTypedArray;
    }, { "./_baseIsTypedArray": 33, "./_baseUnary": 37, "./_nodeUtil": 69 }], 93: [function(require2, module3, exports3) {
      var arrayLikeKeys = require2("./_arrayLikeKeys"), baseKeys = require2("./_baseKeys"), isArrayLike = require2("./isArrayLike");
      function keys(object) {
        return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
      }
      module3.exports = keys;
    }, { "./_arrayLikeKeys": 26, "./_baseKeys": 34, "./isArrayLike": 80 }], 94: [function(require2, module3, exports3) {
      var MapCache = require2("./_MapCache");
      var FUNC_ERROR_TEXT = "Expected a function";
      function memoize(func, resolver) {
        if (typeof func != "function" || resolver != null && typeof resolver != "function") {
          throw new TypeError(FUNC_ERROR_TEXT);
        }
        var memoized = function() {
          var args = arguments, key = resolver ? resolver.apply(this, args) : args[0], cache = memoized.cache;
          if (cache.has(key)) {
            return cache.get(key);
          }
          var result = func.apply(this, args);
          memoized.cache = cache.set(key, result) || cache;
          return result;
        };
        memoized.cache = new (memoize.Cache || MapCache);
        return memoized;
      }
      memoize.Cache = MapCache;
      module3.exports = memoize;
    }, { "./_MapCache": 24 }], 95: [function(require2, module3, exports3) {
      function stubFalse() {
        return false;
      }
      module3.exports = stubFalse;
    }, {}], 96: [function(require2, module3, exports3) {
      var baseToString = require2("./_baseToString");
      function toString(value) {
        return value == null ? "" : baseToString(value);
      }
      module3.exports = toString;
    }, { "./_baseToString": 36 }], airtable: [function(require2, module3, exports3) {
      var __importDefault = this && this.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
      var base_1 = __importDefault(require2("./base"));
      var record_1 = __importDefault(require2("./record"));
      var table_1 = __importDefault(require2("./table"));
      var airtable_error_1 = __importDefault(require2("./airtable_error"));
      var Airtable = function() {
        function Airtable2(opts) {
          if (opts === undefined) {
            opts = {};
          }
          var defaultConfig = Airtable2.default_config();
          var apiVersion = opts.apiVersion || Airtable2.apiVersion || defaultConfig.apiVersion;
          Object.defineProperties(this, {
            _apiKey: {
              value: opts.apiKey || Airtable2.apiKey || defaultConfig.apiKey
            },
            _apiVersion: {
              value: apiVersion
            },
            _apiVersionMajor: {
              value: apiVersion.split(".")[0]
            },
            _customHeaders: {
              value: opts.customHeaders || {}
            },
            _endpointUrl: {
              value: opts.endpointUrl || Airtable2.endpointUrl || defaultConfig.endpointUrl
            },
            _noRetryIfRateLimited: {
              value: opts.noRetryIfRateLimited || Airtable2.noRetryIfRateLimited || defaultConfig.noRetryIfRateLimited
            },
            _requestTimeout: {
              value: opts.requestTimeout || Airtable2.requestTimeout || defaultConfig.requestTimeout
            }
          });
          if (!this._apiKey) {
            throw new Error("An API key is required to connect to Airtable");
          }
        }
        Airtable2.prototype.base = function(baseId) {
          return base_1.default.createFunctor(this, baseId);
        };
        Airtable2.default_config = function() {
          return {
            endpointUrl: "https://api.airtable.com",
            apiVersion: "0.1.0",
            apiKey: "",
            noRetryIfRateLimited: false,
            requestTimeout: 300 * 1000
          };
        };
        Airtable2.configure = function(_a) {
          var { apiKey, endpointUrl, apiVersion, noRetryIfRateLimited, requestTimeout } = _a;
          Airtable2.apiKey = apiKey;
          Airtable2.endpointUrl = endpointUrl;
          Airtable2.apiVersion = apiVersion;
          Airtable2.noRetryIfRateLimited = noRetryIfRateLimited;
          Airtable2.requestTimeout = requestTimeout;
        };
        Airtable2.base = function(baseId) {
          return new Airtable2().base(baseId);
        };
        Airtable2.Base = base_1.default;
        Airtable2.Record = record_1.default;
        Airtable2.Table = table_1.default;
        Airtable2.Error = airtable_error_1.default;
        return Airtable2;
      }();
      module3.exports = Airtable;
    }, { "./airtable_error": 2, "./base": 3, "./record": 15, "./table": 17 }] }, {}, ["airtable"])("airtable");
  });
});

// ../../node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || undefined;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};

// ../../node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = Symbol();

// ../../node_modules/hono/dist/utils/body.js
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
};
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== undefined) {
    if (Array.isArray(form[key])) {
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
};
var handleParsingNestedValues = (form, key, value) => {
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};

// ../../node_modules/hono/dist/utils/url.js
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match, index) => {
    const mark = `@${index}`;
    groups.push([mark, match]);
    return mark;
  });
  return { groups, path };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1;i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1;j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") {
    return "*";
  }
  const match = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match[1], new RegExp(`^${match[2]}(?=/${next})`)] : [label, match[1], new RegExp(`^${match[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match) => {
      try {
        return decoder(match);
      } catch {
        return match;
      }
    });
  }
};
var tryDecodeURI = (str) => tryDecode(str, decodeURI);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (;i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const path = url.slice(start, queryIndex === -1 ? undefined : queryIndex);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63) {
      break;
    }
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var _decodeURI = (value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
};
var _getQueryParam = (url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf(`?${key}`, 8);
    if (keyIndex2 === -1) {
      keyIndex2 = url.indexOf(`&${key}`, 8);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? undefined : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(keyIndex + 1, valueIndex === -1 ? nextKeyIndex === -1 ? undefined : nextKeyIndex : valueIndex);
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? undefined : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;

// ../../node_modules/hono/dist/request.js
var tryDecodeURIComponent = (str) => tryDecode(str, decodeURIComponent_);
var HonoRequest = class {
  raw;
  #validatedData;
  #matchResult;
  routeIndex = 0;
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== undefined) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? undefined;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return this.bodyCache.parsedBody ??= await parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw[key]();
  };
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  text() {
    return this.#cachedBody("text");
  }
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  blob() {
    return this.#cachedBody("blob");
  }
  formData() {
    return this.#cachedBody("formData");
  }
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  get url() {
    return this.raw.url;
  }
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// ../../node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then((res) => Promise.all(res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))).then(() => buffer[0]));
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
};

// ../../node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var Context = class {
  #rawRequest;
  #req;
  env = {};
  #var;
  finalized = false;
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  get res() {
    return this.#res ||= new Response(null, {
      headers: this.#preparedHeaders ??= new Headers
    });
  }
  set res(_res) {
    if (this.#res && _res) {
      _res = new Response(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  setLayout = (layout) => this.#layout = layout;
  getLayout = () => this.#layout;
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = new Response(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers;
    if (value === undefined) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map;
    this.#var.set(key, value);
  };
  get = (key) => {
    return this.#var ? this.#var.get(key) : undefined;
  };
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers;
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return new Response(data, { status, headers: responseHeaders });
  }
  newResponse = (...args) => this.#newResponse(...args);
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(text, arg, setDefaultContentType(TEXT_PLAIN, headers));
  };
  json = (object, arg, headers) => {
    return this.#newResponse(JSON.stringify(object), arg, setDefaultContentType("application/json", headers));
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  redirect = (location, status) => {
    const locationString = String(location);
    this.header("Location", !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString));
    return this.newResponse(null, status ?? 302);
  };
  notFound = () => {
    this.#notFoundHandler ??= () => new Response;
    return this.#notFoundHandler(this);
  };
};

// ../../node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// ../../node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// ../../node_modules/hono/dist/hono-base.js
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var Hono = class {
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  router;
  getPath;
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  errorHandler = errorHandler;
  route(path, app) {
    const subApp = this.basePath(path);
    app.routes.map((r) => {
      let handler;
      if (app.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = async (c, next) => (await compose([], app.errorHandler)(c, () => r.handler(c, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = (request) => request;
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = undefined;
      try {
        executionContext = c.executionCtx;
      } catch {}
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then((resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(new Request(/^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`, requestInit), Env, executionCtx);
  };
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, undefined, event.request.method));
    });
  };
};

// ../../node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
var buildAllMatchersKey = Symbol("buildAllMatchers");
function match(method, path) {
  const matchers = this[buildAllMatchersKey]();
  const match2 = (method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  };
  this.match = match2;
  return match2(method, path);
}

// ../../node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class {
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== undefined) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some((k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR)) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new Node;
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some((k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR)) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new Node;
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// ../../node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node;
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0;; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1;i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1;j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== undefined) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== undefined) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// ../../node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(path === "*" ? "" : `^${path.replace(/\/\*$|([.\\+*[^\]$()])/g, (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)")}$`);
}
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie;
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map((route) => [!/\*|\/:/.test(route[0]), ...route]).sort(([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length);
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length;i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (;paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length;i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length;j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length;k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
function findMiddleware(middleware, path) {
  if (!middleware) {
    return;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return;
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach((p) => re.test(p) && routes[m][p].push([handler, paramCount]));
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length;i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  [buildAllMatchersKey]() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = undefined;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]]));
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// ../../node_modules/hono/dist/router/reg-exp-router/prepared-router.js
var PreparedRegExpRouter = class {
  name = "PreparedRegExpRouter";
  #matchers;
  #relocateMap;
  constructor(matchers, relocateMap) {
    this.#matchers = matchers;
    this.#relocateMap = relocateMap;
  }
  add(method, path, handler) {
    const all = this.#matchers[METHOD_NAME_ALL];
    this.#matchers[method] ||= [
      all[0],
      all[1].map((list) => Array.isArray(list) ? list.slice() : 0),
      Object.keys(all[2]).reduce((obj, key) => {
        obj[key] = [all[2][key][0].slice(), emptyParam];
        return obj;
      }, {})
    ];
    if (path === "/*" || path === "*") {
      const defaultHandlerData = [handler, {}];
      (method === METHOD_NAME_ALL ? Object.keys(this.#matchers) : [method]).forEach((m) => {
        const matcher = this.#matchers[m];
        matcher[1].forEach((list) => list && list.push(defaultHandlerData));
        Object.values(matcher[2]).forEach((list) => list[0].push(defaultHandlerData));
      });
      return;
    }
    const data = this.#relocateMap[path];
    if (!data) {
      throw new Error(`Path ${path} is not registered`);
    }
    for (const [indexes, map] of data) {
      (method === METHOD_NAME_ALL ? Object.keys(this.#matchers) : [method]).forEach((m) => {
        const matcher = this.#matchers[m];
        if (!map) {
          matcher[2][path][0].push([handler, {}]);
        } else {
          indexes.forEach((index) => {
            if (typeof index === "number") {
              matcher[1][index].push([handler, map]);
            } else {
              matcher[2][index || path][0].push([handler, map]);
            }
          });
        }
      });
    }
  }
  [buildAllMatchersKey]() {
    return this.#matchers;
  }
  match = match;
};

// ../../node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (;i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length;i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = undefined;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// ../../node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var Node2 = class {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length;i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new Node2;
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #getHandlerSets(node, method, nodeParams, params) {
    const handlerSets = [];
    for (let i = 0, len = node.#methods.length;i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== undefined) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length;i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
    return handlerSets;
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    for (let i = 0, len = parts.length;i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length;j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              handlerSets.push(...this.#getHandlerSets(nextNode.#children["*"], method, node.#params));
            }
            handlerSets.push(...this.#getHandlerSets(nextNode, method, node.#params));
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length;k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              handlerSets.push(...this.#getHandlerSets(astNode, method, node.#params));
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          const restPathString = parts.slice(i).join("/");
          if (matcher instanceof RegExp) {
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              handlerSets.push(...this.#getHandlerSets(child, method, node.#params, params));
              if (Object.keys(child.#children).length) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              handlerSets.push(...this.#getHandlerSets(child, method, params, node.#params));
              if (child.#children["*"]) {
                handlerSets.push(...this.#getHandlerSets(child.#children["*"], method, params, node.#params));
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      curNodes = tempNodes.concat(curNodesQueue.shift() ?? []);
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// ../../node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2;
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length;i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// ../../node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter, new TrieRouter]
    });
  }
};

// src/airtable.ts
var import_airtable = __toESM(require_airtable_umd(), 1);
var airtable = new import_airtable.default({
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN
});
var base = airtable.base(process.env.AIRTABLE_BASE_ID || "");
function validateEnvironment() {
  if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN) {
    throw new Error("AIRTABLE_PERSONAL_ACCESS_TOKEN is required. Please set it in your .env.local file.");
  }
  if (!process.env.AIRTABLE_BASE_ID) {
    throw new Error("AIRTABLE_BASE_ID is required. Please set it in your .env.local file.");
  }
}
async function testConnection() {
  try {
    validateEnvironment();
    const response = await fetch(`https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`, {
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Invalid Personal Access Token. Please check your AIRTABLE_PERSONAL_ACCESS_TOKEN.");
      }
      if (response.status === 404) {
        throw new Error("Base not found. Please check your AIRTABLE_BASE_ID.");
      }
      throw new Error(`Connection failed: ${response.statusText}`);
    }
    return { success: true, message: "Connection successful" };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown connection error"
    };
  }
}

// src/lib/airtable-helpers.ts
async function fetchAllRecords(baseId, tableName, options) {
  const apiKey = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
  if (!apiKey) {
    throw new Error("AIRTABLE_PERSONAL_ACCESS_TOKEN not configured");
  }
  const records = [];
  let offset;
  do {
    const params = new URLSearchParams;
    if (options?.view)
      params.append("view", options.view);
    if (options?.filterByFormula)
      params.append("filterByFormula", options.filterByFormula);
    if (offset)
      params.append("offset", offset);
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?${params}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.records) {
      data.records.forEach((record) => {
        records.push({
          id: record.id,
          fields: record.fields,
          createdTime: record.createdTime
        });
      });
    }
    offset = data.offset;
  } while (offset);
  return records;
}
async function createRecords(baseId, tableName, records) {
  const apiKey = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
  if (!apiKey) {
    throw new Error("AIRTABLE_PERSONAL_ACCESS_TOKEN not configured");
  }
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ records })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable API error: ${error.error?.message || response.statusText}`);
  }
  const data = await response.json();
  return data.records.map((record) => ({
    id: record.id,
    fields: record.fields,
    createdTime: record.createdTime
  }));
}

// src/routes/ledger.ts
var app = new Hono2;
app.post("/", async (c) => {
  try {
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      return c.json({
        success: false,
        error: `Connection failed: ${connectionTest.message}`
      }, 401);
    }
    const { subscriptionId, clientName, amountCharged, receiptDate } = await c.req.json();
    if (!subscriptionId || !clientName || !amountCharged || !receiptDate) {
      return c.json({
        success: false,
        error: "Missing required fields: subscriptionId, clientName, amountCharged, receiptDate"
      }, 400);
    }
    console.log("Creating Ledger entry:", { subscriptionId, clientName, amountCharged, receiptDate });
    const baseId = process.env.AIRTABLE_BASE_ID || "";
    const subscriptions = await fetchAllRecords(baseId, "Subscriptions Personal");
    const subscription = subscriptions.find((s) => s.id === subscriptionId);
    if (!subscription) {
      return c.json({
        success: false,
        error: "Subscription not found"
      }, 404);
    }
    const recordData = {
      "Service Rendered": "Personal Tax Return",
      "Receipt Date": receiptDate,
      "Amount Charged": amountCharged,
      "Name of Client": clientName,
      Subscription: [subscriptionId]
    };
    const records = await createRecords(baseId, "Ledger", [
      { fields: recordData }
    ]);
    return c.json({
      success: true,
      data: {
        id: records[0].id,
        fields: records[0].fields
      }
    });
  } catch (error) {
    console.error("Error creating Ledger entry:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create ledger entry",
      details: error instanceof Error ? error.stack : "Unknown error"
    }, 500);
  }
});
app.get("/", async (c) => {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID || "";
    const records = await fetchAllRecords(baseId, "Ledger");
    return c.json({
      success: true,
      data: records
    });
  } catch (error) {
    console.error("Error fetching ledger entries:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch ledger entries"
    }, 500);
  }
});
var ledger_default = app;
export {
  ledger_default as default
};
