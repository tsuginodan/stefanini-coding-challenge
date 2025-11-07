# Coding challenge


OpenAPI available in `docs/openapi.yaml`.

Includes the URL to hit for.


## TODO

- [x] Add tests
  - Added basic tests
- [x] Ensure env vars are validated
  - [ ] how to use `middy` for main lambda handlers (the one that routes two http endpoints and one sqs handler)?
  - `serverless-offline` takes env vars as '[object Object]', there is a solution tho, but it's out of scope for now
- [x] Replace console logging for `winston` logger
- [ ] Add more tests and code coverage
- [ ] Work on code refactors opportunities