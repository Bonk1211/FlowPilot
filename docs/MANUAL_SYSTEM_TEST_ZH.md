# FlowPilot：五分钟 Demo 测试与彩排

本手册只测试 presentation 会展示的内容。每轮按同一路线走：**视觉异常 → 上下文问答 → AI 解释 → 3D 检查 → 技师审核经验 → AI 引用经验**。

现场操作目标 **5 分钟，最多 6 分钟（含等待缓冲）**。历史案例在演示前准备，准备时间不计入现场 demo。按钮名以当前英文界面为准。

## 1. 只准备这三个文件

| 文件 | 用途 |
|---|---|
| [incomplete-coverage.png](/Users/jiale/Workspace/Hackathon/FlowPilot/fixtures/vision/incomplete-coverage.png) | 初始异常照片；现场展示 CV 与热图 |
| [synthetic-incomplete-coverage.log](/Users/jiale/Workspace/Hackathon/FlowPilot/fixtures/logs/synthetic-incomplete-coverage.log) | 配对 log，选 Board 103；重量 20→18→16 mg，压力稳定 |
| [normal.png](/Users/jiale/Workspace/Hackathon/FlowPilot/fixtures/vision/normal.png) | 仅演示前准备历史案例时，用作成功复验照片 |

素材目录：`/Users/jiale/Workspace/Hackathon/FlowPilot/fixtures`。macOS 上传框可按 Cmd+Shift+G 粘贴目录，再进入 vision 或 logs。这些是演示素材，设备检查也使用模拟值。

打开两个标签：

- **Investigation**：http://localhost:5173/
- **Learning Database**：http://localhost:5173/knowledge

## 2. 演示前准备：一个历史案例 A

目标：准备一个有完整检查与处理证据、经验仍为 **Pending review** 的历史案例。现场创建的新案例叫 B；A/B 是本手册别名。

1. 从首页上传缺涂照片 → Analyze photo → Continue to context。
2. 按下面“统一输入表”填上下文，Additional observations 填 `DEMO-A: Historical nozzle inspection and recovery.`，点 Generate diagnosis，保存案例地址。
3. Start illustrative inspection → Next step 到最终步骤 → Obstruction found → 勾选观察确认 → Confirm observation。
4. Corrective action 选 **Approved nozzle cleaning** → 勾选 I confirm the corrective action is complete. → Record action complete。
5. 在 Post-action photo 上传 **normal.png** → Analyze photo，确认 Within reference range。
6. 展开 Demo shortcut → Use simulated passing check results → 勾选 I confirm these recovery observations. → Verify recovery。
7. 勾选 I confirm this case is ready to resolve. → Resolve case。
8. 打开 Learning Database，搜索 `DEMO-A`，选中 A。确认 Evidence 中能看到来源，经验为 Pending review。**先不要发布**。
9. 等经验准备完成，记录实际是 Gemini 在线整理还是模板降级；不能把模板模式讲成在线 Gemini。

### 统一输入表：A 与 B 使用相同条件

| 页面字段 | 填写 / 点击 |
|---|---|
| Upload machine log | synthetic-incomplete-coverage.log |
| Board shown in the photo | **103** |
| I confirm this log… | 勾选照片与 log 对应确认 |
| Which spray symptom was observed? | **Incomplete coverage** |
| Has measured flux weight been falling? | **Use log evidence**，应采用 Yes |
| What does fluid pressure show? | **Use log evidence**，应采用 Stable / no known change |
| Any material-condition or idle-purge concerns? | **Not recorded** |
| Was there a collision or recent setup change? | **Not recorded** |

**重复彩排：**优先复用同一个历史 A。上轮已发布时，在新一轮创建 B **之前**，对 A 点 Edit as new version，填写审核者、理由并勾选确认 → Save corrected draft，先停在草稿。每轮从首页创建新的 B，不要复用已经确认检查的 B 重新演检查。准备后确认 A 已退出有效发布状态；不需要清空数据库或不断新建相同历史经验。

## 3. 现场 Demo：按这六步操作

### ① Report：让观众看到 Computer Vision（0:00–0:45）

- 首页 Choose photo → 选 **incomplete-coverage.png** → **Analyze photo**。
- 看到 **Visual anomaly detected** 后，切换 **Original / AI heatmap**。
- 点 **Continue to context**。

**讲一句：**“系统先定位视觉异常，再结合机器记录和技师观察判断原因。”

**通过标准：**原图与热图区别清楚；没有把视觉异常直接写成已确认堵塞。

### ② Context → Diagnose：展示 AI 引导追问（0:45–1:45，目标 60 秒内）

- 上传配对 log，选 **103**，勾选匹配确认；log 会收起为摘要。
- 选择 **Incomplete coverage**，点 **Continue**。这时 Gemini 根据已知证据规划追问；正常选项不会每题重新等待 AI。
- 按屏幕当前问题填写统一输入表：重量和压力点 **Use log evidence**，材料与 setup 选 **Not recorded**，每题点 Continue。题目顺序以当前计划为准。
- 要展示真正的新信息追问，在重量题的 **Anything to add?** 输入：`It began immediately after changing flux material. Material stability has not been checked.`，再 Continue。若出现解释确认，阅读后选 **Choose my own answer** 并按模拟事实选 Not recorded，或在确有依据时采用 **Use this interpretation**。AI 的建议不会自动成为答案。
- 右侧 **Your observations** 可查看已确认答案与来源，Edit 可返回修改。
- 全部条件确认后，在 Additional observations 填 `DEMO-B: Current missing coverage on Board 103.`，点 **Generate diagnosis**，保存 B 地址。

