import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

// 预先导入TensorFlow.js以确保正确初始化
import { initializeTensorFlow } from './utils/tfUtils'

import App from './App.vue'
import router from './router'

const app = createApp(App)

// 注册Element Plus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus)

// 预初始化TensorFlow.js
initializeTensorFlow().then(() => {
  console.log('🚀 TensorFlow.js 预初始化完成')
}).catch((error) => {
  console.warn('⚠️ TensorFlow.js 预初始化失败，将在需要时重试:', error)
})

app.mount('#app')
