import type { LocalMessage } from './local-store';
export interface AISettings { endpoint: string; model: string; apiKey: string }
/** Accept a provider base URL or its full OpenAI-compatible endpoint. Never use site membership or platform credits. */
export function validateEndpoint(endpoint: string): string {
  let url: URL;
  try { url = new URL(endpoint.trim()); } catch { throw new Error('请填写有效的 API Base URL 或完整接口地址'); }
  if (url.username || url.password || url.search || url.hash) throw new Error('API 地址不能含账号、查询参数或片段');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('仅允许 HTTPS 或本机 localhost HTTP 地址');
  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = path.endsWith('/chat/completions') ? path : path.endsWith('/v1') ? `${path}/chat/completions` : `${path}/v1/chat/completions`;
  return url.toString();
}
export function validateAISettings(settings: AISettings): { endpoint: string; model: string; apiKey: string } {
  const endpoint = validateEndpoint(settings.endpoint), model = settings.model.trim(), apiKey = settings.apiKey.trim();
  if (!model) throw new Error('请填写模型名称');
  if (!apiKey) throw new Error('请先填写你自己的 API Key；本工具不提供平台额度或会员接口');
  if (apiKey.length > 4000 || /[\x00-\x1f\x7f]/.test(apiKey)) throw new Error('API Key 格式无效，请重新填写');
  return { endpoint, model, apiKey };
}
export async function askAI(settings: AISettings, context: unknown, messages: LocalMessage[], signal: AbortSignal): Promise<string> {
  const {endpoint, model, apiKey} = validateAISettings(settings);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST', signal, credentials: 'omit', redirect: 'error',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, stream: false, messages: [
        { role: 'system', content: '你是紫微斗数文化学习助手。仅依据提供的命盘讨论传统解释，明确不确定性，不声称确定预测或专业医疗、法律、金融建议。此为独立开源个人工具，不代表商业站专业版。命盘：' + JSON.stringify(context) },
        ...messages,
      ] }),
    });
  } catch {
    // Do not expose provider, fetch, or proxy error text: it may contain credentials.
    throw new Error(signal.aborted ? '模型请求已取消' : '无法连接模型服务，请检查网络、地址与 CORS 设置');
  }
  if (!response.ok) throw new Error(`模型服务返回 HTTP ${response.status}；请检查地址、模型、额度和 Key`);
  let data;
  try { data = await response.json(); } catch { throw new Error('模型响应不是有效 JSON，请检查接口类型'); }
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim() || answer.length > 50000) throw new Error('模型响应格式无效、内容为空或过长');
  return answer;
}
