# Changelog

## [1.2.4](https://github.com/BePing/beping-backends/compare/data-aftt-importer-v1.2.3...data-aftt-importer-v1.2.4) (2025-09-22)


### Bug Fixes

* enhance caching and performance metrics in results and members list processing ([cf92e05](https://github.com/BePing/beping-backends/commit/cf92e051bf5c797cecead9a9692ab9734e936bb5))
* optimize cache cleaning process in members list sync ([4f19269](https://github.com/BePing/beping-backends/commit/4f19269546772ec4b03f8ee60bc49261ac476a94))

## [1.2.3](https://github.com/BePing/beping-backends/compare/data-aftt-importer-v1.2.2...data-aftt-importer-v1.2.3) (2025-09-22)


### Code Refactoring

* clean up code formatting and improve readability across multiple files ([364be1e](https://github.com/BePing/beping-backends/commit/364be1e03cddc2678ff83d14d7513e2ad5f23ec7))

## [1.2.2](https://github.com/BePing/beping-backends/compare/data-aftt-importer-v1.2.1...data-aftt-importer-v1.2.2) (2025-09-13)


### Bug Fixes

* update database readiness check in startup scripts for app-notifications, data-aftt-importer, and tabt-rest ([45e0cbd](https://github.com/BePing/beping-backends/commit/45e0cbd1d245c1ce85bd47efb7461563ecb674cd))

## [1.2.1](https://github.com/BePing/beping-backends/compare/data-aftt-importer-v1.2.0...data-aftt-importer-v1.2.1) (2025-09-13)


### Code Refactoring

* update Dockerfiles and startup scripts for app-notifications and tabt-rest ([8195fd5](https://github.com/BePing/beping-backends/commit/8195fd503c76b6557309ee907e27b3ef1d61a78f))

## [1.2.0](https://github.com/BePing/beping-backends/compare/data-aftt-importer-v1.1.2...data-aftt-importer-v1.2.0) (2025-09-13)


### Features

* implement data import optimizations for small VPS environments ([efdc414](https://github.com/BePing/beping-backends/commit/efdc41451e72060d138bb50d3fc1ccc106f1ffa7))

## [1.1.2](https://github.com/BePing/beping-backends/compare/data-aftt-importer-v1.1.1...data-aftt-importer-v1.1.2) (2025-09-13)


### Code Refactoring

* update Dockerfiles for app-notifications, data-aftt-importer, and tabt-rest ([e180617](https://github.com/BePing/beping-backends/commit/e180617c1cb19a65d1128b4a9d46461724d1fb08))

## [1.1.1](https://github.com/BePing/beping-backends/compare/data-aftt-importer-v1.1.0...data-aftt-importer-v1.1.1) (2025-09-13)


### Code Refactoring

* update Dockerfiles for app-notifications, data-aftt-importer, and tabt-rest ([13ae946](https://github.com/BePing/beping-backends/commit/13ae9462dff2964f1b50ef0fb5a521eb9c48d33c))

## [1.1.0](https://github.com/BePing/beping-backends/compare/data-aftt-importer-v1.0.0...data-aftt-importer-v1.1.0) (2025-09-13)


### Features

* Dockerfile ([289ee88](https://github.com/BePing/beping-backends/commit/289ee88a66f9b8977aa8d2ef411c8c351c3602ca))
* fix ([01280f5](https://github.com/BePing/beping-backends/commit/01280f5ea8d2c3cff70c2a9bfc96a31d8824771c))
* fix ([5cea31d](https://github.com/BePing/beping-backends/commit/5cea31d4ae5c30d40e434fd8d340952fc837a78d))
* fix ([5e79668](https://github.com/BePing/beping-backends/commit/5e796684189fc05388e42e4916c51da347f00eef))
* fix ([d9406ae](https://github.com/BePing/beping-backends/commit/d9406ae07feca158e1a8dd551fa21ed0ad7b0c81))
* fix ([a80e41e](https://github.com/BePing/beping-backends/commit/a80e41e45ba328bebd5958b337a0f277322bf0ae))
* fix ([94a45fd](https://github.com/BePing/beping-backends/commit/94a45fde2345fa7fdd8eb05c501ac0ca8730d934))
* fix ([baa8901](https://github.com/BePing/beping-backends/commit/baa8901457a3959e1b862e29a51250c322d813f5))
* Integrate Supabase and refactor player categories ([8739f9c](https://github.com/BePing/beping-backends/commit/8739f9ce0a61ac217d7256b54e016d8043650eeb))
* Introduce App Notifications Service and FCM Integration ([951cbfb](https://github.com/BePing/beping-backends/commit/951cbfb6ac5a5d0dcab389f7920b35f2588b0518))


### Bug Fixes

* clean cache after data import ([0bcd5d8](https://github.com/BePing/beping-backends/commit/0bcd5d8c17c841ba65d0f80cae52b8f25235bd0d))
* clean cache after data import ([5a4dd19](https://github.com/BePing/beping-backends/commit/5a4dd19df99ceb3fc20564aed5c13ee481104c8a))
* clean migration ([71853d3](https://github.com/BePing/beping-backends/commit/71853d328b3cd6f71b0988359b39446014b013ec))
* Correct ranking and rankingWI assignment in members list processing ([a70b2d2](https://github.com/BePing/beping-backends/commit/a70b2d29045ae66c8e587329ae45227d7b4cc660))
* less logs ([188c42e](https://github.com/BePing/beping-backends/commit/188c42eb4dfa38d704952ef4434a8f13db9f0fd6))
* less logs ([59ce24c](https://github.com/BePing/beping-backends/commit/59ce24c9306f7296ee4ad3054e0d7f1d10f59ac7))
* Missing worldRanking ([be03248](https://github.com/BePing/beping-backends/commit/be03248458fac8256bcee7c4f643f99372aa4e11))
* Remove trailing space in log message for sync members on start ([a213118](https://github.com/BePing/beping-backends/commit/a21311889e9e2e1a8ed03f7666788442ca48d602))
* Update rankingLetterEstimation assignment in members list processing ([4810cd1](https://github.com/BePing/beping-backends/commit/4810cd1b844e45a9c135cddf311afcf4080846d6))
* v3 numeric ranking ([8387407](https://github.com/BePing/beping-backends/commit/838740780a378e935301717892c1afa0e8b88419))


### Miscellaneous

* Pin Node.js ([13220c1](https://github.com/BePing/beping-backends/commit/13220c12e6e148286ce49c1fdc918190e831f1f9))
* Update Node.js to 20.17.x ([cf769ee](https://github.com/BePing/beping-backends/commit/cf769ee2012b84aaf78fa7433696c303e40c82ac))
* Update Node.js to 20.18.x ([5dbe010](https://github.com/BePing/beping-backends/commit/5dbe0109164eb001291cd1fcb9e4e2514cdf373d))


### Code Refactoring

* Optimize data import change detection ([c23f671](https://github.com/BePing/beping-backends/commit/c23f671127d83387ca5b769a3d270c2acae2408a))
