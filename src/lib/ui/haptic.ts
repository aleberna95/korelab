/** Haptic feedback — no-op if not supported */
export const haptic = {
  tap: () => navigator.vibrate?.(10),
  success: () => navigator.vibrate?.([10, 40, 10]),
  warn: () => navigator.vibrate?.([20, 60, 20, 60]),
}
