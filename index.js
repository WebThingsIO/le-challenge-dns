'use strict';

// See https://gitlab.com/pushrocks/cert/blob/master/ts/cert.hook.ts

var PromiseA = require('bluebird');
var dns = PromiseA.promisifyAll(require('dns'));
var DDNS = require('ddns-cli');
var fs = require('fs');
var path = require('path');

var cluster = require('cluster');
var numCores = require('os').cpus().length;
var defaults = {
  oauth3: 'oauth3.org'
, debug: false
, acmeChallengeDns: '_acme-challenge.' // _acme-challenge.example.com TXT xxxxxxxxxxxxxxxx
, memstoreConfig: {
    sock: '/tmp/memstore.sock'

    // If left 'null' or 'undefined' this defaults to a similar memstore
    // with no special logic for 'cookie' or 'expires'
  , store: null

    // a good default to use for instances where you might want
    // to cluster or to run standalone, but with the same API
  , serve: cluster.isMaster
  , connect: cluster.isWorker
  , standalone: (1 === numCores) // overrides serve and connect
  }
};

var Challenge = module.exports;

Challenge.create = function (options) {
  var store = require('memstore-cluster');
  var results = {};

  Object.keys(Challenge).forEach(function (key) {
    results[key] = Challenge[key];
  });
  results.create = undefined;

  Object.keys(defaults).forEach(function (key) {
    if (!(key in options)) {
      options[key] = defaults[key];
    }
  });
  results._options = options;

  results.getOptions = function () {
    return results._options;
  };

  // TODO fix race condition at startup
  results._memstore = options.memstore;

  if (!results._memstore) {
    store.create(options.memstoreConfig).then(function (store) {
      // same api as new sqlite3.Database(options.filename)

      results._memstore = store;

      // app.use(expressSession({ secret: 'keyboard cat', store: store }));
    });
  }

  return results;
};

//
// NOTE: the "args" here in `set()` are NOT accessible to `get()` and `remove()`
// They are provided so that you can store them in an implementation-specific way
// if you need access to them.
//
Challenge.set = function (args, domain, challenge, keyAuthorization, done) {
  // Note: keyAuthorization is not used for dns-01

  this._memstore.set(domain, {
    email: args.email
  , refreshToken: args.refreshToken
  }, function () {

    return DDNS.run({
      email: args.email
    , refreshToken: args.refreshToken

    , name: args.test + args.acmeChallengeDns + '.' + domain
    , type: "TXT"
    , value: challenge
    , ttl: 60
    }).then(function () { done(null); }, done);
  });
};


//
// NOTE: the "defaults" here are still merged and templated, just like "args" would be,
// but if you specifically need "args" you must retrieve them from some storage mechanism
// based on domain and key
//
Challenge.get = function (defaults, domain, challenge, done) {
  throw new Error("Challenge.get() does not need an implementation for dns-01. (did you mean Challenge.loopback?)");
};

Challenge.remove = function (defaults, domain, challenge, done) {
  this._memstore.get(domain, function (data) {
    return DDNS.run({
      email: data.email
    , refreshToken: data.refreshToken

    , name: defaults.test + defaults.acmeChallengeDns + '.' + domain
    , type: "TXT"
    , value: challenge
    , ttl: 60

    , remove: true
    }).then(function () {

      done(null);
    }, done).then(function () {
      this._memstore.remove(domain);
    });
  });
};

// same as get, but external
Challenge.loopback = function (defaults, domain, challenge, done) {
  var subdomain = defaults.test + defaults.acmeChallengeDns + '.' + domain;
  dns.resolveAsync(subdomain).then(function () { done(null); }, done);
};

Challenge.test = function (args, domain, challenge, keyAuthorization, done) {
  // Note: keyAuthorization is not used for dns-01

  args.test = '_test.';

  Challenge.set(args, domain, challenge, keyAuthorization, function (err) {
    if (err) { done(err); return; }

    Challenge.loopback(defaults, domain, challenge, function (err) {
      if (err) { done(err); return; }

      Challenge.remove(defaults, domain, challenge, function (err) {
        if (err) { done(err); return; }

        // TODO needs to use native-dns so that specific nameservers can be used
        // (otherwise the cache will still have the old answer)
        done();
        /*
        Challenge.loopback(defaults, domain, challenge, function (err) {
          if (err) { done(err); return; }

          done();
        });
        */
      });
    });
  });
};
