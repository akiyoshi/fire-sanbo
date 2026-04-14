import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 金額を万円/億円単位でフォーマット
 * @param n - 金額（円）
 * @param yen - 末尾に「円」を付与するか（デフォルト: false → "万"/"億"）
 */
export function formatManYen(n: number, yen = false): string {
  const man = Math.round(n / 10000);
  const suffix = yen ? "円" : "";
  if (Math.abs(man) >= 10000) {
    const oku = man / 10000;
    return (oku % 1 === 0 ? `${oku}億` : `${oku.toFixed(1)}億`) + suffix;
  }
  return `${man.toLocaleString()}万` + suffix;
}
