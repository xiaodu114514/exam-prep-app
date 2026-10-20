---
name: exam-prep-agent
description: 稳步备考（exam-prep）学习管理技能。通过 HTTP API 添加每日学习任务、查询今日/本周完成度与各科背诵进度。当用户提到"备考""稳步备考""添加学习任务""查看今天完成了多少""背诵进度"等时使用。
---

# 稳步备考 · Agent 技能

通过 HTTP API 管理「稳步备考」应用中的学习任务和查看学习进度。适用于任意能发 HTTP 请求的 Agent/脚本。

## 基础信息

- **生产地址**：`https://study.xiaodu0315.top`（或 `http://8.155.135.143`）
- **本地开发地址**：`http://127.0.0.1:3001`（需先启动本地后端）
- **认证**：请求头 `X-Agent-Key: <API Key>`，或 `Authorization: Bearer <API Key>`
- API Key 由部署方提供（存于服务器 `/etc/exam-prep.env` 的 `AGENT_API_KEY`）。
  在 Agent 环境中通过环境变量 `EXAM_PREP_API_KEY` 注入，**不要写入源码或公开文档**。
- 未配置 Key 时所有接口返回 `503`；Key 错误返回 `401`。

## 接口

### 1. 添加任务 `POST /api/agent/tasks`

```json
{
  "title": "背单词 50 个",        // 必填，任务名称
  "date": "2026-10-21",          // 可选，YYYY-MM-DD，默认今天
  "subjectId": "科目 id",        // 可选，从 /api/agent/stats 的 subjects[].id 获取
  "amount": 50,                  // 可选，背诵量（必须配合 subjectId）
  "daily": true                  // 可选，true = 每日任务（每天自动出现）
}
```

成功返回 `201`：

```json
{
  "task": {
    "id": "…",
    "title": "背单词 50 个",
    "date": "2026-10-21",
    "completed": false,
    "subjectId": "…",
    "amount": 50,
    "contributed": 0,
    "daily": true,
    "doneDate": null
  }
}
```

### 2. 查询完成度 `GET /api/agent/stats?date=YYYY-MM-DD`

返回结构（date 省略时默认今天）：

```json
{
  "date": "2026-10-20",
  "today": {
    "total": 3, "done": 1, "rate": 33,
    "tasks": [
      {
        "id": "…", "title": "单词", "completed": false,
        "subjectId": "…", "subjectName": "英语",
        "amount": 40, "daily": true
      }
    ],
    "bySubject": [
      { "subjectId": "…", "name": "英语", "done": 0, "total": 1 }
    ]
  },
  "week": {
    "start": "2026-10-19", "end": "2026-10-25",
    "total": 21, "done": 5, "rate": 24,
    "days": [{ "date": "2026-10-19", "total": 3, "done": 0 }]
  },
  "subjects": [
    { "id": "…", "name": "英语", "unit": "单词",
      "total": 3000, "completed": 780, "rate": 26 }
  ],
  "exam": { "name": "2026 国家公务员考试", "date": "2027-02-10", "daysLeft": 113 }
}
```

### 3. 任务列表 `GET /api/agent/tasks?date=YYYY-MM-DD`

```json
{
  "date": "2026-10-20",
  "tasks": [
    { "id": "…", "title": "单词", "completed": false,
      "subjectId": "…", "amount": 40, "daily": true }
  ]
}
```

## 使用流程建议

1. 先 `GET /api/agent/stats` 了解今日任务、各科背诵进度和考试倒计时；
2. 需要新建任务时 `POST /api/agent/tasks`；
3. 需要向用户汇报进度时，引用 `today.rate`、`week.rate`、`subjects[].rate`。

## 示例

```bash
BASE=https://study.xiaodu0315.top
KEY="$EXAM_PREP_API_KEY"

# 查看今日完成度
curl -s -H "X-Agent-Key: $KEY" "$BASE/api/agent/stats"

# 添加一个今日任务
curl -s -X POST "$BASE/api/agent/tasks" \
  -H "X-Agent-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"title":"行测·判断推理 20 道"}'

# 添加每日背诵任务（需科目 id）
curl -s -X POST "$BASE/api/agent/tasks" \
  -H "X-Agent-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"title":"背单词 50 个","subjectId":"<科目id>","amount":50,"daily":true}'
```

## 错误处理

| 状态码 | 含义 | 处理 |
|---|---|---|
| 401 | Key 缺失或无效 | 检查 `EXAM_PREP_API_KEY` 是否配置正确 |
| 400 | 参数校验失败（如空标题、科目不存在、amount≤0、日期非法） | 修正参数后重试，错误信息在 `error` 字段 |
| 503 | 服务器未启用 Agent API（未配置 AGENT_API_KEY） | 请部署方配置 Key |

## 安全

- API Key 仅用于本技能，勿泄露、勿写入代码仓库或公开文档；
- 生产环境建议通过 HTTPS 访问；Key 泄露时应联系部署方轮换。
