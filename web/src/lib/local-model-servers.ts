export interface LocalModelServerPreset {
  id: string
  name: string
  defaultBaseUrl: string
  description: string
  apiKeyHint: string
}

export const LOCAL_MODEL_SERVER_PRESETS: LocalModelServerPreset[] = [
  {
    id: 'llamacpp-local',
    name: 'llama.cpp',
    defaultBaseUrl: 'http://127.0.0.1:8080/v1',
    description: 'Connect to a local llama-server OpenAI-compatible API.',
    apiKeyHint: 'Usually optional unless llama-server was started with an API key.'
  },
  {
    id: 'vllm-local',
    name: 'vLLM',
    defaultBaseUrl: 'http://127.0.0.1:8000/v1',
    description: 'Connect to a local vLLM OpenAI-compatible server.',
    apiKeyHint: 'Optional unless vLLM was started with --api-key.'
  },
  {
    id: 'unsloth-local',
    name: 'Unsloth Studio',
    defaultBaseUrl: 'http://127.0.0.1:8888/v1',
    description: 'Use a model loaded and served by Unsloth Studio on this computer.',
    apiKeyHint: 'Required by default. Copy the generated API key shown by Unsloth Studio.'
  }
]

export function filterLocalModelServerPresets(query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return LOCAL_MODEL_SERVER_PRESETS
  return LOCAL_MODEL_SERVER_PRESETS.filter(preset =>
    `${preset.name} ${preset.id} ${preset.description}`.toLowerCase().includes(needle)
  )
}
