<template>
  <div class="jupyter-page">
    <!-- Toast 提示框 -->
    <Transition name="toast">
      <div v-if="showToast" :class="['toast-notification', toastType]">
        <span class="toast-icon">
          {{ toastType === 'success' ? '' : toastType === 'error' ? '' : toastType === 'warning' ? '' : '' }}
        </span>
        <span class="toast-message">{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- 独立的顶部导航栏 -->
    <header class="jupyter-nav">
      <div class="nav-left">
        <a href="/" class="logo-link">
          <img src="/logo.png" alt="OpenGeoLab" class="logo">
        </a>
        <a href="/" class="back-link">
          <span class="back-icon">←</span>
          <span>Back to OpenGeoLab</span>
        </a>
      </div>
      <div class="nav-center">
        <h1 class="page-title">OpenGeoLab - Jupyter</h1>
      </div>
      <div class="nav-right"></div>
    </header>

    <!-- 未登录状态 -->
    <div v-if="!isLoggedIn" class="login-container">
      <div class="login-card">
        <div class="login-header">
          <h1>OpenGeoLab - Jupyter</h1>
          <p>个人 JupyterLab 云端开发环境</p>
        </div>
        
        <div class="login-features">
          <div class="feature-item">
            <span class="feature-icon"></span>
            <span>Jupyter Notebook</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon"></span>
            <span>Python 科学计算</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon"></span>
            <span>云端存储</span>
          </div>
        </div>

        <div class="login-form">
          <label class="login-label" for="opengms-email">OpenGMS Email</label>
          <input
            id="opengms-email"
            v-model.trim="loginForm.email"
            class="login-input"
            type="email"
            autocomplete="username"
            placeholder="请输入 OpenGMS 邮箱"
            @keyup.enter="loginWithOpenGMS"
          >

          <label class="login-label" for="opengms-password">Password</label>
          <input
            id="opengms-password"
            v-model="loginForm.password"
            class="login-input"
            type="password"
            autocomplete="current-password"
            placeholder="请输入密码"
            @keyup.enter="loginWithOpenGMS"
          >

          <button class="opengms-login-btn" @click="loginWithOpenGMS" :disabled="isLoading">
            <span>{{ isLoading ? '登录中...' : '使用 OpenGMS 账号登录' }}</span>
          </button>
        </div>

        <div class="login-divider">
          <span>or continue with</span>
        </div>

        <div class="social-login-grid">
          <button
            class="social-login-btn github-btn"
            type="button"
            :disabled="isLoading || !!socialLoadingProvider"
            @click="startOAuthLogin('github')"
          >
            <span class="social-login-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="img">
                <path
                  fill="currentColor"
                  d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.56 0-.28-.01-1.18-.02-2.14-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.74.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.67 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.73.8 1.18 1.83 1.18 3.08 0 4.4-2.68 5.37-5.24 5.66.41.35.78 1.04.78 2.1 0 1.52-.01 2.74-.01 3.11 0 .31.2.67.79.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
                />
              </svg>
            </span>
            <span>{{ socialLoadingProvider === 'github' ? 'Redirecting...' : 'Continue with GitHub' }}</span>
          </button>

          <button
            class="social-login-btn google-btn"
            type="button"
            :disabled="isLoading || !!socialLoadingProvider"
            @click="startOAuthLogin('google')"
          >
            <span class="social-login-icon" aria-hidden="true">
              <svg viewBox="0 0 18 18" role="img">
                <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.482h4.844c-.209 1.125-.843 2.078-1.798 2.715v2.259h2.909c1.703-1.567 2.685-3.877 2.685-6.615Z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.955-2.18l-2.909-2.26c-.806.541-1.836 1.228-3.046 1.228-2.344 0-4.328-1.584-5.037-3.712H.957A9 9 0 0 0 9 18Z" />
                <path fill="#FBBC05" d="M3.963 11.076A5.41 5.41 0 0 1 3.679 9c0-.586.103-1.164.284-1.705V4.962H.957A9 9 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.006-2.334Z" />
                <path fill="#EA4335" d="M9 3.58c1.322 0 2.508.454 3.44 1.345l2.582-2.582C13.464.892 11.427 0 9 0A9 9 0 0 0 .957 4.957l3.006 2.333C4.672 5.164 6.656 3.58 9 3.58Z" />
              </svg>
            </span>
            <span>{{ socialLoadingProvider === 'google' ? 'Redirecting...' : 'Continue with Google' }}</span>
          </button>
        </div>

        <p class="login-hint">当前页面同时支持 OpenGMS、GitHub 和 Google 登录。OpenGMS 仍是主入口。</p>
      </div>
    </div>

    <!-- 已登录状态 - 仿 MyDDE 布局 -->
    <div v-else class="dashboard-layout">
      <!-- 左侧边栏 -->
      <aside class="sidebar">
        <!-- 用户信息 -->
        <div class="sidebar-user">
          <img :src="user.avatarUrl" :alt="user.username" class="user-avatar">
          <div class="user-info">
            <span class="user-name">{{ user.displayName }}</span>
            <span class="user-username">@{{ user.username }}</span>
          </div>
        </div>

        <!-- 导航菜单 -->
        <nav class="sidebar-nav">
          <!-- 一、开发环境 -->
          <div class="nav-section">
            <div class="nav-section-title">开发环境</div>
            <a 
              href="#" 
              :class="['nav-item', { active: activeMenu === 'recent' }]"
              @click.prevent="activeMenu = 'recent'"
            >
              <span class="nav-icon"></span>
              <span>Recent</span>
            </a>
            <a 
              href="#" 
              :class="['nav-item', { active: activeMenu === 'myspace' }]"
              @click.prevent="activeMenu = 'myspace'"
            >
              <span class="nav-icon"></span>
              <span>My Space</span>
            </a>
            <a 
              href="#" 
              :class="['nav-item', { active: activeMenu === 'sharedspace' }]"
              @click.prevent="activeMenu = 'sharedspace'"
            >
              <span class="nav-icon"></span>
              <span>Shared Space</span>
            </a>
            <router-link class="nav-item" to="/jupyter/cases">
              <span class="nav-icon"></span>
              <span>Case Library</span>
            </router-link>
          </div>

          <!-- 二、资源管理 -->
          <div class="nav-section">
            <div class="nav-section-title">资源管理</div>
            <a 
              href="#" 
              :class="['nav-item', { active: activeMenu === 'mymodel' }]"
              @click.prevent="activeMenu = 'mymodel'"
            >
              <span class="nav-icon"></span>
              <span>My Model</span>
            </a>
            <a 
              href="#" 
              :class="['nav-item', { active: activeMenu === 'mydata' }]"
              @click.prevent="activeMenu = 'mydata'"
            >
              <span class="nav-icon"></span>
              <span>My Data</span>
            </a>
            <a 
              href="#" 
              :class="['nav-item', { active: activeMenu === 'mydatamethod' }]"
              @click.prevent="activeMenu = 'mydatamethod'"
            >
              <span class="nav-icon"></span>
              <span>My Data Method</span>
            </a>
          </div>

          <!-- 三、设置 -->
          <div class="nav-section">
            <div class="nav-section-title">设置</div>
            <a 
              href="#" 
              :class="['nav-item', { active: activeMenu === 'environments' }]"
              @click.prevent="activeMenu = 'environments'"
            >
              <span class="nav-icon"></span>
              <span>Environments</span>
            </a>
          </div>
        </nav>

        <!-- 底部退出按钮 -->
        <div class="sidebar-footer">
          <button class="logout-btn" @click="logout">
            <span class="nav-icon"></span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <!-- 右侧主内容区 -->
      <main class="main-content">
        <!-- 顶部标题栏 -->
        <header class="content-header">
          <div class="header-left">
            <h1 class="page-title">{{ pageTitles[activeMenu] }}</h1>
          </div>
          <div class="header-right">
            <div class="search-box">
              <span class="search-icon"></span>
              <input type="text" :placeholder="searchPlaceholder" v-model="searchQuery">
            </div>
            <button 
              v-if="activeMenu === 'recent' || activeMenu === 'myspace'"
              class="header-btn create-btn" 
              @click="showCreateProjectModal = true"
            >
              <span>+ Create</span>
              <span class="dropdown-arrow">▾</span>
            </button>
          </div>
        </header>

        <!-- 内容区域 -->
        <div class="content-body">
          
          <!-- ========== Recent 面板 ========== -->
          <div v-if="activeMenu === 'recent'" class="recent-panel">
            <div class="recent-layout">
              <!-- 左侧：快速创建 + 最近项目 -->
              <div class="recent-main">
                <!-- 快速创建 -->
                <section class="recent-section">
                  <h3 class="section-title">Quickly Create</h3>
                  <div class="quick-create-grid">
                    <button class="quick-create-btn" @click="showCreateProjectModal = true">
                      <span class="qc-icon"></span>
                      <span class="qc-text">New Project</span>
                    </button>
                  </div>
                </section>

                <!-- 最近项目 -->
                <section class="recent-section">
                  <h3 class="section-title">Recent Projects</h3>
                  <div class="recent-projects-card">
                    <div v-if="projects.length === 0" class="empty-recent">
                      <div class="empty-icon-box"></div>
                      <p>No Recent Projects</p>
                    </div>
                    <div v-else-if="filteredRecentProjects.length === 0" class="empty-recent">
                      <div class="empty-icon-box"></div>
                      <p>未找到匹配的项目</p>
                    </div>
                    <div v-else class="recent-projects-list">
                      <div 
                        v-for="project in filteredRecentProjects" 
                        :key="project.name" 
                        class="recent-project-item"
                        @click="goToProject(project)"
                      >
                        <div class="project-details">
                          <span class="project-name">{{ project.name }}</span>
                          <span class="project-meta">{{ project.notebookCount }} notebooks • {{ formatDate(project.modifiedAt) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <!-- 我的资源 -->
                <section class="recent-section">
                  <div class="section-header">
                    <h3 class="section-title">My Resources</h3>
                    <div class="section-actions">
                      <select class="time-filter" v-model="resourceTimeFilter">
                        <option value="7">7 hours</option>
                        <option value="24">24 hours</option>
                        <option value="168">7 days</option>
                      </select>
                    </div>
                  </div>
                  <div class="resources-card">
                    <div class="empty-resources">
                      <div class="empty-icon-box"></div>
                      <p>No Resource Usage Information</p>
                    </div>
                  </div>
                </section>
              </div>

              <!-- 右侧：最近使用的数据 -->
              <div class="recent-sidebar">
                <section class="recent-section">
                  <h3 class="section-title">Recently Used Data</h3>
                  <div class="recent-data-card">
                    <div class="empty-recent">
                      <div class="empty-icon-box"></div>
                      <p>No Recently Used Data</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>

          <!-- ========== My Space 面板 ========== -->
          <div v-else-if="activeMenu === 'myspace'" class="myspace-panel">
            <div class="projects-table-wrapper">
              <table class="projects-table-new">
                <thead>
                  <tr>
                    <th class="col-name">Project Name</th>
                    <th class="col-desc">Description</th>
                    <th class="col-date">Created Date</th>
                    <th class="col-status">Status</th>
                    <th class="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="filteredProjects.length === 0">
                    <td colspan="5" class="empty-row">
                      <div class="empty-state">
                        <div class="empty-icon">📁</div>
                        <p>还没有项目</p>
                        <p class="empty-hint">点击右上角 + Create 创建新项目</p>
                      </div>
                    </td>
                  </tr>
                  <tr 
                    v-for="project in filteredProjects" 
                    :key="project.name"
                    class="project-row"
                    @dblclick="goToProject(project)"
                  >
                    <td class="col-name">
                      <span class="project-name-text" @click="goToProject(project)">
                        {{ project.name }}
                      </span>
                      <span v-if="project.forkedFrom" class="fork-tag" :title="`Forked from ${project.forkedFrom.owner}/${project.forkedFrom.projectName}`">
                        ↪ Fork
                      </span>
                      <span v-if="project.isCase" class="case-tag" title="Published as case">
                        Case
                      </span>
                    </td>
                    <td class="col-desc">
                      <span class="desc-text">{{ project.description || '-' }}</span>
                    </td>
                    <td class="col-date">{{ formatDate(project.createdAt) }}</td>
                    <td class="col-status">
                      <span :class="['status-badge', project.isPublic ? 'public' : 'active']">
                        {{ project.isPublic ? 'Public' : 'Active' }}
                      </span>
                    </td>
                    <td class="col-actions">
                      <div class="action-buttons">
                        <button class="action-icon-btn" @click.stop="goToProject(project)" title="打开项目">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        </button>
                        <button class="action-icon-btn" @click.stop="editProject(project)" title="编辑项目">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        </button>
                        <button class="action-icon-btn" @click.stop="toggleProjectVisibility(project)" :title="project.isPublic ? '设为私有' : '设为公开'">
                          <svg v-if="project.isPublic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        </button>
                        <button class="action-icon-btn" @click.stop="toggleCasePublish(project)" :title="project.isCase ? 'Unpublish case' : 'Publish as case'">
                          <svg v-if="project.isCase" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 5h14v14H5z"/><path d="M8 12h8"/><path d="M8 8h8"/><path d="M8 16h5"/></svg>
                          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3l2.4 4.86 5.36.78-3.88 3.78.92 5.34L12 15.4 7.2 17.76l.92-5.34L4.24 8.64l5.36-.78L12 3z"/></svg>
                        </button>
                        <button class="action-icon-btn danger" @click.stop="deleteProject(project)" title="删除项目">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- ========== My Model 面板 ========== -->
          <div v-else-if="activeMenu === 'mymodel'" class="mymodel-panel">
            <div class="panel-toolbar">
              <button class="add-btn" @click="openModelSelector">
                <span>+ 从模型库添加</span>
              </button>
            </div>
            
            <div class="resource-list">
              <div v-if="myModels.length === 0" class="empty-state">
                <div class="empty-icon"></div>
                <p>还没有添加模型</p>
                <p class="empty-hint">点击上方按钮从模型库中选择添加</p>
              </div>
              
              <div v-else-if="filteredMyModels.length === 0" class="empty-state">
                <div class="empty-icon"></div>
                <p>未找到匹配的模型</p>
                <p class="empty-hint">请尝试其他搜索关键词</p>
              </div>
              
              <div v-else class="resource-grid">
                <div 
                  v-for="model in filteredMyModels" 
                  :key="model.id" 
                  class="resource-card"
                >
                  <div class="resource-header">
                    <span class="resource-icon"></span>
                    <h4 class="resource-name">{{ model.name }}</h4>
                  </div>
                  <p class="resource-desc">{{ model.description || '暂无描述' }}</p>
                  <div class="resource-footer">
                    <span class="resource-meta">{{ model.author || 'OpenGeoLab' }}</span>
                    <div class="resource-actions">
                      <button class="action-btn run" @click="runModel(model)" title="运行"></button>
                      <button class="action-btn remove" @click="removeFromMyModels(model)" title="移除">×</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ========== My Data Method 面板 ========== -->
          <div v-else-if="activeMenu === 'mydatamethod'" class="mydatamethod-panel">
            <div class="panel-toolbar">
              <button class="add-btn" @click="openDataMethodSelector">
                <span>+ 从数据方法库添加</span>
              </button>
            </div>
            
            <div class="resource-list">
              <div v-if="myDataMethods.length === 0" class="empty-state">
                <div class="empty-icon"></div>
                <p>还没有添加数据方法</p>
                <p class="empty-hint">点击上方按钮从数据方法库中选择添加</p>
              </div>
              
              <div v-else-if="filteredMyDataMethods.length === 0" class="empty-state">
                <div class="empty-icon"></div>
                <p>未找到匹配的数据方法</p>
                <p class="empty-hint">请尝试其他搜索关键词</p>
              </div>
              
              <div v-else class="resource-grid">
                <div 
                  v-for="method in filteredMyDataMethods" 
                  :key="method.id" 
                  class="resource-card"
                >
                  <div class="resource-header">
                    <span class="resource-icon"></span>
                    <h4 class="resource-name">{{ method.name }}</h4>
                  </div>
                  <p class="resource-desc">{{ method.description || '暂无描述' }}</p>
                  <div class="resource-footer">
                    <span class="resource-meta">{{ method.author || 'OpenGeoLab' }}</span>
                    <div class="resource-actions">
                      <button class="action-btn run" @click="runDataMethod(method)" title="运行"></button>
                      <button class="action-btn remove" @click="removeFromMyDataMethods(method)" title="移除">×</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ========== My Data 面板 (网盘风格) ========== -->
          <div v-else-if="activeMenu === 'mydata'" class="mydata-panel netdisk-style">
            <!-- 工具栏 -->
            <div class="netdisk-toolbar">
              <button class="toolbar-btn primary" @click="openForkDataModal">
                <span>Fork 数据</span>
              </button>
              <button class="toolbar-btn" @click="navigateBack" :disabled="currentDataPath === '/'">
                <span class="btn-icon">«</span>
                <span>返回</span>
              </button>
              <button class="toolbar-btn" @click="loadMyData">
                <span class="btn-icon">↻</span>
                <span>刷新</span>
              </button>
              <button class="toolbar-btn upload" @click="openDataUploader">
                <span class="btn-icon">⬆</span>
                <span>上传数据</span>
              </button>
              <button class="toolbar-btn" @click="createNewFolder">
                <span class="btn-icon">+</span>
                <span>新建文件夹</span>
              </button>
              <span class="current-path">{{ currentDataPath }}</span>
            </div>

            <!-- 文件网格 -->
            <div class="netdisk-content">
              <div v-if="loadingMyData" class="loading-state">
                <div class="spinner"></div>
                <p>加载中...</p>
              </div>

              <div v-else-if="currentDataItems.length === 0" class="empty-state">
                <p>文件夹为空</p>
                <p class="empty-hint">点击上方按钮上传数据或从数据中心 Fork</p>
              </div>

              <div v-else class="netdisk-grid">
                <div 
                  v-for="item in currentDataItems" 
                  :key="item.id"
                  :class="['netdisk-item', { selected: selectedDataItems.includes(item.id) }]"
                  @click="handleItemClick(item)"
                  @dblclick="handleItemDoubleClick(item)"
                  @contextmenu.prevent="openItemContextMenu($event, item)"
                >
                  <div class="item-icon-wrapper">
                    <img 
                      v-if="item.type === 'folder'" 
                      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Cpath fill='%23FFA000' d='M40 12H22l-4-4H8c-2.2 0-4 1.8-4 4v8h44v-4c0-2.2-1.8-4-4-4z'/%3E%3Cpath fill='%23FFCA28' d='M40 12H8c-2.2 0-4 1.8-4 4v20c0 2.2 1.8 4 4 4h32c2.2 0 4-1.8 4-4V16c0-2.2-1.8-4-4-4z'/%3E%3C/svg%3E"
                      alt="folder"
                      class="item-icon"
                    >
                    <div v-else class="file-icon" :class="getFileIconClass(item)">
                      <span class="file-ext">{{ getFileExtension(item.name) }}</span>
                    </div>
                    <!-- Fork 标识 -->
                    <div v-if="item.forked" class="fork-badge" title="已从数据中心 Fork">
                      <span>Fork</span>
                    </div>
                  </div>
                  <div class="item-name" :title="item.name">{{ item.name }}</div>
                  <div class="item-meta" v-if="item.type !== 'folder'">
                    {{ formatSize(item.size) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 底部状态栏 -->
            <div class="netdisk-statusbar">
              <span>{{ myDataList.length }} 个项目</span>
              <span v-if="selectedDataItems.length > 0">已选择 {{ selectedDataItems.length }} 项</span>
              <span class="storage-info">已用存储: {{ calculateTotalDataSize() }}</span>
            </div>
          </div>

          <!-- Fork 数据模态框 -->
          <div v-if="showForkDataModal" class="modal-overlay" @click.self="showForkDataModal = false">
            <div class="fork-data-modal">
              <div class="modal-header">
                <h3>从数据中心 Fork 数据</h3>
                <button class="close-btn" @click="showForkDataModal = false">×</button>
              </div>

              <div class="fork-search-bar">
                <input 
                  type="text" 
                  v-model="forkSearchQuery" 
                  placeholder="搜索数据中心..."
                  @keyup.enter="searchDataCenter"
                >
                <button class="search-btn" @click="searchDataCenter">搜索</button>
              </div>

              <!-- 分类筛选 -->
              <div class="fork-categories">
                <button 
                  v-for="cat in dataCenterCategories" 
                  :key="cat.value"
                  :class="['category-tag', { active: forkSelectedCategory === cat.value }]"
                  @click="selectForkCategory(cat.value)"
                >
                  {{ cat.label }}
                </button>
              </div>

              <div class="fork-data-list">
                <div v-if="loadingDataCenter" class="loading-state compact">
                  <div class="spinner"></div>
                  <span>加载数据中心...</span>
                </div>

                <div v-else-if="dataCenterList.length === 0" class="empty-state compact">
                  <p>暂无数据</p>
                </div>

                <div v-else class="fork-items">
                  <div 
                    v-for="item in dataCenterList" 
                    :key="item.id"
                    :class="['fork-item', { selected: forkSelectedItems.includes(item.id) }]"
                    @click="toggleForkSelection(item)"
                  >
                    <div class="fork-item-checkbox">
                      <input type="checkbox" :checked="forkSelectedItems.includes(item.id)" @click.stop>
                    </div>
                    <div class="fork-item-icon">{{ getDataCenterIcon(item) }}</div>
                    <div class="fork-item-info">
                      <div class="fork-item-name">{{ item.name }}</div>
                      <div class="fork-item-meta">
                        <span class="fork-item-type">{{ item.suffix || '未知类型' }}</span>
                        <span class="fork-item-size">{{ formatSize(item.fileSize) }}</span>
                        <span class="fork-item-author" v-if="item.author">{{ item.author }}</span>
                      </div>
                    </div>
                    <button 
                      class="fork-single-btn" 
                      @click.stop="forkSingleItem(item)"
                      :disabled="isItemForked(item.id)"
                    >
                      {{ isItemForked(item.id) ? '已 Fork' : 'Fork' }}
                    </button>
                  </div>
                </div>

                <!-- 分页 -->
                <div class="fork-pagination" v-if="dataCenterTotalPages > 1">
                  <button :disabled="dataCenterPage === 1" @click="changeForkPage(dataCenterPage - 1)">上一页</button>
                  <span>{{ dataCenterPage }} / {{ dataCenterTotalPages }}</span>
                  <button :disabled="dataCenterPage === dataCenterTotalPages" @click="changeForkPage(dataCenterPage + 1)">下一页</button>
                </div>
              </div>

              <div class="modal-footer">
                <span class="selected-count" v-if="forkSelectedItems.length > 0">
                  已选择 {{ forkSelectedItems.length }} 项
                </span>
                <button class="cancel-btn" @click="showForkDataModal = false">取消</button>
                <button 
                  class="confirm-btn" 
                  @click="forkSelectedData"
                  :disabled="forkSelectedItems.length === 0 || forkingData"
                >
                  {{ forkingData ? 'Fork 中...' : `Fork 选中项 (${forkSelectedItems.length})` }}
                </button>
              </div>
            </div>
          </div>

          <!-- 右键菜单 -->
          <div 
            v-if="showDataContextMenu" 
            class="context-menu"
            :style="{ top: contextMenuY + 'px', left: contextMenuX + 'px' }"
            @click.stop
          >
            <div class="context-item" @click="downloadContextItem">
              下载
            </div>
            <div class="context-item" @click="renameContextItem">
              重命名
            </div>
            <div class="context-item danger" @click="deleteContextItem">
              删除
            </div>
          </div>

          <!-- ========== Shared Space 面板 ========== -->
          <div v-else-if="activeMenu === 'sharedspace'" class="shared-space-panel">
            <!-- 项目共享空间 -->
            <div class="shared-projects-section">
              <div class="panel-intro">
                <p>浏览其他用户公开分享的项目，您可以预览项目内容并 Fork 到自己的空间中继续开发。</p>
              </div>
              
              <!-- 搜索栏 -->
              <div class="shared-search-bar">
                <input 
                  type="text" 
                  v-model="sharedSearchQuery" 
                  placeholder="搜索公开项目..."
                  class="shared-search-input"
                >
              </div>
              
              <div v-if="loadingSharedProjects" class="loading-state">
                <div class="spinner"></div>
                <p>加载共享项目...</p>
              </div>
              
              <div v-else-if="filteredSharedProjects.length === 0" class="empty-state">
                <p>暂无公开项目</p>
                <span class="empty-hint">当其他用户公开分享项目时，会显示在这里</span>
              </div>
              
              <div v-else class="shared-projects-grid">
                <div 
                  v-for="project in filteredSharedProjects" 
                  :key="`${project.owner}/${project.name}`" 
                  class="shared-project-card"
                >
                  <div class="shared-card-header">
                    <div class="project-info">
                      <h3 class="project-name">{{ project.name }}</h3>
                      <span class="project-owner">
                        {{ project.owner }}
                      </span>
                    </div>
                  </div>
                  
                  <p class="project-description" v-if="project.description">
                    {{ project.description }}
                  </p>
                  <p class="project-description empty" v-else>
                    暂无描述
                  </p>
                  
                  <div class="project-stats">
                    <span class="stat-item">
                      {{ project.notebookCount }} notebooks
                    </span>
                    <span class="stat-item">
                      {{ project.fileCount }} files
                    </span>
                  </div>
                  
                  <div class="project-time">
                    <span>更新于 {{ formatRelativeTime(project.modifiedAt) }}</span>
                  </div>
                  
                  <div class="shared-card-actions">
                    <button 
                      class="action-btn preview" 
                      @click="previewSharedProject(project)"
                      title="预览项目"
                    >
                      预览
                    </button>
                    <button 
                      class="action-btn fork" 
                      @click="forkProject(project)"
                      :disabled="forkingProject === `${project.owner}/${project.name}`"
                      title="Fork 到我的空间"
                    >
                      {{ forkingProject === `${project.owner}/${project.name}` ? 'Fork 中...' : 'Fork' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ========== Environments 面板 ========== -->
          <div v-else-if="activeMenu === 'environments'" class="environments-panel">
            <div class="env-panel-header">
              <h2 class="env-panel-title">Select Execution Environment (Docker Container)</h2>
              <p class="env-panel-desc">Choose the Python environment for running Jupyter Notebook</p>
            </div>
            
            <div v-if="loadingEnvironments" class="loading-state">
              <div class="spinner"></div>
              <p>Loading environments...</p>
            </div>
            
            <template v-else>
              <div class="env-cards-grid">
                <!-- Geo-Standard 环境 -->
                <div 
                  :class="['env-card-new', { selected: selectedEnvId === 'geomodel-jupyter' }]"
                  @click="selectEnvironment('geomodel-jupyter')"
                >
                  <div class="env-card-check" v-if="selectedEnvId === 'geomodel-jupyter'">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                  </div>
                  <div class="env-card-icon geo-standard">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  </div>
                  <h3 class="env-card-title">Geo-Standard</h3>
                  <p class="env-card-desc">(GDAL, GeoPandas, Scipy - Py3.11)</p>
                </div>

                <!-- Deep Learning Geo 环境 -->
                <div 
                  :class="['env-card-new', { selected: selectedEnvId === 'geomodel-jupyter-dl' }]"
                  @click="selectEnvironment('geomodel-jupyter-dl')"
                >
                  <div class="env-card-check" v-if="selectedEnvId === 'geomodel-jupyter-dl'">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                  </div>
                  <div class="env-card-icon deep-learning">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="12" y1="22.08" x2="12" y2="12" stroke="currentColor" stroke-width="1.5"/></svg>
                  </div>
                  <h3 class="env-card-title">Deep Learning Geo</h3>
                  <p class="env-card-desc">(PyTorch, TensorFlow, Rasterio - GPU Enabled)</p>
                </div>

                <!-- Hydrology Suite 环境 -->
                <div 
                  :class="['env-card-new', { selected: selectedEnvId === 'geomodel-jupyter-hydro' }]"
                  @click="selectEnvironment('geomodel-jupyter-hydro')"
                >
                  <div class="env-card-check" v-if="selectedEnvId === 'geomodel-jupyter-hydro'">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                  </div>
                  <div class="env-card-icon hydrology">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8zm0 18c-3.35 0-6-2.57-6-6.2 0-2.34 1.95-5.44 6-9.14 4.05 3.7 6 6.79 6 9.14 0 3.63-2.65 6.2-6 6.2z"/></svg>
                  </div>
                  <h3 class="env-card-title">Hydrology Suite</h3>
                  <p class="env-card-desc">(SWAT, PyHSPF - Py3.8)</p>
                </div>
              </div>

              <div class="env-launch-section">
                <button class="launch-jupyter-btn" @click="launchWithSelectedEnv" :disabled="!selectedEnvId">
                  Launch JupyterLab Workspace
                </button>
              </div>
            </template>
          </div>

        </div>
      </main>
    </div>

    <!-- 模型选择器模态框 -->
    <div v-if="showModelSelector" class="modal-overlay" @click.self="showModelSelector = false">
      <div class="modal-content selector-modal">
        <div class="modal-header">
          <h2>从模型库选择</h2>
          <button class="close-btn" @click="showModelSelector = false">×</button>
        </div>
        <div class="modal-body">
          <div class="selector-search">
            <input 
              type="text" 
              v-model="librarySearchQuery" 
              placeholder="搜索模型..."
              @keyup.enter="searchModelLibrary"
            >
            <button @click="searchModelLibrary">搜索</button>
          </div>
          
          <div v-if="libraryLoading" class="selector-loading">
            <div class="spinner"></div>
            <p>加载中...</p>
          </div>
          
          <div v-else class="selector-list">
            <div 
              v-for="model in modelLibrary" 
              :key="model.id" 
              class="selector-item"
              :class="{ added: isModelAdded(model) }"
            >
              <div class="item-info">
                <div class="item-details">
                  <h4>{{ model.name }}</h4>
                  <p>{{ model.description || '暂无描述' }}</p>
                </div>
              </div>
              <button 
                class="add-item-btn"
                :disabled="isModelAdded(model)"
                @click="addToMyModels(model)"
              >
                {{ isModelAdded(model) ? '已添加' : '+ 添加' }}
              </button>
            </div>
            
            <div v-if="modelLibrary.length === 0" class="empty-selector">
              <p>没有找到模型</p>
            </div>
          </div>
          
          <div v-if="libraryTotal > 0" class="selector-pagination">
            <button :disabled="libraryPage === 1 || libraryLoading" @click="loadModelLibrary(libraryPage - 1)">上一页</button>
            <span>{{ libraryPage }} / {{ Math.max(1, Math.ceil(libraryTotal / 12)) }}</span>
            <button :disabled="libraryPage >= Math.ceil(libraryTotal / 12) || libraryLoading" @click="loadModelLibrary(libraryPage + 1)">下一页</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据方法选择器模态框 -->
    <div v-if="showDataMethodSelector" class="modal-overlay" @click.self="showDataMethodSelector = false">
      <div class="modal-content selector-modal">
        <div class="modal-header">
          <h2>从数据方法库选择</h2>
          <button class="close-btn" @click="showDataMethodSelector = false">×</button>
        </div>
        <div class="modal-body">
          <div class="selector-search">
            <input 
              type="text" 
              v-model="librarySearchQuery" 
              placeholder="搜索数据方法..."
              @keyup.enter="searchDataMethodLibrary"
            >
            <button @click="searchDataMethodLibrary">搜索</button>
          </div>
          
          <div v-if="libraryLoading" class="selector-loading">
            <div class="spinner"></div>
            <p>加载中...</p>
          </div>
          
          <div v-else class="selector-list">
            <div 
              v-for="method in dataMethodLibrary" 
              :key="method.id" 
              class="selector-item"
              :class="{ added: isDataMethodAdded(method) }"
            >
              <div class="item-info">
                <div class="item-details">
                  <h4>{{ method.name }}</h4>
                  <p>{{ method.description || '暂无描述' }}</p>
                </div>
              </div>
              <button 
                class="add-item-btn"
                :disabled="isDataMethodAdded(method)"
                @click="addToMyDataMethods(method)"
              >
                {{ isDataMethodAdded(method) ? '已添加' : '+ 添加' }}
              </button>
            </div>
            
            <div v-if="dataMethodLibrary.length === 0" class="empty-selector">
              <p>没有找到数据方法</p>
            </div>
          </div>
          
          <div v-if="libraryTotal > 0" class="selector-pagination">
            <button :disabled="libraryPage === 1 || libraryLoading" @click="loadDataMethodLibrary(libraryPage - 1)">上一页</button>
            <span>{{ libraryPage }} / {{ Math.max(1, Math.ceil(libraryTotal / 12)) }}</span>
            <button :disabled="libraryPage >= Math.ceil(libraryTotal / 12) || libraryLoading" @click="loadDataMethodLibrary(libraryPage + 1)">下一页</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建项目模态框 -->
    <div v-if="showCreateProjectModal" class="modal-overlay" @click.self="showCreateProjectModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>创建新项目</h2>
          <button class="close-btn" @click="showCreateProjectModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>项目名称</label>
            <input 
              type="text" 
              v-model="newProjectName" 
              placeholder="输入项目名称"
              @keyup.enter="createProject"
            >
          </div>
          <div class="form-group">
            <label>描述（可选）</label>
            <textarea 
              v-model="newProjectDescription" 
              placeholder="项目描述"
              rows="3"
            ></textarea>
          </div>
          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="newProjectIsPublic">
              <span class="checkbox-custom"></span>
              <span class="checkbox-text">project 新建时是否公开</span>
            </label>
            <p class="checkbox-hint">公开后，其他用户可以在 Shared Space 查看和 Fork 您的项目</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showCreateProjectModal = false">取消</button>
          <button class="btn-create" @click="createProject" :disabled="!newProjectName.trim() || isCreating">
            {{ isCreating ? '创建中...' : '创建项目' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Case 发布面板模态框 -->
    <div v-if="showCasePublishModal" class="modal-overlay" @click.self="showCasePublishModal = false">
      <div class="modal-content case-publish-modal">
        <div class="modal-header">
          <h2>Publish as Case</h2>
          <button class="close-btn" @click="showCasePublishModal = false">×</button>
        </div>
        <div class="modal-body case-publish-body">
          <p class="case-publish-hint">Fill in the case metadata. Once published, the project will be public and appear in the Case Library.</p>

          <div class="case-form-grid">
            <!-- 左列 -->
            <div class="case-form-col">
              <div class="form-group">
                <label>Case Title <span class="required">*</span></label>
                <input type="text" v-model="caseForm.title" placeholder="Enter case title">
              </div>
              <div class="form-group">
                <label>Summary</label>
                <textarea v-model="caseForm.summary" placeholder="Describe what this case demonstrates" rows="3"></textarea>
              </div>
              <div class="form-group">
                <label>Scenario</label>
                <input type="text" v-model="caseForm.scenario" placeholder="e.g. Urban planning, Hazard analysis">
              </div>
              <div class="form-group">
                <label>Core Notebook</label>
                <input type="text" v-model="caseForm.coreNotebook" placeholder="e.g. main.ipynb">
              </div>
              <div class="form-group">
                <label>Environment</label>
                <input type="text" v-model="caseForm.environment" placeholder="e.g. Python 3.10 + GDAL">
              </div>
            </div>
            <!-- 右列 -->
            <div class="case-form-col">
              <div class="form-group">
                <label>Tags <span class="field-hint">comma-separated</span></label>
                <input type="text" v-model="caseForm.tags" placeholder="e.g. Raster, GeoTIFF, Validation">
              </div>
              <div class="form-group">
                <label>Datasets <span class="field-hint">semicolon-separated</span></label>
                <textarea v-model="caseForm.datasets" placeholder="e.g. DEM_30m.tif; landuse_2020.shp" rows="2"></textarea>
              </div>
              <div class="form-group">
                <label>Reproduction Steps <span class="field-hint">semicolon-separated</span></label>
                <textarea v-model="caseForm.steps" placeholder="e.g. Open notebook; Run all cells; Check output" rows="3"></textarea>
              </div>
              <div class="form-group">
                <label>Expected Results <span class="field-hint">semicolon-separated</span></label>
                <textarea v-model="caseForm.results" placeholder="e.g. Output raster generated; Validation passed" rows="3"></textarea>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showCasePublishModal = false">Cancel</button>
          <button class="btn-create" @click="submitCasePublish" :disabled="!caseForm.title.trim() || casePublishSubmitting">
            {{ casePublishSubmitting ? 'Publishing...' : 'Publish Case' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 数据上传模态框 -->
    <div v-if="showDataUploader" class="modal-overlay" @click.self="closeDataUploader">
      <div class="modal-content upload-modal">
        <div class="modal-header">
          <h2>上传数据</h2>
          <button class="close-btn" @click="closeDataUploader">×</button>
        </div>
        <div class="modal-body">
          <!-- 文件选择区域 -->
          <div 
            class="upload-dropzone"
            :class="{ 'dragover': isDragging, 'has-file': uploadFile }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleFileDrop"
            @click="triggerFileInput"
          >
            <input 
              type="file" 
              ref="fileInput" 
              @change="handleFileSelect" 
              style="display: none"
            >
            <div v-if="!uploadFile" class="dropzone-content">
              <p class="dropzone-text">拖拽文件到此处，或点击选择文件</p>
              <p class="dropzone-hint">支持 CSV, JSON, GeoJSON, TIF, SHP, NC 等格式</p>
            </div>
            <div v-else class="file-preview">
              <div class="file-icon">{{ getDataIcon(getFileExtension(uploadFile.name)) }}</div>
              <div class="file-info">
                <span class="file-name">{{ uploadFile.name }}</span>
                <span class="file-size">{{ formatSize(uploadFile.size) }}</span>
              </div>
              <button class="remove-file-btn" @click.stop="removeUploadFile">×</button>
            </div>
          </div>

          <!-- 数据描述 -->
          <div class="form-group">
            <label>数据描述（可选）</label>
            <textarea 
              v-model="uploadDataDescription" 
              placeholder="描述这份数据的内容、来源、用途等"
              rows="3"
            ></textarea>
          </div>

          <!-- 上传进度 -->
          <div v-if="uploadProgress > 0 && uploadProgress < 100" class="upload-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
            </div>
            <span class="progress-text">{{ uploadProgress }}%</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeDataUploader" :disabled="isUploading">取消</button>
          <button 
            class="btn-create" 
            @click="uploadData" 
            :disabled="!uploadFile || isUploading"
          >
            {{ isUploading ? '上传中...' : '上传数据' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const router = useRouter()

// 状态
const isLoading = ref(false)
const socialLoadingProvider = ref('')
const loginForm = ref({
  email: '',
  password: ''
})
const isCreating = ref(false)
const user = ref(null)
const projects = ref([])
const activeMenu = ref('recent') // recent, myspace, mymodel, mydata, mydatamethod, sharedspace, environments
const myspaceTab = ref('projects') // projects, data
const searchQuery = ref('')
const showCreateProjectModal = ref(false)
const openMenuProject = ref(null)
const newProjectName = ref('')
const newProjectDescription = ref('')
const newProjectIsPublic = ref(false)
const resourceTimeFilter = ref('7')

// Shared Space 相关状态
const sharedProjects = ref([])
const loadingSharedProjects = ref(false)
const sharedSearchQuery = ref('')
const forkingProject = ref(null)  // 正在 fork 的项目名

// My Data 相关状态
const myDataList = ref([])
const myDataPage = ref(1)
const myDataPageSize = ref(10)
const showDataUploader = ref(false)
const uploadFile = ref(null)
const uploadDataName = ref('')
const uploadDataDescription = ref('')
const uploadProgress = ref(0)
const isUploading = ref(false)
const isDragging = ref(false)
const fileInput = ref(null)
const loadingMyData = ref(false)

// 网盘风格相关状态
const currentDataPath = ref('/')
const selectedDataItems = ref([])
const showDataContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuItem = ref(null)

// Fork 数据相关状态
const showForkDataModal = ref(false)
const forkSearchQuery = ref('')
const forkSelectedCategory = ref('')
const dataCenterList = ref([])
const dataCenterPage = ref(1)
const dataCenterTotal = ref(0)
const dataCenterTotalPages = ref(0)
const loadingDataCenter = ref(false)
const forkSelectedItems = ref([])
const forkingData = ref(false)
const forkedDataIds = ref([]) // 已 fork 的数据 ID 列表

// Case 发布面板状态
const showCasePublishModal = ref(false)
const casePublishProject = ref(null)
const casePublishSubmitting = ref(false)
const caseForm = ref({
  title: '',
  summary: '',
  scenario: '',
  coreNotebook: '',
  environment: '',
  tags: '',
  datasets: '',
  steps: '',
  results: ''
})

// Toast 提示框状态
const toastMessage = ref('')
const toastType = ref('success') // success, error, warning, info
const showToast = ref(false)
let toastTimer = null
const oauthErrorMessages = {
  github_not_configured: 'GitHub 登录尚未配置',
  github_no_code: 'GitHub 未返回授权码，请重试',
  github_token_failed: 'GitHub 令牌获取失败',
  github_oauth_failed: 'GitHub 登录失败，请稍后重试',
  google_not_configured: 'Google 登录尚未配置',
  google_access_denied: '你已取消 Google 登录授权',
  google_no_code: 'Google 未返回授权码，请重试',
  google_token_failed: 'Google 令牌获取失败',
  google_profile_failed: 'Google 账户信息获取失败',
  google_oauth_failed: 'Google 登录失败，请稍后重试'
}

// 显示提示框
const showToastMessage = (message, type = 'success', duration = 3000) => {
  toastMessage.value = message
  toastType.value = type
  showToast.value = true
  
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    showToast.value = false
  }, duration)
}

// 数据中心分类
const dataCenterCategories = [
  { label: '全部', value: '' },
  { label: '基础地理', value: '基础地理' },
  { label: '土地利用', value: '土地利用/覆盖' },
  { label: '地形', value: '地形' },
  { label: '气候', value: '气候' },
  { label: '水文', value: '水文' },
  { label: '土壤', value: '土壤' },
  { label: '植被', value: '植被' },
  { label: '生态系统', value: '生态系统' },
  { label: '人口', value: '人口' },
  { label: '社会经济', value: '社会经济' },
  { label: '灾害', value: '灾害' },
  { label: '其他', value: '其他数据' }
]

// My Model 和 My Data Method 相关状态
const myModels = ref([])
const myDataMethods = ref([])
const showModelSelector = ref(false)
const showDataMethodSelector = ref(false)
const modelLibrary = ref([])
const dataMethodLibrary = ref([])
const libraryLoading = ref(false)
const librarySearchQuery = ref('')
const libraryPage = ref(1)
const libraryTotal = ref(0)

// Environments 相关状态
const availableEnvironments = ref([])
const loadingEnvironments = ref(false)
const hoverEnvId = ref(null)
const userDefaultEnvId = ref(localStorage.getItem('default_jupyter_env') || null)
const selectedEnvId = ref(localStorage.getItem('default_jupyter_env') || 'geomodel-jupyter')

// 选择环境
const selectEnvironment = (envId) => {
  selectedEnvId.value = envId
  localStorage.setItem('default_jupyter_env', envId)
}

// 使用选定环境启动（暂时只是提示）
const launchWithSelectedEnv = () => {
  alert(`Will launch JupyterLab with ${selectedEnvId.value} environment\n\nPlease go to My Space and select a project to start Jupyter`)
}

// 计算默认环境
const defaultEnvironment = computed(() => {
  // 优先使用用户设置的默认环境
  if (userDefaultEnvId.value) {
    const userDefault = availableEnvironments.value.find(e => e.id === userDefaultEnvId.value)
    if (userDefault) return userDefault
  }
  // 否则使用系统默认
  return availableEnvironments.value.find(e => e.default) || availableEnvironments.value[0]
})

// 切换菜单时清空搜索
watch(activeMenu, (newMenu) => {
  searchQuery.value = ''
  // 切换到 environments 时加载环境列表
  if (newMenu === 'environments' && availableEnvironments.value.length === 0) {
    loadEnvironments()
  }
  // 切换到 sharedspace 时加载共享项目列表
  if (newMenu === 'sharedspace') {
    loadSharedProjects()
  }
  // 切换到 mydata 时加载数据列表
  if (newMenu === 'mydata') {
    loadMyDataList()
  }
})

// 搜索时重置分页
watch(searchQuery, () => {
  if (activeMenu.value === 'mydata') {
    myDataPage.value = 1
  }
})

// 页面标题映射
const pageTitles = {
  recent: 'Recent',
  myspace: 'My Space',
  sharedspace: 'Shared Space',
  mymodel: 'My Model',
  mydata: 'My Data',
  mydatamethod: 'My Data Method',
  environments: 'Environments'
}

// 计算属性
const isLoggedIn = computed(() => !!user.value)

// 最近项目（最多5个）
const recentProjects = computed(() => {
  return [...projects.value]
    .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt))
    .slice(0, 5)
})

// TODO: 最近使用的资源（最多5个）
// TODO: 最近使用的数据（最多5个）

// 过滤后的项目列表
const filteredProjects = computed(() => {
  if (!searchQuery.value) return projects.value
  const query = searchQuery.value.toLowerCase()
  return projects.value.filter(p => p.name.toLowerCase().includes(query))
})

// 过滤后的最近项目
const filteredRecentProjects = computed(() => {
  const sorted = [...projects.value]
    .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt))
    .slice(0, 10)
  if (!searchQuery.value) return sorted
  const query = searchQuery.value.toLowerCase()
  return sorted.filter(p => p.name.toLowerCase().includes(query))
})

// 过滤后的模型列表
const filteredMyModels = computed(() => {
  if (!searchQuery.value) return myModels.value
  const query = searchQuery.value.toLowerCase()
  return myModels.value.filter(m => 
    m.name.toLowerCase().includes(query) || 
    (m.description && m.description.toLowerCase().includes(query))
  )
})

// 过滤后的数据方法列表
const filteredMyDataMethods = computed(() => {
  if (!searchQuery.value) return myDataMethods.value
  const query = searchQuery.value.toLowerCase()
  return myDataMethods.value.filter(m => 
    m.name.toLowerCase().includes(query) || 
    (m.description && m.description.toLowerCase().includes(query))
  )
})

// 过滤后的共享项目列表
const filteredSharedProjects = computed(() => {
  if (!sharedSearchQuery.value) return sharedProjects.value
  const query = sharedSearchQuery.value.toLowerCase()
  return sharedProjects.value.filter(p => 
    p.name.toLowerCase().includes(query) || 
    p.owner.toLowerCase().includes(query) ||
    (p.description && p.description.toLowerCase().includes(query))
  )
})

// 当前路径下的数据项
const currentDataItems = computed(() => {
  const path = currentDataPath.value
  if (path === '/') {
    // 根目录显示所有顶层项目
    return myDataList.value.filter(d => !d.parentId)
  }
  // 子文件夹内容
  const parentFolder = myDataList.value.find(d => d.type === 'folder' && d.path === path)
  if (parentFolder) {
    return myDataList.value.filter(d => d.parentId === parentFolder.id)
  }
  return []
})

// 过滤后的我的数据列表
const filteredMyDataList = computed(() => {
  if (!searchQuery.value) return myDataList.value
  const query = searchQuery.value.toLowerCase()
  return myDataList.value.filter(d => 
    d.name.toLowerCase().includes(query) || 
    (d.description && d.description.toLowerCase().includes(query))
  )
})

// 分页后的数据列表
const paginatedMyDataList = computed(() => {
  const start = (myDataPage.value - 1) * myDataPageSize.value
  const end = start + myDataPageSize.value
  return filteredMyDataList.value.slice(start, end)
})

// 总页数
const myDataTotalPages = computed(() => {
  return Math.ceil(filteredMyDataList.value.length / myDataPageSize.value) || 1
})

// 可见的页码列表
const visiblePageNumbers = computed(() => {
  const total = myDataTotalPages.value
  const current = myDataPage.value
  const pages = []
  
  if (total <= 5) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    if (current <= 3) {
      pages.push(1, 2, 3, 4, 5)
    } else if (current >= total - 2) {
      pages.push(total - 4, total - 3, total - 2, total - 1, total)
    } else {
      pages.push(current - 2, current - 1, current, current + 1, current + 2)
    }
  }
  
  return pages.filter(p => p >= 1 && p <= total)
})

// 搜索框 placeholder
const searchPlaceholder = computed(() => {
  switch (activeMenu.value) {
    case 'recent': return 'Search recent projects...'
    case 'myspace': return 'Search my projects...'
    case 'mymodel': return 'Search my models...'
    case 'mydata': return 'Search my data...'
    case 'mydatamethod': return 'Search my data methods...'
    default: return 'Search...'
  }
})

// 计算总存储空间
const totalSize = computed(() => {
  const total = projects.value.reduce((sum, p) => sum + (p.size || 0), 0)
  return formatSize(total)
})

// 计算最近活动时间
const lastModified = computed(() => {
  if (projects.value.length === 0) return '无'
  const latest = projects.value.reduce((latest, p) => {
    const pTime = new Date(p.modifiedAt).getTime()
    return pTime > latest ? pTime : latest
  }, 0)
  if (latest === 0) return '无'
  const date = new Date(latest)
  const now = new Date()
  const diff = now - date
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
})

// 跳转到项目详情页
const goToProject = (project) => {
  openMenuProject.value = null
  router.push(`/jupyter/project/${encodeURIComponent(project.name)}`)
}

// 创建新项目
const createProject = async () => {
  if (!newProjectName.value.trim()) return
  
  isCreating.value = true
  try {
    const res = await authAxios().post('/api/jupyter/projects', {
      name: newProjectName.value.trim(),
      description: newProjectDescription.value.trim(),
      isPublic: newProjectIsPublic.value
    })
    
    if (res.data.status === 'created') {
      // 添加到列表并跳转
      projects.value.unshift(res.data.project)
      showCreateProjectModal.value = false
      newProjectName.value = ''
      newProjectDescription.value = ''
      newProjectIsPublic.value = false
      
      // 跳转到新项目
      router.push(`/jupyter/project/${encodeURIComponent(res.data.project.name)}`)
    }
  } catch (e) {
    alert('创建失败: ' + (e.response?.data?.error || e.message))
  } finally {
    isCreating.value = false
  }
}

// 切换项目菜单
const toggleProjectMenu = (project) => {
  if (openMenuProject.value === project.name) {
    openMenuProject.value = null
  } else {
    openMenuProject.value = project.name
  }
}

// 编辑项目（名称和描述）
const editProject = async (project) => {
  // 使用简单的 prompt 进行编辑
  const newName = prompt('项目名称:', project.name)
  if (newName === null) return // 用户取消
  
  const newDesc = prompt('项目描述:', project.description || '')
  if (newDesc === null) return // 用户取消
  
  const hasNameChange = newName.trim() && newName.trim() !== project.name
  const hasDescChange = newDesc !== (project.description || '')
  
  if (!hasNameChange && !hasDescChange) {
    return // 没有变化
  }
  
  try {
    await authAxios().put(`/api/jupyter/projects/${encodeURIComponent(project.name)}`, {
      newName: hasNameChange ? newName.trim() : undefined,
      description: newDesc
    })
    // 更新本地列表
    const idx = projects.value.findIndex(p => p.name === project.name)
    if (idx !== -1) {
      if (hasNameChange) {
        projects.value[idx].name = newName.trim()
      }
      projects.value[idx].description = newDesc
    }
  } catch (e) {
    alert('更新失败: ' + (e.response?.data?.error || e.message))
  }
  openMenuProject.value = null
}

// 保留 renameProject 以兼容其他地方的调用
const renameProject = editProject

// 删除项目
const deleteProject = async (project) => {
  if (confirm(`确定要删除项目 "${project.name}" 吗？\n此操作将删除项目内所有文件，不可恢复！`)) {
    try {
      await authAxios().delete(`/api/jupyter/projects/${encodeURIComponent(project.name)}`)
      // 从列表移除
      projects.value = projects.value.filter(p => p.name !== project.name)
    } catch (e) {
      alert('删除失败: ' + (e.response?.data?.error || e.message))
    }
  }
  openMenuProject.value = null
}

// 切换项目公开/私有状态
const toggleProjectVisibility = async (project) => {
  const newVisibility = !project.isPublic
  const action = newVisibility ? '公开' : '设为私有'
  
  if (!confirm(`确定要将项目 "${project.name}" ${action}吗？\n${newVisibility ? '公开后其他用户可以查看和 Fork 此项目' : '设为私有后将不再出现在 Shared Space'}`)) {
    openMenuProject.value = null
    return
  }
  
  try {
    await authAxios().put(`/api/jupyter/projects/${encodeURIComponent(project.name)}/visibility`, {
      isPublic: newVisibility
    })
    // 更新本地状态
    const idx = projects.value.findIndex(p => p.name === project.name)
    if (idx !== -1) {
      projects.value[idx].isPublic = newVisibility
    }
  } catch (e) {
    alert('更新失败: ' + (e.response?.data?.error || e.message))
  }
  openMenuProject.value = null
}

const toggleCasePublish = async (project) => {
  if (project.isCase) {
    if (!confirm(`Unpublish case for project "${project.name}"?`)) return
    try {
      await authAxios().put(`/api/jupyter/projects/${encodeURIComponent(project.name)}/case`, {
        isCase: false
      })
      const idx = projects.value.findIndex(p => p.name === project.name)
      if (idx !== -1) {
        projects.value[idx].isCase = false
        projects.value[idx].case = null
        projects.value[idx].caseTitle = ''
      }
      showToastMessage('Case unpublished', 'success')
    } catch (e) {
      showToastMessage('Failed to unpublish case: ' + (e.response?.data?.error || e.message), 'error')
    }
    return
  }

  // 打开 Case 发布面板，预填已有数据
  casePublishProject.value = project
  caseForm.value = {
    title: project.caseTitle || project.case?.title || project.name,
    summary: project.case?.summary || project.description || '',
    scenario: project.case?.scenario || '',
    coreNotebook: project.case?.coreNotebook || '',
    environment: project.case?.environment || '',
    tags: (project.case?.tags || []).join(', '),
    datasets: (project.case?.datasets || []).join('; '),
    steps: (project.case?.steps || []).join('; '),
    results: (project.case?.results || []).join('; ')
  }
  showCasePublishModal.value = true
}

const submitCasePublish = async () => {
  const project = casePublishProject.value
  if (!project) return
  casePublishSubmitting.value = true
  try {
    const res = await authAxios().put(`/api/jupyter/projects/${encodeURIComponent(project.name)}/case`, {
      isCase: true,
      caseMeta: {
        title: caseForm.value.title,
        summary: caseForm.value.summary,
        scenario: caseForm.value.scenario,
        coreNotebook: caseForm.value.coreNotebook,
        environment: caseForm.value.environment,
        tags: caseForm.value.tags,
        datasets: caseForm.value.datasets,
        steps: caseForm.value.steps,
        results: caseForm.value.results
      }
    })
    const idx = projects.value.findIndex(p => p.name === project.name)
    if (idx !== -1) {
      projects.value[idx].isCase = true
      projects.value[idx].isPublic = true
      projects.value[idx].case = res.data.case || null
      projects.value[idx].caseTitle = res.data.case?.title || caseForm.value.title.trim()
    }
    showCasePublishModal.value = false
    showToastMessage('Case published successfully (project is now public)', 'success')
  } catch (e) {
    showToastMessage('Failed to publish case: ' + (e.response?.data?.error || e.message), 'error')
  } finally {
    casePublishSubmitting.value = false
  }
}

// 格式化日期时间
const formatDateTime = (date) => {
  if (!date) return '-'
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${year}/${month}/${day} ${hour}:${minute}`
}

// 格式化相对时间
const formatRelativeTime = (date) => {
  if (!date) return '未知'
  const now = new Date()
  const d = new Date(date)
  const diffMs = now - d
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  
  if (diffDay > 30) {
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}/${month}/${day}`
  } else if (diffDay > 0) {
    return `${diffDay} 天前`
  } else if (diffHour > 0) {
    return `${diffHour} 小时前`
  } else if (diffMin > 0) {
    return `${diffMin} 分钟前`
  } else {
    return '刚刚'
  }
}

// 获取存储的 token
const getToken = () => localStorage.getItem('jupyter_token')
const setToken = (token) => localStorage.setItem('jupyter_token', token)
const clearToken = () => localStorage.removeItem('jupyter_token')

// 创建带认证的 axios 实例
const authAxios = () => {
  const token = getToken()
  return axios.create({
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
}

const getAuthBaseUrl = () => {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/+$/, '')
  }

  return window.location.origin.replace(/\/+$/, '')
}

const startOAuthLogin = (provider) => {
  socialLoadingProvider.value = provider
  window.location.assign(`${getAuthBaseUrl()}/api/auth/${provider}`)
}

// OpenGMS 登录
const loginWithOpenGMS = async () => {
  if (!loginForm.value.email || !loginForm.value.password) {
    showToastMessage('请输入 OpenGMS 邮箱和密码', 'warning')
    return
  }

  isLoading.value = true
  try {
    const res = await axios.post('/api/auth/opengms/login', {
      email: loginForm.value.email,
      password: loginForm.value.password
    })

    if (!res.data?.token) {
      throw new Error(res.data?.error || '登录失败')
    }

    setToken(res.data.token)
    loginForm.value.password = ''

    const loggedIn = await fetchUser()
    if (!loggedIn) {
      throw new Error('登录状态校验失败')
    }

    await Promise.all([
      loadProjects(),
      loadMyModels(),
      loadMyDataMethods()
    ])

    showToastMessage('登录成功', 'success')
  } catch (e) {
    clearToken()
    showToastMessage('登录失败: ' + (e.response?.data?.error || e.message), 'error')
  } finally {
    isLoading.value = false
  }
}

// 登出
const logout = async () => {
  try {
    await authAxios().post('/api/auth/logout')
  } catch (e) {
    // ignore
  }
  clearToken()
  user.value = null
  jupyterStatus.value = 'stopped'
}

// 加载环境列表
const loadEnvironments = async () => {
  loadingEnvironments.value = true
  try {
    const res = await authAxios().get('/api/jupyter/images')
    availableEnvironments.value = res.data.images || []
    // 更新 default 标记
    updateEnvironmentDefaults()
  } catch (e) {
    console.error('Failed to load environments:', e)
    availableEnvironments.value = []
  } finally {
    loadingEnvironments.value = false
  }
}

// 更新环境的默认标记
const updateEnvironmentDefaults = () => {
  availableEnvironments.value = availableEnvironments.value.map(env => ({
    ...env,
    default: userDefaultEnvId.value ? env.id === userDefaultEnvId.value : env.default
  }))
}

// 设置默认环境
const setDefaultEnvironment = (envId) => {
  userDefaultEnvId.value = envId
  localStorage.setItem('default_jupyter_env', envId)
  updateEnvironmentDefaults()
}

// ========== Shared Space 相关方法 ==========

// 加载共享项目列表
const loadSharedProjects = async () => {
  loadingSharedProjects.value = true
  try {
    const res = await authAxios().get('/api/jupyter/shared-projects')
    sharedProjects.value = res.data.projects || []
  } catch (e) {
    console.error('Failed to load shared projects:', e)
    sharedProjects.value = []
  } finally {
    loadingSharedProjects.value = false
  }
}

// 预览共享项目
const previewSharedProject = (project) => {
  // 跳转到共享项目预览页面
  router.push(`/jupyter/shared/${encodeURIComponent(project.owner)}/${encodeURIComponent(project.name)}`)
}

// Fork 项目
const forkProject = async (project) => {
  const key = `${project.owner}/${project.name}`
  forkingProject.value = key
  
  try {
    const res = await authAxios().post(`/api/jupyter/fork/${encodeURIComponent(project.owner)}/${encodeURIComponent(project.name)}`)
    
    if (res.data.status === 'forked') {
      // 添加到我的项目列表
      projects.value.unshift(res.data.project)
      
      // 显示成功提示
      alert(`成功 Fork 项目！新项目名称：${res.data.project.name}`)
      
      // 询问是否跳转到新项目
      if (confirm('是否立即打开 Fork 的项目？')) {
        router.push(`/jupyter/project/${encodeURIComponent(res.data.project.name)}`)
      }
    }
  } catch (e) {
    alert('Fork 失败: ' + (e.response?.data?.error || e.message))
  } finally {
    forkingProject.value = null
  }
}

// ========== My Data 相关方法 ==========

// 加载用户的数据列表
const loadMyDataList = async () => {
  loadingMyData.value = true
  try {
    const res = await authAxios().get('/api/jupyter/my-data')
    myDataList.value = res.data.dataList || []
    // 提取已 fork 的数据 ID
    forkedDataIds.value = myDataList.value
      .filter(d => d.forked && d.sourceId)
      .map(d => d.sourceId)
  } catch (e) {
    console.error('Failed to load my data:', e)
    myDataList.value = []
  } finally {
    loadingMyData.value = false
  }
}

// 网盘风格方法的别名
const loadMyData = loadMyDataList

// 导航返回上级目录
const navigateBack = () => {
  if (currentDataPath.value === '/') return
  const parts = currentDataPath.value.split('/').filter(p => p)
  parts.pop()
  currentDataPath.value = parts.length === 0 ? '/' : '/' + parts.join('/')
  selectedDataItems.value = []
}

// 创建新文件夹
const createNewFolder = async () => {
  const folderName = prompt('请输入文件夹名称:')
  if (!folderName || !folderName.trim()) return
  
  try {
    const res = await authAxios().post('/api/jupyter/my-data/folder', {
      name: folderName.trim(),
      path: currentDataPath.value,
      parentId: getCurrentParentId()
    })
    
    if (res.data.status === 'created') {
      // 添加到列表
      myDataList.value.push({
        id: res.data.id || Date.now().toString(),
        name: folderName.trim(),
        type: 'folder',
        path: currentDataPath.value === '/' 
          ? '/' + folderName.trim()
          : currentDataPath.value + '/' + folderName.trim(),
        parentId: getCurrentParentId(),
        createdAt: new Date().toISOString()
      })
      showToastMessage('文件夹创建成功', 'success')
    }
  } catch (e) {
    console.error('Failed to create folder:', e)
    showToastMessage('创建文件夹失败: ' + (e.response?.data?.error || e.message), 'error')
  }
}

// 获取当前父文件夹ID
const getCurrentParentId = () => {
  if (currentDataPath.value === '/') return null
  const folder = myDataList.value.find(d => d.type === 'folder' && d.path === currentDataPath.value)
  return folder?.id || null
}

// 单击选择项目
const handleItemClick = (item) => {
  const index = selectedDataItems.value.indexOf(item.id)
  if (index > -1) {
    selectedDataItems.value.splice(index, 1)
  } else {
    selectedDataItems.value = [item.id]
  }
}

// 双击打开文件夹或下载文件
const handleItemDoubleClick = (item) => {
  if (item.type === 'folder') {
    currentDataPath.value = item.path
    selectedDataItems.value = []
  } else {
    downloadData(item)
  }
}

// 打开右键菜单
const openItemContextMenu = (event, item) => {
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuItem.value = item
  showDataContextMenu.value = true
  
  // 点击其他地方关闭菜单
  setTimeout(() => {
    document.addEventListener('click', closeContextMenu, { once: true })
  }, 0)
}

const closeContextMenu = () => {
  showDataContextMenu.value = false
}

// 右键菜单操作
const downloadContextItem = () => {
  if (contextMenuItem.value) {
    downloadData(contextMenuItem.value)
  }
  showDataContextMenu.value = false
}

const renameContextItem = async () => {
  if (!contextMenuItem.value) return
  const newName = prompt('请输入新名称:', contextMenuItem.value.name)
  if (!newName || newName === contextMenuItem.value.name) {
    showDataContextMenu.value = false
    return
  }
  
  try {
    await authAxios().put(`/api/jupyter/my-data/${contextMenuItem.value.id}`, {
      name: newName.trim()
    })
    contextMenuItem.value.name = newName.trim()
    showToastMessage('重命名成功', 'success')
  } catch (e) {
    showToastMessage('重命名失败: ' + (e.response?.data?.error || e.message), 'error')
  }
  showDataContextMenu.value = false
}

const deleteContextItem = async () => {
  if (!contextMenuItem.value) return
  if (!confirm(`确定要删除 "${contextMenuItem.value.name}" 吗？`)) {
    showDataContextMenu.value = false
    return
  }
  
  try {
    await authAxios().delete(`/api/jupyter/my-data/${contextMenuItem.value.id}`)
    const index = myDataList.value.findIndex(d => d.id === contextMenuItem.value.id)
    if (index > -1) {
      myDataList.value.splice(index, 1)
    }
    showToastMessage('删除成功', 'success')
  } catch (e) {
    showToastMessage('删除失败: ' + (e.response?.data?.error || e.message), 'error')
  }
  showDataContextMenu.value = false
}

// 获取文件图标类型
const getFileIconClass = (item) => {
  const ext = getFileExtension(item.name).toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) return 'icon-image'
  if (['tif', 'tiff', 'geotiff'].includes(ext)) return 'icon-geo'
  if (['shp', 'geojson', 'kml', 'kmz', 'gpx'].includes(ext)) return 'icon-geo'
  if (['nc', 'hdf', 'hdf5', 'h5'].includes(ext)) return 'icon-data'
  if (['csv', 'xlsx', 'xls'].includes(ext)) return 'icon-table'
  if (['pdf'].includes(ext)) return 'icon-pdf'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'icon-archive'
  if (['doc', 'docx', 'txt', 'md'].includes(ext)) return 'icon-doc'
  return 'icon-file'
}

// 获取文件扩展名
const getFileExtension = (filename) => {
  if (!filename) return ''
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop().toUpperCase() : ''
}

// 计算总数据大小
const calculateTotalDataSize = () => {
  const total = myDataList.value.reduce((sum, d) => sum + (d.size || 0), 0)
  return formatSize(total)
}

// ========== Fork 数据中心相关方法 ==========

// 打开 Fork 模态框
const openForkDataModal = () => {
  showForkDataModal.value = true
  forkSearchQuery.value = ''
  forkSelectedCategory.value = ''
  forkSelectedItems.value = []
  dataCenterPage.value = 1
  fetchDataCenter()
}

// 获取数据中心数据
const fetchDataCenter = async () => {
  loadingDataCenter.value = true
  try {
    const params = {
      asc: false,
      page: dataCenterPage.value,
      pageSize: 12,
      searchText: forkSearchQuery.value,
      sortField: 'createTime',
      tagClass: 'problemTags',
      tagName: forkSelectedCategory.value
    }
    
    const response = await axios.post('/api/datacenter/list', params)
    
    if (response.data.code === 0 && response.data.data) {
      dataCenterList.value = response.data.data.content || []
      dataCenterTotal.value = response.data.data.totalElements || 0
      dataCenterTotalPages.value = response.data.data.totalPages || 0
    } else {
      dataCenterList.value = []
    }
  } catch (e) {
    console.error('Failed to fetch data center:', e)
    dataCenterList.value = []
  } finally {
    loadingDataCenter.value = false
  }
}

// 搜索数据中心
const searchDataCenter = () => {
  dataCenterPage.value = 1
  fetchDataCenter()
}

// 选择分类
const selectForkCategory = (category) => {
  forkSelectedCategory.value = category
  dataCenterPage.value = 1
  fetchDataCenter()
}

// 切换 Fork 选择
const toggleForkSelection = (item) => {
  const index = forkSelectedItems.value.indexOf(item.id)
  if (index > -1) {
    forkSelectedItems.value.splice(index, 1)
  } else {
    forkSelectedItems.value.push(item.id)
  }
}

// Fork 分页
const changeForkPage = (page) => {
  dataCenterPage.value = page
  fetchDataCenter()
}

// 检查是否已 Fork
const isItemForked = (itemId) => {
  return forkedDataIds.value.includes(itemId)
}

// Fork 单个数据
const forkSingleItem = async (item) => {
  if (isItemForked(item.id)) return
  
  try {
    const dataToFork = {
      sourceId: item.id,
      name: item.name,
      type: item.suffix || 'unknown',
      size: item.fileSize || 0,
      description: item.description || '',
      downloadUrl: `https://geomodeling.njnu.edu.cn/OpenGMPBack/userRes/downloadDataItem/${item.id}`,
      forked: true,
      source: 'datacenter',
      author: item.author || '',
      parentId: getCurrentParentId(),
      path: currentDataPath.value
    }
    
    const res = await authAxios().post('/api/jupyter/my-data/fork', dataToFork)
    
    if (res.data.status === 'forked') {
      forkedDataIds.value.push(item.id)
      // 重新加载数据列表
      loadMyDataList()
      showToastMessage(`成功 Fork: ${item.name}`, 'success')
    }
  } catch (e) {
    console.error('Fork failed:', e)
    showToastMessage('Fork 失败: ' + (e.response?.data?.error || e.message), 'error')
  }
}

// Fork 选中的数据
const forkSelectedData = async () => {
  if (forkSelectedItems.value.length === 0) return
  
  forkingData.value = true
  let successCount = 0
  let failCount = 0
  
  for (const itemId of forkSelectedItems.value) {
    const item = dataCenterList.value.find(d => d.id === itemId)
    if (!item || isItemForked(itemId)) continue
    
    try {
      const dataToFork = {
        sourceId: item.id,
        name: item.name,
        type: item.suffix || 'unknown',
        size: item.fileSize || 0,
        description: item.description || '',
        downloadUrl: `https://geomodeling.njnu.edu.cn/OpenGMPBack/userRes/downloadDataItem/${item.id}`,
        forked: true,
        source: 'datacenter',
        author: item.author || '',
        parentId: getCurrentParentId(),
        path: currentDataPath.value
      }
      
      const res = await authAxios().post('/api/jupyter/my-data/fork', dataToFork)
      
      if (res.data.status === 'forked') {
        forkedDataIds.value.push(item.id)
        successCount++
      }
    } catch (e) {
      console.error(`Fork failed for ${item.name}:`, e)
      failCount++
    }
  }
  
  forkingData.value = false
  forkSelectedItems.value = []
  loadMyDataList()
  
  if (successCount > 0) {
    showToastMessage(`成功 Fork ${successCount} 个数据${failCount > 0 ? `，失败 ${failCount} 个` : ''}`, 'success')
  } else if (failCount > 0) {
    showToastMessage(`Fork 失败 ${failCount} 个数据`, 'error')
  }
  
  showForkDataModal.value = false
}

// 获取数据中心图标
const getDataCenterIcon = (item) => {
  return ''
}

// 打开数据上传器
const openDataUploader = () => {
  uploadFile.value = null
  uploadDataName.value = ''
  uploadDataDescription.value = ''
  uploadProgress.value = 0
  isUploading.value = false
  isDragging.value = false
  showDataUploader.value = true
}

// 关闭数据上传器
const closeDataUploader = () => {
  if (isUploading.value) return
  showDataUploader.value = false
  uploadFile.value = null
  uploadDataName.value = ''
  uploadDataDescription.value = ''
  uploadProgress.value = 0
  isDragging.value = false
}

// 触发文件选择
const triggerFileInput = () => {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

// 处理文件选择
const handleFileSelect = (event) => {
  const files = event.target.files
  if (files && files.length > 0) {
    uploadFile.value = files[0]
    // 自动填充文件名（不含扩展名）作为数据名称
    if (!uploadDataName.value) {
      const fileName = files[0].name
      const lastDotIndex = fileName.lastIndexOf('.')
      uploadDataName.value = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName
    }
  }
}

// 处理拖拽进入
const handleDragOver = (event) => {
  event.preventDefault()
  isDragging.value = true
}

// 处理拖拽离开
const handleDragLeave = () => {
  isDragging.value = false
}

// 处理文件拖放
const handleFileDrop = (event) => {
  event.preventDefault()
  isDragging.value = false
  const files = event.dataTransfer.files
  if (files && files.length > 0) {
    uploadFile.value = files[0]
    // 自动填充文件名
    if (!uploadDataName.value) {
      const fileName = files[0].name
      const lastDotIndex = fileName.lastIndexOf('.')
      uploadDataName.value = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName
    }
  }
}

// 移除已选文件
const removeUploadFile = () => {
  uploadFile.value = null
}

// 上传数据
const uploadData = async () => {
  if (!uploadFile.value) {
    showToastMessage('请选择要上传的文件', 'warning')
    return
  }
  
  isUploading.value = true
  uploadProgress.value = 0
  
  try {
    const formData = new FormData()
    formData.append('file', uploadFile.value)
    formData.append('dataName', uploadDataName.value || uploadFile.value.name)
    formData.append('description', uploadDataDescription.value || '')
    formData.append('parentId', getCurrentParentId() || '')
    formData.append('path', currentDataPath.value)
    
    const res = await authAxios().post('/api/jupyter/upload-data', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        }
      }
    })
    
    if (res.data.success) {
      // 添加到我的数据列表
      const newData = {
        id: res.data.dataId || Date.now().toString(),
        name: uploadDataName.value || uploadFile.value.name,
        filename: uploadFile.value.name,
        description: uploadDataDescription.value,
        type: getFileExtension(uploadFile.value.name),
        size: uploadFile.value.size,
        url: res.data.url,
        parentId: getCurrentParentId(),
        path: currentDataPath.value,
        uploadedAt: new Date().toISOString()
      }
      myDataList.value.unshift(newData)
      
      showToastMessage('上传成功！', 'success')
      closeDataUploader()
    } else {
      throw new Error(res.data.error || '上传失败')
    }
  } catch (e) {
    console.error('Upload failed:', e)
    showToastMessage('上传失败: ' + (e.response?.data?.error || e.message), 'error')
  } finally {
    isUploading.value = false
    uploadProgress.value = 0
  }
}

// 下载数据
const downloadData = (data) => {
  if (data.url) {
    window.open(data.url, '_blank')
  } else {
    showToastMessage('下载链接不可用', 'warning')
  }
}

// 从我的数据中移除
const removeFromMyData = async (data) => {
  if (!confirm(`确定要删除 "${data.name}" 吗？`)) return
  try {
    await authAxios().delete(`/api/jupyter/my-data/${data.id}`)
    myDataList.value = myDataList.value.filter(d => d.id !== data.id)
  } catch (e) {
    alert('删除失败: ' + (e.response?.data?.error || e.message))
  }
}

// 根据数据类型获取图标
const getDataIcon = (type) => {
  return ''
}

// 获取用户信息
const fetchUser = async () => {
  try {
    const res = await authAxios().get('/api/auth/me')
    user.value = res.data
    return true
  } catch (e) {
    clearToken()
    return false
  }
}

// 加载项目列表
const loadProjects = async () => {
  try {
    const res = await authAxios().get('/api/jupyter/projects')
    projects.value = res.data.projects || []
  } catch (e) {
    console.error('Failed to load projects:', e)
  }
}

// ========== My Model 相关方法 ==========

// 加载用户的模型列表
const loadMyModels = async () => {
  try {
    const res = await authAxios().get('/api/jupyter/my-models')
    myModels.value = res.data.models || []
  } catch (e) {
    console.error('Failed to load my models:', e)
  }
}

// 打开模型选择器
const openModelSelector = async () => {
  showModelSelector.value = true
  librarySearchQuery.value = ''
  libraryPage.value = 1
  await loadModelLibrary(1)
}

// 加载模型库
const loadModelLibrary = async (page = 1) => {
  libraryLoading.value = true
  try {
    const res = await axios.get(`/api/ogms/models?page=${page}&limit=12&q=${librarySearchQuery.value}`)
    modelLibrary.value = res.data.data || []
    libraryTotal.value = res.data.total || 0
    libraryPage.value = page
  } catch (e) {
    console.error('Failed to load model library:', e)
    modelLibrary.value = []
  } finally {
    libraryLoading.value = false
  }
}

// 搜索模型库
const searchModelLibrary = () => {
  loadModelLibrary(1)
}

// 检查模型是否已添加
const isModelAdded = (model) => {
  return myModels.value.some(m => m.id === model.id)
}

// 添加到我的模型
const addToMyModels = async (model) => {
  try {
    await authAxios().post('/api/jupyter/my-models', { model })
    myModels.value.push(model)
  } catch (e) {
    alert('添加失败: ' + (e.response?.data?.error || e.message))
  }
}

// 从我的模型移除
const removeFromMyModels = async (model) => {
  if (!confirm(`确定要从列表中移除 "${model.name}" 吗？`)) return
  try {
    await authAxios().delete(`/api/jupyter/my-models/${model.id}`)
    myModels.value = myModels.value.filter(m => m.id !== model.id)
  } catch (e) {
    alert('移除失败: ' + (e.response?.data?.error || e.message))
  }
}

// 运行模型（跳转到模型页面）
const runModel = (model) => {
  window.open(`/model?run=${model.id}`, '_blank')
}

// ========== My Data Method 相关方法 ==========

// 加载用户的数据方法列表
const loadMyDataMethods = async () => {
  try {
    const res = await authAxios().get('/api/jupyter/my-datamethods')
    myDataMethods.value = res.data.dataMethods || []
  } catch (e) {
    console.error('Failed to load my data methods:', e)
  }
}

// 打开数据方法选择器
const openDataMethodSelector = async () => {
  showDataMethodSelector.value = true
  librarySearchQuery.value = ''
  libraryPage.value = 1
  await loadDataMethodLibrary(1)
}

// 加载数据方法库
const loadDataMethodLibrary = async (page = 1) => {
  libraryLoading.value = true
  try {
    const res = await axios.get(`/api/datamethods?page=${page}&limit=12&q=${librarySearchQuery.value}`)
    dataMethodLibrary.value = res.data.data || []
    libraryTotal.value = res.data.total || 0
    libraryPage.value = page
  } catch (e) {
    console.error('Failed to load data method library:', e)
    dataMethodLibrary.value = []
  } finally {
    libraryLoading.value = false
  }
}

// 搜索数据方法库
const searchDataMethodLibrary = () => {
  loadDataMethodLibrary(1)
}

// 检查数据方法是否已添加
const isDataMethodAdded = (method) => {
  return myDataMethods.value.some(m => m.id === method.id)
}

// 添加到我的数据方法
const addToMyDataMethods = async (method) => {
  try {
    await authAxios().post('/api/jupyter/my-datamethods', { dataMethod: method })
    myDataMethods.value.push(method)
  } catch (e) {
    alert('添加失败: ' + (e.response?.data?.error || e.message))
  }
}

// 从我的数据方法移除
const removeFromMyDataMethods = async (method) => {
  if (!confirm(`确定要从列表中移除 "${method.name}" 吗？`)) return
  try {
    await authAxios().delete(`/api/jupyter/my-datamethods/${method.id}`)
    myDataMethods.value = myDataMethods.value.filter(m => m.id !== method.id)
  } catch (e) {
    alert('移除失败: ' + (e.response?.data?.error || e.message))
  }
}

// 运行数据方法（跳转到数据方法页面）
const runDataMethod = (method) => {
  window.open(`/datamethod?run=${method.id}`, '_blank')
}

// 复制 token
const copyToken = () => {
  navigator.clipboard.writeText(jupyterToken.value)
  alert('Token 已复制到剪贴板')
}

// 格式化函数
const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

const formatDate = (dateStr) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 初始化
onMounted(async () => {
  const oauthError = route.query.error
  // 检查 URL 中是否有 token (OAuth 回调)
  const urlToken = route.query.token
  if (urlToken) {
    setToken(urlToken)
    router.replace('/jupyter') // 清除 URL 中的 token
    return
  }

  if (typeof oauthError === 'string' && oauthError) {
    showToastMessage(oauthErrorMessages[oauthError] || '第三方登录失败，请重试', 'error', 5000)
    router.replace('/jupyter')
    return
  }
  
  // 检查本地 token
  if (getToken()) {
    const loggedIn = await fetchUser()
    if (loggedIn) {
      await Promise.all([
        loadProjects(),
        loadMyModels(),
        loadMyDataMethods()
      ])
    }
  }
})
</script>

<style scoped>
/* Toast 提示框样式 */
.toast-notification {
  position: fixed;
  top: 90px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 500;
  z-index: 10000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
}

.toast-notification.success {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.95), rgba(56, 142, 60, 0.95));
  color: #fff;
  border: 1px solid rgba(76, 175, 80, 0.5);
}

