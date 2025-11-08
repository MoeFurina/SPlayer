/**
 * 窗口拖动 RAF 批处理优化工具
 * 
 * 用于优化 Electron 窗口拖动性能:
 * - 使用 requestAnimationFrame 批处理高频 mousemove 事件
 * - 将 IPC 调用频率从 100-200次/秒 降低到 60次/秒
 * - 减少主进程负载和 DWM 合成次数
 * 
 * @example
 * const dragOptimizer = useWindowDragOptimization();
 * 
 * // 拖动开始
 * dragOptimizer.reset();
 * 
 * // 拖动过程中
 * dragOptimizer.accumulateDelta(deltaX, deltaY, (dx, dy) => {
 *   sendIpc("window-move", { deltaX: dx, deltaY: dy });
 * });
 * 
 * // 拖动结束
 * dragOptimizer.flush((dx, dy) => {
 *   sendIpc("window-move", { deltaX: dx, deltaY: dy });
 * });
 */
export function useWindowDragOptimization() {
  // 累积的 delta 值
  let pendingDeltaX = 0;
  let pendingDeltaY = 0;
  
  // requestAnimationFrame ID
  let rafId = null;

  /**
   * 累积拖动 delta 并使用 RAF 批处理发送
   * 
   * @param {number} deltaX - X 轴移动距离
   * @param {number} deltaY - Y 轴移动距离
   * @param {Function} sendCallback - 发送回调函数 (deltaX, deltaY) => void
   */
  const accumulateDelta = (deltaX, deltaY, sendCallback) => {
    // 累积 delta 值
    pendingDeltaX += deltaX;
    pendingDeltaY += deltaY;

    // 如果没有待处理的 RAF,创建一个
    // 这样可以将多个 mousemove 事件的 delta 合并到一个动画帧中
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        // 发送累积的 delta
        sendCallback(pendingDeltaX, pendingDeltaY);
        
        // 重置累积值和 RAF ID
        pendingDeltaX = 0;
        pendingDeltaY = 0;
        rafId = null;
      });
    }
  };

  /**
   * 清理并发送剩余的 delta
   * 
   * 在拖动结束时调用,确保所有累积的 delta 都被发送
   * 
   * @param {Function} sendCallback - 发送回调函数 (deltaX, deltaY) => void
   */
  const flush = (sendCallback) => {
    // 取消待处理的 RAF
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    // 如果还有未发送的 delta,立即发送
    if (pendingDeltaX !== 0 || pendingDeltaY !== 0) {
      sendCallback(pendingDeltaX, pendingDeltaY);
      pendingDeltaX = 0;
      pendingDeltaY = 0;
    }
  };

  /**
   * 重置状态
   * 
   * 在拖动开始时调用,清理之前的状态
   */
  const reset = () => {
    // 取消待处理的 RAF
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    
    // 重置累积值
    pendingDeltaX = 0;
    pendingDeltaY = 0;
  };

  return {
    accumulateDelta,
    flush,
    reset,
  };
}

