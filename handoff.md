# FlowPilot handoff — Database Learning

更新时间：2026-09-19。用途：交给一个新的 coding-agent session，让它从当前代码继续 research → plan → implement → validate。本文描述的是交接时的状态，开始工作时请先核对 Git 和代码；不要把「建议方案」当成已经实现的功能。

## 1. 下一轮的任务

用户希望 FlowPilot 能从过去的 troubleshooting cases 中积累可复用、可纠错的经验：

1. 保存问题、证据、可能原因、实际检查结果、处理措施与验证结果。
2. 新问题出现时，系统查找相关历史案例，并利用可信经验辅助诊断和下一步检查。
3. Technician 发现历史结论不正确时，可以修正知识；后续检索应使用正确版本。
4. 探索 Knowledge Graph / 类似 Obsidian 的关联视图，让人能理解问题、部件、原因、措施和案例之间的关系。
5. 同时改善 Diagnose 和知识库的 UI，减少长篇文字，让「判断、依据、下一步」更清楚。

**下一轮要自己研究和选型，再写出具体计划并推进实现。** 本文提供产品目标、现状和设计约束，不预先锁死数据库、检索算法或图形库。不要只做研究报告或一个不能影响诊断的 graph 装饰页。

用户用中文交流，应用界面保留英文。用户有 coding agents 支持，不要仅以团队人数或开发时长否定方案。优先判断数据是否支持、功能是否真实、演示是否能跑通。常规实现选择自主推进；只有真正影响产品方向或需要用户提供的信息才提问。

## 2. 仓库与 Git 基线

- 仓库：`/Users/jiale/Workspace/Hackathon/FlowPilot`
- Remote：`https://github.com/JiaLe331/FlowPilot.git`
- 当前分支：`feat/photo-anomaly-workflow`
- 当前 HEAD：`258536d5cbc031965320e2a1a846ce8358f3adfb`
- 远端同名分支已 push，交接前本地与远端一致。
- `258536d`：Report 两步流程、photo/log/observations 联合提交、配套日志和 ignore 补充。
- `4d15ed4`：照片异常分析、PatchCore-style detector、修复前后照片比较。
- `864f6bf`：移除自动 GitHub Actions workflow。
- `c67350a`：任务导向工作流 UI、右下角浮动 assistant。

用户明确要求使用 feature branch，不直接 push main。下一轮必须从上述功能基线继续；不要从旧 main 开始而漏掉已完成工作。可以在此基线上创建新的 database-learning 分支。不要 reset、覆盖队友改动、改写既有 commits 或擅自合并 main。

本轮只新增这份 handoff；写入时它尚未 commit/push。接手时重新查看实际状态。不要假定开发服务器仍在运行。

## 3. 题目与资料

题目：NSW Automation / AI Horizon Solution Challenge 2026，AI Dispensing Defect Detective。

原文：`/Users/jiale/Workspace/Hackathon/AIhorizon/NSW Automation .pdf`

第 7 页 **4.3 Bonus Challenge 3 — AI Learning Database** 要求一个小型数据库包含：

- Dispensing Problem
- Possible Causes
- Recommended Solutions
- Successful Solution

并让 AI 利用以往 troubleshooting cases。题目举例用相似案例的次数及已知原因分布表达历史经验。**题目没有强制 Knowledge Graph、Obsidian、向量数据库或模型再训练。** 不要把少量演示记录的计数包装成统计概率。

其他本地资料：

- `docs/PRODUCT_REQUIREMENTS.md`：现有 PRD；知识检索、知识管理和 graph 曾标为 post-hackathon。
- `docs/EXPERT_REVIEW.md`：工艺解释及尚未完成的专家验证边界。
- `docs/PHOTO_INSPECTION.md`：当前照片流程、模型细节、启动与验证方式。
- `fixtures/logs/README.md`：两条 demo 的对应关系、日志字段和计算规则。
- `docs/DESIGN_SYSTEM.md`、`docs/DEVELOPMENT.md`。
- `/Users/jiale/Workspace/Hackathon/AIhorizon/output/research/NSW-Hackathon-Idea-Selection-Full.md`：此前完整研究，作为背景，不必重做整轮 hackathon 选题。

