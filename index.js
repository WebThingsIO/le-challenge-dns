'use strict';

var PromiseA = require('bluebird');
var dns = PromiseA.promisifyAll(require('dns'));
var Challenge = module.exports;

Challenge.create = function (defaults) {
  return  {
    getOptions: function () {
      return defaults || {};
    }
  , set: Challenge.set
  , get: Challenge.get
  , remove: Challenge.remove
  , loopback: Challenge.loopback
  , test: Challenge.test
  };
};

// Show the user the token and key and wait for them to be ready to continue
Challenge.set = function (args, domain, challenge, keyAuthorization, cb) {
  var keyAuthDigest = require('crypto').createHash('sha256').update(keyAuthorization||'').digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
    ;
  var challengeDomain = (args.test || '') + args.acmeChallengeDns + domain;

  console.info("");
  console.info("Challenge for '" + domain + "'");
  console.info("");
  console.info("We now present (for you copy-and-paste pleasure) your ACME Challenge");
  console.info("public Challenge and secret KeyAuthorization and Digest, in that order, respectively:");
  console.info(challenge);
  console.info(keyAuthorization);
  console.info(keyAuthDigest);
  console.info("");
  console.info(challengeDomain + "\tTXT " + keyAuthDigest + "\tTTL 60");
  console.info("");
  console.info(JSON.stringify({
    domain: domain
  , challenge: challenge
  , keyAuthorization: keyAuthorization
  , keyAuthDigest: keyAuthDigest
  }, null, '  ').replace(/^/gm, '\t'));
  console.info("");
  console.info("hit enter to continue...");
  process.stdin.resume();
  process.stdin.on('data', function () {
    process.stdin.pause();
    cb(null);
  });
};

// nothing to do here, that's why it's manual
Challenge.get = function (defaults, domain, challenge, cb) {
  cb(null);
};

// might as well tell the user that whatever they were setting up has been checked
Challenge.remove = function (args, domain, challenge, cb) {
  console.info("Challenge for '" + domain + "' complete. You may remove it.");
  console.info("");
  //console.info("hit enter to continue...");
  //process.stdin.resume();
  //process.stdin.on('data', function () {
  //  process.stdin.pause();
    cb(null);
  //});
};

Challenge.loopback = function (defaults, domain, challenge, done) {
  var challengeDomain = (defaults.test || '') + defaults.acmeChallengeDns + domain;
  console.log("dig TXT +noall +answer @8.8.8.8 '" + challengeDomain + "' # " + challenge);
  dns.resolveTxtAsync(challengeDomain).then(function (x) { done(null, x); }, done);
};