.toast-notification.error {
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.95), rgba(211, 47, 47, 0.95));
  color: #fff;
  border: 1px solid rgba(244, 67, 54, 0.5);
}

.toast-notification.warning {
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.95), rgba(245, 124, 0, 0.95));
  color: #fff;
  border: 1px solid rgba(255, 152, 0, 0.5);
}

.toast-notification.info {
  background: linear-gradient(135deg, rgba(33, 150, 243, 0.95), rgba(25, 118, 210, 0.95));
  color: #fff;
  border: 1px solid rgba(33, 150, 243, 0.5);
}

.toast-icon {
  font-size: 1.2rem;
  font-weight: bold;
}

.toast-message {
  max-width: 400px;
}

/* Toast 动画 */
.toast-enter-active {
  animation: toastIn 0.3s ease-out;
}

.toast-leave-active {
  animation: toastOut 0.3s ease-in;
}

@keyframes toastIn {
  from {
    opacity: 0;
    transform: translate(-50%, -20px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

@keyframes toastOut {
  from {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -20px);
  }
}

.jupyter-page {
  min-height: 100vh;
  background: #f5f7fa;
}

/* 独立导航栏 */
.jupyter-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2rem;
  height: 70px;
  background: #000000;
  border-bottom: none;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 2rem;
  flex: 1;
}

.logo-link {
  display: flex;
  align-items: center;
}

.logo {
  height: 42px;
  width: auto;
  transition: transform 0.2s;
}

.logo:hover {
  transform: scale(1.05);
}

.back-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s;
  white-space: nowrap;
}

