'use strict';

var leChallengeDns = require('./').create({ });
var opts = leChallengeDns.getOptions();
var domain = 'test.daplie.me';
var challenge = 'xxx-acme-challenge-xxx';
var keyAuthorization = 'xxx-acme-challenge-xxx.xxx-acme-authorization-xxx';

setTimeout(function () {
  leChallengeDns.test(opts, domain, challenge, keyAuthorization, function (err) {
    // if there's an error, there's a problem
    if (err) { throw err; }

    console.log('test passed');
  });
}, 300);
