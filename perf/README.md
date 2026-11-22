# Perf baselines — wdk (fork)

Perf harness for the core WDK orchestration in `src/wdk.js`: seed validation,
wallet registration, and `getAccount()` protocol decoration + middleware.

No network and no real key derivation: the wallet manager is a fixed fixture
(same pattern as `tests/wdk.test.js`) returning fresh dummy accounts, and the
seed phrase is the public dummy phrase from the repo's own tests.

## Run

```sh
npm install        # once, for @tetherto/wdk-wallet
./perf/run-perf.sh                    # compare vs perf/baseline.json
node perf/run-perf.mjs --write-baseline   # regenerate baseline (only on purpose)
```

Verdict: median regression >10% = warn, >25% = block (exit 1). Baseline
metadata (environment, fork commit) is in `perf/baseline.json`.
