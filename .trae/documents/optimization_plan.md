# 🌱 HomeSprout 优化实施计划

## 一、优化范围

基于 `implementation_plan.md` 的优化建议，本计划聚焦于 **P0**（必须优先处理）和 **P1**（短期内应完成）级别的优化项。

---

## 二、优化项清单与实施步骤

### 🚀 P0 优先级（立即执行）

#### 2.1 路由级代码分割（1.1）

**文件**:
- `client/src/App.jsx` - 添加 React.lazy + Suspense
- `client/src/main.jsx` - 确保 Suspense 支持

**步骤**:
1. 将 TVModePage、DashboardPage、GraphPage、ExportPage、AdminPage 改为动态 import
2. 添加 Loading 组件作为 fallback

#### 2.2 巨型页面组件拆分（2.1）

**文件**:
- `client/src/pages/RecordDetailPage.jsx` (665行) - 拆分为播放器、轮播、标签组件
- `client/src/pages/GraphPage.jsx` (558行) - 拆分为图谱控制、侧边栏组件
- `client/src/pages/TVModePage.jsx` (556行) - 拆分为导航、卡片组件

**步骤**:
1. 创建 `components/Player/MediaPlayer.jsx`
2. 创建 `components/Carousel/ImageCarousel.jsx`
3. 创建 `components/Tags/TagEditor.jsx`
4. 创建 `components/Graph/GraphControls.jsx`

#### 2.3 浅色模式全面适配（3.1）

**文件**:
- `client/src/pages/TVModePage.jsx` - 替换硬编码颜色
- `client/src/pages/GraphPage.jsx` - 替换硬编码颜色
- `client/src/pages/ExportPage.jsx` - 替换硬编码颜色

**步骤**:
1. 搜索并替换 `#070714`、`rgba(255,255,255,...)` 为 CSS 变量
2. 验证浅色模式下所有页面的显示效果

#### 2.4 Admin Token 硬编码修复（4.1）

**文件**:
- `client/src/utils/api.js` - 移除硬编码 token
- `server/src/middleware/auth.js` - 支持环境变量读取
- `server/src/index.js` - 从环境变量读取配置
- `.gitignore` - 添加 config.json auth 部分或 .env
- 创建 `.env.example`

**步骤**:
1. 创建 `.env` 配置文件模板
2. 后端从 `process.env` 读取 admin_token
3. 前端移除默认 token，增加登录流程

#### 2.5 WebSocket 在 Demo 模式下静默降级（5.1）

**文件**:
- `client/src/hooks/useWebSocket.js` - 添加 Demo 模式判断
- `client/src/contexts/RecordsContext.jsx` - 条件调用 WS hook

**步骤**:
1. 在 useWebSocket 中检测 isDemoMode，跳过连接
2. 确保 Demo 模式下无错误日志输出

---

### 🟡 P1 优先级（短期内完成）

#### 2.6 Cytoscape.js 独立 chunk（1.2）

**文件**:
- `client/vite.config.js` - 添加 manualChunks 配置

**步骤**:
1. 配置 Vite 将 cytoscape 抽离为独立 vendor chunk

#### 2.7 图片懒加载（1.3）

**文件**:
- `client/src/components/Cards/RecordCard.jsx` - 添加 loading="lazy"

**步骤**:
1. 为所有 `<img>` 添加 `loading="lazy"` 和 `decoding="async"`

#### 2.8 内联样式迁移至 CSS（2.2）

**文件**:
- `client/src/pages/RecordDetailPage.jsx` - 提取内联样式
- `client/src/pages/TVModePage.jsx` - 提取内联样式
- `client/src/pages/DashboardPage.jsx` - 提取内联样式
- `client/src/index.css` - 添加新的 CSS class

**步骤**:
1. 将内联 style 对象转换为 CSS class
2. 利用 CSS 伪类和 CSS 变量实现动态样式

#### 2.9 API 层与 Mock 层解耦（2.3）

**文件**:
- `client/src/utils/api.js` - 接口定义
- `client/src/utils/mockApi.js` - 模拟实现（新建）
- `client/src/utils/api.js` - 运行时动态切换

**步骤**:
1. 创建 mockApi.js 提取所有模拟逻辑
2. 修改 api.js 为纯接口定义，运行时根据模式切换

#### 2.10 移动端底部 Tab 导航补全（3.2）

**文件**:
- `client/src/components/Layout/AppShell.jsx` - 扩展底部 Tab

**步骤**:
1. 增加 TV 模式、成长看板等页面的 Tab 入口
2. 或添加"更多"折叠菜单

#### 2.11 文件上传安全验证（4.2）

