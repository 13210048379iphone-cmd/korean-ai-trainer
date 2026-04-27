# 韩语智能训练（纯静态单机版）

这是一个可以直接部署到 GitHub Pages 的韩语训练网站：

- 不用后端
- 不用数据库
- 不用登录
- 打开网页就能学

## 这版重点升级

1. 去掉登录页面，打开即用  
2. 改为口语优先：每日默认 `6` 篇朗读 + `4` 个词汇题  
3. 修复翻译错位：每篇朗读是“韩文+中文”成对生成，避免少翻译  
4. 内容库扩展：TOPIK0~TOPIK3 + 组合式生成，支持长期不重复练习  
5. 支持多人本地档案：每个人独立保存学习状态  
6. 新增个人周报：每周训练次数、均分、错误总数一览
7. 语音存储优化：仅保留最近 30 条原始音频，历史记录仅保留文本和分数
8. 朗读评分增强：新增句段覆盖率，并提高长度权重，防止只读半句拿高分
9. 朗读卡片支持韩文/中文切换，中文可一键展开/收起
10. unknown/error 相关项改为中文友好显示（含词义与错误类型）

---

## 本地运行（先看效果）

```bash
cd /Users/liyunsong/Desktop/韩语
npm install --prefix client
npm run dev --prefix client
```

浏览器打开：

- `http://localhost:5173`

## 内容库是否够用半年？

当前每日默认是 `6` 篇朗读。  
按 180 天计算需要 `1080` 篇内容。

组合式生成使用：时间 + 主语 + 场景 + 动作 + 计划 + 薄弱词注入，且按“学习者 + 日期 + 题号”生成稳定唯一 ID。  
实测 4 个等级各自 180 天都是 `1080 / 1080` 唯一（无重复）。

---

## 使用方法（超简版）

1. 打开网页直接进入“今日训练”
2. 右上角下拉框切换学习者
3. 右上角输入名字点“添加”可以新建学习者
4. 学完后到“学习数据”看：
   - 分数趋势
   - 错词列表
   - 个人周报（每周数据表）

> 所有数据都保存在浏览器本地（LocalStorage），换设备不会自动同步。
> 为避免存储爆满，系统会自动清理旧语音音频，仅保留最近 30 条可回放音频。

---

## GitHub Pages 部署（小白版）

你已经有仓库了，后面每次就三步：

```bash
cd /Users/liyunsong/Desktop/韩语
git add .
git commit -m "update static trainer"
git push
```

然后：

1. 打开仓库 `Settings`
2. 点 `Pages`
3. Source 选 `GitHub Actions`
4. 等 `Actions` 里绿色对勾完成

网站地址：

- `https://13210048379iphone-cmd.github.io/korean-ai-trainer/`

---

## 重置本地数据

打开浏览器开发者工具（F12）：

1. `Application` → `Local Storage`
2. 删除：
   - `korean_static_pack_v2`
   - `korean_static_active_student_v1`
3. 刷新页面

---

## 关键文件

- [client/src/api/client.js](/Users/liyunsong/Desktop/韩语/client/src/api/client.js)：本地数据引擎、个性化任务、周报聚合
- [client/src/data/koreanPack.js](/Users/liyunsong/Desktop/韩语/client/src/data/koreanPack.js)：词库与阅读组件（TOPIK0~TOPIK3）
- [client/src/utils/scoring.js](/Users/liyunsong/Desktop/韩语/client/src/utils/scoring.js)：语音容错评分
- [client/src/components/AppShell.jsx](/Users/liyunsong/Desktop/韩语/client/src/components/AppShell.jsx)：学习者切换与新增
- [client/src/pages/StudentDashboard.jsx](/Users/liyunsong/Desktop/韩语/client/src/pages/StudentDashboard.jsx)：口语优先训练页
- [client/src/pages/DataPage.jsx](/Users/liyunsong/Desktop/韩语/client/src/pages/DataPage.jsx)：趋势+错误+个人周报
