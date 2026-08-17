<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { bridge } from '@mp-sdk/bridge'

const platform = ref('detecting...')
const bridgeStatus = ref('checking...')
const callResult = ref('')

onMounted(() => {
  platform.value = bridge.getPlatform()
  bridgeStatus.value = bridge.hasNativeBridge() ? 'connected' : 'standalone (no native bridge)'

  // 注册 JS 端方法供 Native 调用
  bridge.register('onMessage', (params: any) => {
    callResult.value = `Received from Native: ${JSON.stringify(params)}`
    return { received: true }
  })
})

function testCallNative() {
  if (!bridge.hasNativeBridge()) {
    callResult.value = 'No native bridge available (running in pure web mode)'
    return
  }
  const result = bridge.call('echo', { message: 'Hello from JS!' })
  callResult.value = `Native response: ${JSON.stringify(result)}`
}

async function testAsyncCallNative() {
  if (!bridge.hasNativeBridge()) {
    callResult.value = 'No native bridge available (running in pure web mode)'
    return
  }
  const result = await bridge.callAsync('asyncEcho', { message: 'Hello async!' })
  callResult.value = `Async response: ${JSON.stringify(result)}`
}
</script>

<template>
  <div style="padding: 20px; font-family: sans-serif;">
    <h1>MPBridge SDK Demo</h1>
    <div style="margin: 16px 0;">
      <p><strong>Platform:</strong> {{ platform }}</p>
      <p><strong>Bridge Status:</strong> {{ bridgeStatus }}</p>
    </div>
    <div style="margin: 16px 0;">
      <button @click="testCallNative" style="margin-right: 8px;">Sync Call</button>
      <button @click="testAsyncCallNative">Async Call</button>
    </div>
    <div v-if="callResult" style="margin-top: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px;">
      <strong>Result:</strong> {{ callResult }}
    </div>
  </div>
</template>
