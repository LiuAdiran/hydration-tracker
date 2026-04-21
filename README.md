# 饮水提醒应用

一个简洁易用的饮水提醒应用，帮助用户养成良好的饮水习惯。

## 功能特点

- 📱 响应式设计，适配各种设备
- 💧 实时饮水记录和统计
- 🏆 成就系统，激励用户坚持
- 🎯 饮水挑战，增加趣味性
- 📊 数据统计和分析
- 👤 个人资料管理
- 📚 饮水知识科普

## 部署到 Netlify（推荐）

1. 打开 [Netlify](https://app.netlify.com/) 并登录
2. 点击 `Add new site` -> `Deploy manually`
3. 将本项目根目录（包含 `index.html`）直接拖到上传区域
4. 等待部署完成后，获得公网地址（如 `https://xxx.netlify.app`）
5. 访问公网地址即可使用

### 可选：自定义域名
在站点设置中进入 `Domain management`，按引导绑定你自己的域名。

## 本地预览

如果你想先在本机验证页面，可使用：

### 使用Python
```bash
# Windows
python -m http.server 8080

# macOS
python3 -m http.server 8080
```

### 使用 Node.js（如果已安装）
```bash
npx serve .
```

## 项目结构

- `index.html` - 首页
- `profile.html` - 个人资料
- `challenges.html` - 饮水挑战
- `knowledge.html` - 饮水知识
- `help.html` - 帮助中心
- `about.html` - 关于应用
- `app.js` - 核心应用逻辑
- `style.css` - 样式文件

## 数据存储

应用使用浏览器的 localStorage 存储数据，包括：
- 饮水记录
- 成就数据
- 挑战完成情况
- 个人资料设置

## 分享给他人

1. 将整个项目文件夹压缩成ZIP文件
2. 发送给朋友或同事
3. 对方可直接上传到 Netlify，或本地启动静态服务后使用

## 技术栈

- HTML5 + CSS3 + JavaScript
- Bootstrap 5
- 纯前端实现，无需后端服务

## 注意事项

- 请确保电脑已安装Python 3.6或更高版本
- 服务器启动后，请勿关闭命令窗口
- 数据存储在浏览器本地，清除浏览器数据会导致数据丢失
- 建议定期使用"导出数据"功能备份数据

## 问题反馈

如果遇到问题，请检查：
1. Python是否正确安装
2. 端口是否被占用
3. 项目文件是否完整
4. 浏览器是否支持localStorage

---

**健康饮水，从现在开始！** 🌊