**范围已更新：用户现在主动把 database learning 提升为下一阶段重点。** PRD 的旧 deferred 标记不能作为拒绝继续的理由。研究后应同步修订相关范围描述，同时保留现有工艺和证据约束。

可作为研究起点，仍需自行核实适用性：

- RAG 原始论文：<https://arxiv.org/abs/2005.11401>
- Obsidian Graph view：<https://help.obsidian.md/plugins/graph>

先读 repo `AGENTS.md` 及它引用的文件。涉及具体库、框架、API 用法时，按工作区指引使用 Context7 获取当前文档；技术研究优先原始论文与官方文档。

## 4. 当前系统实际做到了哪里

### 用户流程

1. **Report / Inspect photo**：只提供照片上传；没有 Try an example 选择器。分析后展示真实 anomaly score、threshold、原图/heatmap 切换以及运行中的反馈。
2. **Report / Add context**：独立下一页。上传可选 `.log` / `.txt`，选择并确认对应 Board，填写五个结构化观察及可选备注。可以显式采用 log 中支持的重量、压力答案。
3. **Generate diagnosis**：一次性验证并保存 photo + log + observations，直接进入诊断，不再重复五个问题。
4. **Diagnose**：固定规则给多个候选原因打分；可选 Gemini specialists + critic 提供带证据引用的解释。
5. **Inspect**：交互式 3D guide，technician 记录检查结果并确认；保留 2D/文字 fallback。
6. **Correct / Verify**：记录已完成动作，上传 post-action photo，确认设备复验项目；满足条件后结案并保存前后对比。

Report 支持返回保留草稿。换照片、换 Board、替换/移除 log 会使对应确认和 log 派生答案失效。不同来源冲突需要选择来源并记录理由。没有 log 时仍能继续；未知事项可选 Not recorded。

### 已有基础与实际缺口

| 项目 | 当前实际状态 |
| --- | --- |
| 持久化 case、证据、动作和结果 | 已有 |
| 单个 case 的诊断快照与时间线 | 已有 `diagnostic_history`，不是跨案例学习 |
| 编辑/拒绝当前 case 的证据 | 已有；会失效相关答案并重新诊断，但确认检查后有锁定限制 |
| 新 case 检索其他已保存的 cases | 未实现 |
| 可发布、修正、归档的知识条目 | 未实现 |
| 历史知识版本及其引用追踪 | 未实现 |
| Knowledge Graph | 未实现 |

不要把「保存了病例」或「列出历史记录」描述为已经实现 database learning。

### 模型、规则与存储

- 前端：React + TypeScript + Vite，已有 CSS tokens 和 Phosphor 图标。
- 后端：FastAPI / Pydantic / SQLAlchemy / Alembic。
- 默认数据库：仓库根目录 `flowpilot.db`，SQLite；没有默认 Supabase 依赖。
- `cases` 表当前主要保存 `id`、乐观并发 `revision`、JSON `payload`。
- 诊断打分来自 `fixtures/v2/scoring-rules.json`，不是从旧案例自动训练出来的。
- Gemini 可选；当前 `enrich()` 只接收当前 case 的证据、ranking、known gaps，没有历史案例检索。
- `validate_finding()` 目前只允许引用当前 case 的有效 evidence/source。引入知识引用时需明确扩展契约及校验，不能把旧 case 的事实伪装成本次测量。
- 右下角浮动 assistant 已有；其 explain endpoint 当前基于当前 case 的信息，不要假定它已具备跨案例 RAG。
- Vision 是 **PatchCore-style 简化实现**：冻结的 ImageNet ResNet18 + 正常 patch 特征库 + 最近邻距离。不是 LM，也不是官方 WRN50 实现。
- `fixtures/vision/memory-bank.npz` 约 95 KB，含 78 个正常参考特征，已提交且运行必需。它与新做的 troubleshooting knowledge database 是两回事；修正案例知识不应修改这个文件或 detector threshold。