**讲一句：**“AI 根据已有证据决定下一步要问什么；收到补充信息后会重新确认相关条件，最终答案由技师确认。”

**通过标准：**看到实际的 AI-guided questions 或明确的 Rule guidance；每轮最多两次规划请求，每次等待上限 4 秒。未知、冲突和 AI 解释不能自动变成事实。此时不应引用尚未发布的 A。

**彩排注意：**补充材料变化会进入 B 的 notes，但不必然修改结构化条件。为保持 A/B 的检索兼容，不能为了演示而盲目接受与 A 不同的条件。若真实确认了不同条件，应允许不匹配，而不是要求系统强行引用 A。

### ③ Chatbot：解释为什么、还缺什么（1:45–2:20）

- 点 **Open FlowPilot chat**。
- 输入：`Why should I inspect the nozzle next, and what evidence is still missing?`
- 点 **Ask FlowPilot**（发送箭头），展示回答中的依据；有证据引用时点开一条。
- 点 **Minimize chat**，回到主流程。

**讲一句：**“技师可以追问判断依据与缺失条件，AI 帮助解释，检查确认仍由人完成。”

**通过标准：**回答围绕当前案例，不虚构已经完成的检查；聊天不自动改变案例状态。记录实际在线或降级模式。

### ④ Inspect：展示 3D 指导与人工确认（2:20–3:10）

- 点 **Start illustrative inspection**。
- 点 **Next step** 展示两三个部件的高亮，做一次 Orbit 或 Zoom。
- 继续 Next step 到最终观察步骤。
- 选 **Obstruction found** → 勾选观察确认 → **Confirm observation**。
- 停在 Obstruction confirmed；现场不继续操作 B 的处理与复验表单。

**讲一句：**“AI 把建议落实到具体部件与检查步骤，最终发现需要技师确认。”

**通过标准：**文字与高亮同步；观察结果不能绕过人工确认；确认后仍未宣称修复成功。

### ⑤ Learning Database：展示技师审核与修正（3:10–4:20）

切换到已经准备好的 **历史案例 A**，不是刚确认检查的 B。

1. 展示 A 的关系图，点一个 Finding 或 Action 看来源，再选回 A。
2. 右侧点 **Evidence**，展示来源检查和处理记录，然后回 **Experience**。
3. 点 **Edit as new version**。
4. Reusable lesson 填：

   `In this case, nozzle cleaning was followed by successful recovery. In a similar case, inspect for obstruction and confirm the finding before choosing an action.`

5. 保留真实的 Inspection interpretation、Outcome interpretation、Check focus 和已选证据。
6. Reviewer name 填 **Technician Lee**。
7. Review / correction reason 填：`Reviewed source evidence; clarified that the next case still requires inspection.`
8. 勾选 **I reviewed the source evidence and confirm this change.** → **Save corrected draft**。
9. 重新核对审核字段、再次勾选确认 → **Confirm & publish**。记下显示的版本号 **vN**，不要固定讲 v1。

**讲一句：**“经验先经过技师审核；我们把适用范围写清楚，避免 AI 把历史原因直接套到新案例。”

**通过标准：**经验显示可供 AI 使用，发布反馈与计数刷新；Graph 中假设与检查事实可区分。一次点击发布不等于训练了模型参数。

### ⑥ 回到 B：证明 AI 用到了审核后的经验（4:20–5:00）

- 切回 B 的案例页，找到 **Past experience**，点 **Refresh past experience**。
- 展示 **A 的来源、vN、匹配条件、未知条件及经验建议**。
- 点来源链接，确认能回到 A 的对应知识版本。

**讲一句：**“这次显式刷新后，刚审核的经验进入了诊断上下文，并保留来源和版本。”

**通过标准：**刷新前不引用 A，发布并刷新后引用 A；B 已有的人工检查事实保留。不要要求规则分数必然变化，检查的是经验引用与分析依据。

**最后 1 分钟留作缓冲**：模型等待、页面切换或观众提问。等待超时可以打开预先保存的案例展示，但明确说是预先保存的结果，不将缓存或模板描述成刚刚在线生成。

## 4. 每轮只检查这六项

| 项目 | 通过 / 问题 |
|---|---|
| CV：上传、分析、Original / AI heatmap 清楚 | |
| Context：AI 规划／降级状态清楚、补充信息追问、log 确认和诊断生成正确 | |
| Chatbot：解释依据与未知条件，来源可查 | |
| Inspect：3D 高亮、步骤、人工确认正确 | |
| Database：来源可查，技师能修改、审核并发布 | |
| RAG：B 刷新前不引用 A，发布刷新后引用 A 的正确版本 | |

整轮耗时：____ 分 ____ 秒。最卡的一步：____。

问题记录格式：**步骤编号＋案例地址＋我的操作＋实际结果＋截图／改进建议**。

本轮不扩展到争议、归档、失败复验、校准失败、旧原型或全面异常测试；现场只讲这条闭环。若第⑥步找不到 A，先核对 A 已发布、A 早于 B、两者输入条件一致；检索最多返回三条，重复历史经验或已有匹配也可能影响结果，应在彩排时提前解决。
