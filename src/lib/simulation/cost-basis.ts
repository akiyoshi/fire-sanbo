/**
 * 課税対象口座の取得費（costBasis）を追跡する。
 * balance と cost をペアで管理し、含み益率を動的に算出する。
 *
 * - 積立: 新規資金は含み益0%（全額がcostBasis）
 * - リターン: costBasis不変（残高のみ変動、含み益率が自然に上昇）
 * - 取り崩し/売却: costBasisを按分で減少
 */
export class CostBasis {
  cost: number;

  constructor(balance: number, gainRatio: number) {
    this.cost = balance * (1 - gainRatio);
  }

  /** 現在の含み益率（0〜1）。含み損の場合は0を返す */
  gainRatio(balance: number): number {
    return balance > 0 ? Math.max(0, 1 - this.cost / balance) : 0;
  }

  /** 積立・退職金投入: 新規資金は全額が取得費 */
  contribute(amount: number): void {
    this.cost += amount;
  }

  /** 取り崩し・売却: 取得費を按分で減少 */
  withdraw(amount: number, balance: number): void {
    if (balance > 0) {
      this.cost = Math.max(0, this.cost - amount * (this.cost / balance));
    }
  }
}
