// BTC momentum bot for the make.fun bars-replay race (agent-fun/bars-replay/v1).
//
// Strategy, in plain words: this bot reads one bar per batch from the hello
// handshake's single symbol (CBBTC), keeps the recent closes, and only sends
// orders when a short burst of momentum is large enough to plausibly pay for
// the round trip (fees, slippage and price impact together cost roughly
// 26 bps on a full-size trade).
//
// Rules:
// - Entry: when flat, the close has risen more than ENTRY_BPS over the last
//   LOOKBACK bars, we have entries left, and the cooldown since the last exit
//   has passed, buy with SIZE_PCT of the cash on hand.
// - Take-profit exit: sell the whole position when it is more than TAKE_BPS
//   over its cost at a bar close, banking a strong move outright.
// - Protective exit: sell the whole position when it is more than STOP_BPS
//   under its cost at a bar close.
// - Trailing exit: once a position is more than ARM_BPS in profit, sell the
//   whole position when the close falls more than TRAIL_BPS below the highest
//   close seen while holding it. This locks in a real move instead of riding
//   it all the way back down.
// - Otherwise hold. No exit on weak momentum alone: on a choppy day that just
//   pays the spread again and again.
//
// Everything is deterministic: only the bars in each batch drive decisions,
// never the wall clock, the network or any file. Each reply carries at most
// one order, well under the protocol cap, with a 100 bps slippage guard.

import { runBars } from './vendor/makefun-bars.ts';

const LOOKBACK = 20; // bars of momentum to measure (20 one-minute bars)
const ENTRY_BPS = 12n; // enter only when 20-bar momentum exceeds this
const TAKE_BPS = 130n; // take profit: exit at this gain versus cost
const STOP_BPS = 175n; // hard stop: exit at this loss versus cost
const ARM_BPS = 75n; // trailing exit arms at this profit versus cost
const TRAIL_BPS = 30n; // then exit on this fall from the peak close
const SIZE_PCT = 100n; // spend this percent of cash on an entry
const MAX_ENTRIES = 2; // at most this many separate entries per window
const COOLDOWN = 30; // bars to wait after an exit before re-entering
const MAX_SLIPPAGE_BPS = 100;
const SYMBOL = 'CBBTC';

const closes: bigint[] = []; // every close seen, in order
let entriesMade = 0;
let barsSinceExit = Number.MAX_SAFE_INTEGER;
let peakClose: bigint | null = null; // highest close while holding

await runBars({
  onBatch(state, batch) {
    // Fold this batch in: one bar per minute for our symbol.
    let fresh = false;
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) {
        closes.push(BigInt(bar.c));
        fresh = true;
      }
    }
    if (!fresh || state.warmingUp) return [];

    const held = state.positions.get(SYMBOL);
    const price = state.close(SYMBOL);
    if (price === null) return [];

    if (held === undefined) {
      peakClose = null;
      barsSinceExit += 1;
    } else if (peakClose === null || price > peakClose) {
      peakClose = price;
    }

    // Exit first: a held position with a triggered stop or trailing exit
    // sells in full on this bar, filling at the next bar's open.
    if (held !== undefined) {
      const value = state.value(SYMBOL, held.qty);
      if (held.cost > 0n && value > 0n) {
        const pnlBps = (value * 10000n) / held.cost - 10000n;
        if (pnlBps >= TAKE_BPS) {
          barsSinceExit = 0;
          return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
        }
        if (pnlBps <= -STOP_BPS) {
          barsSinceExit = 0;
          return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
        }
        if (pnlBps >= ARM_BPS && peakClose !== null && peakClose > 0n) {
          const fallBps = (price * 10000n) / peakClose - 10000n;
          if (fallBps <= -TRAIL_BPS) {
            barsSinceExit = 0;
            return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
          }
        }
      }
      return [];
    }

    // Entry: strong short momentum, entries left, cooldown served.
    if (entriesMade >= MAX_ENTRIES || barsSinceExit <= COOLDOWN) return [];
    if (closes.length <= LOOKBACK) return [];
    const base = closes[closes.length - 1 - LOOKBACK];
    if (base <= 0n) return [];
    const momentumBps = (price * 10000n) / base - 10000n;
    if (momentumBps <= ENTRY_BPS) return [];
    const spend = (state.cash * SIZE_PCT) / 100n;
    if (spend < 1_000_000n) return []; // the replay's 1 USDC minimum notional
    entriesMade += 1;
    peakClose = price;
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  },
});
