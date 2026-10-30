import type { LocalMessage } from './local-store';
export interface AISettings { endpoint: string; model: string; apiKey: string }
export function validateEndpoint(endpoint: string): string {
  const url = new URL(endpoint);
  if (url.username || url.password || url.search || url.hash) throw new Error('API 地址不能含账号、查询参数或片段');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('仅允许 HTTPS 或本机 localhost HTTP 地址');
  return url.toString().replace(/\/$/, '');
}
export async function askAI(settings: AISettings, context: unknown, messages: LocalMessage[], signal: AbortSignal): Promise<string> {
  const endpoint = validateEndpoint(settings.endpoint);
  if (!settings.model.trim()) throw new Error('请填写模型名称');
  const response = await fetch(endpoint, {
    method: 'POST', signal, credentials: 'omit', redirect: 'error',
    headers: { 'Content-Type': 'application/json', ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}) },
    body: JSON.stringify({ model: settings.model.trim(), stream: false, messages: [
      { role: 'system', content: '你是紫微斗数文化学习助手。仅依据提供的命盘讨论传统解释，明确不确定性，不声称确定预测或专业医疗、法律、金融建议。此为独立开源个人工具，不代表商业站专业版。命盘：' + JSON.stringify(context) },
      ...messages,
    ] }),
  });
  if (!response.ok) throw new Error(`模型服务返回 HTTP ${response.status}；请检查地址、模型、额度和 Key`);
  const data = await response.json();
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim() || answer.length > 50000) throw new Error('模型响应格式无效、内容为空或过长');
  return answer;
}
