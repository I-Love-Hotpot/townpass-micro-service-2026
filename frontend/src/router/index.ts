import { createRouter, createWebHashHistory } from 'vue-router';
import ScanView from '@/views/ScanView.vue';
import HistoryView from '@/views/HistoryView.vue';
import DocumentView from '@/views/DocumentView.vue';
import SettingView from '@/views/SettingView.vue';

export default createRouter({
  history: createWebHashHistory(
    location.pathname === '/govclear' ? '/govclear' : import.meta.env.BASE_URL
  ),
  routes: [
    { path: '/', name: 'scan', component: ScanView },
    { path: '/history', name: 'history', component: HistoryView },
    { path: '/setting', name: 'setting', component: SettingView },
    { path: '/documents/:id', name: 'document', component: DocumentView },
    { path: '/documents/:id/pages/:page', name: 'page', component: DocumentView },
    { path: '/documents/:id/chat', name: 'chat', component: DocumentView },
    { path: '/documents/:id/services/:destination', name: 'destination', component: DocumentView },
    { path: '/:pathMatch(.*)*', redirect: { name: 'scan' } }
  ]
});
