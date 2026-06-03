# FinScope — 全方位公司分析平台

**Status:** designed, pending plan  
**Date:** 2026-06-03

## Naming

- 项目名：**FinScope**
- 路由：`/technology/`（向后兼容，不改现有 URL）
- 分析页标题：FinScope
- GitHub：2assqw/my-blog（统一仓库）

## Overview

将现有财报分析工具升级为五标签专业分析平台。新增股价、估值、新闻、分析师评级等维度，数据来源 Finnhub + SEC EDGAR。

## Architecture

```
浏览器 → Cloudflare Pages (FinScope 前端)
              │
              ├── /api/financials  → SEC EDGAR (已有)
              ├── /api/proxy       → SEC 文件代理 (已有)
              ├── /api/market      → Finnhub 股价/估值 (新增)
              └── /api/news        → Finnhub 新闻/评级 (新增)
```

所有 API 调用走 Worker，前端不直接调第三方 API。Worker 做数据清洗 + 错误兜底。

## Data Sources

| 数据维度 | 来源 | 引用标注 |
|---|---|---|
| 公司搜索 | SEC company_tickers.json (本地) | — |
| 财报基本面 | SEC EDGAR 10-K/10-Q | SEC EDGAR |
| 股价行情 | Finnhub Quote API | Finnhub |
| 估值指标 | Finnhub Basic Financials | Finnhub + SEC |
| 分析师评级 | Finnhub Recommendation Trends | Finnhub |
| 公司新闻 | Finnhub Company News | Finnhub |
| 盘中走势 | Finnhub Stock Candles | Finnhub |

**数据来源标注规则：**
- 每个标签底部固定一行：`数据来源：来源1 · 来源2 · 延迟说明`
- 概览标签下每个卡片如涉及多源，单独标注来源图标（S=SEC, F=Finnhub）

## Error Handling（防数据出错）

### Worker 层
- 所有外部 API 调用带 try-catch，失败返回 `{ error, source }` 而非 500
- 单个数据源超时（5s）不阻塞其他源
- 响应格式强制为 `{ ok: boolean, data?: T, error?: string, source: string }`

### 前端层
- 每个标签独立加载，互不阻塞——概览加载失败不影响财报标签
- 卡片/图表用 React Error Boundary 包裹，单个崩溃不影响整页
- 空数据状态与错误状态分开显示：
  - `loading` → 骨架屏
  - `error` → "数据加载失败 [来源] — 重试"
  - `empty` → "暂无数据 [来源]"

### 数据验证
- 股价不可为负或 NaN
- PE 比率超出 0-1000 范围视为异常，标记而非静默显示
- 新闻标题为空或日期无效时跳过
- 评级数据缺失部分字段（如缺少某月）用 null 填充，不中断渲染

## Tab Design

### Tab 1: 概览 (Overview)

| 区域 | 内容 | 数据源 |
|---|---|---|
| 指标卡片 (4格) | 当前股价、涨跌幅、PE、市值 | Finnhub |
| 迷你走势图 | 近 3 个月收盘价折线 | Finnhub |
| 最新新闻 | 最近 3 条标题+摘要 | Finnhub |
| 评级摘要 | 买入/持有/卖出 分布条 | Finnhub |

### Tab 2: 财报 (Financials)

现有分析页内容 — 比率评分卡 + 散点图 + 6 折线图。已有。

### Tab 3: 市场 (Market)

| 区域 | 内容 | 数据源 |
|---|---|---|
| 走势图 | 6 个月日 K 线（折线替代，无 OHLC 数据） | Finnhub |
| 估值趋势 | PE/PB/PS 三线折线图 | Finnhub |
| 关键价位 | 52 周高/低、50 日均线 | Finnhub |

### Tab 4: 新闻 (News)

| 区域 | 内容 | 数据源 |
|---|---|---|
| 新闻列表 | 最近 20 条，标题+摘要+时间+来源 | Finnhub |
| 情绪筛选 | 正面/负面/中性 切换 | 前端过滤 |
| 标注机制 | 无来源链接、引用匿名人士、含极端词汇（暴/崩/逃）的消息标记"⚠ 未经证实" | 前端判断 |

**标注规则（前端自动检测）：**
- 新闻缺少来源 URL → 标 ⚠️ "未附来源链接"
- 标题含 "匿名人士" / "内部人士" / "知情人士" 等无具名来源 → 标 ⚠️ "引用未知来源"
- 标题含极端量化描述但 Finnhub 未提供佐证数据 → 标 ⚠️ "无法佐证"
- 多条规则命中 → 仅显示优先级最高的一个标签
- 标注不阻塞显示，仅作为视觉提示（琥珀色标签条在新闻卡片顶部）

### Tab 5: 评级 (Ratings)

| 区域 | 内容 | 数据源 |
|---|---|---|
| 评级分布 | 堆叠柱状图：strongBuy/buy/hold/sell/strongSell | Finnhub |
| 趋势线 | 近 6 个月评级变化 | Finnhub |
| 目标价 | 最高/最低/平均目标价 | Finnhub |

## Page Layout

```
/technology/analysis/
├── 顶栏：← FinScope  [公司名]  [期间切换]
├── 标签栏：[概览] [财报] [市场] [新闻] [评级]
├── 内容区 (当前标签)
└── 底栏：数据来源：Finnhub · SEC EDGAR · 数据延迟最多 15 分钟
```

每切换标签，内容区做淡入过渡（0.2s opacity），不符合博客的线性过度原则时用 opacity 即可。

## Non-Goals

- 实时数据推送（WebSocket）
- 搜索/筛选/排序新闻
- 导出功能
- 宏观数据集成
- 移动端深度优化（已有基础响应式，本阶段不做额外优化）
- AI 自动事实核查（标注规则基于前端已有字段的模式匹配，不做外部查证）