.back-link:hover {
  color: #ffffff;
}

.back-icon {
  font-size: 1.1rem;
}

.nav-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.page-title {
  color: #fff;
  font-size: 1.3rem;
  font-weight: 600;
  margin: 0;
  white-space: nowrap;
}

.nav-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
}

/* 登录页面样式 */
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 70px);
  padding: 2rem;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
}

.login-card {
  background: #ffffff;
  border: none;
  border-radius: 16px;
  padding: 3rem 4rem;
  text-align: center;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
}

.login-header h1 {
  color: #000000;
  margin-bottom: 0.5rem;
  font-size: 2rem;
}

.login-header p {
  color: #606266;
  margin-bottom: 2rem;
  font-size: 1.1rem;
}

.login-features {
  display: flex;
  justify-content: center;
  gap: 2.5rem;
  margin-bottom: 2rem;
}

.feature-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: #aaa;
  font-size: 0.9rem;
}

.feature-icon {
  font-size: 1.8rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  margin-top: 2rem;
  gap: 0.75rem;
}

.login-label {
  color: #334155;
  font-size: 0.9rem;
  font-weight: 600;
  text-align: left;
}

.login-input {
  width: 100%;
  padding: 0.9rem 1rem;
  border: 1px solid #d8e1ec;
  border-radius: 10px;
  background: #fbfdff;
  color: #213547;
  font-size: 0.98rem;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}

