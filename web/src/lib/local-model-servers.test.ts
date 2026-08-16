import { describe, expect, it } from 'vitest'

import { filterLocalModelServerPresets, LOCAL_MODEL_SERVER_PRESETS } from './local-model-servers'

describe('local model server presets', () => {
  it('offers llama.cpp, vLLM, and Unsloth Studio with their standard local URLs', () => {
    expect(LOCAL_MODEL_SERVER_PRESETS.map(({ id, defaultBaseUrl }) => ({ id, defaultBaseUrl }))).toEqual([
      { id: 'llamacpp-local', defaultBaseUrl: 'http://127.0.0.1:8080/v1' },
      { id: 'vllm-local', defaultBaseUrl: 'http://127.0.0.1:8000/v1' },
      { id: 'unsloth-local', defaultBaseUrl: 'http://127.0.0.1:8888/v1' }
    ])
  })

  it('finds Unsloth by its Studio name', () => {
    expect(filterLocalModelServerPresets('studio').map(preset => preset.id)).toEqual(['unsloth-local'])
  })
})
