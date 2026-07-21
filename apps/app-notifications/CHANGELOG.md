# Changelog

## [2.2.1](https://github.com/BePing/beping-backends/compare/app-notifications-v2.2.0...app-notifications-v2.2.1) (2026-07-21)


### Bug Fixes

* trigger patch releases for all services ([a5d6ebb](https://github.com/BePing/beping-backends/commit/a5d6ebb5e27a7399ffe12f2a3e65c566e3cff7ce))

## [2.2.0](https://github.com/BePing/beping-backends/compare/app-notifications-v2.1.0...app-notifications-v2.2.0) (2026-07-21)


### Features

* expose internal Prometheus metrics ([#1284](https://github.com/BePing/beping-backends/issues/1284)) ([3f63508](https://github.com/BePing/beping-backends/commit/3f63508178904f751e75fbc7e085b5ed1b7ea9e1))

## [2.1.0](https://github.com/BePing/beping-backends/compare/app-notifications-v2.0.0...app-notifications-v2.1.0) (2026-07-05)


### Features

* project hardening + stack modernization ([b0631e7](https://github.com/BePing/beping-backends/commit/b0631e725634f3530a95500f9bb3ce4b57635381))

## [2.0.0](https://github.com/BePing/beping-backends/compare/app-notifications-v1.4.5...app-notifications-v2.0.0) (2026-06-17)


### Miscellaneous

* per-app release versioning + pin prod image tags ([75fcc58](https://github.com/BePing/beping-backends/commit/75fcc5876440694a903881cf87ee88678f110448))
* release 2.0.0 ([27aa649](https://github.com/BePing/beping-backends/commit/27aa649bb00435fa86e50392d3b6758e4d059e90))
* repo hygiene, secrets, and green test/lint baseline ([d8c4260](https://github.com/BePing/beping-backends/commit/d8c4260b0f4d2f386f65328d2ac97e893bea4831))


### Code Refactoring

* extract libs/common; remove cross-app import + duplication ([5443afb](https://github.com/BePing/beping-backends/commit/5443afbc9192f88288dcf7d02389b66525aec30e))


### Build System

* **docker:** slim runtime images ~37% and split migrations into an init image ([7c310ef](https://github.com/BePing/beping-backends/commit/7c310ef5ea7c8f55e6924ee4df5ba65b84acfd61))
* normalize Dockerfiles, start scripts, and compose ([7070a4c](https://github.com/BePing/beping-backends/commit/7070a4ce49b9a4af8db27af3332bd2006c166fb0))
* upgrade to Prisma 7, bump deps to latest, migrate npm to pnpm ([a5144cb](https://github.com/BePing/beping-backends/commit/a5144cb17df8502af4ec517fcf2f15920dd7cc53))

## [1.4.5](https://github.com/BePing/beping-backends/compare/app-notifications-v1.4.4...app-notifications-v1.4.5) (2026-01-19)


### Bug Fixes

* update Dockerfiles to include prisma CLI for migrations ([5c5aa9b](https://github.com/BePing/beping-backends/commit/5c5aa9bcc3ea1e21a2d6e481259ef1de4a392755))

## [1.4.4](https://github.com/BePing/beping-backends/compare/app-notifications-v1.4.3...app-notifications-v1.4.4) (2026-01-19)


### Miscellaneous

* update Dockerfiles to copy all application source code for build ([59ad669](https://github.com/BePing/beping-backends/commit/59ad6691c40b6d38161fc5ee994ec3f083d28cf2))

## [1.4.3](https://github.com/BePing/beping-backends/compare/app-notifications-v1.4.2...app-notifications-v1.4.3) (2026-01-19)


### Miscellaneous

* streamline Dockerfiles by removing unnecessary COPY commands ([349f5ac](https://github.com/BePing/beping-backends/commit/349f5ac091180ea54903565bc2b23e81237f3bf8))

## [1.4.2](https://github.com/BePing/beping-backends/compare/app-notifications-v1.4.1...app-notifications-v1.4.2) (2026-01-19)


### Miscellaneous

* update Dockerfiles and .dockerignore for improved build efficiency ([15ccd98](https://github.com/BePing/beping-backends/commit/15ccd98e1796ec1e61ff148010d6d4b46aa761a2))

## [1.4.1](https://github.com/BePing/beping-backends/compare/app-notifications-v1.4.0...app-notifications-v1.4.1) (2026-01-04)


### Bug Fixes

* add missing line in README.md and update package.json description ([4248d59](https://github.com/BePing/beping-backends/commit/4248d591a742a44847c0ff3fd1f6f9f23435c9fd))

## [1.4.0](https://github.com/BePing/beping-backends/compare/app-notifications-v1.3.2...app-notifications-v1.4.0) (2026-01-04)


### Features

* integrate OpenAI for AI-powered notifications and enhance subscription management ([95effc2](https://github.com/BePing/beping-backends/commit/95effc21aa9605e57630403b00463dbfbc4b59d5))
* upgrade NestJS dependencies and enhance caching mechanisms ([db3e15a](https://github.com/BePing/beping-backends/commit/db3e15a7ed347ff3f0ec74a8a28e7b0ec35ce7a8))


### Code Refactoring

* update cache service tests and improve caching logic ([055166a](https://github.com/BePing/beping-backends/commit/055166a85c0e2c9506a94340f179aae1f6ae2ff4))

## [1.3.2](https://github.com/BePing/beping-backends/compare/app-notifications-v1.3.1...app-notifications-v1.3.2) (2025-12-10)


### Miscellaneous

* add Prisma configuration and update Dockerfiles to use Prisma 5.20.0 ([4d76f5e](https://github.com/BePing/beping-backends/commit/4d76f5e3925c35a9f2c4a3152a0dad7c1fd74412))

## [1.3.1](https://github.com/BePing/beping-backends/compare/app-notifications-v1.3.0...app-notifications-v1.3.1) (2025-12-10)


### Miscellaneous

* update Dockerfiles and GitHub Actions for multi-platform support ([006b7db](https://github.com/BePing/beping-backends/commit/006b7dbeba623d07ed0a8c9cfa3539aa9ba12136))

## [1.3.0](https://github.com/BePing/beping-backends/compare/app-notifications-v1.2.4...app-notifications-v1.3.0) (2025-12-10)


### Features

* integrate Google Generative AI for dynamic notification content ([2817445](https://github.com/BePing/beping-backends/commit/2817445215dcdbe96ebb95b5ae2759054fa36f3e))

## [1.2.4](https://github.com/BePing/beping-backends/compare/app-notifications-v1.2.3...app-notifications-v1.2.4) (2025-11-17)


### Bug Fixes

* update individual match result properties and enhance head2head service logging ([53734b4](https://github.com/BePing/beping-backends/commit/53734b4776448abb786ddf51977736ab1edfbedc))

## [1.2.3](https://github.com/BePing/beping-backends/compare/app-notifications-v1.2.2...app-notifications-v1.2.3) (2025-09-22)


### Code Refactoring

* clean up code formatting and improve readability across multiple files ([364be1e](https://github.com/BePing/beping-backends/commit/364be1e03cddc2678ff83d14d7513e2ad5f23ec7))

## [1.2.2](https://github.com/BePing/beping-backends/compare/app-notifications-v1.2.1...app-notifications-v1.2.2) (2025-09-13)


### Bug Fixes

* update database readiness check in startup scripts for app-notifications, data-aftt-importer, and tabt-rest ([45e0cbd](https://github.com/BePing/beping-backends/commit/45e0cbd1d245c1ce85bd47efb7461563ecb674cd))

## [1.2.1](https://github.com/BePing/beping-backends/compare/app-notifications-v1.2.0...app-notifications-v1.2.1) (2025-09-13)


### Code Refactoring

* update Dockerfiles and startup scripts for app-notifications and tabt-rest ([8195fd5](https://github.com/BePing/beping-backends/commit/8195fd503c76b6557309ee907e27b3ef1d61a78f))

## [1.2.0](https://github.com/BePing/beping-backends/compare/app-notifications-v1.1.2...app-notifications-v1.2.0) (2025-09-13)


### Features

* implement data import optimizations for small VPS environments ([efdc414](https://github.com/BePing/beping-backends/commit/efdc41451e72060d138bb50d3fc1ccc106f1ffa7))

## [1.1.2](https://github.com/BePing/beping-backends/compare/app-notifications-v1.1.1...app-notifications-v1.1.2) (2025-09-13)


### Code Refactoring

* update Dockerfiles for app-notifications, data-aftt-importer, and tabt-rest ([e180617](https://github.com/BePing/beping-backends/commit/e180617c1cb19a65d1128b4a9d46461724d1fb08))

## [1.1.1](https://github.com/BePing/beping-backends/compare/app-notifications-v1.1.0...app-notifications-v1.1.1) (2025-09-13)


### Code Refactoring

* update Dockerfiles for app-notifications, data-aftt-importer, and tabt-rest ([13ae946](https://github.com/BePing/beping-backends/commit/13ae9462dff2964f1b50ef0fb5a521eb9c48d33c))

## [1.1.0](https://github.com/BePing/beping-backends/compare/app-notifications-v1.0.0...app-notifications-v1.1.0) (2025-09-13)


### Features

* fix ([baa8901](https://github.com/BePing/beping-backends/commit/baa8901457a3959e1b862e29a51250c322d813f5))
* Introduce App Notifications Service and FCM Integration ([951cbfb](https://github.com/BePing/beping-backends/commit/951cbfb6ac5a5d0dcab389f7920b35f2588b0518))
* update types ([dae5d81](https://github.com/BePing/beping-backends/commit/dae5d81ece1b3d88a0de56cd7cc689599dc5458b))


### Bug Fixes

* clean DTOs ([1c36ada](https://github.com/BePing/beping-backends/commit/1c36ada374c6a4f677abef95463fd9de4da16f18))
* v3 numeric ranking ([2608546](https://github.com/BePing/beping-backends/commit/26085469b1908a604a6132b4d3ad7158135c3930))


### Miscellaneous

* Update Node.js to v20.18.0 ([#993](https://github.com/BePing/beping-backends/issues/993)) ([b44e898](https://github.com/BePing/beping-backends/commit/b44e898926860a2ba1e40214779d2a267e2e1b1f))
