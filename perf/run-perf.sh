#!/bin/sh
# Re-run perf benches and compare against perf/baseline.json (see run-perf.mjs).
set -e
cd "$(dirname "$0")/.."
exec node perf/run-perf.mjs "$@"
