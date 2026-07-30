/**
 * OpenAI Chat Completions ↔ Anthropic Messages conversion for 0G Router.
 * Some models (e.g. claude-fable-5) only advertise supported_formats: ["anthropic"].
 */

export type ApiFormat = 'openai' | 'anthropic'

function normalizeFormats(formats?: string[] | null): string[] {
  if (!formats?.length) return []
  return formats.map((f) => f.toLowerCase().trim()).filter(Boolean)
}

export function supportsOpenaiFormat(formats?: string[] | null): boolean {
  return normalizeFormats(formats).includes('openai')
}

export function supportsAnthropicFormat(formats?: string[] | null): boolean {
  return normalizeFormats(formats).includes('anthropic')
}

/**
 * True when the model cannot be called via OpenAI /chat/completions and must
 * use Anthropic /v1/messages instead.
 */
export function requiresAnthropicFormat(formats?: string[] | null): boolean {
  const normalized = normalizeFormats(formats)
  if (!normalized.length) return false
  return normalized.includes('anthropic') && !normalized.includes('openai')
}

/** Detect Router errors that mean "retry on /v1/messages". */
export function isOpenaiFormatMismatchError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('not available on the openai api format') ||
    m.includes('use the matching endpoint') ||
    (m.includes('supported:') && m.includes('anthropic') && !m.includes('openai'))
  )
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function imageUrlToAnthropicSource(url: string): Record<string, unknown> {
  const dataMatch = url.match(/^data:([^;]+);base64,(.+)$/s)
  if (dataMatch) {
    return {
      type: 'base64',
      media_type: dataMatch[1],
      data: dataMatch[2],
    }
  }
  return { type: 'url', url }
}

function openaiContentToAnthropic(
  content: unknown,
): string | Array<Record<string, unknown>> {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return content == null ? '' : String(content)

  const parts: Array<Record<string, unknown>> = []
  for (const part of content) {
    if (!isRecord(part)) continue
    const type = asString(part.type)
    if (type === 'text' && typeof part.text === 'string') {
      parts.push({ type: 'text', text: part.text })
      continue
    }
    if (type === 'image_url' && isRecord(part.image_url)) {
      const url = asString(part.image_url.url)
      if (!url) continue
      parts.push({
        type: 'image',
        source: imageUrlToAnthropicSource(url),
      })
      continue
    }
    // Pass through Anthropic-shaped blocks if a client already sent them.
    if (type === 'image' || type === 'tool_use' || type === 'tool_result') {
      parts.push(part)
    }
  }

  if (parts.length === 0) return ''
  if (parts.length === 1 && parts[0]?.type === 'text') {
    return String(parts[0].text ?? '')
  }
  return parts
}

