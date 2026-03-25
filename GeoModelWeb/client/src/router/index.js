import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ModelView from '../views/ModelView.vue'
import DataView from '../views/DataView.vue'
import DataMethodView from '../views/DataMethodView.vue'
import JupyterDashboard from '../views/JupyterDashboard.vue'
import JupyterCallback from '../views/JupyterCallback.vue'
import JupyterProject from '../views/JupyterProject.vue'
import SharedProjectPreview from '../views/SharedProjectPreview.vue'
import CaseLibrary from '../views/CaseLibrary.vue'
import CaseDetail from '../views/CaseDetail.vue'

const routes = [
    {
        path: '/',
        name: 'Home',
        component: HomeView
    },
    {
        path: '/model',
        name: 'Model',
        component: ModelView
    },
    {
        path: '/data',
        name: 'Data',
        component: DataView
    },
    {
        path: '/datamethod',
        name: 'DataMethod',
        component: DataMethodView
    },
    {
        path: '/jupyter',
        name: 'Jupyter',
        component: JupyterDashboard,
        meta: { title: 'My Jupyter', hideMainNav: true }
    },
    {
        path: '/jupyter/callback',
        name: 'JupyterCallback',
        component: JupyterCallback,
        meta: { title: '登录中...', hideMainNav: true }
    },
    {
        path: '/jupyter/project/:projectName',
        name: 'JupyterProject',
        component: JupyterProject,
        meta: { title: 'Project', hideMainNav: true }
    },
    {
        path: '/jupyter/shared/:owner/:projectName',
        name: 'SharedProjectPreview',
        component: SharedProjectPreview,
        meta: { title: 'Shared Project', hideMainNav: true }
    },
    {
        path: '/jupyter/cases',
        name: 'CaseLibrary',
        component: CaseLibrary,
        meta: { title: 'Case Library', hideMainNav: true }
    },
    {
        path: '/jupyter/cases/:owner/:projectName',
        name: 'CaseDetail',
        component: CaseDetail,
        meta: { title: 'Case Detail', hideMainNav: true }
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