.login-input:focus {
  outline: none;
  border-color: #2f7db8;
  box-shadow: 0 0 0 3px rgba(47, 125, 184, 0.12);
  background: #fff;
}

.opengms-login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 1rem 1.5rem;
  margin-top: 0.5rem;
  background: linear-gradient(135deg, #1368a2 0%, #0c8b8f 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.opengms-login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(19, 104, 162, 0.24);
}

.opengms-login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.login-divider {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-top: 1.5rem;
  color: #8a97a8;
  font-size: 0.88rem;
}

.login-divider::before,
.login-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(216, 225, 236, 0), rgba(216, 225, 236, 1));
}

.login-divider::after {
  background: linear-gradient(90deg, rgba(216, 225, 236, 1), rgba(216, 225, 236, 0));
}

.social-login-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
  margin-top: 1rem;
}

.social-login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  width: 100%;
  padding: 0.9rem 1rem;
  border-radius: 10px;
  border: 1px solid #d8e1ec;
  background: #ffffff;
  color: #223247;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}

.social-login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.1);
}

.social-login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.social-login-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.social-login-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}

.github-btn .social-login-icon {
  color: #111827;
}

.login-hint {
  color: #556;
  font-size: 0.9rem;
  margin-top: 2rem;
}

@media (max-width: 640px) {
  .social-login-grid {
    grid-template-columns: 1fr;
  }
}