**文件**:
- `server/src/routes/upload.js` - 添加文件类型校验

**步骤**:
1. 安装 `file-type` 库
2. 在上传时校验文件魔术字节

#### 2.12 路径遍历防护（4.3）

**文件**:
- `server/src/routes/records.js` - 媒体文件下载端点

**步骤**:
1. 对 filename 做白名单校验
2. 禁止 `..` 等路径穿越字符

#### 2.13 Ollama 离线优雅降级（5.2）

**文件**:
- `server/src/index.js` - 启动时探测 Ollama 可用性
- `server/src/services/aiClassifier.js` - 添加状态检查
- `server/src/routes/stats.js` - 添加 AI 状态端点

**步骤**:
1. 启动时检测 Ollama 服务
2. 不可用时直接走规则分类
3. 在 Admin 面板显示 AI 状态

#### 2.14 GitHub Actions CI/CD（7.1）

**文件**:
- `.github/workflows/deploy.yml`（新建）

**步骤**:
1. 创建 GitHub Actions 工作流
2. 配置 push 到 main 时自动构建并发布到 GitHub Pages

---

## 三、实施顺序建议

| 阶段 | 优化项 | 预计耗时 |
|------|--------|----------|
| **第一阶段** | 2.1 (路由分割) + 2.7 (图片懒加载) | 低 |
| **第一阶段** | 2.5 (WS 静默降级) + 2.13 (Ollama 降级) | 低 |
| **第二阶段** | 2.4 (Token 安全) + 4.2/4.3 (安全加固) | 中 |
| **第二阶段** | 2.3 (浅色模式适配) | 中 |
| **第三阶段** | 2.2 (组件拆分) + 2.8 (样式迁移) | 高 |
| **第三阶段** | 2.9 (API/Mock 解耦) | 中 |
| **第四阶段** | 2.6 (Cytoscape chunk) + 2.10 (Tab 补全) | 低 |
| **第四阶段** | 2.14 (CI/CD) | 低 |

---

## 四、风险与注意事项

1. **路由分割风险**: 动态 import 可能导致首次访问页面时出现短暂白屏，需添加 Loading 状态
2. **组件拆分风险**: 拆分后需要确保 props 传递完整，避免状态丢失
3. **安全修复风险**: Token 改为环境变量后，需要确保部署流程同步更新
4. **样式迁移风险**: 内联样式迁移后需要全面测试所有交互效果

---

## 五、验证标准

- ✅ 前端构建产物大小降低 50%+
- ✅ 浅色模式下所有页面正常显示
- ✅ Demo 模式下无 WebSocket 错误日志
- ✅ API 接口与 Mock 实现完全解耦
- ✅ 文件上传经过双重校验（扩展名 + 魔术字节）
- ✅ GitHub Actions 自动部署成功

---

## 六、文件修改清单

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `client/src/App.jsx` | 修改 | React.lazy 动态导入 |
| `client/src/main.jsx` | 修改 | Suspense 包裹 |
| `client/vite.config.js` | 修改 | manualChunks 配置 |
| `client/src/components/Cards/RecordCard.jsx` | 修改 | 图片懒加载 |
| `client/src/pages/TVModePage.jsx` | 修改 | 浅色模式适配 + 组件拆分 |
| `client/src/pages/GraphPage.jsx` | 修改 | 浅色模式适配 + 组件拆分 |
| `client/src/pages/ExportPage.jsx` | 修改 | 浅色模式适配 |
| `client/src/pages/RecordDetailPage.jsx` | 修改 | 组件拆分 + 样式迁移 |
| `client/src/pages/DashboardPage.jsx` | 修改 | 样式迁移 |
| `client/src/utils/api.js` | 修改 | 移除硬编码 token，接口解耦 |
| `client/src/utils/mockApi.js` | 新建 | 模拟实现 |
| `client/src/hooks/useWebSocket.js` | 修改 | Demo 模式降级 |
| `client/src/contexts/RecordsContext.jsx` | 修改 | WS 条件调用 |
| `client/src/components/Layout/AppShell.jsx` | 修改 | Tab 导航扩展 |
| `server/src/middleware/auth.js` | 修改 | 环境变量支持 |
| `server/src/index.js` | 修改 | 环境变量支持，Ollama 检测 |
| `server/src/routes/upload.js` | 修改 | 文件类型校验 |
| `server/src/routes/records.js` | 修改 | 路径遍历防护 |
| `.gitignore` | 修改 | 添加 .env |
| `.env.example` | 新建 | 环境变量模板 |
| `.github/workflows/deploy.yml` | 新建 | CI/CD 工作流 |