function mergeAnthropicContent(
  a: string | Array<Record<string, unknown>>,
  b: string | Array<Record<string, unknown>>,
): string | Array<Record<string, unknown>> {
  const toParts = (
    c: string | Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> => {
    if (typeof c === 'string') {
      return c ? [{ type: 'text', text: c }] : []
    }
    return c
  }
  const merged = [...toParts(a), ...toParts(b)]
  if (merged.length === 0) return ''
  if (merged.length === 1 && merged[0]?.type === 'text') {
    return String(merged[0].text ?? '')
  }
  return merged
}

function openaiToolsToAnthropic(tools: unknown): unknown[] | undefined {
  if (!Array.isArray(tools) || tools.length === 0) return undefined
  const out: unknown[] = []
  for (const tool of tools) {
    if (!isRecord(tool)) continue
    if (tool.type === 'function' && isRecord(tool.function)) {
      const fn = tool.function
      out.push({
        name: fn.name,
        description: fn.description,
        input_schema: fn.parameters ?? { type: 'object', properties: {} },
      })
      continue
    }
    // Already Anthropic-shaped
    if (typeof tool.name === 'string' && tool.input_schema) {
      out.push(tool)
    }
  }
  return out.length ? out : undefined
}

function openaiToolChoiceToAnthropic(toolChoice: unknown): unknown {
  if (toolChoice == null) return undefined
  if (toolChoice === 'none') return { type: 'none' }
  if (toolChoice === 'auto') return { type: 'auto' }
  if (toolChoice === 'required') return { type: 'any' }
  if (isRecord(toolChoice) && toolChoice.type === 'function') {
    const fn = isRecord(toolChoice.function) ? toolChoice.function : null
    const name = fn ? asString(fn.name) : undefined
    if (name) return { type: 'tool', name }
  }
  if (isRecord(toolChoice) && typeof toolChoice.type === 'string') {
    return toolChoice
  }
  return undefined
}

/**
 * Convert an OpenAI chat-completions body into an Anthropic /v1/messages body.
 * Strips OpenAI-only fields; max_tokens is required by Anthropic.
 */
export function openaiChatBodyToAnthropicMessages(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const messagesIn = Array.isArray(body.messages) ? body.messages : []
  const systemParts: string[] = []
  const messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }> =
    []

  for (const raw of messagesIn) {
    if (!isRecord(raw)) continue
    const role = asString(raw.role) || 'user'
    const content = openaiContentToAnthropic(raw.content)

    if (role === 'system' || role === 'developer') {
      if (typeof content === 'string') {
        if (content.trim()) systemParts.push(content)
      } else {
        for (const p of content) {
          if (p.type === 'text' && typeof p.text === 'string' && p.text.trim()) {
            systemParts.push(p.text)
          }
        }
      }
      continue
    }

    const mappedRole = role === 'tool' ? 'user' : role === 'assistant' ? 'assistant' : 'user'
    const last = messages[messages.length - 1]
    if (last && last.role === mappedRole) {
      last.content = mergeAnthropicContent(last.content, content)
    } else {
      messages.push({ role: mappedRole, content })
    }
  }

  // Anthropic requires the conversation to start with a user turn.
  if (messages.length && messages[0]?.role === 'assistant') {
    messages.unshift({ role: 'user', content: '.' })
  }
  if (!messages.length) {
    messages.push({ role: 'user', content: '' })
  }

  const maxTokens =
    (typeof body.max_tokens === 'number' && body.max_tokens > 0
      ? body.max_tokens
      : undefined) ??
    (typeof body.max_completion_tokens === 'number' &&
    body.max_completion_tokens > 0
      ? body.max_completion_tokens
      : undefined) ??
    4096

  const out: Record<string, unknown> = {
    model: body.model,
    messages,
    max_tokens: maxTokens,
  }

  if (systemParts.length) out.system = systemParts.join('\n\n')
  if (typeof body.temperature === 'number') out.temperature = body.temperature
  if (typeof body.top_p === 'number') out.top_p = body.top_p
  if (typeof body.stream === 'boolean') out.stream = body.stream

  const stop = body.stop
  if (typeof stop === 'string') out.stop_sequences = [stop]
  else if (Array.isArray(stop)) out.stop_sequences = stop

  const tools = openaiToolsToAnthropic(body.tools)
  if (tools) out.tools = tools

  const toolChoice = openaiToolChoiceToAnthropic(body.tool_choice)
  if (toolChoice) out.tool_choice = toolChoice

  // Pass through Anthropic-native optional fields if present.
  for (const key of [
    'metadata',
    'thinking',
    'output_config',
    'cache_control',
    'provider',
  ] as const) {
    if (body[key] !== undefined) out[key] = body[key]
  }

  return out
}

function mapStopReason(reason: unknown): string | null {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop'
    case 'max_tokens':
      return 'length'
    case 'tool_use':
      return 'tool_calls'
    default:
      return reason == null ? null : String(reason)
  }
}

function extractTextAndThinking(content: unknown): {
  text: string
  thinking: string
  toolCalls: Array<Record<string, unknown>>
} {
  if (typeof content === 'string') {
    return { text: content, thinking: '', toolCalls: [] }
  }
  if (!Array.isArray(content)) {
    return { text: '', thinking: '', toolCalls: [] }
  }

  const textParts: string[] = []
  const thinkingParts: string[] = []
  const toolCalls: Array<Record<string, unknown>> = []

  for (const block of content) {
    if (!isRecord(block)) continue
    const type = asString(block.type)
    if (type === 'text' && typeof block.text === 'string') {
      textParts.push(block.text)
    } else if (
      (type === 'thinking' || type === 'reasoning') &&
      typeof block.thinking === 'string'
    ) {
      thinkingParts.push(block.thinking)
    } else if (type === 'tool_use') {
      toolCalls.push({
        id: asString(block.id) || `tool_${toolCalls.length}`,
        type: 'function',
        function: {
          name: asString(block.name) || 'unknown',
          arguments: JSON.stringify(block.input ?? {}),
        },
      })
    }
  }

  return {
    text: textParts.join(''),
    thinking: thinkingParts.join(''),
    toolCalls,
  }
}

