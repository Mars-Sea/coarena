// Only plugin-owned words are translated; service error codes/messages stay intact.
const zh = {
  daily: "每日模型额度", requests: "每日请求次数", rate: "速率限制", request: "额度申请",
  free: "免费每日额度", granted: "获批每日额度", plan: "每日额度",
  unknown: "未知", used: "已用", held: "预占", left: "剩余", unavailable: "无可用额度", requestUnit: "次",
  keyRate: "次/分钟（每 Key）", accountRate: "次/分钟（每账号）", modelRate: "次/分钟（每模型）", concurrency: "并发请求",
  requestStatus: "申请状态：", statuses: { pending: "待审核", granted: "已批准", declined: "已拒绝", withdrawn: "已撤回" },
  requestID: "请求 ID", retry: "Retry-After", reset: "重置时间",
  cancelled: "额度读取已取消", timedOut: "额度读取超时", readFailed: "无法读取额度（网络或响应格式错误）",
  advice: {
    expired: "请重新输入 Coarena API 密钥。", conflicting: "请检查是否存在冲突的鉴权请求头。",
    scope: "请检查该密钥的推理权限。", account: "请检查 Coarena 账号状态。",
    quota: "请等待每日额度重置，或检查账号额度。", rate: "请稍后重试。",
    unavailable: "Coarena 暂时不可用，请稍后重试。", auth: "请检查鉴权配置和服务状态。", other: "请检查 Coarena 账号，或稍后重试。",
  },
}
const en = {
  daily: "Daily model allowance", requests: "Daily requests", rate: "Rate limits", request: "Allowance request",
  free: "Free daily allowance", granted: "Granted daily allowance", plan: "Daily allowance",
  unknown: "unknown", used: "Used", held: "Held", left: "Left", unavailable: "No available allowance", requestUnit: "requests",
  keyRate: "req/min per key", accountRate: "req/min per account", modelRate: "req/min per model", concurrency: "concurrent requests",
  requestStatus: "Request ", statuses: { pending: "pending", granted: "granted", declined: "declined", withdrawn: "withdrawn" },
  requestID: "Request ID", retry: "Retry-After", reset: "Resets at",
  cancelled: "read cancelled", timedOut: "read timed out", readFailed: "could not read limits (network or response format error)",
  advice: {
    expired: "Enter a new Coarena API key.", conflicting: "Check for conflicting authentication headers.",
    scope: "Check this key's inference scopes.", account: "Check your Coarena account status.",
    quota: "Wait for the daily reset or check your account allowance.", rate: "Wait before retrying.",
    unavailable: "Coarena is temporarily unavailable; try later.", auth: "Check authentication and the service status.", other: "Check your Coarena account or try later.",
  },
}
export const words = (language) => language === "en" ? en : zh
