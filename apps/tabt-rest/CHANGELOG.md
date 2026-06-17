# Changelog

## [2.0.0](https://github.com/BePing/beping-backends/compare/tabt-rest-v1.0.0...tabt-rest-v2.0.0) (2026-06-17)


### ⚠ BREAKING CHANGES

* v2

### Features

* Add global search functionality across members, clubs, and tournaments ([3f81dfe](https://github.com/BePing/beping-backends/commit/3f81dfe844559b20c02301994a9a7cc108b4f97b))
* add ranking table endpoint and DTO for member rankings ([d57ebf2](https://github.com/BePing/beping-backends/commit/d57ebf238683c14cf3d3b34c341047a5623b27d7))
* Dashboard api ([21eef81](https://github.com/BePing/beping-backends/commit/21eef81b4258abbd42bfbdbcfb911f96964480b4))
* Dockerfile ([289ee88](https://github.com/BePing/beping-backends/commit/289ee88a66f9b8977aa8d2ef411c8c351c3602ca))
* enhance multi-category member dashboard and update Docker configuration ([c067b9c](https://github.com/BePing/beping-backends/commit/c067b9c73ac3536cebb8482b19cfa1ad171dcd69))
* fix ([5cea31d](https://github.com/BePing/beping-backends/commit/5cea31d4ae5c30d40e434fd8d340952fc837a78d))
* fix ([fb1f2c4](https://github.com/BePing/beping-backends/commit/fb1f2c45d7e6e76b1587cfaedf6c0f1e52f2d4ef))
* fix ([d9406ae](https://github.com/BePing/beping-backends/commit/d9406ae07feca158e1a8dd551fa21ed0ad7b0c81))
* fix ([554c3f8](https://github.com/BePing/beping-backends/commit/554c3f8bb3e6e5bf7825605fcf58f3ce61d6198b))
* fix ([7d354d6](https://github.com/BePing/beping-backends/commit/7d354d6bc993b2336aa9591fa23d772f2439f736))
* fix ([baa8901](https://github.com/BePing/beping-backends/commit/baa8901457a3959e1b862e29a51250c322d813f5))
* Integrate Supabase and refactor player categories ([8739f9c](https://github.com/BePing/beping-backends/commit/8739f9ce0a61ac217d7256b54e016d8043650eeb))
* Introduce App Notifications Service and FCM Integration ([951cbfb](https://github.com/BePing/beping-backends/commit/951cbfb6ac5a5d0dcab389f7920b35f2588b0518))
* update types ([dae5d81](https://github.com/BePing/beping-backends/commit/dae5d81ece1b3d88a0de56cd7cc689599dc5458b))
* upgrade NestJS dependencies and enhance caching mechanisms ([db3e15a](https://github.com/BePing/beping-backends/commit/db3e15a7ed347ff3f0ec74a8a28e7b0ec35ce7a8))
* v2 ([a6665a3](https://github.com/BePing/beping-backends/commit/a6665a35f96e5adcf70c2db57cee2003b0be7088))


### Bug Fixes

* add timeout configuration to health controller requests ([21ac735](https://github.com/BePing/beping-backends/commit/21ac735302550901144e93a4578e9d9fbe78d5c2))
* bounds checks, OpenAPI schema mismatches, and DTO corrections ([2760bde](https://github.com/BePing/beping-backends/commit/2760bde30873069f7208eb276af415ecc68a1f5b))
* clean DTOs ([1c36ada](https://github.com/BePing/beping-backends/commit/1c36ada374c6a4f677abef95463fd9de4da16f18))
* clean migration ([71853d3](https://github.com/BePing/beping-backends/commit/71853d328b3cd6f71b0988359b39446014b013ec))
* correct swagger ([17f420d](https://github.com/BePing/beping-backends/commit/17f420d22fec826ed6740daa2cd91fe110f823c0))
* enhance member dashboard service with category-specific handling ([f9d8063](https://github.com/BePing/beping-backends/commit/f9d80639edb9a2abdb6c1d854eb2cae0d64590d4))
* Ensure default port for NestJS application ([64a5ba0](https://github.com/BePing/beping-backends/commit/64a5ba06aa18a8055bc2dfbaf0ff63c18392a451))
* ensure newline at end of start.sh file ([60e7747](https://github.com/BePing/beping-backends/commit/60e7747e5bc9ef421bf1cdb7271b79add5d58fce))
* head2head ([7670a1d](https://github.com/BePing/beping-backends/commit/7670a1dc723161aba374592423cff2401813e283))
* improve database readiness check in start.sh ([8d796f4](https://github.com/BePing/beping-backends/commit/8d796f431fe49ad13764114c948508f4a7aa7eed))
* less logs ([7968655](https://github.com/BePing/beping-backends/commit/79686552abba6135f33233087f84ead7c7a9281b))
* optimize ranking letter estimation in numeric ranking service ([1e577fd](https://github.com/BePing/beping-backends/commit/1e577fd89a5d9ae503a97b3328f9a69fc3f9513b))
* prevent dashboard crash for players with null Decimal fields or missing SOAP data ([62a8397](https://github.com/BePing/beping-backends/commit/62a83972d9f472196a6d0f7dddfc5ca484a4874b))
* remove sentry ([70b1b7c](https://github.com/BePing/beping-backends/commit/70b1b7c1d389d01b47f7fc7ab5fc8a2dcf4cb057))
* remove unnecessary HTTPS agent configuration in head2head service ([48f8096](https://github.com/BePing/beping-backends/commit/48f809695a876f6b9b287c6f45857558e1a8c570))
* reverse match IDs order in member dashboard service ([083caae](https://github.com/BePing/beping-backends/commit/083caae023faaffabbff3b4ccb4f6b8d4fb2c9a2))
* update database readiness check in startup scripts for app-notifications, data-aftt-importer, and tabt-rest ([45e0cbd](https://github.com/BePing/beping-backends/commit/45e0cbd1d245c1ce85bd47efb7461563ecb674cd))
* update Dockerfiles to include prisma CLI for migrations ([5c5aa9b](https://github.com/BePing/beping-backends/commit/5c5aa9bcc3ea1e21a2d6e481259ef1de4a392755))
* update individual match result properties and enhance head2head service logging ([53734b4](https://github.com/BePing/beping-backends/commit/53734b4776448abb786ddf51977736ab1edfbedc))
* update member dashboard service logic and API documentation ([34fe0b5](https://github.com/BePing/beping-backends/commit/34fe0b5b274b79dab7fcd618f3b6f062cd81c12c))
* update OpenAPI server configuration ([f6f6607](https://github.com/BePing/beping-backends/commit/f6f6607632b9d1393eb745c87891b3f84c295cda))
* update year lol ([0a12ecc](https://github.com/BePing/beping-backends/commit/0a12ecc9ff8e535871b72d5f8e6816a7e2eee50a))
* v3 numeric ranking ([2608546](https://github.com/BePing/beping-backends/commit/26085469b1908a604a6132b4d3ad7158135c3930))
* v3 numeric ranking ([a822332](https://github.com/BePing/beping-backends/commit/a8223320064da91462b38e141a9692c70c3de266))


### Miscellaneous

* add Prisma configuration and update Dockerfiles to use Prisma 5.20.0 ([4d76f5e](https://github.com/BePing/beping-backends/commit/4d76f5e3925c35a9f2c4a3152a0dad7c1fd74412))
* Pin Node.js ([13220c1](https://github.com/BePing/beping-backends/commit/13220c12e6e148286ce49c1fdc918190e831f1f9))
* release 2.0.0 ([27aa649](https://github.com/BePing/beping-backends/commit/27aa649bb00435fa86e50392d3b6758e4d059e90))
* repo hygiene, secrets, and green test/lint baseline ([d8c4260](https://github.com/BePing/beping-backends/commit/d8c4260b0f4d2f386f65328d2ac97e893bea4831))
* streamline Dockerfiles by removing unnecessary COPY commands ([349f5ac](https://github.com/BePing/beping-backends/commit/349f5ac091180ea54903565bc2b23e81237f3bf8))
* update Dockerfiles and .dockerignore for improved build efficiency ([15ccd98](https://github.com/BePing/beping-backends/commit/15ccd98e1796ec1e61ff148010d6d4b46aa761a2))
* update Dockerfiles and GitHub Actions for multi-platform support ([006b7db](https://github.com/BePing/beping-backends/commit/006b7dbeba623d07ed0a8c9cfa3539aa9ba12136))
* update Dockerfiles to copy all application source code for build ([59ad669](https://github.com/BePing/beping-backends/commit/59ad6691c40b6d38161fc5ee994ec3f083d28cf2))
* Update Node.js to 20.17.x ([cf769ee](https://github.com/BePing/beping-backends/commit/cf769ee2012b84aaf78fa7433696c303e40c82ac))
* Update Node.js to 20.18.x ([5dbe010](https://github.com/BePing/beping-backends/commit/5dbe0109164eb001291cd1fcb9e4e2514cdf373d))


### Code Refactoring

* clean up code formatting and improve readability across multiple files ([364be1e](https://github.com/BePing/beping-backends/commit/364be1e03cddc2678ff83d14d7513e2ad5f23ec7))
* extract libs/common; remove cross-app import + duplication ([5443afb](https://github.com/BePing/beping-backends/commit/5443afbc9192f88288dcf7d02389b66525aec30e))
* read bootstrap config via ConfigService; fold in WIP config ([a42fca2](https://github.com/BePing/beping-backends/commit/a42fca271593da675422a858c13814e443e2e1a1))
* update cache service tests and improve caching logic ([055166a](https://github.com/BePing/beping-backends/commit/055166a85c0e2c9506a94340f179aae1f6ae2ff4))
* update Dockerfiles and startup scripts for app-notifications and tabt-rest ([8195fd5](https://github.com/BePing/beping-backends/commit/8195fd503c76b6557309ee907e27b3ef1d61a78f))
* update Dockerfiles for app-notifications, data-aftt-importer, and tabt-rest ([e180617](https://github.com/BePing/beping-backends/commit/e180617c1cb19a65d1128b4a9d46461724d1fb08))
* update Dockerfiles for app-notifications, data-aftt-importer, and tabt-rest ([13ae946](https://github.com/BePing/beping-backends/commit/13ae9462dff2964f1b50ef0fb5a521eb9c48d33c))


### Build System

* **docker:** slim runtime images ~37% and split migrations into an init image ([7c310ef](https://github.com/BePing/beping-backends/commit/7c310ef5ea7c8f55e6924ee4df5ba65b84acfd61))
* normalize Dockerfiles, start scripts, and compose ([7070a4c](https://github.com/BePing/beping-backends/commit/7070a4ce49b9a4af8db27af3332bd2006c166fb0))
* upgrade to Prisma 7, bump deps to latest, migrate npm to pnpm ([a5144cb](https://github.com/BePing/beping-backends/commit/a5144cb17df8502af4ec517fcf2f15920dd7cc53))
