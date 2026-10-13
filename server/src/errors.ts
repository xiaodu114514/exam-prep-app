/** 统一业务错误：由 setErrorHandler 转为对应状态码的 JSON 响应 */
export class AppError extends Error {
  readonly statusCode: number
  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
  }
}

export function badRequest(message: string): AppError {
  return new AppError(400, message)
}

export function unauthorized(message = '未登录或会话已过期'): AppError {
  return new AppError(401, message)
}

export function notFound(message = '资源不存在'): AppError {
  return new AppError(404, message)
}

export function tooManyRequests(message = '尝试次数过多，请稍后再试'): AppError {
  return new AppError(429, message)
}
