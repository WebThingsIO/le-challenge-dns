// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

'use strict';

var le;
var fetch = require('node-fetch');
var LE = require('greenlock');
var leChallengeDns = require('./index.js').create({ debug: false })
// Storage Backend
var leStore = require('le-store-certbot').create({
  configDir: '~/letsencrypt/etc'   // or /etc/letsencrypt or wherever
, debug: true
, logsDir: '~/letsencrypt/var/log'
});

function leAgree(opts, agreeCb) {
  // opts = { email, domains, tosUrl }
  agreeCb(null, opts.tosUrl);
}

let subdomain = String(Math.random()).replace('.','');

le = LE.create({
  server: LE.productionServerUrl                               // Change to LE.productionServerUrl in production
, challengeType: 'dns-01'
, challenges: {
    'dns-01': leChallengeDns
  }
, approveDomains: [  subdomain + '.box.knilxof.org' ]
, agreeToTerms: leAgree                                   // hook to allow user to view and accept LE TOS
, debug: true
, store: leStore
});



// Check in-memory cache of certificates for the named domain
le.check({ domains: [ subdomain + '.box.knilxof.org' ] }).then(function (results) {

    if (results) {
        // we already have certificates
        return;
    }

    let token;
    let challenge;

    // promise to be called when LE has the dns challenge ready for us
    leChallengeDns.leDnsResponse = function(challenge, keyAuthorization, keyAuthDigest, challengeDomain, domain){

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

        return new Promise((resolve, reject) => {
            // ok now that we have a challenge, we call our gateway to setup the TXT record
            fetch('http://knilxof.org//dnsconfig?token=' + token + '&challenge=' + keyAuthDigest)
            .then(function(res) { return res.text(); }).then(function(body) {
                console.log(body);
                resolve("Success!");
            });
        });
    }

    fetch('http://knilxof.org/subscribe?name=' + subdomain)
        .then(function (res) { return res.text(); })
        .then(function (body) {
        const jsonBody = JSON.parse(body);
        token = jsonBody.token;
        // Register Let's Encrypt
        le.register({
            domains: [subdomain + '.box.knilxof.org']                           // CHANGE TO YOUR DOMAIN (list for SANS)
            , email: 'john.doe@example.com'                                    // CHANGE TO YOUR EMAIL
            , agreeTos: true                                              // set to tosUrl string (or true) to pre-approve (and skip agreeToTerms)
            , rsaKeySize: 2048                                           // 2048 or higher
            , challengeType: 'dns-01'                                   // http-01, tls-sni-01, or dns-01
        }).then(function (results) {
            console.log('success');
        }, function (err) {
            console.error('[Error]: node-greenlock/examples/standalone');
            console.error(err.stack);
        });
    });
});

