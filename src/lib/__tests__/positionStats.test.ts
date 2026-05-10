import { describe, expect, it } from 'vitest';
import { computeCostBasis } from '../positionStats';
import type { DepotTransaction } from '../../api/types';

// Test-only helper. Builds a valid `DepotTransaction` with sensible
// defaults so the body of each test can focus on the field that matters.
function mkTx(partial: Partial<DepotTransaction>): DepotTransaction {
  return {
    transaction_id: 'TX0',
    depot_id: 'D1',
    isin: 'DE000ABC123',
    booking_date: '2026-01-01',
    transaction_type: 'BUY',
    quantity: 0,
    price: 0,
    amount: 0,
    currency: 'EUR',
    ...partial,
  };
}

describe('computeCostBasis', () => {
  it('returns zero stats when there are no transactions', () => {
    const stats = computeCostBasis([], 0);
    expect(stats).toEqual({
      avgCostPerShare: 0,
      remainingCostBasis: 0,
      realizedPnl: 0,
      salesPnl: 0,
      dividendsPnl: 0,
      unrealizedPnl: 0,
      totalPnl: 0,
      currentQuantity: 0,
      ledgerIncomplete: false,
      oversold: false,
    });
  });

  it('computes weighted-average cost basis across multiple BUYs', () => {
    // 10 @ 100 EUR + 10 @ 120 EUR = 20 shares @ avg 110 EUR
    const txs = [
      mkTx({
        transaction_id: 'A',
        booking_date: '2026-01-01',
        transaction_type: 'BUY',
        quantity: 10,
        price: 100,
        amount: 1000,
      }),
      mkTx({
        transaction_id: 'B',
        booking_date: '2026-02-01',
        transaction_type: 'BUY',
        quantity: 10,
        price: 120,
        amount: 1200,
      }),
    ];
    const stats = computeCostBasis(txs, 2400);
    expect(stats.currentQuantity).toBe(20);
    expect(stats.avgCostPerShare).toBe(110);
    expect(stats.remainingCostBasis).toBe(2200);
    expect(stats.realizedPnl).toBe(0);
    // unrealized = 2400 (current value) - 2200 (cost basis) = +200
    expect(stats.unrealizedPnl).toBe(200);
    expect(stats.totalPnl).toBe(200);
  });

  it('records realized P&L on partial SELL using avg cost', () => {
    // Buy 10 @ 100 (cost 1000), sell 5 @ 130 (proceeds 650).
    // avg = 100, sold_cost = 5 * 100 = 500, realized = 650 - 500 = 150.
    // Remaining: 5 shares, cost basis 500, avg 100.
    const txs = [
      mkTx({
        transaction_id: 'A',
        booking_date: '2026-01-01',
        transaction_type: 'BUY',
        quantity: 10,
        price: 100,
        amount: 1000,
      }),
      mkTx({
        transaction_id: 'B',
        booking_date: '2026-03-01',
        transaction_type: 'SELL',
        quantity: 5,
        price: 130,
        amount: 650,
      }),
    ];
    const stats = computeCostBasis(txs, 600); // 5 * 120 current price
    expect(stats.currentQuantity).toBe(5);
    expect(stats.avgCostPerShare).toBe(100);
    expect(stats.remainingCostBasis).toBe(500);
    expect(stats.realizedPnl).toBe(150);
    // unrealized = 600 - 500 = 100
    expect(stats.unrealizedPnl).toBe(100);
    expect(stats.totalPnl).toBe(250);
  });

  it('treats DIVIDENDs as realized P&L without touching cost basis', () => {
    const txs = [
      mkTx({
        transaction_id: 'A',
        booking_date: '2026-01-01',
        transaction_type: 'BUY',
        quantity: 10,
        price: 100,
        amount: 1000,
      }),
      mkTx({
        transaction_id: 'B',
        booking_date: '2026-06-15',
        transaction_type: 'DIVIDEND',
        quantity: 10,
        price: 0,
        amount: 25,
      }),
    ];
    const stats = computeCostBasis(txs, 1100);
    expect(stats.currentQuantity).toBe(10);
    expect(stats.remainingCostBasis).toBe(1000);
    expect(stats.realizedPnl).toBe(25);
    // Split: dividends are tracked separately from sale-side P&L so
    // the user can map them to Anlage KAP "Kapitalerträge" cleanly.
    expect(stats.dividendsPnl).toBe(25);
    expect(stats.salesPnl).toBe(0);
    expect(stats.unrealizedPnl).toBe(100); // 1100 - 1000
    expect(stats.totalPnl).toBe(125);
  });

  it('splits realised P&L into sales and dividends', () => {
    // Buy 10 @ 100 (cost 1000), receive 30 EUR dividend, then sell 4
    // @ 130 (proceeds 520). Sale-cost = 4 × 100 = 400, salesPnl = 120.
    // Combined realized = 120 + 30 = 150.
    const txs = [
      mkTx({
        transaction_id: 'A',
        booking_date: '2026-01-01',
        transaction_type: 'BUY',
        quantity: 10,
        price: 100,
        amount: 1000,
      }),
      mkTx({
        transaction_id: 'B',
        booking_date: '2026-04-01',
        transaction_type: 'DIVIDEND',
        quantity: 10,
        price: 0,
        amount: 30,
      }),
      mkTx({
        transaction_id: 'C',
        booking_date: '2026-06-01',
        transaction_type: 'SELL',
        quantity: 4,
        price: 130,
        amount: 520,
      }),
    ];
    const stats = computeCostBasis(txs, 720); // 6 × 120 current price
    expect(stats.salesPnl).toBe(120);
    expect(stats.dividendsPnl).toBe(30);
    expect(stats.realizedPnl).toBe(150); // sales + dividends
    expect(stats.currentQuantity).toBe(6);
  });

  it('walks transactions chronologically regardless of input order', () => {
    // Same data as the partial-SELL test but reversed in the input.
    const txs = [
      mkTx({
        transaction_id: 'B',
        booking_date: '2026-03-01',
        transaction_type: 'SELL',
        quantity: 5,
        price: 130,
        amount: 650,
      }),
      mkTx({
        transaction_id: 'A',
        booking_date: '2026-01-01',
        transaction_type: 'BUY',
        quantity: 10,
        price: 100,
        amount: 1000,
      }),
    ];
    const stats = computeCostBasis(txs, 600);
    expect(stats.realizedPnl).toBe(150);
    expect(stats.currentQuantity).toBe(5);
  });

  it('flags ledger-incomplete when a SELL precedes any BUY', () => {
    const txs = [
      mkTx({
        transaction_id: 'A',
        booking_date: '2026-01-01',
        transaction_type: 'SELL',
        quantity: 5,
        price: 100,
        amount: 500,
      }),
    ];
    const stats = computeCostBasis(txs, 0);
    expect(stats.ledgerIncomplete).toBe(true);
    // Realized still records the proceeds so the user sees something.
    expect(stats.realizedPnl).toBe(500);
    expect(stats.currentQuantity).toBe(0);
  });

  it('flags oversold when SELL quantity exceeds prior BUY quantity', () => {
    const txs = [
      mkTx({
        transaction_id: 'A',
        booking_date: '2026-01-01',
        transaction_type: 'BUY',
        quantity: 5,
        price: 100,
        amount: 500,
      }),
      mkTx({
        transaction_id: 'B',
        booking_date: '2026-02-01',
        transaction_type: 'SELL',
        quantity: 10, // tries to sell more than held
        price: 110,
        amount: 1100,
      }),
    ];
    const stats = computeCostBasis(txs, 0);
    expect(stats.oversold).toBe(true);
    // Oversold path also flips ledgerIncomplete so the UI keeps
    // surfacing the warning even when no SELL-before-BUY happened.
    expect(stats.ledgerIncomplete).toBe(true);
    expect(stats.currentQuantity).toBe(0);
  });

  it('pro-rates oversold SELL proceeds to the held share (no inflated P&L)', () => {
    // Bug pin (FC1 from the finance review): depot loaded mid-stream,
    // earlier BUYs are missing, so the SELL-side `quantity` exceeds
    // the running held-quantity. Old code capped `sellQty` to the
    // held quantity but still credited the *full* `amount` proceeds
    // against the held-slice cost — synthesising a phantom gain.
    //
    // Scenario from the brief: BUY 5 @ 50 EUR (total 250), then a
    // SELL of 10 @ 110 EUR (total 1100). Only 5 of those 10 sold
    // shares are accounted for in our window.
    //   avg_per_share        = 250 / 5             = 50
    //   sold_cost (held)     = 50 × 5              = 250
    //   buggy realized       = 1100 − 250          = 850   ← inflated
    //   pro-rated proceeds   = 1100 × 5 / 10       = 550
    //   correct realized     = 550 − 250           = 300
    const txs = [
      mkTx({
        transaction_id: 'A',
        booking_date: '2026-01-01',
        transaction_type: 'BUY',
        quantity: 5,
        price: 50,
        amount: 250,
      }),
      mkTx({
        transaction_id: 'B',
        booking_date: '2026-02-01',
        transaction_type: 'SELL',
        quantity: 10,
        price: 110,
        amount: 1100,
      }),
    ];
    const stats = computeCostBasis(txs, 0);
    // Hard pin: NOT the old buggy 850 figure.
    expect(stats.realizedPnl).not.toBe(850);
    // Pro-rated formula: (1100 * 5/10) − (5 * 50) = 550 − 250 = 300.
    expect(stats.realizedPnl).toBe(300);
    expect(stats.oversold).toBe(true);
    // Oversold path keeps `ledgerIncomplete` true so the UI's
    // "incomplete history" warning stays visible.
    expect(stats.ledgerIncomplete).toBe(true);
    expect(stats.currentQuantity).toBe(0);
  });

  it('ignores OTHER transactions', () => {
    const txs = [
      mkTx({
        transaction_id: 'A',
        booking_date: '2026-01-01',
        transaction_type: 'BUY',
        quantity: 10,
        price: 100,
        amount: 1000,
      }),
      mkTx({
        transaction_id: 'B',
        booking_date: '2026-02-01',
        transaction_type: 'OTHER',
        quantity: 1,
        price: 999,
        amount: 999,
      }),
    ];
    const stats = computeCostBasis(txs, 1000);
    expect(stats.currentQuantity).toBe(10);
    expect(stats.remainingCostBasis).toBe(1000);
    expect(stats.realizedPnl).toBe(0);
  });
});