/* ========== Dashboard 布局 - 仿 MyDDE 风格 ========== */
.dashboard-layout {
  display: flex;
  min-height: calc(100vh - 70px);
}

/* 左侧边栏 */
.sidebar {
  width: 240px;
  background: #ffffff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.03);
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px;
  border-bottom: 1px solid #e4e7ed;
  background: #f5f7fa;
}

.sidebar-user .user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.sidebar-user .user-info {
  display: flex;
  flex-direction: column;
}

.sidebar-user .user-name {
  color: #303133;
  font-weight: 600;
  font-size: 14px;
}

.sidebar-user .user-username {
  color: #909399;
  font-size: 12px;
}

/* 导航菜单 */
.sidebar-nav {
  flex: 1;
  padding: 16px 0;
  overflow-y: auto;
}

.nav-section {
  margin-bottom: 24px;
}

.nav-section-title {
  padding: 0 16px;
  margin-bottom: 8px;
  color: #909399;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  color: #606266;
  text-decoration: none;
  font-size: 14px;
  transition: all 0.2s;
  position: relative;
}

.nav-item:hover:not(.disabled) {
  color: #303133;
  background: rgba(64, 158, 255, 0.08);
}

.nav-item.active {
  color: #409eff;
  background: rgba(64, 158, 255, 0.1);
  border-left: 3px solid #409eff;
  font-weight: 500;
}

