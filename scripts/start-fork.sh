#!/bin/bash
set -euo pipefail

RPC_URL="${RPC_URL:?RPC_URL is required}"
FORK_BLOCK="${FORK_BLOCK:+-f $(printf '%d' "$FORK_BLOCK")}"

echo "Starting anvil fork of ${RPC_URL} at block ${FORK_BLOCK:-latest}"
anvil --fork-url "${RPC_URL}" ${FORK_BLOCK} --host 0.0.0.0 --port 8545
