/**
 * シード付き疑似乱数生成器 (Mulberry32)
 * 再現性のあるシミュレーション用
 */
export class PRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** 0〜1の一様乱数 */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Box-Muller法で標準正規分布の乱数を生成 */
  normalRandom(): number {
    let u1 = this.next();
    const u2 = this.next();
    // u1が0だとlog(0)=-Infinityになるためガード
    while (u1 === 0) u1 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

/**
 * 対数正規分布のリターンを生成
 * 幾何ブラウン運動: r = exp(μ - σ²/2 + σ*Z) - 1
 */
export function generateLogNormalReturn(
  expectedReturn: number,
  stdDev: number,
  rng: PRNG
): number {
  const mu = Math.log(1 + expectedReturn) - (stdDev * stdDev) / 2;
  const z = rng.normalRandom();
  return Math.exp(mu + stdDev * z) - 1;
}