.nav-item.disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.nav-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.nav-badge {
  margin-left: auto;
  background: #409eff;
  color: #fff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: auto;
}

.status-dot.running {
  background: #4CAF50;
  box-shadow: 0 0 6px rgba(76, 175, 80, 0.6);
}

.coming-soon {
  margin-left: auto;
  font-size: 10px;
  color: #666;
  background: #2a2a2a;
  padding: 2px 6px;
  border-radius: 4px;
}

/* 底部退出按钮 */
.sidebar-footer {
  padding: 16px;
  border-top: 1px solid #e4e7ed;
}

.sidebar-footer .logout-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px;
  background: transparent;
  color: #f56c6c;
  border: 1px solid rgba(245, 108, 108, 0.3);
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.sidebar-footer .logout-btn:hover {
  background: rgba(245, 108, 108, 0.08);
  border-color: #f56c6c;
}

/* 主内容区 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
  overflow: hidden;
}

/* 顶部标题栏 */
.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #e4e7ed;
  background: #ffffff;
}

.header-left .page-title {
  color: #303133;
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 8px 12px;
}

.search-box .search-icon {
  font-size: 14px;
  color: #909399;
}

.search-box input {
  background: transparent;
  border: none;
  color: #303133;
  font-size: 14px;
  outline: none;
  width: 180px;
}

.search-box input::placeholder {
  color: #c0c4cc;
}

.header-btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.create-btn {
  background: #409eff;
  color: #fff;
  border: none;
}

.create-btn:hover {
  background: #66b1ff;
}

/* 内容区域 */
.content-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

