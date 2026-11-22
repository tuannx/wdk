// Perf benches for wdk (fork tuannx/wdk).
// Scope: core WDK orchestration in src/wdk.js — seed validation, wallet
// registration and getAccount protocol-decoration + middleware chain.
// No network, no real key derivation: the wallet manager is a fixed in-repo
// fixture (same pattern as tests/wdk.test.js) returning fresh dummy accounts;
// the seed phrase is the public dummy phrase used by the repo's own tests.
// Requires `npm install` once (for @tetherto/wdk-wallet). Warmup/iterations
// are fixed per bench for determinism.
import WDK from '../index.js'

// Public dummy seed phrase from tests/wdk.test.js — not a real wallet.
const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'
const CONFIG = { transferMaxFee: 100, transactionMaxFee: 500 }
const RAW_SEED = new Uint8Array(32).fill(7)

class FakeWalletManager {
  constructor (seed, config) { this.seed = seed; this.config = config }
  async getAccount (index) {
    return { path: `m/44'/60'/0'/0/${index}`, getAddress: async () => '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd' }
  }
  async getAccountByPath (path) {
    return { path, getAddress: async () => '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd' }
  }
  dispose () {}
}

let sink = 0

function freshWdk () {
  const wdk = new WDK(SEED_PHRASE)
  wdk.registerWallet('ethereum', FakeWalletManager, CONFIG)
  return wdk
}
const sharedWdk = freshWdk()
sharedWdk.registerMiddleware('ethereum', async (account) => { sink += account.path.length })

export const benches = [
  {
    name: 'wdk.isValidSeed-phrase',
    scope: 'src/wdk.js WDK.isValidSeed() — BIP-39 phrase validation via @tetherto/wdk-wallet',
    warmup: 500,
    iterations: 5000,
    fn: () => { sink += WDK.isValidSeed(SEED_PHRASE) ? 1 : 0 }
  },
  {
    name: 'wdk.isValidSeed-raw-bytes',
    scope: 'src/wdk.js WDK.isValidSeed() — Uint8Array length check (pure)',
    warmup: 2000,
    iterations: 20000,
    fn: () => { sink += WDK.isValidSeed(RAW_SEED) ? 1 : 0 }
  },
  {
    name: 'wdk.construct+registerWallet',
    scope: 'src/wdk.js new WDK() + registerWallet() with fixture wallet manager',
    warmup: 500,
    iterations: 5000,
    fn: () => { sink += freshWdk()._wallets.size }
  },
  {
    name: 'wdk.getAccount-decorate+middleware',
    scope: 'src/wdk.js getAccount() — fresh account protocol decoration + 1 middleware',
    warmup: 500,
    iterations: 5000,
    fn: async () => { const a = await sharedWdk.getAccount('ethereum', 0); sink += typeof a.getSwapProtocol === 'function' ? 1 : 0 }
  }
]

export function getSink () { return sink }
