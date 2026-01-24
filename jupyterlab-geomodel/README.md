# JupyterLab GeoModel Extension

A JupyterLab extension for OpenGMS Model and Data Method integration.

## 功能特性

- 🧊 **Model 浏览器** - 浏览和搜索 OpenGMS 模型库
- 📊 **Data Method 浏览器** - 浏览和搜索数据方法库
- ⭐ **个人收藏** - 查看已收藏的模型和数据方法
- 📝 **参数表单** - 可视化的参数输入界面
- 💻 **代码生成** - 自动生成 Python 调用代码
- 📥 **一键插入** - 将生成的代码插入到 Notebook Cell

## 安装

### 从源码安装

```bash
# 克隆仓库
cd jupyterlab-geomodel

# 安装依赖
jlpm install

# 构建扩展
jlpm build

# 安装到 JupyterLab
jupyter labextension develop . --overwrite

# 构建 TypeScript 源码
jlpm build
```

### 开发模式

```bash
# 监听源码变化
jlpm watch

# 在另一个终端启动 JupyterLab
jupyter lab --watch
```

## 使用方法

1. 启动 JupyterLab
2. 点击右侧边栏的 🌍 图标打开 GeoModel 面板
3. 选择 "Model" 或 "Data Method" 标签
4. 选择 "全部" 或 "我的收藏" 来源
5. 点击要使用的模型/方法
6. 在参数表单中填写/上传参数
7. 预览生成的代码
8. 点击 "Insert Code" 将代码插入到当前 Notebook

## 项目结构

```
jupyterlab-geomodel/
├── src/
│   ├── index.ts                 # 扩展入口
│   ├── widget.tsx               # 侧边栏 Widget
│   ├── types.ts                 # TypeScript 类型定义
│   ├── components/
│   │   ├── GeoModelPanel.tsx    # 主面板组件
│   │   ├── ModelBrowser.tsx     # 模型浏览器
│   │   ├── ParameterForm.tsx    # 参数表单
│   │   └── CodePreview.tsx      # 代码预览
│   ├── services/
│   │   └── api.ts               # API 服务
│   └── utils/
│       └── codeGenerator.ts     # 代码生成器
├── style/
│   └── index.css                # 样式文件
├── package.json
└── tsconfig.json
```

## 配置

### API 地址配置

在 `src/services/api.ts` 中修改 API 基础地址：

```typescript
const API_BASE_URL = 'http://your-server:3000/api';
```

### 认证配置

扩展会从 `localStorage` 读取 `jupyter_token` 用于认证请求。

## 依赖

- JupyterLab >= 4.0.0
- Python pygeomodel 包（用于生成的代码）

## License

MIT
