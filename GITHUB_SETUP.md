# GitHub 同步指南

## 方式 1：使用 GitHub CLI（推荐）

如果你已安装 GitHub CLI (`gh`)：

```bash
# 1. 登录 GitHub（如果还未登录）
gh auth login

# 2. 创建 GitHub 仓库并推送
gh repo create html-visual-editor --public --source=. --remote=origin --push

# 或者创建私有仓库
gh repo create html-visual-editor --private --source=. --remote=origin --push
```

## 方式 2：手动创建仓库

### 步骤 1：在 GitHub 上创建仓库

1. 访问 https://github.com/new
2. 仓库名称：`html-visual-editor`（或你喜欢的名称）
3. 描述：`HTML 可视化编辑器 - 支持独立使用和 VS Code 插件`
4. 选择 Public 或 Private
5. **不要**勾选 "Initialize this repository with a README"
6. 点击 "Create repository"

### 步骤 2：添加远程仓库并推送

复制 GitHub 显示的仓库 URL，然后执行：

```bash
# 添加远程仓库（替换 YOUR_USERNAME 为你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/html-visual-editor.git

# 或使用 SSH（如果已配置 SSH key）
git remote add origin git@github.com:YOUR_USERNAME/html-visual-editor.git

# 推送到 GitHub
git push -u origin main
```

## 方式 3：使用现有仓库

如果你已经有一个 GitHub 仓库：

```bash
# 添加远程仓库
git remote add origin YOUR_REPO_URL

# 推送
git push -u origin main
```

## 验证推送

推送成功后，访问你的 GitHub 仓库页面，应该能看到：

- ✅ 所有源代码文件
- ✅ 完整的文档
- ✅ VS Code 插件代码
- ✅ README.md 作为首页显示

## 后续更新

以后有新的修改时：

```bash
# 1. 添加修改的文件
git add .

# 2. 提交
git commit -m "描述你的修改"

# 3. 推送到 GitHub
git push
```

## 推荐的仓库设置

### 1. 添加 Topics（标签）

在 GitHub 仓库页面，点击右侧的 "Add topics"，添加：
- `html-editor`
- `visual-editor`
- `vscode-extension`
- `wysiwyg`
- `typescript`
- `javascript`

### 2. 设置仓库描述

在仓库页面点击 "About" 旁边的齿轮图标，添加：

**Description（描述）**：
```
HTML 可视化编辑器 - 零依赖的单文件编辑器 + VS Code 插件版本
```

**Website（网站）**：
如果你部署了在线演示，可以添加链接

**Topics（标签）**：
见上方推荐的标签

### 3. 启用 GitHub Pages（可选）

如果想要在线演示独立版：

1. 进入仓库 Settings > Pages
2. Source 选择 "main" 分支
3. 保存后会生成一个 URL，如：
   ```
   https://YOUR_USERNAME.github.io/html-visual-editor/html-editor.html
   ```

### 4. 添加 README 徽章（可选）

在 README.md 顶部添加徽章：

```markdown
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.0-green.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-1.75.0+-blue.svg)
```

## 常见问题

### Q: 推送时提示 "Permission denied"

A: 检查你的 GitHub 认证：
- HTTPS：确保输入了正确的用户名和密码/token
- SSH：确保已配置 SSH key

### Q: 推送时提示 "Updates were rejected"

A: 远程仓库有新的提交，先拉取：
```bash
git pull origin main --rebase
git push
```

### Q: 如何修改远程仓库 URL？

```bash
# 查看当前 URL
git remote -v

# 修改 URL
git remote set-url origin NEW_URL
```

## 下一步

推送成功后：

1. ✅ 在 GitHub 上查看你的仓库
2. ✅ 添加 Topics 和描述
3. ✅ 邀请协作者（如果需要）
4. ✅ 设置 GitHub Pages（如果需要在线演示）
5. ✅ 分享你的项目！

## 获取帮助

- GitHub 文档：https://docs.github.com
- GitHub CLI 文档：https://cli.github.com/manual/
- Git 文档：https://git-scm.com/doc

---

*准备好了吗？选择上面的一种方式开始推送到 GitHub！*
