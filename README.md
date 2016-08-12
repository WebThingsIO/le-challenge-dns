le-challenge-dns
================

A dns-based strategy for node-letsencrypt for setting, and clearing ACME DNS-01 challenges issued by the ACME server.

DRAFT
-----

This details how any dns-based challenge will work with node-letsencrypt, but is not yet implemented specifically (though it is in the pipeline at present, obviously).

Usage
-----

```bash
var leChallenge = require('le-challenge-dns').create({
  ttl: 600
, debug: false
});

var LE = require('letsencrypt');

LE.create({
  server: LE.stagingServerUrl                               // Change to LE.productionServerUrl in production
, challenge: leChallenge
});
```

NOTE: If you request a certificate with 6 domains listed,
it will require 6 individual challenges.

Exposed Methods
---------------

For ACME Challenge:

* `set(opts, domain, key, val, done)`
* `get(defaults, domain, key, done)`
* `remove(defaults, domain, key, done)`

For node-letsencrypt internals:

* `getOptions()` returns the internal defaults merged with the user-supplied options
* `loopback(defaults, domain, key, value, done)` should test, by external means, that the ACME server's challenge server will succeed
