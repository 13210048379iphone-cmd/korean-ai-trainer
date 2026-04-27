# 韩语智能训练（纯静态版）

这是一个**完全静态**的韩语训练网站，不需要后端、不需要数据库、不需要服务器。

你只要把代码推到 GitHub，就可以用 GitHub Pages 免费发布。

## 现在的架构（非常重要）

- 前端：React + Vite
- 数据：全部打包在前端（本地数据包 + 浏览器 LocalStorage）
- 部署：GitHub Pages（免费）
- 不再依赖：
- Node 后端接口
- PostgreSQL
- 云服务器

## 内容覆盖范围

项目内置了大量韩语训练内容：

- `TOPIK0` 基础词汇与短文
- `TOPIK1` 进阶词汇与短文
- `TOPIK2` 中级词汇与短文
- `TOPIK3` 中高级词汇与短文

主要数据文件：

- [koreanPack.js](/Users/liyunsong/Desktop/韩语/client/src/data/koreanPack.js)

## 账号（内置）

- 学生1：`student@demo.com / pass123456`（TOPIK0）
- 学生2：`student2@demo.com / pass123456`（TOPIK1）
- 学生3：`student3@demo.com / pass123456`（TOPIK2）
- 学生4：`student4@demo.com / pass123456`（TOPIK3）
- 教师：`teacher@demo.com / pass123456`

## 本地运行（你自己先看效果）

在项目根目录执行：

```bash
cd /Users/liyunsong/Desktop/韩语
npm install --prefix client
npm run dev --prefix client
```

浏览器打开：

- `http://localhost:5173`

## 新手发布教程（GitHub Pages，最简版）

下面是**从 0 到上线**的傻瓜流程，按顺序点就行。

### 第 1 步：推代码到 GitHub

如果你已经推好了，直接跳到第 2 步。

```bash
cd /Users/liyunsong/Desktop/韩语
git add .
git commit -m "static pages version"
git push
```

### 第 2 步：开启 GitHub Pages

1. 打开你的仓库页面：  
   `https://github.com/13210048379iphone-cmd/korean-ai-trainer`
2. 点击 `Settings`
3. 左侧点击 `Pages`
4. 在 `Build and deployment` 里把 `Source` 设为 `GitHub Actions`

做完后不用再手动传文件，后续每次 `git push` 都会自动部署。

### 第 3 步：等自动部署完成

1. 仓库顶部点击 `Actions`
2. 找到工作流：`Deploy Static Site to GitHub Pages`
3. 等它显示绿色对勾（成功）

部署工作流文件：

- [deploy-pages.yml](/Users/liyunsong/Desktop/韩语/.github/workflows/deploy-pages.yml)

### 第 4 步：打开网站

你的网站地址是：

- `https://13210048379iphone-cmd.github.io/korean-ai-trainer/`

## 每次更新网站怎么做（以后就这三行）

```bash
cd /Users/liyunsong/Desktop/韩语
git add .
git commit -m "更新说明"
git push
```

推完后 GitHub 会自动重新部署。

## 数据存储说明（小白必看）

你看到的学习记录、错题、连续学习天数，都是保存在浏览器本地（LocalStorage）：

- 换设备：数据不会自动同步
- 清理浏览器缓存：数据会丢失
- 适合小范围、轻量使用

## 如何重置本地数据（回到初始状态）

方法 1（最简单）：

1. 打开网站
2. 按 `F12` 打开开发者工具
3. 找到 `Application` -> `Local Storage`
4. 删除 `korean_static_pack_v1`、`token`、`user`
5. 刷新页面

方法 2：

- 浏览器里清理本站点缓存

## 已实现功能（静态版）

- 学生登录 / 教师登录
- 每日任务（本地算法个性化）
- 朗读训练（浏览器录音 + 本地容错评分）
- 词汇训练（自动判分、错题回流）
- 每周考试（听力、词汇、朗读）
- 学习趋势图、错词频率
- 连续学习天数（streak）
- 自动升降级（最近 3 天平均分）
- 教师端语音回放 + 波形预览

## 关键文件

- [client/src/api/client.js](/Users/liyunsong/Desktop/韩语/client/src/api/client.js)：本地“伪接口”与数据引擎
- [client/src/data/koreanPack.js](/Users/liyunsong/Desktop/韩语/client/src/data/koreanPack.js)：韩语数据包（TOPIK0~3）
- [client/src/utils/scoring.js](/Users/liyunsong/Desktop/韩语/client/src/utils/scoring.js)：朗读评分函数
- [client/vite.config.js](/Users/liyunsong/Desktop/韩语/client/vite.config.js)：GitHub Pages 构建基路径配置
- [deploy-pages.yml](/Users/liyunsong/Desktop/韩语/.github/workflows/deploy-pages.yml)：自动部署流程
