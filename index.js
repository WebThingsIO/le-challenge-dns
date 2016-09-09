'use strict';

// See https://gitlab.com/pushrocks/cert/blob/master/ts/cert.hook.ts

var PromiseA = require('bluebird');
var dns = PromiseA.promisifyAll(require('dns'));
var DDNS = require('/Users/aj/Code/ddns-cli');
//var DDNS = require('ddns-cli');
var fs = require('fs');
var path = require('path');

var cluster = require('cluster');
var numCores = require('os').cpus().length;
//var count = 0;
var defaults = {
  oauth3: 'oauth3.org'
, debug: false
, acmeChallengeDns: '_acme-challenge.' // _acme-challenge.example.com TXT xxxxxxxxxxxxxxxx
, memstoreConfig: {
    name: 'le-dns'
  }
};

var Challenge = module.exports;

Challenge.create = function (options) {
  // count += 1;
  var store = require('cluster-store');
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
  var me = this;
  // Note: keyAuthorization is not used for dns-01

  me._memstore.set(domain, {
    email: args.email
  , refreshToken: args.refreshToken
  }, function (err) {
    if (err) { done(err); return; }

    var challengeDomain = args.test + args.acmeChallengeDns + domain;

    return DDNS.update({
      email: args.email
    , refreshToken: args.refreshToken
    , silent: true

    , name: challengeDomain
    , type: "TXT"
    , value: challenge
    , ttl: 60
    }, {
      //debug: true
    }).then(function () {
      if (args.debug) {
        console.log("Test DNS Record:");
        console.log("dig TXT +noall +answer @ns1.redirect-www.org '" + challengeDomain + "' # " + challenge);
      }
      done(null);
    }, done);
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
  var me = this;

  me._memstore.get(domain, function (err, data) {
    if (err) { done(err); return; }

    var challengeDomain = defaults.test + defaults.acmeChallengeDns + domain;

    return DDNS.update({
      email: data.email
    , refreshToken: data.refreshToken
    , silent: true

    , name: challengeDomain
    , type: "TXT"
    , value: challenge
    , ttl: 60

    , remove: true
    }, {
      //debug: true
    }).then(function () {

      done(null);
    }, done).then(function () {
      me._memstore.destroy(domain);
    });
  });
};

// same as get, but external
Challenge.loopback = function (defaults, domain, challenge, done) {
  var challengeDomain = defaults.test + defaults.acmeChallengeDns + domain;
  dns.resolveTxtAsync(challengeDomain).then(function () { done(null); }, done);
};

Challenge.test = function (args, domain, challenge, keyAuthorization, done) {
  var me = this;
  // Note: keyAuthorization is not used for dns-01

  args.test = args.test || '_test.';
  defaults.test = args.test;

  me.set(args, domain, challenge, null, function (err) {
    if (err) { done(err); return; }

    me.loopback(defaults, domain, challenge, function (err) {
      if (err) { done(err); return; }

      me.remove(defaults, domain, challenge, function (err) {
        if (err) { done(err); return; }

        // TODO needs to use native-dns so that specific nameservers can be used
        // (otherwise the cache will still have the old answer)
        done();
        /*
        me.loopback(defaults, domain, challenge, function (err) {
          if (err) { done(err); return; }

          done();
        });
        */
      });
    });
  });
};
