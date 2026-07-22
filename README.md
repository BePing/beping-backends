# TabT-Rest 
![Coverage:branches](./.badges/badge-branches.svg)
![Coverage:functions](./.badges/badge-functions.svg)
![Coverage:lines](./.badges/badge-lines.svg)
![Coverage:statements](./.badges/badge-statements.svg)
[![GPLv3 license](https://img.shields.io/badge/License-GPLv3-blue.svg)](http://perso.crans.org/besson/LICENSE.html)

This api is a bridge to the TabT SOAP API. It contacts TabT and cache results in order to reduce latency for some requests. More documentation will come.

## Prerequisites

- Node.js 26
- pnpm 11

## Installation

```bash
$ git clone https://github.com/Fllorent0D/TabT-Rest.git
$ corepack enable
$ pnpm install
```

Create your own environment file (`.env`) from the `.env.example`

## Running the app

```bash
# development
$ pnpm run start:tabt-rest

# watch mode
$ pnpm run start:dev:tabt-rest

# production mode
$ pnpm run start:prod:tabt-rest
```

## Test

```bash
# unit tests
$ pnpm test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:coverage
```
### Start with pm2

```sh
pm2 start tabt-rest-pm2.json
```

## Release History

* 1.0.0
    * First complete implementation with OpenApi specs.
* 1.0.1
    * OpenApi operationId.
* 1.0.2
    * Bug fixes 
* 1.0.3
    * Align with Tabt 0.7.24
* 1.0.4
    * Disable automatic conversation for DTOs

## Meta

Cardoen Florent – [@Fllorent0D](https://twitter.com/fllorent0D) – f.cardoen@me.com

## Contributing

1. Fork it (<https://github.com/Fllorent0D/Tabt-Rest>)
2. Create your feature branch (`git checkout -b feature/fooBar`)
3. Commit your changes (`git commit -am 'Add some fooBar'`)
4. Push to the branch (`git push origin feature/fooBar`)
5. Create a new Pull Request