## 5. 两条现有 demo

| 场景 | 照片和 log | 观察与后续结果 |
| --- | --- | --- |
| Incomplete coverage | `fixtures/vision/incomplete-coverage.png` + `fixtures/logs/synthetic-incomplete-coverage.log`，Board 103 | 重量 20 → 18 → 16 mg；压力约 1.50 bar。以确认喷嘴堵塞 → 清洁/更换 → 复验通过作为成功处理路径。 |
| Coarse deposits | `fixtures/vision/coarse-deposits.png` + `fixtures/logs/synthetic-coarse-deposits.log`，Board 203 | 重量在 19–21 mg 参考范围内；压力约 1.50 bar。确认未发现 nozzle obstruction 后进入维护交接。它不证明 atomization fault 已确认或已修复。 |

修复后照片：`fixtures/vision/normal.png`。

照片和配套日志是 synthetic demo 数据。日志基于用户提供的时间戳事件格式，重量和压力事件是明确记录在文档中的 demo 扩展，不是真实 NSW 导出字段规范。

用户希望主页面干净，避免到处重复 Demo / AI-generated 字样；数据来源仍保留在文档、元数据及演示说明中。不要宣称真实工业数据或已验证的生产准确率。

## 6. 推荐方向，待下一轮研究后细化

### A. 从案例生成可追溯的经验记录

用结构化字段保存工艺/设备适用范围、症状、测量特征、候选原因、已确认/已排除的检查结果、实际措施及效果，并关联原 case revision、evidence IDs、照片/log 和确认者。

允许模型整理摘要，但发布知识必须基于来源证据及明确确认。保留「候选原因」「已确认结果」「尚未解决」的区别。成功处理可以形成经验；失败动作和明确的 negative finding 也有价值，但不能被发布为成功修复或被夸大成全面排除某类故障。

不要自动把所有已保存案例都当成可靠知识，尤其不能把反复跑 demo 的重复记录当成独立工业样本。

### B. 新 case 自动检索相关案例

研究一个与现有数据规模相称的方案：结构化过滤 + 明确的相似条件，可结合全文/语义检索。比较简单可解释基线与引入 embeddings/graph traversal 的实际增益，再决定技术栈。

候选匹配因素包括工艺/设备、症状、重量趋势、压力状态、物料/recipe 条件。未知条件必须显式保留；不要用文件名匹配答案。不要把当前 case 或其未来结果检索给自己。

结果应显示：匹配理由、不同/未知条件、历史检查和处理结果、知识版本、可点击的来源。无可靠匹配时明确显示无匹配。

历史经验应实际参与解释和下一步检查的选择。需要在计划中明确它如何影响现有固定规则、推荐步骤及 Gemini：可以先单独呈现 historical support；若改变排序，必须能解释变化，避免重复计分。相似历史不能跳过当前 case 的检查和确认。

### C. 纠错必须改变后续检索

建议支持 draft / published / disputed / superseded / archived 等明确状态；最终状态模型由下一轮设计。

Technician 能指出错在哪里，提供修正值、理由和支持材料。错误版本被标记后应暂停作为有效建议；新版本发布后，检索及缓存/索引采用新版本。

保留旧版本、修改人、时间和理由。已引用旧版本的诊断保留原快照，显示参考知识已更新，并允许显式重跑；不要悄悄重写过去的诊断。

当前 `correct_evidence()` 在确认检查后锁定，知识修订需要独立处理，不要为了编辑历史知识移除原有 case 工作流约束。并发修改、来源 case 被修正时如何失效知识、发布与检索更新的原子性，都应进入设计。

### D. Graph 与知识管理页面

目标是一个能操作、查来源的知识视图。可以有 `Symptom → Case → Finding/Cause → Component → Action → Outcome` 等节点与有类型的关联。