/** Convert Anthropic Messages JSON into an OpenAI chat.completion object. */
export function anthropicMessageToOpenaiCompletion(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const { text, thinking, toolCalls } = extractTextAndThinking(data.content)
  const usageIn = isRecord(data.usage) ? data.usage : {}
  const prompt = Number(usageIn.input_tokens ?? 0)
  const completion = Number(usageIn.output_tokens ?? 0)

  const message: Record<string, unknown> = {
    role: 'assistant',
    content: text || null,
  }
  if (thinking) message.reasoning_content = thinking
  if (toolCalls.length) message.tool_calls = toolCalls

  const out: Record<string, unknown> = {
    id: asString(data.id) || `chatcmpl_${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: asString(data.model) || undefined,
    choices: [
      {
        index: 0,
        message,
        finish_reason: mapStopReason(data.stop_reason),
      },
    ],
    usage: {
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: prompt + completion,
    },
  }

  if (data.x_0g_trace !== undefined) out.x_0g_trace = data.x_0g_trace
  if (data.error !== undefined) out.error = data.error

  return out
}

type StreamState = {
  id: string
  model?: string
  roleSent: boolean
}

function openaiChunk(
  state: StreamState,
  delta: Record<string, unknown>,
  finishReason: string | null = null,
  extra?: Record<string, unknown>,
): string {
  const payload = {
    id: state.id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: state.model,
    choices: [
      {
        index: 0,
        delta,
        finish_reason: finishReason,
      },
    ],
    ...extra,
  }
  return `data: ${JSON.stringify(payload)}\n\n`
}

/**
 * Transform Anthropic Messages SSE into OpenAI chat.completion.chunk SSE
 * so existing Micropay clients keep working unchanged.
 */
export function anthropicSseToOpenaiStream(
  upstream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''
  let eventName = ''
  const state: StreamState = {
    id: `chatcmpl_${Date.now()}`,
    roleSent: false,
  }

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trimEnd()
            if (!trimmed) {
              eventName = ''
              continue
            }
            if (trimmed.startsWith(':')) continue
            if (trimmed.startsWith('event:')) {
              eventName = trimmed.slice(6).trim()
              continue
            }
            if (!trimmed.startsWith('data:')) continue
            const payload = trimmed.slice(5).trim()
            if (!payload || payload === '[DONE]') continue

            let parsed: Record<string, unknown>
            try {
              parsed = JSON.parse(payload) as Record<string, unknown>
            } catch {
              continue
            }

            const type = asString(parsed.type) || eventName

            if (type === 'message_start' && isRecord(parsed.message)) {
              const msg = parsed.message
              if (typeof msg.id === 'string') state.id = msg.id
              if (typeof msg.model === 'string') state.model = msg.model
              if (!state.roleSent) {
                controller.enqueue(
                  encoder.encode(
                    openaiChunk(state, { role: 'assistant', content: '' }),
                  ),
                )
                state.roleSent = true
              }
              if (msg.x_0g_trace !== undefined) {
                controller.enqueue(
                  encoder.encode(
                    openaiChunk(state, {}, null, {
                      x_0g_trace: msg.x_0g_trace,
                    }),
                  ),
                )
              }
              continue
            }

            if (type === 'content_block_delta' && isRecord(parsed.delta)) {
              const delta = parsed.delta
              const dType = asString(delta.type)
              if (dType === 'text_delta' && typeof delta.text === 'string') {
                controller.enqueue(
                  encoder.encode(
                    openaiChunk(state, { content: delta.text }),
                  ),
                )
              } else if (
                (dType === 'thinking_delta' || dType === 'reasoning_delta') &&
                typeof (delta.thinking ?? delta.text) === 'string'
              ) {
                const thinking = String(delta.thinking ?? delta.text)
                controller.enqueue(
                  encoder.encode(
                    openaiChunk(state, { reasoning_content: thinking }),
                  ),
                )
              } else if (
                dType === 'input_json_delta' &&
                typeof delta.partial_json === 'string'
              ) {
                // Tool-call args streaming — best-effort OpenAI shape.
                controller.enqueue(
                  encoder.encode(
                    openaiChunk(state, {
                      tool_calls: [
                        {
                          index: typeof parsed.index === 'number' ? parsed.index : 0,
                          function: { arguments: delta.partial_json },
                        },
                      ],
                    }),
                  ),
                )
              }
              continue
            }

            if (type === 'content_block_start' && isRecord(parsed.content_block)) {
              const block = parsed.content_block
              if (asString(block.type) === 'tool_use') {
                controller.enqueue(
                  encoder.encode(
                    openaiChunk(state, {
                      tool_calls: [
                        {
                          index:
                            typeof parsed.index === 'number' ? parsed.index : 0,
                          id: asString(block.id),
                          type: 'function',
                          function: {
                            name: asString(block.name) || '',
                            arguments: '',
                          },
                        },
                      ],
                    }),
                  ),
                )
              }
              continue
            }

            if (type === 'message_delta') {
              const finish = mapStopReason(
                isRecord(parsed.delta) ? parsed.delta.stop_reason : null,
              )
              const usageIn = isRecord(parsed.usage) ? parsed.usage : {}
              const prompt = Number(usageIn.input_tokens ?? 0)
              const completion = Number(usageIn.output_tokens ?? 0)
              const extra: Record<string, unknown> = {}
              if (prompt || completion) {
                extra.usage = {
                  prompt_tokens: prompt,
                  completion_tokens: completion,
                  total_tokens: prompt + completion,
                }
              }
              if (parsed.x_0g_trace !== undefined) {
                extra.x_0g_trace = parsed.x_0g_trace
              }
              controller.enqueue(
                encoder.encode(openaiChunk(state, {}, finish, extra)),
              )
              continue
            }

            // message_stop / other events: wait for stream end to emit [DONE]
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        controller.error(err)
      } finally {
        reader.releaseLock()
      }
    },
  })
}
