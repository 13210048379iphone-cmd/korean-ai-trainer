# 韩语智能训练网站

一个前后端分离的韩语 AI 训练 MVP，包含学生端、教师端、JWT 权限隔离、AI 动态任务、朗读录音、基础语音评分、错题循环和数据分析。

## 当前版本进度（已到第 4 版）

- 第 1 版：MVP 可用（学生/教师/训练/考试）
- 第 2 版：个性化任务生成强化（弱词注入、错题来源约束）
- 第 3 版：语音评分容错 + 学习留存机制（streak、进步反馈、等级升降）
- 第 4 版：稳定性与发布增强（输入校验、错误兜底、测试覆盖、CI、Render 部署配置）

## 技术栈

- 前端：React + Vite + Tailwind + Recharts
- 后端：Node.js + Express + Prisma
- 数据库：PostgreSQL
- AI：OpenAI Responses API、Audio Transcriptions、Text-to-Speech

## 核心能力

- 学生登录后只能访问 `/api/student/*`
- 教师登录后只能访问 `/api/teacher/*`
- 每日任务根据学生等级、`VocabularyStatus` 未掌握词、`ErrorRecord` 高频错误词、历史分数生成
- 朗读训练支持标准音频、浏览器录音、语音提交、容错评分（相似度+关键词+长度）
- 词汇选择题自动批改并写入错题
- 学习数据页展示分数趋势、错词频率、记录、今日对比反馈
- 每周考试包含听力、词汇、朗读和学习建议
- 教师后台可查看所有学生、语音记录、错误分析
- 支持连续学习天数（streak）自动维护和等级自动升降

## 本次强化逻辑

### 1. AI 每日任务个性化

- 输入数据强制包含：
- `student.level`
- `VocabularyStatus` 中 `unknown` 或 `error_count > 0` 的词
- `ErrorRecord` 高频错误项
- 生成约束：
- 2 篇朗读每篇至少包含 2-3 个未掌握词（后端二次校验并补词）
- 10 个词汇题中至少 70% 来自未掌握词
- 错题复习 `review` 必须来自 `ErrorRecord`，不使用虚构项

### 2. 语音评分容错机制

- 新增 `evaluateSpeech(expectedText, recognizedText)`，返回：
- `similarityScore`
- `keywordMatchScore`
- `lengthScore`
- `finalScore`
- 判定规则：
- `finalScore >= 80`：正确
- `50 <= finalScore < 80`：部分正确
- `< 50`：需重读
- 空识别或非韩语识别：返回 `未识别清晰，请重新朗读`

### 3. 用户留存与成长

- streak：
- 以每日任务完成为准（当天 `reading >= 2` 且 `vocab >= 10`）
- 完成后 `streak_days +1`，中断后自动重置为 `0`
- 进步反馈：
- 返回今日 vs 昨日平均分变化
- 返回错误数量变化（`errorReduction`）
- 升级机制：
- 最近 3 天平均分 `> 80`：等级 +1
- 最近 3 天平均分 `< 50`：等级 -1

### 4. 词汇与错误聚合补强

- `VocabularyStatus`：
- 做错时 `error_count +1`
- 连续做对时 `error_count` 递减至 `0` 并标记 `known`
- `ErrorRecord`：
- 按 `content + error_type` 聚合计数
- 用于任务生成与错题复习
- `ErrorDailyStat`：
- 按天记录错误次数快照（`student_id + date_key`）
- 用于“今日 vs 昨日错误变化”的稳定计算
- `StudyRecord`：
- 全量记录训练行为，用于趋势与等级计算

## 启动步骤

1. 安装依赖

```bash
npm install
npm run install:all
```

2. 启动 PostgreSQL

```bash
docker compose up -d
```

3. 初始化数据库并写入演示账号

```bash
npm run db:push
npm run db:seed
```

说明：新增了 `ErrorDailyStat` 表，老项目拉取最新代码后必须重新执行一次 `npm run db:push`。

4. 启动前后端

```bash
npm run dev
```

5. 运行后端规则测试（推荐）

```bash
npm run test --prefix server
```

打开：

- 前端：http://localhost:5173
- 后端健康检查：http://localhost:4000/health

## 演示账号

- 学生：`student@demo.com` / `pass123456`
- 教师：`teacher@demo.com` / `pass123456`

## OpenAI 配置

编辑 `server/.env`：

```bash
OPENAI_API_KEY="你的 API Key"
AI_TEXT_MODEL="gpt-5.2"
AI_TRANSCRIBE_MODEL="gpt-4o-mini-transcribe"
AI_TTS_MODEL="gpt-4o-mini-tts"
```

没有配置 `OPENAI_API_KEY` 时，系统会使用本地降级内容生成和文本相似度评分，仍可完整跑通训练流程。

当前 OpenAI 接入参考了官方文档：Responses API 用于文本生成，Audio Transcriptions 支持 `gpt-4o-mini-transcribe`，Speech API 支持 `gpt-4o-mini-tts`。

## 最简单上线方式（Render）

项目根目录已提供 `render.yaml`，可直接使用蓝图部署。

1. 代码推到 GitHub。
2. 登录 Render，选择 **New + -> Blueprint**。
3. 选择该仓库，Render 会自动读取 `render.yaml` 并创建：
- PostgreSQL
- 后端服务（`server`）
- 前端静态站点（`client`）
4. 在 Render 后端服务里补充 `OPENAI_API_KEY`。
5. 首次部署后执行一次种子数据：

```bash
npm run db:seed --prefix server
```

6. 使用演示账号登录验证。

CI 已配置在 [ci.yml](/Users/liyunsong/Desktop/韩语/.github/workflows/ci.yml)，推送到 GitHub 后会自动跑后端测试和前端构建。

## 目录结构

```text
.
├── client
│   ├── src
│   │   ├── api
│   │   ├── components
│   │   └── pages
│   └── vite.config.js
├── server
│   ├── prisma
│   │   ├── schema.prisma
│   │   └── seed.js
│   └── src
│       ├── middleware
│       ├── routes
│       ├── services
│       └── utils
└── docker-compose.yml
```

## 主要 API

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/student/dashboard`
- `POST /api/student/daily/generate`
- `POST /api/student/reading/submit`
- `POST /api/student/vocab/answer`
- `GET /api/student/records`
- `GET /api/student/exam/current`
- `POST /api/student/exam/submit`
- `GET /api/teacher/students`
- `GET /api/teacher/audio`
- `GET /api/teacher/analytics`

### 关键返回字段（新增）

- `GET /api/student/dashboard`：
- `progressFeedback`（今日/昨日分数、错误变化）
- `POST /api/student/reading/submit`：
- `similarityScore` / `keywordMatchScore` / `lengthScore` / `finalScore` / `verdict`
- `progressFeedback` / `streak` / `levelUpdate`
- `POST /api/student/vocab/answer`：
- `progressFeedback` / `streak` / `levelUpdate`

## 教师端语音增强

- 教师后台语音记录支持：
- 音频播放控件
- 自动解析时长
- 简易波形预览

## 数据模型

Prisma schema 已实现需求中的核心结构：

- `Student`
- `VocabularyStatus`
- `StudyRecord`
- `ErrorRecord`
- `AudioRecord`
- `ErrorDailyStat`

同时增加：

- `User`：登录与角色权限
- `DailyTask`：每日 AI 任务缓存
- `ExamResult`：每周考试记录
