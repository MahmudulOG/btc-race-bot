# btc-race-bot

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/MahmudulOG/btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/MahmudulOG/btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A paper-money BTC trading bot for make.fun's "Race a BTC trading bot live
for 24 hours" bounty
([btc-race-24h-20261117-0603](https://make.fun/bounty/btc-race-24h-20261117-0603)).
It trades cbBTC/USDC minute by minute in the `agent-fun/bars-replay/v1`
replay: $1,000 of paper USDC, long only, fills at the next bar's open with
fees, slippage and pool price impact charged by the harness. Nothing real
is traded.

How it works: the bot stays flat by default. It buys only when the close
has risen more than 12 bps over the last 20 one-minute bars — a burst of
momentum large enough to matter next to the roughly 26 bps a full-size
round trip costs — spending all of its cash, at most twice per window, and
only after a 30-bar cooldown since the last exit. A position exits on a
hard stop 175 bps under its cost, or, once it is 75 bps in profit, on a
trailing exit 30 bps below the highest close seen while holding it, so a
real move is locked in rather than ridden back down. Weak momentum alone
never exits: in chop that just pays the spread again and again.

On the frozen dev window shipped with the bounty kit, the local grader
reports net PnL of about +$18.88 on the $1,000 start, 4 trades, and a
maximum drawdown of about 1.73%.

- `main.ts` — the bot: Node 22, standard library only (plus the vendored
  protocol shim), no network, no wall clock, deterministic.
- `vendor/makefun-bars.ts` — a byte-for-byte copy of the kit's SDK shim
  for the bars-replay protocol.

MIT licensed — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=eg9w3128&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