每条关联应带来源和验证状态。「相关」不等于「已证实导致」。点击节点能查看相关经验和证据；编辑通过清晰的详情表单进行，不能只是拖动线条后无校验地改变诊断知识。

Graph 可以先聚焦选中的 case/部件附近关系，搭配列表/卡片视图。是否引入专门 graph database 需要研究论证；现有关系数据库保存节点/关系也是候选。不要让用户安装 Obsidian 才能使用 FlowPilot。

### E. UI 优先点

**必须使用项目的 UI/UX Pro Max skill：** `.agents/skills/ui-ux-pro-max/SKILL.md`。

- Diagnose 首屏突出「目前判断、关键依据、下一步检查」。
- 增加 Similar past cases / Past experience，清楚区分历史经验与本次证据。
- Knowledge Library 提供搜索、状态、来源、详情、修正及版本记录；提供关联 graph 的合理入口。
- 长篇评分、底层 ID 和完整历史按需展开，保留可追溯能力。
- 延续现有视觉 tokens、可访问交互和响应式布局，不再把新功能堆成长页面。
- 保留已经改善的 Report、浮动 assistant、3D inspection，不因新功能重复推翻它们。

## 7. 关键代码入口

路径均相对 FlowPilot 根目录。

| 路径 | 用途 |
| --- | --- |
| `apps/api/src/flowpilot/cases.py` | Case/CaseRecord、rank、apply_action、correct_evidence、capture_diagnosis、apply_intake、持久化与 API |
| `apps/api/src/flowpilot/diagnosis/reasoning.py` | Gemini specialists/critic、enrich、引用校验和 fallback |
| `apps/api/src/flowpilot/intake.py` | 联合报告契约、按 Board 提取可采用的 log signals |
| `apps/api/src/flowpilot/ingestion/industry_event_log.py` | 原始日志解析与来源行 |
| `apps/api/src/flowpilot/investigations/models.py` | Evidence / Investigation 等契约 |
| `apps/api/src/flowpilot/persistence/database.py` | DB Base 和 engine |
| `apps/api/migrations/` | Alembic migrations；新存储结构应有迁移和旧数据兼容方案 |
| `fixtures/v2/scoring-rules.json`、`fixtures/v2/golden-scenario.json` | 当前工艺规则、问题与程序数据 |
| `apps/web/src/CaseApp.tsx` | 当前工作流 UI 和诊断页面 |
| `apps/web/src/components/ReportIntake.tsx` | 新 Report 的两步 UI 与三类证据摘要 |
| `apps/web/src/components/CaseAudit.tsx`、`EvidenceCorrection.tsx` | 单个 case 的审计/纠错 UI，可参考但不等于知识修订 |
| `apps/web/src/components/ApplicationFrame.tsx`、`CaseNavigator.tsx` | 页面框架与导航 |
| `apps/web/src/components/GuidanceComposer.tsx` | 当前 assistant UI |
| `apps/web/src/api.ts` | 前端 API client |
| `packages/contracts/openapi.json`、`packages/contracts/src/generated.ts` | 生成的契约；改后端 schema 后用脚本生成，勿只手改生成文件 |
| `apps/api/tests/test_photo_cases.py`、`test_intake_context.py`、`test_audit_history.py`、`test_corrections.py`、`test_reasoning.py` | 现有相关后端回归 |
| `test/e2e/photos.spec.ts`、`test/helpers/caseJourney.ts` | 现有照片/日志完整 browser journey |

建议把知识存储、检索和版本逻辑分模块；避免继续把所有新逻辑加进已有的大型 `cases.py` / `CaseApp.tsx`。

## 8. 下一轮工作顺序与交付物

