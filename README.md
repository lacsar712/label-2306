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

1. **前提条件**: 确保已安装 [Docker](https://www.docker.com/) 和 [Docker Compose](https://docs.docker.com/compose/)。
2. **配置 JWT 密钥**: 
   后端服务强制要求 `JWT_SECRET`。请参照下方 [JWT 密钥配置](#-jwt-密钥配置) 章节完成设置。
3. **一键启动**: 在项目根目录执行：
   ```bash
   docker compose up --build
   ```
4. **访问系统**:
   - 前端地址: [http://localhost:3000](http://localhost:3000)
   - 后端 API: [http://localhost:8000/api](http://localhost:8000/api)

## 🔑 JWT 密钥配置

为确保系统安全，后端强制要求配置 `JWT_SECRET` 环境变量。您可以通过以下两种方式之一进行设置：

### 方式一：使用 .env 文件（推荐）
1. 在项目根目录下创建 `.env` 文件：
   ```bash
   touch .env
   ```
2. 在文件中添加以下内容：
   ```text
   JWT_SECRET=您的随机长字符串
   ```

### 方式二：直接修改 docker-compose.yml
1. 打开根目录下的 `docker-compose.yml`。
2. 找到 `backend` 服务下的 `environment` 节点。
3. 修改或确认 `JWT_SECRET` 的值：
   ```yaml
  services:
    backend:
      environment:
        DATABASE_URL: "..."
        JWT_SECRET: "您的随机长字符串"
  ```

> **注意**: 修改配置后，请重新执行 `docker compose up --build` 以使配置生效。

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