/* Jupyter 面板 */
.jupyter-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 状态卡片 */
.status-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.status-card.running {
  border-color: rgba(103, 194, 58, 0.3);
  background: linear-gradient(135deg, #ffffff 0%, rgba(103, 194, 58, 0.05) 100%);
}

.status-card.stopped {
  border-color: #e4e7ed;
}

.status-icon {
  font-size: 40px;
}

.status-info {
  flex: 1;
}

.status-info h3 {
  color: #303133;
  font-size: 16px;
  margin: 0 0 4px 0;
}

.status-info .status-text {
  color: #909399;
  font-size: 14px;
  margin: 0;
}

.status-card.running .status-text {
  color: #67c23a;
}

.status-action .action-btn {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn.primary {
  background: linear-gradient(135deg, #67c23a, #5daf34);
  color: #fff;
  border: none;
}

.action-btn.primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(103, 194, 58, 0.4);
}

.action-btn.danger {
  background: transparent;
  color: #f56c6c;
  border: 1px solid #f56c6c;
}

.action-btn.danger:hover:not(:disabled) {
  background: rgba(245, 108, 108, 0.08);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 访问信息卡片 */
.access-card {
  padding: 24px;
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.access-card h3 {
  color: #303133;
  font-size: 16px;
  margin: 0 0 16px 0;
}

.access-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.info-label {
  color: #909399;
  font-size: 14px;
  width: 80px;
  flex-shrink: 0;
}

.info-value {
  color: #303133;
  font-size: 14px;
}

.info-value.link {
  color: #409eff;
  text-decoration: none;
}

.info-value.link:hover {
  text-decoration: underline;
}

.info-value.token {
  background: #f5f7fa;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  color: #606266;
  border: 1px solid #e4e7ed;
}

.copy-btn {
  padding: 4px 12px;
  background: transparent;
  color: #409eff;
  border: 1px solid #409eff;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: rgba(64, 158, 255, 0.1);
}

.open-jupyter-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #FF9800, #F57C00);
  color: #fff;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.2s;
}

.open-jupyter-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(255, 152, 0, 0.4);
}

/* 统计卡片 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.stat-icon {
  font-size: 32px;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  color: #303133;
  font-size: 24px;
  font-weight: 700;
}

.stat-label {
  color: #909399;
  font-size: 13px;
}

/* 项目列表面板 */
.projects-panel {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.table-header {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.5fr 80px;
  padding: 12px 20px;
  background: #fafafa;
  border-bottom: 1px solid #e4e7ed;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}

.table-body {
  min-height: 300px;
}

.table-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.5fr 80px;
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
  align-items: center;
  transition: background 0.2s;
}

.table-row:hover {
  background: rgba(64, 158, 255, 0.04);
}

.table-row:last-child {
  border-bottom: none;
}

.col-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-name {
  color: #303133;
  font-weight: 500;
}

.col-type, .col-size, .col-time {
  color: #909399;
  font-size: 14px;
}

.type-badge {
  display: inline-block;
  padding: 4px 10px;
  background: rgba(64, 158, 255, 0.15);
  color: #409eff;
  border-radius: 4px;
  font-size: 12px;
}

.col-action {
  text-align: center;
}

.action-menu-btn {
  background: transparent;
  border: none;
  color: #909399;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.action-menu-btn:hover {
  background: #f5f7fa;
  color: #303133;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 60px;
  margin-bottom: 16px;
}

.empty-state p {
  color: #909399;
  font-size: 16px;
  margin: 0 0 8px 0;
}

.empty-hint {
  color: #c0c4cc;
  font-size: 14px;
}

.empty-state .action-btn {
  margin-top: 20px;
}

/* 加载动画 */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ========== Header Tabs ========== */
.header-tabs {
  display: flex;
  gap: 8px;
  margin-left: 24px;
}

.tab-btn {
  padding: 8px 16px;
  background: transparent;
  color: #909399;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #303133;
}

.tab-btn.active {
  color: #409eff;
  border-bottom-color: #409eff;
}

.dropdown-arrow {
  font-size: 10px;
  margin-left: 4px;
}

/* ========== Recent 面板 ========== */
.recent-panel {
  height: 100%;
}

.recent-layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 24px;
  height: 100%;
}

.recent-main {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.recent-sidebar {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.recent-section {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  color: #303133;
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 16px 0;
}

.section-header .section-title {
  margin: 0;
}

.time-filter {
  background: #f5f7fa;
  color: #606266;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}

/* 快速创建 */
.quick-create-grid {
  display: flex;
  gap: 12px;
}

.quick-create-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  color: #303133;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-create-btn:hover:not(:disabled) {
  background: #ecf5ff;
  border-color: #409eff;
  color: #409eff;
}

.quick-create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.qc-icon {
  font-size: 18px;
}

/* 最近项目 */
.recent-projects-card {
  min-height: 120px;
}

.empty-recent {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  color: #909399;
}

.empty-icon-box {
  font-size: 40px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-recent p {
  margin: 0;
  font-size: 14px;
}

.recent-projects-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recent-project-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #fafafa;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.recent-project-item:hover {
  background: #ecf5ff;
  border-color: #409eff;
}

.recent-project-item .project-icon {
  font-size: 20px;
}

.recent-project-item .project-details {
  display: flex;
  flex-direction: column;
}

.recent-project-item .project-name {
  color: #303133;
  font-size: 14px;
}

.recent-project-item .project-time {
  color: #909399;
  font-size: 12px;
}

/* 资源卡片 */
.resources-card {
  min-height: 100px;
}

.empty-resources {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  color: #909399;
}

/* 最近数据 */
.recent-data-card {
  min-height: 120px;
}

/* ========== My Space 面板 ========== */
.myspace-panel {
  height: 100%;
}

/* 新版项目表格样式 */
.projects-table-wrapper {
  background: #ffffff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.projects-table-new {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.projects-table-new thead {
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.projects-table-new th {
  padding: 14px 16px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  font-size: 13px;
  white-space: nowrap;
}

.projects-table-new th.col-name { width: 22%; }
.projects-table-new th.col-desc { width: 30%; }
.projects-table-new th.col-date { width: 15%; }
.projects-table-new th.col-status { width: 12%; }
.projects-table-new th.col-actions { width: 21%; text-align: center; }

.projects-table-new tbody tr {
  border-bottom: 1px solid #f1f3f4;
  transition: background 0.15s ease;
}

.projects-table-new tbody tr:hover {
  background: #f8f9fa;
}

.projects-table-new tbody tr:last-child {
  border-bottom: none;
}

.projects-table-new td {
  padding: 14px 16px;
  vertical-align: middle;
}

.project-name-text {
  color: #202124;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s;
}

.project-name-text:hover {
  color: #1a73e8;
}

.fork-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 6px;
  background: #e8f0fe;
  color: #1a73e8;
  font-size: 11px;
  border-radius: 4px;
}

.case-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 6px;
  background: rgba(47, 108, 246, 0.12);
  color: #2f6cf6;
  font-size: 11px;
  border-radius: 4px;
}

.desc-text {
  color: #5f6368;
  font-size: 13px;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}

.col-date {
  color: #5f6368;
  font-size: 13px;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.active {
  background: #e6f4ea;
  color: #1e8e3e;
}

.status-badge.public {
  background: #e8f0fe;
  color: #1a73e8;
}

.status-badge.archived {
  background: #f1f3f4;
  color: #80868b;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.action-icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: #5f6368;
}

.action-icon-btn svg {
  width: 18px;
  height: 18px;
}

.action-icon-btn:hover {
  background: #f1f3f4;
  color: #202124;
}

.action-icon-btn.danger:hover {
  background: #fce8e6;
  color: #d93025;
}

.empty-row {
  text-align: center;
  padding: 60px 20px !important;
}

.empty-row .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-row .empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.empty-row .empty-state p {
  margin: 0;
  color: #5f6368;
}

.empty-row .empty-hint {
  font-size: 13px;
  color: #80868b;
}

/* 保留旧样式用于其他表格 */
.projects-table, .data-table {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.table-header {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.5fr 80px;
  padding: 12px 20px;
  background: #fafafa;
  border-bottom: 1px solid #e4e7ed;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}

.table-body {
  min-height: 300px;
}

.table-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.5fr 80px;
  padding: 14px 20px;
  border-bottom: 1px solid #ebeef5;
  align-items: center;
  transition: background 0.2s;
}

.table-row:hover {
  background: rgba(64, 158, 255, 0.04);
}

.table-row:last-child {
  border-bottom: none;
}

.col-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-name {
  color: #409eff;
  font-weight: 500;
  text-decoration: none;
}

.file-name:hover {
  text-decoration: underline;
}

.col-type, .col-size, .col-time, .col-partition {
  color: #909399;
  font-size: 14px;
}

.type-badge {
  display: inline-block;
  padding: 4px 10px;
  background: rgba(64, 158, 255, 0.15);
  color: #409eff;
  border-radius: 4px;
  font-size: 12px;
}

.partition-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
}

.partition-badge.running {
  background: rgba(103, 194, 58, 0.15);
  color: #67c23a;
}

.partition-text {
  color: #909399;
}

.col-action {
  text-align: center;
  position: relative;
}

/* 操作下拉菜单 */
.action-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 8px 0;
  min-width: 140px;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.action-dropdown button {
  display: block;
  width: 100%;
  padding: 10px 16px;
  background: transparent;
  border: none;
  color: #606266;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s;
}

.action-dropdown button:hover {
  background: #f5f7fa;
}

.action-dropdown button.danger {
  color: #f56c6c;
}

/* ========== Jupyter 浮动状态栏 ========== */
.jupyter-floating-bar {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.floating-info {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #303133;
  font-size: 14px;
}

.floating-info .status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #67c23a;
  box-shadow: 0 0 6px rgba(103, 194, 58, 0.6);
}

.project-tag {
  padding: 2px 8px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
  color: #606266;
  border: 1px solid #e4e7ed;
}

.floating-actions {
  display: flex;
  gap: 8px;
}

.floating-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}

.floating-btn.open {
  background: #409eff;
  color: #fff;
  border: none;
}

.floating-btn.open:hover {
  background: #66b1ff;
}

.floating-btn.stop {
  background: transparent;
  color: #f56c6c;
  border: 1px solid #f56c6c;
}

.floating-btn.stop:hover:not(:disabled) {
  background: rgba(245, 108, 108, 0.08);
}

.floating-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: #ffffff;
  border-radius: 12px;
  width: 90%;
  max-width: 480px;
  border: none;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e4e7ed;
  background: linear-gradient(135deg, #000000, #1a1a1a);
  border-radius: 12px 12px 0 0;
}

.modal-header h2 {
  font-size: 1.2rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.close-btn:hover {
  color: #ffffff;
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #606266;
  font-size: 0.9rem;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px 16px;
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  color: #303133;
  font-size: 0.95rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #409eff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.1);
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: #c0c4cc;
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e4e7ed;
}

.btn-cancel {
  padding: 10px 20px;
  background: transparent;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  color: #606266;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-cancel:hover {
  border-color: #909399;
  color: #303133;
}

.btn-create {
  padding: 10px 24px;
  background: linear-gradient(135deg, #409eff, #2d8cf0);
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-create:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.btn-create:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Case 发布面板样式 */
.case-publish-modal {
  max-width: 780px !important;
}

.case-publish-body {
  max-height: 65vh;
  overflow-y: auto;
}

.case-publish-hint {
  margin: 0 0 18px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
  padding: 10px 14px;
  background: #f0f6ff;
  border-radius: 8px;
  border-left: 3px solid #3b82f6;
}

.case-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 24px;
}

.case-form-col .form-group {
  margin-bottom: 16px;
}

.case-form-col .form-group label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.case-form-col .form-group label .required {
  color: #ef4444;
  font-weight: 600;
}

.case-form-col .form-group label .field-hint {
  font-weight: 400;
  color: #94a3b8;
  font-size: 11px;
}

.case-form-col .form-group input,
.case-form-col .form-group textarea {
  width: 100%;
  padding: 9px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  color: #1e293b;
  font-size: 13px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.case-form-col .form-group input:focus,
.case-form-col .form-group textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  background: #fff;
}

.case-form-col .form-group textarea {
  resize: vertical;
  min-height: 60px;
}

@media (max-width: 640px) {
  .case-form-grid {
    grid-template-columns: 1fr;
  }
  .case-publish-modal {
    max-width: 95% !important;
  }
}

/* 表格列宽调整 */
.col-notebooks,
.col-files {
  width: 100px;
  text-align: center;
}

.notebook-count {
  color: #f59e0b;
}

.file-count {
  color: #888;
}

/* ========== My Model / My Data Method 面板样式 ========== */
.mymodel-panel,
.mydatamethod-panel {
  padding: 0;
}

.panel-toolbar {
  display: flex;
  justify-content: flex-start;
  padding: 16px 0;
  margin-bottom: 16px;
  border-bottom: 1px solid #e4e7ed;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #409eff, #2d8cf0);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.resource-list {
  min-height: 300px;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.resource-card {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.resource-card:hover {
  border-color: #409eff;
  box-shadow: 0 4px 16px rgba(64, 158, 255, 0.1);
}

.resource-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.resource-icon {
  font-size: 1.5rem;
}

.resource-name {
  font-size: 1rem;
  font-weight: 600;
  color: #303133;
  margin: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-desc {
  font-size: 0.85rem;
  color: #909399;
  margin: 0 0 16px 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.5em;
}

.resource-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #e4e7ed;
}

.resource-meta {
  font-size: 0.8rem;
  color: #909399;
}

.resource-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn.run {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.action-btn.run:hover {
  background: rgba(16, 185, 129, 0.3);
}

.action-btn.remove {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.action-btn.remove:hover {
  background: rgba(239, 68, 68, 0.3);
}

/* ========== 选择器模态框样式 ========== */
.selector-modal {
  max-width: 700px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.selector-modal .modal-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 16px 24px;
}

.selector-search {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.selector-search input {
  flex: 1;
  padding: 10px 14px;
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  color: #303133;
  font-size: 0.95rem;
}

.selector-search input:focus {
  outline: none;
  border-color: #409eff;
}

.selector-search button {
  padding: 10px 16px;
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  color: #606266;
  cursor: pointer;
  transition: all 0.2s;
}

.selector-search button:hover {
  background: #ecf5ff;
  border-color: #409eff;
  color: #409eff;
}

.selector-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #909399;
}

.selector-loading .spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e4e7ed;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.selector-list {
  flex: 1;
  overflow-y: auto;
  max-height: 400px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
}

.selector-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #ebeef5;
  transition: background 0.2s;
}

.selector-item:last-child {
  border-bottom: none;
}

.selector-item:hover {
  background: rgba(64, 158, 255, 0.04);
}

.selector-item.added {
  opacity: 0.7;
}

.item-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.item-icon {
  font-size: 1.3rem;
  flex-shrink: 0;
}

.item-details {
  flex: 1;
  min-width: 0;
}

.item-details h4 {
  font-size: 0.95rem;
  font-weight: 500;
  color: #303133;
  margin: 0 0 4px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-details p {
  font-size: 0.8rem;
  color: #909399;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.add-item-btn {
  padding: 6px 14px;
  background: linear-gradient(135deg, #409eff, #2d8cf0);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.add-item-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
}

.add-item-btn:disabled {
  background: #f5f7fa;
  color: #c0c4cc;
  cursor: not-allowed;
}

.empty-selector {
  padding: 40px;
  text-align: center;
  color: #909399;
}

.selector-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding-top: 16px;
  margin-top: 16px;
  border-top: 1px solid #e4e7ed;
}

.selector-pagination button {
  padding: 8px 16px;
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  color: #606266;
  cursor: pointer;
  transition: all 0.2s;
}

.selector-pagination button:hover:not(:disabled) {
  background: #ecf5ff;
  border-color: #409eff;
  color: #409eff;
}

.selector-pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.selector-pagination span {
  color: #909399;
  font-size: 0.9rem;
}

/* ========== 创建项目复选框样式 ========== */
.checkbox-group {
  margin-top: 16px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  display: none;
}

.checkbox-custom {
  width: 18px;
  height: 18px;
  border: 2px solid #dcdfe6;
  border-radius: 4px;
  margin-right: 10px;
  position: relative;
  transition: all 0.2s;
}

.checkbox-label input[type="checkbox"]:checked + .checkbox-custom {
  background: #409eff;
  border-color: #409eff;
}

.checkbox-label input[type="checkbox"]:checked + .checkbox-custom::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #ffffff;
  font-size: 12px;
  font-weight: bold;
}

.checkbox-text {
  color: #303133;
  font-size: 0.95rem;
}

.checkbox-hint {
  margin-top: 8px;
  margin-left: 28px;
  color: #909399;
  font-size: 0.85rem;
}

/* ========== Fork 和公开标识样式 ========== */
.fork-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  padding: 2px 8px;
  background: rgba(136, 108, 228, 0.15);
  border: 1px solid rgba(136, 108, 228, 0.3);
  border-radius: 12px;
  font-size: 0.75rem;
  color: #a78bfa;
}

.fork-icon {
  font-size: 0.7rem;
}

.fork-source {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.public-badge {
  margin-left: 6px;
  font-size: 0.85rem;
  opacity: 0.8;
}

/* ========== Shared Space 面板样式 ========== */
.shared-space-panel {
  padding: 0;
}

.shared-search-bar {
  margin-bottom: 24px;
}

.shared-search-input {
  width: 100%;
  max-width: 400px;
  padding: 10px 16px;
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  color: #303133;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
}

.shared-search-input:focus {
  border-color: #409eff;
}

.shared-search-input::placeholder {
  color: #c0c4cc;
}

.shared-projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.shared-project-card {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.shared-project-card:hover {
  border-color: #409eff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.1);
}

.shared-card-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.shared-card-header .project-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.shared-card-header .project-info {
  flex: 1;
  min-width: 0;
}

.shared-card-header .project-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: #303133;
  margin: 0 0 4px 0;
  word-break: break-word;
}

.shared-card-header .project-owner {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
  color: #909399;
}

.project-owner .owner-icon {
  font-size: 0.8rem;
}

.project-description {
  color: #606266;
  font-size: 0.9rem;
  line-height: 1.5;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.project-description.empty {
  color: #c0c4cc;
  font-style: italic;
}

.project-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
  color: #909399;
}

.stat-icon {
  font-size: 0.9rem;
}

.project-time {
  font-size: 0.8rem;
  color: #c0c4cc;
  margin-bottom: 16px;
}

.shared-card-actions {
  display: flex;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid #e4e7ed;
}

.shared-card-actions .action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.shared-card-actions .action-btn .btn-icon {
  font-size: 1rem;
}

.shared-card-actions .action-btn.preview {
  background: #f5f7fa;
  color: #606266;
  border: 1px solid #dcdfe6;
}

.shared-card-actions .action-btn.preview:hover {
  background: #ecf5ff;
  border-color: #409eff;
  color: #409eff;
}

.shared-card-actions .action-btn.fork {
  background: linear-gradient(135deg, #409eff 0%, #2d8cf0 100%);
  color: #ffffff;
}

.shared-card-actions .action-btn.fork:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.shared-card-actions .action-btn.fork:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ========== Environments 面板样式 ========== */
.environments-panel {
  padding: 0;
}

.env-panel-header {
  margin-bottom: 32px;
}

.env-panel-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px 0;
}

.env-panel-desc {
  color: #909399;
  font-size: 0.9rem;
  margin: 0;
}

/* 新版环境卡片网格 */
.env-cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

@media (max-width: 900px) {
  .env-cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .env-cards-grid {
    grid-template-columns: 1fr;
  }
}

.env-card-new {
  position: relative;
  background: #ffffff;
  border: 2px solid #e4e7ed;
  border-radius: 12px;
  padding: 24px 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.env-card-new:hover {
  border-color: #c0c4cc;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.env-card-new.selected {
  border-color: #2e7d32;
  background: linear-gradient(to bottom, rgba(46, 125, 50, 0.03), #ffffff);
}

.env-card-check {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 24px;
  height: 24px;
  background: #2e7d32;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.env-card-check svg {
  width: 16px;
  height: 16px;
}

.env-card-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.env-card-icon svg {
  width: 32px;
  height: 32px;
}

.env-card-icon.geo-standard {
  background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
  color: #2e7d32;
}

.env-card-icon.deep-learning {
  background: linear-gradient(135deg, #fff3e0, #ffe0b2);
  color: #e65100;
}

.env-card-icon.hydrology {
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
  color: #1565c0;
}

.env-card-title {
  font-size: 1rem;
  font-weight: 600;
  color: #303133;
  margin: 0 0 6px 0;
}

.env-card-desc {
  font-size: 0.8rem;
  color: #909399;
  margin: 0;
  line-height: 1.4;
}

.env-launch-section {
  text-align: left;
}

.launch-jupyter-btn {
  padding: 12px 28px;
  background: #2e7d32;
  border: none;
  border-radius: 6px;
  color: #ffffff;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.launch-jupyter-btn:hover:not(:disabled) {
  background: #1b5e20;
  box-shadow: 0 4px 12px rgba(46, 125, 50, 0.3);
}

.launch-jupyter-btn:disabled {
  background: #c8e6c9;
  cursor: not-allowed;
}

/* 保留旧样式用于兼容 */
.panel-intro {
  padding: 16px 0;
  margin-bottom: 24px;
  border-bottom: 1px solid #e4e7ed;
}

.panel-intro p {
  color: #909399;
  font-size: 0.95rem;
  margin: 0;
}

/* 区域标题 */
.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.1rem;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px 0;
}

.title-icon {
  font-size: 1.2rem;
}

.section-desc {
  color: #909399;
  font-size: 0.85rem;
  margin: 0 0 20px 0;
}

/* 默认环境区域 */
.default-env-section {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e4e7ed;
}

.default-env-wrapper {
  max-width: 360px;
}

.no-default {
  padding: 24px;
  background: #fafafa;
  border: 1px dashed #dcdfe6;
  border-radius: 12px;
  text-align: center;
  color: #909399;
  max-width: 360px;
}

.no-default p {
  margin: 0;
}

/* 所有环境区域 */
.all-env-section {
  margin-bottom: 32px;
}

.environments-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.environment-card {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s;
  position: relative;
  cursor: default;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.environment-card:hover {
  border-color: #409eff;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(64, 158, 255, 0.1);
}

.environment-card.is-default {
  border-color: #67c23a;
  background: linear-gradient(145deg, rgba(103, 194, 58, 0.05), #ffffff);
}

.environment-card.unavailable {
  opacity: 0.6;
}

.environment-card.unavailable:hover {
  transform: none;
  box-shadow: none;
}

.env-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.env-icon {
  font-size: 2rem;
}

.env-badges {
  display: flex;
  gap: 8px;
}

.badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 500;
}

.badge.default {
  background: rgba(103, 194, 58, 0.2);
  color: #67c23a;
}

.badge.unavailable {
  background: rgba(245, 108, 108, 0.2);
  color: #f56c6c;
}

.environment-card .env-name {
  font-size: 1rem;
  font-weight: 600;
  color: #303133;
  margin: 0 0 6px 0;
}

.environment-card .env-description {
  font-size: 0.8rem;
  color: #909399;
  margin: 0 0 12px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.env-details {
  margin-bottom: 12px;
  padding: 10px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-size: 0.8rem;
  color: #909399;
}

.detail-value {
  font-size: 0.85rem;
  color: #606266;
  font-weight: 500;
}

.env-features {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
  min-height: 28px;
}

.feature-tag {
  padding: 4px 10px;
  background: rgba(64, 158, 255, 0.1);
  border: 1px solid rgba(64, 158, 255, 0.2);
  border-radius: 12px;
  font-size: 0.75rem;
  color: #409eff;
}

.env-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #e4e7ed;
  min-height: 36px;
}

.env-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: #909399;
}

.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-indicator.available {
  background: #67c23a;
  box-shadow: 0 0 6px rgba(103, 194, 58, 0.5);
}

.status-indicator.unavailable {
  background: #909399;
}

.set-default-btn {
  padding: 6px 14px;
  background: linear-gradient(135deg, #f39c12, #e67e22);
  border: none;
  border-radius: 16px;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  animation: fadeIn 0.2s ease;
}

.set-default-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(243, 156, 18, 0.4);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(10px); }
  to { opacity: 1; transform: translateX(0); }
}

.environments-footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e4e7ed;
}

.environments-footer .hint {
  color: #909399;
  font-size: 0.85rem;
  margin: 0;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #909399;
}

.loading-state .spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e4e7ed;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ========== My Data 网盘风格样式 ========== */
.mydata-panel.netdisk-style {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
}

.netdisk-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid #e4e7ed;
  flex-wrap: wrap;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  color: #606266;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar-btn:hover:not(:disabled) {
  background: #ecf5ff;
  border-color: #409eff;
  color: #409eff;
}

.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar-btn.primary {
  background: linear-gradient(135deg, #409eff 0%, #2d8cf0 100%);
  border-color: #409eff;
  color: #ffffff;
  font-weight: 500;
}

.toolbar-btn.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.toolbar-btn.upload {
  background: linear-gradient(135deg, #67c23a 0%, #5daf34 100%);
  border-color: #67c23a;
  color: #ffffff;
  font-weight: 500;
}

.toolbar-btn.upload:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(103, 194, 58, 0.3);
}

.toolbar-btn .btn-icon {
  font-size: 1rem;
}

.current-path {
  margin-left: auto;
  padding: 8px 16px;
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  color: #606266;
  font-family: monospace;
  font-size: 0.85rem;
}

.netdisk-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 0;
  background: #ffffff;
  border-radius: 12px;
  margin: 16px 0;
  min-height: 400px;
  border: 1px solid #e4e7ed;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.netdisk-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 20px;
  padding: 20px;
}

.netdisk-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.netdisk-item:hover {
  background: rgba(64, 158, 255, 0.1);
}

.netdisk-item.selected {
  background: rgba(64, 158, 255, 0.2);
  outline: 2px solid #409eff;
}

.item-icon-wrapper {
  position: relative;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.item-icon-wrapper .item-icon {
  width: 64px;
  height: 64px;
}

.file-icon {
  width: 64px;
  height: 72px;
  background: linear-gradient(145deg, #e4e7ed, #d3d6db);
  border-radius: 4px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.file-icon::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
  background: #c0c4cc;
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
}

.file-icon .file-ext {
  font-size: 0.65rem;
  font-weight: bold;
  color: #fff;
  text-transform: uppercase;
  background: rgba(0,0,0,0.2);
  padding: 2px 6px;
  border-radius: 3px;
}

.file-icon.icon-image { background: linear-gradient(145deg, #66bb6a, #43a047); }
.file-icon.icon-geo { background: linear-gradient(145deg, #4fc3f7, #29b6f6); }
.file-icon.icon-data { background: linear-gradient(145deg, #ab47bc, #8e24aa); }
.file-icon.icon-table { background: linear-gradient(145deg, #26a69a, #00897b); }
.file-icon.icon-pdf { background: linear-gradient(145deg, #ef5350, #e53935); }
.file-icon.icon-archive { background: linear-gradient(145deg, #ffa726, #fb8c00); }
.file-icon.icon-doc { background: linear-gradient(145deg, #42a5f5, #1e88e5); }

/* Fork 标识 */
.fork-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #409eff 0%, #2d8cf0 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  box-shadow: 0 2px 6px rgba(64, 158, 255, 0.4);
  border: 2px solid #ffffff;
}

.item-name {
  font-size: 0.85rem;
  color: #303133;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.item-meta {
  font-size: 0.75rem;
  color: #909399;
}

.netdisk-statusbar {
  display: flex;
  gap: 24px;
  padding: 12px 0;
  border-top: 1px solid #e4e7ed;
  font-size: 0.85rem;
  color: #909399;
}

.netdisk-statusbar .storage-info {
  margin-left: auto;
}

/* ========== Fork 数据模态框样式 ========== */
.fork-data-modal {
  width: 90%;
  max-width: 900px;
  max-height: 85vh;
  background: #ffffff;
  border-radius: 16px;
  border: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.fork-data-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e4e7ed;
  background: linear-gradient(135deg, #000000, #1a1a1a);
  border-radius: 16px 16px 0 0;
}

.fork-data-modal .modal-header h3 {
  margin: 0;
  color: #ffffff;
  font-size: 1.2rem;
}

.fork-search-bar {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  background: #fafafa;
}

.fork-search-bar input {
  flex: 1;
  padding: 12px 16px;
  background: #ffffff;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  color: #303133;
  font-size: 0.95rem;
}

.fork-search-bar input:focus {
  outline: none;
  border-color: #409eff;
}

.fork-search-bar .search-btn {
  padding: 12px 24px;
  background: linear-gradient(135deg, #409eff 0%, #2d8cf0 100%);
  border: none;
  border-radius: 8px;
  color: #ffffff;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.fork-search-bar .search-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.fork-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 24px 16px;
  background: #fafafa;
}

.category-tag {
  padding: 6px 14px;
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 20px;
  color: #606266;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.category-tag:hover {
  background: #ecf5ff;
  border-color: #409eff;
  color: #409eff;
}

.category-tag.active {
  background: rgba(64, 158, 255, 0.1);
  border-color: #409eff;
  color: #409eff;
}

.fork-data-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 24px;
  min-height: 300px;
}

.fork-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}

.fork-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  background: #fafafa;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.fork-item:hover {
  background: #ecf5ff;
  border-color: #409eff;
}

.fork-item.selected {
  background: rgba(64, 158, 255, 0.08);
  border-color: #409eff;
}

.fork-item-checkbox input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.fork-item-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.fork-item-info {
  flex: 1;
  min-width: 0;
}

.fork-item-name {
  font-size: 0.95rem;
  color: #303133;
  font-weight: 500;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fork-item-meta {
  display: flex;
  gap: 12px;
  font-size: 0.8rem;
  color: #909399;
}

.fork-item-type {
  padding: 2px 8px;
  background: rgba(64, 158, 255, 0.1);
  border-radius: 4px;
  color: #409eff;
  text-transform: uppercase;
}

.fork-single-btn {
  padding: 8px 16px;
  background: #f5f7fa;
  border: 1px solid #409eff;
  border-radius: 6px;
  color: #409eff;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.fork-single-btn:hover:not(:disabled) {
  background: #409eff;
  color: #ffffff;
}

.fork-single-btn:disabled {
  opacity: 0.5;
  border-color: #dcdfe6;
  color: #c0c4cc;
  cursor: not-allowed;
}

.fork-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
}

.fork-pagination button {
  padding: 8px 16px;
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  color: #606266;
  cursor: pointer;
  transition: all 0.2s;
}

.fork-pagination button:hover:not(:disabled) {
  background: #ecf5ff;
  border-color: #409eff;
  color: #409eff;
}

.fork-pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fork-data-modal .modal-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e4e7ed;
  background: #fafafa;
}

.fork-data-modal .selected-count {
  margin-right: auto;
  color: #409eff;
  font-size: 0.9rem;
}

/* 右键菜单 */
.context-menu {
  position: fixed;
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  z-index: 1000;
  min-width: 150px;
  overflow: hidden;
}

.context-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  color: #606266;
  cursor: pointer;
  transition: background 0.2s;
}

.context-item:hover {
  background: rgba(64, 158, 255, 0.08);
}

.context-item.danger {
  color: #f56c6c;
}

.context-item.danger:hover {
  background: rgba(245, 108, 108, 0.08);
}

/* 加载状态样式调整 */
.loading-state.compact {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
}

.empty-state.compact {
  padding: 20px;
  text-align: center;
}

/* ========== My Data 面板样式 ========== */
.mydata-panel {
  padding: 0;
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.data-card {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.data-card:hover {
  border-color: #409eff;
  box-shadow: 0 4px 16px rgba(64, 158, 255, 0.1);
}

.data-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.data-icon {
  font-size: 1.8rem;
}

.data-name {
  font-size: 1rem;
  font-weight: 600;
  color: #303133;
  margin: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.data-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.data-size, .data-type {
  font-size: 0.8rem;
  color: #909399;
  padding: 2px 8px;
  background: #f5f7fa;
  border-radius: 4px;
}

.data-desc {
  font-size: 0.85rem;
  color: #909399;
  margin: 0 0 16px 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.5em;
}

.data-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #e4e7ed;
}

.data-time {
  font-size: 0.8rem;
  color: #c0c4cc;
}

.data-actions {
  display: flex;
  gap: 8px;
}

.action-btn.download {
  background: rgba(64, 158, 255, 0.2);
  color: #409eff;
}

.action-btn.download:hover {
  background: rgba(64, 158, 255, 0.3);
}

/* ========== My Data 列表样式 ========== */
.mydata-panel .panel-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.mydata-panel .data-stats {
  color: #909399;
  font-size: 0.9rem;
}

.data-list-container {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e4e7ed;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.data-list-header {
  display: grid;
  grid-template-columns: 2fr 100px 100px 140px 100px;
  gap: 12px;
  padding: 12px 20px;
  background: #fafafa;
  border-bottom: 1px solid #e4e7ed;
  font-size: 0.85rem;
  font-weight: 500;
  color: #606266;
}

.data-list {
  max-height: calc(100vh - 380px);
  overflow-y: auto;
}

.data-list-item {
  display: grid;
  grid-template-columns: 2fr 100px 100px 140px 100px;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid #ebeef5;
  align-items: center;
  transition: background 0.2s;
}

.data-list-item:hover {
  background: rgba(64, 158, 255, 0.04);
}

.data-list-item:last-child {
  border-bottom: none;
}

.data-list-item .col-name {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.data-list-item .data-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.data-list-item .data-name-wrapper {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.data-list-item .data-name {
  font-size: 0.95rem;
  color: #303133;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.data-list-item .data-desc {
  font-size: 0.8rem;
  color: #909399;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.data-list-item .col-type {
  text-align: center;
}

.data-list-item .type-tag {
  display: inline-block;
  padding: 3px 10px;
  background: rgba(64, 158, 255, 0.1);
  border: 1px solid rgba(64, 158, 255, 0.2);
  border-radius: 12px;
  font-size: 0.75rem;
  color: #64b5f6;
  text-transform: uppercase;
}

.data-list-item .col-size {
  color: #909399;
  font-size: 0.85rem;
  text-align: center;
}

.data-list-item .col-time {
  color: #c0c4cc;
  font-size: 0.85rem;
  text-align: center;
}

.data-list-item .col-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.data-list-item .action-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  font-size: 1rem;
}

.data-list-item .action-btn.download {
  background: rgba(103, 194, 58, 0.1);
  color: #67c23a;
}

.data-list-item .action-btn.download:hover {
  background: rgba(103, 194, 58, 0.2);
}

.data-list-item .action-btn.remove {
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}

.data-list-item .action-btn.remove:hover {
  background: rgba(245, 108, 108, 0.2);
}

/* 分页样式 */
.data-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #e4e7ed;
  background: #fafafa;
}

.data-pagination .page-btn {
  padding: 6px 12px;
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  color: #606266;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.data-pagination .page-btn:hover:not(:disabled) {
  background: #ecf5ff;
  border-color: #409eff;
  color: #409eff;
}

.data-pagination .page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.data-pagination .page-numbers {
  display: flex;
  gap: 4px;
}

.data-pagination .page-num {
  width: 32px;
  height: 32px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: transparent;
  color: #909399;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.data-pagination .page-num:hover {
  background: #f5f7fa;
  color: #303133;
}

.data-pagination .page-num.active {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}

.data-pagination .page-info {
  margin-left: 12px;
  color: #909399;
  font-size: 0.85rem;
}

/* 数据上传模态框样式 */
.upload-modal {
  max-width: 520px;
}

.upload-dropzone {
  border: 2px dashed #dcdfe6;
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #fafafa;
  margin-bottom: 20px;
  position: relative;
}

.upload-dropzone:hover,
.upload-dropzone.dragover {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.04);
}

.upload-dropzone.has-file {
  border-color: #67c23a;
  background: rgba(103, 194, 58, 0.04);
}

.dropzone-content {
  color: #909399;
}

.dropzone-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.dropzone-text {
  font-size: 1rem;
  color: #606266;
  margin-bottom: 8px;
}

.dropzone-hint {
  font-size: 0.85rem;
  color: #c0c4cc;
}

.file-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.file-preview .file-icon {
  font-size: 2.5rem;
}

.file-preview .file-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.file-preview .file-name {
  font-size: 1rem;
  color: #303133;
  word-break: break-all;
}

.file-preview .file-size {
  font-size: 0.85rem;
  color: #909399;
}

.remove-file-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: #f56c6c;
  color: #fff;
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.remove-file-btn:hover {
  background: #e64242;
  transform: scale(1.1);
}

.upload-progress {
  margin-top: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: #ebeef5;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #409eff, #67c23a);
  border-radius: 4px;
  transition: width 0.3s;
}

.progress-text {
  font-size: 0.9rem;
  color: #67c23a;
  min-width: 45px;
  text-align: right;
}
</style>