1. **核实基线**：检查 Git 状态、资料、数据结构和两条 demo；检查是否已有队友改动。
2. **定向研究**：比较 case-based retrieval、RAG 与 graph 的职责；决定适用范围、知识粒度、可信状态、纠错传播和检索方法。记录来源和取舍，不重做整个选题研究。
3. **写可执行计划**：建议 `docs/DATABASE_LEARNING_PLAN.md`，包含数据模型、API、引用和版本策略、UI 流程、迁移、demo 及验收。明确哪些是用户目标、哪些是实现选择。处理 PRD 中旧的 deferred 范围。
4. **实施一个闭环**：经验产生 → 确认发布 → 新 case 真实检索/引用 → 修正 → 后续诊断引用新版本。优先完成贯通的工作，再完善 graph 和视觉。
5. **验证与交付**：跑相关测试和两条现有流程，用隔离数据演示闭环；留下简短使用说明、研究/计划结论及已知限制。报告实际完成状态，不把 prototype graph 或 mock retrieval 描述为完整 learning。

## 9. 必须证明的行为

- 案例 A 产生经确认的知识；新案例 B 符合条件时能检索到 A，展示真实来源和匹配理由。
- 发布前、被争议、已归档或被替代的版本不作为当前有效建议。
- 修正 A 的知识后，新案例 C 使用新版本；B 的旧诊断快照仍能解释当时为何引用旧版本。
- 无匹配、条件不兼容、缺少信息时，不虚构案例、成功次数、原因或处理结果。
- 重复 demo、同一 case 多个 revision 不被重复计成多个成功案例；不存在自我检索和结果泄漏。
- 相似案例的成功处理不能自动确认当前根因、标记动作已完成或绕过复验。
- Coarse-deposits 的 clear-nozzle 记录仍是已确认检查结果/未解决交接，不被当成已确认的 atomization repair。
- Knowledge 变化确实影响检索结果及解释/检查建议，可通过发布或修订前后对比证明；不能只添加静态文案。
- 引用校验、旧数据加载、并发更新、失败回滚、模型不可用 fallback 有合适测试。
- 原有 upload-only Report、草稿失效规则、3D 检查、修复与复验流程不回归。

## 10. 启动、检查与文件卫生

在 repo root 运行；先检查已安装状态，不要重复下载依赖或模型：

```sh
npm ci
uv sync --locked
npm run vision:setup
npm run db:migrate
npm run dev
```

- Web：`http://127.0.0.1:5173`
- API：`http://127.0.0.1:8000`
- 本机 uv 位于 `/Users/jiale/.local/bin`，如未在 PATH 中可临时补入。
- 可选后端 `GEMINI_API_KEY`；默认模型名称以当前 `settings.py` / `.env.example` 为准。不要读取或输出真实 key，不要写进 `VITE_*` 或提交 `.env`。
- 无 key 时保留清楚标注的 deterministic fallback；不要伪装 live AI。

改 schema 后运行 `npm run contracts:generate`。标准检查：

```sh
npm run check
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --workers=2
```

上一轮构建、lint、typecheck、契约和后端检查已通过。浏览器共 52 项测试，一项因隐藏页面的重复文本导致定位歧义，修正 locator 后单独重跑通过。之后新增的源测量拒绝回归也已通过相关后端测试。接手后按实际改动做新的验证，不要只引用这些历史结果。

Browser E2E 用 5174 / 8100 和 `.cache/e2e-*` 的隔离数据库/照片目录。运行前检查端口和已有进程。用户曾明确不希望留下大量 test investigations 或备份垃圾：不要把测试案例批量写入日常使用的 `flowpilot.db`；结束后只清理本轮确知的临时产物，不删除用户数据或不明来源文件。

`.gitignore` 已覆盖依赖、缓存、构建产物、本地数据库、`.env`、Playwright 产物、macOS 元数据和运行日志；`fixtures/**/*.log` 明确保留。必要的 demo 图片、synthetic logs、memory bank、模型 manifest、迁移及锁文件需要保留在 Git。

ResNet 权重约 45 MB，位于 ignored `.cache/vision/model/`；照片/heatmap 位于 `.cache/vision/assessments/`，已保存 case 可能引用它们，不能当垃圾随意删除。没有添加 paid service 或重新启用 GitHub Actions 的需求。
