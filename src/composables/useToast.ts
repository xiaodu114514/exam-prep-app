import { reactive } from 'vue'
import type { ToastType } from '../types'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
}

// 模块级单例，全局共享同一条 Toast 队列
let seq = 0
const toasts = reactive<ToastItem[]>([])

const DURATION = 2600

export function useToast() {
  function show(message: string, type: ToastType = 'success'): void {
    const id = ++seq
    toasts.push({ id, message, type })
    setTimeout(() => {
      const i = toasts.findIndex((t) => t.id === id)
      if (i >= 0) toasts.splice(i, 1)
    }, DURATION)
  }

  function success(message: string): void {
    show(message, 'success')
  }

  function error(message: string): void {
    show(message, 'error')
  }

  function info(message: string): void {
    show(message, 'info')
  }

  function dismiss(id: number): void {
    const i = toasts.findIndex((t) => t.id === id)
    if (i >= 0) toasts.splice(i, 1)
  }

  return { toasts, show, success, error, info, dismiss }
}
