# 会员管理系统 (Membership Management System)

本项目是一个基于 Vue 3 + Element Plus 的全栈会员管理系统，具备现代化的 UI 设计和完整的 Docker 化部署能力。

## 🛠 技术栈

### 前端 (Frontend)
- **框架**: Vue 3 (Composition API)
- **构建工具**: Vite
- **UI 组件库**: Element Plus
- **状态管理**: Pinia
- **路由**: Vue Router
- **HTTP 客户端**: Axios
- **工具库**: Day.js

### 后端 (Backend)
- **运行时**: Node.js (Express)
- **ORM**: Prisma
- **数据校验**: Zod
- **身份认证**: JWT, Bcrypt
- **日志**: Winston

### 基础设施 (Infrastructure)
- **数据库**: MySQL 8.0
- **服务器**: Nginx (前端反向代理)
- **容器化**: Docker, Docker Compose

## 📂 项目结构

```text
├── backend/                # 后端服务
│   ├── prisma/             # 数据库模型与迁移
│   ├── src/                # 源码目录
│   └── Dockerfile          # 后端镜像构建
├── frontend/               # 前端服务
│   ├── src/                # 源码目录
│   │   ├── api/            # 接口封装
│   │   ├── components/     # 公用组件
│   │   ├── stores/         # 状态管理
│   │   ├── views/          # 页面视图
│   │   └── router/         # 路由配置
│   ├── nginx.conf          # Nginx 配置
│   └── Dockerfile          # 前端镜像构建
└── docker-compose.yml      # 容器编排配置
```

## 🚀 启动指南

### 方式一：本地开发（无需 Docker）

适合日常开发调试，前后端分别独立启动。

1. **前提条件**:
   - 已安装 Node.js 18+ 和 npm
   - 本地运行中的 MySQL 8.0 数据库

2. **配置后端环境变量**:
   ```bash
   cd backend
   cp .env.example .env
   # 编辑 .env，填入数据库连接信息和 JWT 密钥
   ```

3. **启动后端服务**:
   ```bash
   cd backend
   npm install
   npm run prisma:generate
   npm run prisma:push
   npm run prisma:seed
   npm run dev
   ```
   后端将运行于 [http://localhost:8000](http://localhost:8000)

4. **启动前端服务**（新开终端）:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Vite 开发服务器已内置 `/api` 反向代理至 `http://localhost:8000`，无需额外配置跨域。
   前端将运行于 [http://localhost:5173](http://localhost:5173)

### 方式二：Docker Compose 一键部署

适合快速体验或生产部署。

1. **前提条件**: 确保已安装 [Docker](https://www.docker.com/) 和 [Docker Compose](https://docs.docker.com/compose/)。
2. **配置 JWT 密钥**: 
   后端服务强制要求 `JWT_SECRET`。请参照下方 [环境变量说明](#-环境变量说明) 章节完成设置。
3. **一键启动**: 在项目根目录执行：
   ```bash
   docker compose up --build
   ```
4. **访问系统**:
   - 前端地址: [http://localhost:3000](http://localhost:3000)
   - 后端 API: [http://localhost:8000/api](http://localhost:8000/api)

## ⚙️ 环境变量说明

### 后端（backend/.env）

| 变量名 | 必须 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `PORT` | 否 | `8000` | 后端服务监听端口 |
| `DATABASE_URL` | 是 | — | MySQL 连接字符串，格式：`mysql://用户名:密码@主机:端口/数据库名` |
| `JWT_SECRET` | 是 | — | JWT 签名密钥，生产环境请使用复杂随机字符串 |
| `NODE_ENV` | 否 | — | 运行环境，设为 `development` 时 API 错误响应包含堆栈信息 |

### 前端（frontend/.env）

| 变量名 | 必须 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `VITE_API_URL` | 否 | `/api` | 后端 API 基础地址。本地 `npm run dev` 时会被 Vite 代理自动转发至 `http://localhost:8000`，无需修改；生产构建时需设置为实际后端地址 |

> **快速配置**: 两个目录下均提供了 `.env.example` 文件，可复制为 `.env` 后按需修改。

## ✨ 核心功能

- **仪表盘**: 实时展示会员统计数据及等级分布。
- **会员管理**: 完整的会员 CRUD 操作，支持高级搜索、状态筛选及积分调整。
- **用户管理**: 基于角色的访问控制 (RBAC)，支持管理员管理后台账号。
- **系统监控**: 管理员可查看服务器运行状态及系统信息。
- **安全性**: 
  - 后端接口全量 JWT 校验。
  - 完善的输入验证 (Zod Schemas)。
  - 敏感操作 (如用户管理) 严格限制管理员权限。

## 🧪 测试账号

系统预置了以下测试账号（出于安全考虑，登录页已移除默认回填，请手动输入）：
- **管理员**: `admin` / `admin123`
- **普通用户**: `user` / `user123`

## ⚠️ 安全警告

- **JWT 密钥**: 后端强制要求环境变量 `JWT_SECRET`。在生产环境中，请务必设置一个复杂的随机字符串。
- **默认账号**: 建议在首次登录后立即修改管理员密码。


