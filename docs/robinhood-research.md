# Robinhood Chain Testnet integration notes

Checked on 2026-10-10 against the [official Robinhood Chain connection guide](https://docs.robinhood.com/chain/connecting/) and the live public RPC.

| Property | Testnet value |
| --- | --- |
| Chain ID | `46630` (hex `0xb626`) |
| Native currency | ETH, 18 decimals |
| Public RPC | `https://rpc.testnet.chain.robinhood.com` |
| Explorer | `https://explorer.testnet.chain.robinhood.com` |

The live `eth_chainId` response from the documented RPC was `0xb626`. Robinhood's docs identify the public RPC as rate-limited; configure `ROBINHOOD_RPC_URLS` with a provider endpoint when this app needs more throughput.

## Activity retrieval

Robinhood Chain is an EVM chain and uses ETH as its native currency. Arc's EIP-7708 system emitter is not used to infer Robinhood transfers.

Standard JSON-RPC has no query for “all transactions involving this address.” Native top-level ETH transfers are indexed from the explorer's address transaction endpoint, and successful internal ETH value transfers are indexed from its internal transaction endpoint. The adapter ignores zero-value, failed, self, `delegatecall`, and `staticcall` rows.

ERC-20 activity comes from the explorer's address token-transfer endpoint, restricted to `ERC-20`. This endpoint indexes standard `Transfer(address,address,uint256)` contract logs and includes the emitting token address, raw value, decimals, symbol, log index, block, and timestamp. The provider follows the endpoint's pagination until it reaches the requested block range, and errors if its configured page cap would make the result incomplete.

The RPC and explorer indexer can be at different heads. Before building a report, ArcLens caps the report's last block to the lower of the RPC head and latest indexed explorer block. Current balance and nonce remain live RPC reads. ETH and each ERC-20 token are analyzed separately in their own units; testnet balances and token amounts are not presented as dollars.

Explorer API paths used by the provider:

- `/api/v2/blocks`
- `/api/v2/addresses/{address}/transactions`
- `/api/v2/addresses/{address}/internal-transactions`
- `/api/v2/addresses/{address}/token-transfers?type=ERC-20`

The testnet explorer serves these endpoints on the official explorer host. `ROBINHOOD_EXPLORER_API_URL` can point to another compatible Blockscout v2 indexer.
