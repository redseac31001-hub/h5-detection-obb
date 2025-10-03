import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'detection',
      component: () => import('../views/DetectionView.vue'),
    },
    {
      path: '/yolo-detection',
      name: 'yoloDetection',
      component: () => import('../components/YOLODetectionView.vue'),
    },
    {
      path: '/face-payment',
      name: 'facePayment',
      component: () => import('../views/FacePaymentView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
    },
  ],
})

export default router
