/**
 * Cost basis + realized/unrealized P&L computed client-side from a
 * position's DepotTransaction list.
 *
 * Method: **weighted-average cost basis**, applied chronologically.
 * Reasoning:
 *   1. The backend does not store a per-lot cost basis (see
 *      `DepotTransaction` in src/core/db/models.py) — there are no
 *      separate fee or settlement columns either, so a per-share FIFO
 *      ledger would be reconstructing data we don't have.
 *   2. Comdirect's `transactionValue` (mapped to `amount`) already
 *      bundles fees into the cash impact, so weighted-average over
 *      `amount / quantity` for BUYs gives a faithful break-even price.
 *   3. For partial SELLs we reduce remaining quantity and remaining
 *      cost-basis proportionally — this is mathematically equivalent
 *      to FIFO when buys are at a single price, and the canonical
 *      simplification when they aren't.
 *
 * Conventions:
 *   * `amount` is **positive** in all transaction types as ingested
 *     (Comdirect returns the absolute transaction value).
 *   * Realized P&L on a SELL is
 *         proceeds − (avg_cost_per_share × sold_quantity)
 *     where `proceeds = amount` and `avg_cost_per_share` is the
 *     weighted-average cost across all preceding BUYs net of any
 *     prior SELLs.
 *   * DIVIDENDs are added to realized P&L without touching cost basis.
 *   * Unrealized P&L is `current_value − remaining_cost_basis`, where
 *     `remaining_cost_basis = avg_cost_per_share × current_quantity`.
 *   * OTHER (splits, transfers-in/out, fees not classified elsewhere)
 *     are ignored — without explicit semantics in the source data,
 *     applying them blindly would introduce silent corruption. They
 *     show up in the table so the user can spot them.
 */
import type { DepotTransaction } from '../api/types';

export type CostBasisStats = {
  /** Average cost per share across all BUYs net of SELL-share reductions. */
  avgCostPerShare: number;
  /** Σ(BUY amount) − Σ(SELL share-cost). Decreases as shares are sold. */
  remainingCostBasis: number;
  /**
   * salesPnl + dividendsPnl. Kept as the canonical "realised" figure
   * so callers that don't care about the split keep working.
   */
  realizedPnl: number;
  /**
   * Σ(SELL proceeds) − Σ(SELL share-cost). Maps to Anlage KAP "Gewinn
   * aus Veräußerung" (line 7 / 9, depending on instrument type) once
   * the user reconciles against the FIFO figure on the
   * Jahressteuerbescheinigung.
   */
  salesPnl: number;
  /**
   * Σ(DIVIDEND amount). Maps to Anlage KAP "Kapitalerträge" (line 7)
   * — pre-tax / brutto in the Comdirect feed.
   */
  dividendsPnl: number;
  /** current_value − remainingCostBasis (only when shares are held). */
  unrealizedPnl: number;
  /** realizedPnl + unrealizedPnl. */
  totalPnl: number;
  /** Net BUY − SELL quantity walked through the chronology. */
  currentQuantity: number;
  /**
   * True when the dataset is missing earlier transactions — either a
   * SELL appeared before any BUY, or a SELL exceeded the running
   * held-quantity (see `oversold`). Both indicate the cost basis is
   * reconstructed from an incomplete ledger and the numbers should
   * be shown with a warning.
   */
  ledgerIncomplete: boolean;
  /**
   * True when the running quantity drops below zero on a SELL — set
   * alongside `ledgerIncomplete` and kept distinct so the UI can
   * phrase the warning specifically (more shares sold than ever
   * bought in the visible window).
   */
  oversold: boolean;
};

export function computeCostBasis(
  txs: DepotTransaction[],
  currentValue: number,
): CostBasisStats {
  // Walk in chronological order — the backend returns desc, so sort a
  // copy. Stable-sort by booking_date then transaction_id for
  // deterministic results when multiple txs share a day.
  const ordered = [...txs].sort((a, b) => {
    if (a.booking_date !== b.booking_date) {
      return a.booking_date < b.booking_date ? -1 : 1;
    }
    return a.transaction_id < b.transaction_id ? -1 : 1;
  });

  let qty = 0;
  let remainingCost = 0;
  let salesPnl = 0;
  let dividendsPnl = 0;
  let ledgerIncomplete = false;
  let oversold = false;

  for (const tx of ordered) {
    const txQty = Number(tx.quantity);
    const txAmount = Number(tx.amount);
    if (tx.transaction_type === 'BUY') {
      qty += txQty;
      remainingCost += txAmount;
    } else if (tx.transaction_type === 'SELL') {
      if (qty <= 0) {
        // Selling without a prior BUY in the dataset — happens when
        // the depot was loaded mid-stream. Skip cost reduction so
        // realized P&L isn't bogus, but flag the inconsistency.
        ledgerIncomplete = true;
        salesPnl += txAmount;
        continue;
      }
      const sellQty = Math.min(txQty, qty);
      const avgPerShare = remainingCost / qty;
      const soldCost = avgPerShare * sellQty;
      if (sellQty < txQty) {
        // Oversold path: the depot was loaded mid-stream and earlier
        // BUYs are missing, so we only own `sellQty` of the `txQty`
        // shares the user is reporting as sold. Pro-rate proceeds to
        // the held share — otherwise we'd credit the *full* sale
        // amount against the cost of just the held slice and inflate
        // realized P&L. Also flag `ledgerIncomplete` so the warning
        // in the UI keeps surfacing the uncertainty.
        oversold = true;
        ledgerIncomplete = true;
        const proceedsForHeldShare = (txAmount * sellQty) / txQty;
        salesPnl += proceedsForHeldShare - soldCost;
      } else {
        salesPnl += txAmount - soldCost;
      }
      remainingCost -= soldCost;
      qty -= sellQty;
    } else if (tx.transaction_type === 'DIVIDEND') {
      dividendsPnl += txAmount;
    }
    // OTHER: deliberately ignored — see method note above.
  }

  const avgCostPerShare = qty > 0 ? remainingCost / qty : 0;
  const unrealized = qty > 0 ? currentValue - remainingCost : 0;
  const realized = salesPnl + dividendsPnl;
  return {
    avgCostPerShare,
    remainingCostBasis: remainingCost,
    realizedPnl: realized,
    salesPnl,
    dividendsPnl,
    unrealizedPnl: unrealized,
    totalPnl: realized + unrealized,
    currentQuantity: qty,
    ledgerIncomplete,
    oversold,
  };
}
