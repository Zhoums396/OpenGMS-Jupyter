# Tri-Space Context Fusion 架构实现说明

## 📋 目录

1. [架构概览](#架构概览)
2. [用户建模空间 (User Modeling)](#用户建模空间-user-modeling)
3. [平台建模空间 (Platform Modeling)](#平台建模空间-platform-modeling)
4. [Agent建模空间 (Agent Modeling)](#agent建模空间-agent-modeling)
5. [双循环协调机制](#双循环协调机制)
6. [上下文融合引擎](#上下文融合引擎)
7. [API接口说明](#api接口说明)

---

## 架构概览

本实现基于 **Tri-Space Context Fusion** 架构，将上下文建模划分为三个正交空间：

```
┌─────────────────────────────────────────────────────────────────┐
│                    Tri-Space Context Fusion                     │
├──────────────────┬──────────────────┬───────────────────────────┤
│  User Modeling   │ Platform Modeling │     Agent Modeling       │
│  (用户空间)       │  (平台空间)        │     (Agent空间)           │
├──────────────────┼──────────────────┼───────────────────────────┤
│ • Vibe/State     │ • Service        │ • Skill Tree              │
│ • Static Profile │   Affordances    │ • Planning Capability     │
│ • Interaction    │ • Data Topology  │ • Dynamic Attention       │
│   Trace          │ • Constraints    │                           │
│ • Intent Vector  │                  │                           │
└──────────────────┴──────────────────┴───────────────────────────┘
            ↓                                       ↓
    ┌───────────────────────────────────────────────────────┐
    │            Loop 1: Perception-Alignment               │
    │                   (User ↔ Agent)                      │
    ├───────────────────────────────────────────────────────┤
    │  perceive() → Vibe Sensing → align() → Response       │
    └───────────────────────────────────────────────────────┘
                              ↓
    ┌───────────────────────────────────────────────────────┐
    │           Loop 2: Reasoning-Actuation                 │
    │                  (Agent ↔ Platform)                   │
    ├───────────────────────────────────────────────────────┤
    │  ground() → Plan → solve() → execute() → Result       │
    └───────────────────────────────────────────────────────┘
```

### 核心理念

> **上下文并非静态的信息孤岛，而是由"用户意图"、"平台能力"和"Agent认知"三者在交互中动态生成的产物。**

### 文件结构

```
agent_service/
├── modeling/
│   ├── user_model.py      # 用户空间建模
│   ├── platform_model.py  # 平台空间建模
│   ├── agent_model.py     # Agent空间建模
│   └── context_fusion.py  # 三维上下文融合器
├── loops/
│   ├── perception_alignment.py  # Loop 1: 感知-对齐循环
│   └── reasoning_actuation.py   # Loop 2: 推理-执行循环
└── skills/
    └── implementations/         # 17个技能实现
```

---

## 用户建模空间 (User Modeling)

> **"The Flow of Intent" - 意图的流动**

用户空间捕捉用户与系统交互过程中的状态和意图。

### 核心组件

| 组件 | 代码类 | 作用 |
|------|--------|------|
| Vibe/State | `UserVibe` | 用户当前的心理/认知状态 |
| Static Profile | `StaticProfile` | 用户的静态偏好信息 |
| Interaction Trace | `UserModel.interaction_history` | 交互历史轨迹 |
| Intent Vector | `IntentVector` | 意图的向量化表示 |

### 1. Vibe 状态识别 (Vibe Sensing)

**文件**: `modeling/user_model.py`

Vibe 是我们对用户当前"状态"的感知，分为 5 种状态：

```python
class UserVibe(Enum):
    """用户的 Vibe 状态（情绪/意图倾向）"""
    EXPLORATORY = "exploratory"   # 探索性：用户在浏览、尝试
    DEBUGGING = "debugging"       # 调试中：用户遇到问题
    PRODUCTION = "production"     # 生产性：用户明确知道要做什么
    LEARNING = "learning"         # 学习中：用户想了解概念
    UNCERTAIN = "uncertain"       # 不确定：意图模糊
```

#### Vibe 推断算法 (`infer_vibe()`)

```python
def infer_vibe(self):
    """基于交互历史推断当前 Vibe"""
    
    # 规则1: 连续错误 → DEBUGGING
    if self.consecutive_errors >= 2:
        self.current_vibe = UserVibe.DEBUGGING
        self.vibe_confidence = 0.9
        return
    
    # 分析最近的消息类型
    recent = self.interaction_history[-5:]  # 最近5条
    
    queries = sum(1 for m in recent if m.get('type') == 'query')
    executes = sum(1 for m in recent if m.get('type') == 'execute')
    
    # 规则2: 大量查询 → EXPLORATORY
    if queries > executes * 2:
        self.current_vibe = UserVibe.EXPLORATORY
        self.vibe_confidence = 0.7
        return
    
    # 规则3: 大量执行 → PRODUCTION
    if executes > queries:
        self.current_vibe = UserVibe.PRODUCTION
        self.vibe_confidence = 0.7
        return
    
    # 规则4: 检查是否在学习
    learning_keywords = ['什么是', '如何', '为什么', 'how', 'what', 'why', '解释', '教']
    last_message = recent[-1].get('content', '') if recent else ''
    if any(kw in last_message.lower() for kw in learning_keywords):
        self.current_vibe = UserVibe.LEARNING
        self.vibe_confidence = 0.8
        return
```

**推断逻辑图**:

```
                    ┌────────────────┐
                    │  交互历史分析    │
                    └────────┬───────┘
                             ▼
           ┌─────────────────────────────────┐
           │    连续错误 >= 2 ?              │
           └────────┬───────────┬────────────┘
                    │ YES       │ NO
                    ▼           ▼
             ┌──────────┐  ┌───────────────────┐
             │ DEBUGGING │  │ 查询/执行比例分析 │
             └──────────┘  └─────────┬─────────┘
                                     ▼
                    ┌────────────────────────────┐
                    │  queries > executes * 2 ?  │
                    └────┬──────────────┬────────┘
                         │ YES          │ NO
                         ▼              ▼
                  ┌─────────────┐  ┌──────────────────┐
                  │ EXPLORATORY │  │ 学习关键词检测?   │
                  └─────────────┘  └───┬──────────┬───┘
                                       │ YES      │ NO
                                       ▼          ▼
                                 ┌──────────┐ ┌────────────┐
                                 │ LEARNING │ │ PRODUCTION │
                                 └──────────┘ └────────────┘
```

### 2. 消息级 Vibe 分析 (`analyze_message_vibe()`)

除了历史推断，我们还对每条消息进行即时分析：

```python
def analyze_message_vibe(message: str) -> Tuple[UserVibe, float, IntentType]:
    """分析单条消息的 Vibe"""
    message_lower = message.lower()
    
    # 调试模式检测
    debug_patterns = ['错误', '失败', '不工作', 'error', 'failed', '报错', '问题']
    if any(p in message_lower for p in debug_patterns):
        return UserVibe.DEBUGGING, 0.85, IntentType.DEBUG
    
    # 学习模式检测
    learning_patterns = ['什么是', '如何', '怎么', '为什么', 'how', 'what', 'why']
    if any(p in message_lower for p in learning_patterns):
        return UserVibe.LEARNING, 0.8, IntentType.EXPLORE
    
    # 探索模式检测
    explore_patterns = ['有什么', '能做什么', '介绍', '列出', '可以', '支持']
    if any(p in message_lower for p in explore_patterns):
        return UserVibe.EXPLORATORY, 0.75, IntentType.EXPLORE
    
    # 生产模式检测
    execute_patterns = ['运行', '执行', '处理', '分析', '计算', 'run', 'execute']
    if any(p in message_lower for p in execute_patterns):
        return UserVibe.PRODUCTION, 0.8, IntentType.EXECUTE
```

### 3. 意图向量 (Intent Vector)

```python
@dataclass
class IntentVector:
    """意图的向量化表示"""
    primary_intent: IntentType          # 主要意图类型
    target_object: Optional[str]        # 目标对象
    confidence: float                   # 置信度
    ambiguity_level: float = 0.0        # 模糊程度
    clarification_needed: List[str]     # 需要澄清的点
```

**IntentType 枚举**:

```python
class IntentType(Enum):
    EXPLORE = "explore"     # 探索/浏览
    EXECUTE = "execute"     # 执行任务
    DEBUG = "debug"         # 调试问题
    CONFIGURE = "configure" # 配置设置
    QUERY = "query"         # 查询信息
```

### 4. 用户持久化 (`UserModelManager`)

用户状态会持久化到 `data/users/{user_id}.json`:

```python
class UserModelManager:
    """管理多用户的 UserModel，支持持久化"""
    
    def __init__(self, storage_dir: str = "data/users"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self._cache: Dict[str, UserModel] = {}
    
    def get_user(self, user_id: str) -> UserModel:
        """获取用户模型（从缓存或磁盘）"""
        if user_id not in self._cache:
            user_file = self.storage_dir / f"{user_id}.json"
            if user_file.exists():
                self._cache[user_id] = UserModel.from_dict(...)
            else:
                self._cache[user_id] = UserModel(user_id=user_id)
        return self._cache[user_id]
    
    def save_user(self, user_id: str):
        """保存用户模型到磁盘"""
        user = self._cache.get(user_id)
        if user:
            user_file = self.storage_dir / f"{user_id}.json"
            with open(user_file, 'w') as f:
                json.dump(user.to_dict(), f, indent=2, ensure_ascii=False)
```

---

## 平台建模空间 (Platform Modeling)

> **"The Space of Possibility" - 可能性空间**

平台空间建模当前环境的能力边界和数据状态。

### 核心组件

| 组件 | 代码类 | 作用 |
|------|--------|------|
| Service Affordances | `ServiceAffordance` | 平台提供的服务能力 |
| Data Topology | `DataNode` | 数据资源的拓扑结构 |
| Constraints | `PlatformConstraint` | 平台约束条件 |

**文件**: `modeling/platform_model.py`

### 1. 服务能力 (Service Affordances)

```python
@dataclass
class ServiceAffordance:
    """服务能力"""
    service_id: str
    name: str
    description: str
    input_types: List[DataType]    # 接受的输入类型
    output_types: List[DataType]   # 产生的输出类型
    constraints: List[str]         # 约束条件
    availability: float = 1.0      # 可用性 (0-1)
```

### 2. 数据节点 (Data Topology)

```python
@dataclass
class DataNode:
    """数据节点"""
    node_id: str
    name: str
    data_type: DataType
    size_bytes: int
    coordinate_system: Optional[CoordinateSystem]
    metadata: Dict[str, Any]
    created_at: datetime
    last_accessed: Optional[datetime] = None
```

**支持的数据类型**:

```python
class DataType(Enum):
    VECTOR = "vector"       # 矢量数据
    RASTER = "raster"       # 栅格数据
    TABLE = "table"         # 表格数据
    JSON = "json"           # JSON数据
    MODEL = "model"         # 模型文件
    NOTEBOOK = "notebook"   # Notebook文件
    OTHER = "other"         # 其他类型
```

### 3. 平台约束 (Constraints)

```python
@dataclass
class PlatformConstraint:
    """平台约束"""
    constraint_id: str
    constraint_type: str      # 'crs', 'size', 'format', etc.
    description: str
    is_hard: bool             # 硬约束 vs 软约束
    check_function: str       # 检查函数名
```

约束检查示例：

```python
def find_constraint_violations(self, operation: str, data_nodes: List[DataNode]) -> List[str]:
    """检查操作是否违反约束"""
    violations = []
    
    # CRS 一致性检查
    crs_set = set()
    for node in data_nodes:
        if node.coordinate_system:
            crs_set.add(node.coordinate_system.epsg_code)
    
    if len(crs_set) > 1:
        violations.append(f"CRS不一致: {crs_set}")
    
    # 大小限制检查
    total_size = sum(node.size_bytes for node in data_nodes)
    if total_size > 1024 * 1024 * 1024:  # 1GB
        violations.append(f"数据总大小 {total_size/1024/1024:.1f}MB 超过限制")
    
    return violations
```

---

## Agent建模空间 (Agent Modeling)

> **"The Cognitive Bridge" - 认知的桥梁**

Agent空间建模代理的认知能力和注意力分配。

**文件**: `modeling/agent_model.py`

### 核心组件

| 组件 | 代码类 | 作用 |
|------|--------|------|
| Skill Tree | `Skill`, `SkillCategory` | 技能树结构 |
| Planning | `ExecutionPlan`, `PlanStep` | 任务规划能力 |
| Dynamic Attention | `AttentionFocus` | 动态注意力分配 |

### 1. 技能树 (Skill Tree)

```python
class SkillCategory(Enum):
    DATA = "data"           # 数据处理
    MODEL = "model"         # 模型操作
    NOTEBOOK = "notebook"   # Notebook操作
    SEARCH = "search"       # 搜索能力
    DIAGNOSTIC = "diagnostic"  # 诊断能力

@dataclass
class Skill:
    """单个技能"""
    skill_id: str
    name: str
    description: str
    category: SkillCategory
    required_inputs: List[str]
    produces_outputs: List[str]
    proficiency: float = 1.0   # 熟练度
    success_rate: float = 1.0  # 历史成功率
```

**已实现的 17 个技能**:

| 类别 | 技能 | 说明 |
|------|------|------|
| DATA | `list_workspace_data` | 列出工作区数据 |
| DATA | `preview_data` | 预览数据内容 |
| DATA | `analyze_data_schema` | 分析数据结构 |
| MODEL | `list_available_models` | 列出可用模型 |
| MODEL | `get_model_info` | 获取模型详情 |
| MODEL | `execute_model` | 执行模型 |
| MODEL | `check_model_status` | 检查模型状态 |
| MODEL | `get_model_results` | 获取模型结果 |
| NOTEBOOK | `create_notebook` | 创建Notebook |
| NOTEBOOK | `add_cell` | 添加单元格 |
| NOTEBOOK | `execute_cell` | 执行单元格 |
| NOTEBOOK | `save_notebook` | 保存Notebook |
| SEARCH | `search_models` | 搜索模型 |
| SEARCH | `search_data` | 搜索数据 |
| DIAGNOSTIC | `diagnose_error` | 诊断错误 |
| DIAGNOSTIC | `suggest_fix` | 建议修复方案 |
| DIAGNOSTIC | `explain_concept` | 解释概念 |

### 2. 执行计划 (Execution Plan)

```python
@dataclass
class PlanStep:
    """计划步骤"""
    step_id: str
    skill_id: str
    parameters: Dict[str, Any]
    expected_output: str
    status: str = "pending"
    result: Optional[Any] = None

@dataclass
class ExecutionPlan:
    """执行计划"""
    plan_id: str
    goal: str
    steps: List[PlanStep]
    status: str = "pending"
    created_at: datetime
```

### 3. 动态注意力 (Dynamic Attention)

这是 Agent 空间最核心的概念 —— Agent 根据上下文动态分配注意力：

```python
class AttentionFocus(Enum):
    """注意力焦点类型"""
    USER_INTENT = "user_intent"       # 用户意图
    USER_EMOTION = "user_emotion"     # 用户情绪
    PLATFORM_STATE = "platform_state" # 平台状态
    PLATFORM_ERROR = "platform_error" # 平台错误
    TASK_PROGRESS = "task_progress"   # 任务进度

@dataclass
class AgentCognitiveState:
    """Agent 的认知状态"""
    attention_distribution: Dict[AttentionFocus, float]  # 注意力分配
    current_plan: Optional[ExecutionPlan] = None
    working_memory: List[Dict[str, Any]] = field(default_factory=list)
```

#### 注意力更新算法

```python
def update_attention_for_context(self, user_vibe: str, has_error: bool, task_in_progress: bool):
    """基于上下文更新注意力分配"""
    attention = self.cognitive_state.attention_distribution
    
    # 基础注意力重置
    for focus in AttentionFocus:
        attention[focus] = 0.1
    
    # 根据用户 Vibe 调整
    if user_vibe == "debugging":
        attention[AttentionFocus.USER_EMOTION] = 0.3
        attention[AttentionFocus.PLATFORM_ERROR] = 0.4
    elif user_vibe == "exploratory":
        attention[AttentionFocus.USER_INTENT] = 0.5
        attention[AttentionFocus.PLATFORM_STATE] = 0.3
    elif user_vibe == "production":
        attention[AttentionFocus.TASK_PROGRESS] = 0.5
        attention[AttentionFocus.PLATFORM_STATE] = 0.3
    elif user_vibe == "learning":
        attention[AttentionFocus.USER_INTENT] = 0.6
        attention[AttentionFocus.USER_EMOTION] = 0.2
    
    # 错误时增加错误关注
    if has_error:
        attention[AttentionFocus.PLATFORM_ERROR] = max(0.4, attention[AttentionFocus.PLATFORM_ERROR])
    
    # 任务进行中增加进度关注
    if task_in_progress:
        attention[AttentionFocus.TASK_PROGRESS] = max(0.3, attention[AttentionFocus.TASK_PROGRESS])
    
    # 归一化
    total = sum(attention.values())
    for focus in attention:
        attention[focus] /= total
```

**注意力分配可视化**:

```
DEBUGGING 模式:
┌─────────────────────────────────────────────────────────┐
│ USER_EMOTION   ████████████████        30%              │
│ PLATFORM_ERROR ████████████████████████ 40%             │
│ USER_INTENT    ████                     10%              │
│ PLATFORM_STATE ████                     10%              │
│ TASK_PROGRESS  ████                     10%              │
└─────────────────────────────────────────────────────────┘

EXPLORATORY 模式:
┌─────────────────────────────────────────────────────────┐
│ USER_INTENT    █████████████████████████ 50%            │
│ PLATFORM_STATE ██████████████           30%              │
│ USER_EMOTION   ████                      10%              │
│ PLATFORM_ERROR ████                      5%               │
│ TASK_PROGRESS  ██                        5%               │
└─────────────────────────────────────────────────────────┘
```

---

## 双循环协调机制

### Loop 1: 感知-对齐循环 (Perception-Alignment)

> **User ↔ Agent 之间的桥梁**

**文件**: `loops/perception_alignment.py`

```
用户消息 → perceive() → Vibe识别 → align() → 响应策略
```

#### perceive() - 感知阶段

```python
def perceive(self, message: str) -> PerceptionResult:
    """
    感知用户消息
    输出: Vibe状态、意图、模糊程度
    """
    # 1. Vibe Sensing
    vibe, vibe_confidence, intent_type = analyze_message_vibe(message)
    
    # 2. 意图模糊度检测
    ambiguity, clarifications = detect_intent_ambiguity(message)
    
    # 3. 更新用户模型
    self.user.current_vibe = vibe
    self.user.vibe_confidence = vibe_confidence
    
    # 4. 结合历史推断
    self.user.infer_vibe()
    
    return PerceptionResult(
        detected_vibe=self.user.current_vibe,
        vibe_confidence=self.user.vibe_confidence,
        intent_type=intent_type,
        ambiguity_level=ambiguity,
        clarification_needed=clarifications
    )
```

#### align() - 对齐阶段

```python
def align(self, perception: PerceptionResult) -> AlignmentResult:
    """
    基于感知结果决定响应策略
    """
    action = AlignmentAction.PROCEED  # 默认继续
    strategy = []
    
    # 高模糊度 → 需要澄清
    if perception.ambiguity_level > 0.6:
        action = AlignmentAction.CLARIFY
        strategy = [f"请澄清: {c}" for c in perception.clarification_needed]
    
    # 调试模式 → 诊断优先
    elif perception.detected_vibe == UserVibe.DEBUGGING:
        action = AlignmentAction.EXPLAIN
        strategy = ["诊断问题原因", "提供解决方案", "解释错误信息"]
    
    # 学习模式 → 教学优先
    elif perception.detected_vibe == UserVibe.LEARNING:
        action = AlignmentAction.EXPLAIN
        strategy = ["提供概念解释", "给出示例", "推荐学习资源"]
    
    # 探索模式 → 建议优先
    elif perception.detected_vibe == UserVibe.EXPLORATORY:
        action = AlignmentAction.SUGGEST
        strategy = ["列出可用选项", "提供使用建议", "展示能力范围"]
    
    # 生产模式 → 确认后执行
    elif perception.detected_vibe == UserVibe.PRODUCTION:
        action = AlignmentAction.CONFIRM
        strategy = ["确认执行参数", "执行任务", "报告结果"]
    
    return AlignmentResult(
        action=action,
        response_strategy=strategy,
        attention_adjustment=self._suggest_attention_adjustment(perception)
    )
```

**AlignmentAction 枚举**:

```python
class AlignmentAction(Enum):
    PROCEED = "proceed"   # 继续执行
    CLARIFY = "clarify"   # 需要澄清
    SUGGEST = "suggest"   # 提供建议
    EXPLAIN = "explain"   # 进行解释
    CONFIRM = "confirm"   # 确认后执行
```

### Loop 2: 推理-执行循环 (Reasoning-Actuation)

> **Agent ↔ Platform 之间的桥梁**

**文件**: `loops/reasoning_actuation.py`

```
意图 → ground_resources() → solve_constraints() → execute() → 结果
```

#### ground_resources() - 资源接地

将抽象的参数绑定到具体的平台资源：

```python
def ground_resources(self, abstract_params: Dict[str, Any]) -> GroundingResult:
    """
    将抽象参数绑定到具体资源
    例: "输入数据" → "road_network.shp"
    """
    matches = {}
    unresolved = []
    
    for param_name, param_spec in abstract_params.items():
        match = self._find_best_match(param_name, param_spec)
        if match:
            matches[param_name] = match
        else:
            unresolved.append(param_name)
    
    return GroundingResult(
        status=GroundingStatus.FULL if not unresolved else GroundingStatus.PARTIAL,
        resource_matches=matches,
        unresolved_params=unresolved
    )

def _find_best_match(self, param_name: str, param_spec: Any) -> Optional[ResourceMatch]:
    """智能匹配资源"""
    # 从平台数据拓扑中搜索
    for node_id, node in self.platform.data_topology.items():
        score = 0.0
        
        # 名称相似度
        if param_name.lower() in node.name.lower():
            score += 0.5
        
        # 类型匹配
        if isinstance(param_spec, dict) and 'type' in param_spec:
            if node.data_type.value == param_spec['type']:
                score += 0.3
        
        if score > 0.5:
            return ResourceMatch(
                resource_id=node_id,
                resource_name=node.name,
                match_score=score
            )
    
    return None
```

#### solve_constraints() - 约束求解

```python
def solve_constraints(self, grounding: GroundingResult) -> ConstraintResult:
    """检查并尝试解决约束冲突"""
    
    # 收集涉及的数据节点
    involved_nodes = [
        self.platform.data_topology[m.resource_id]
        for m in grounding.resource_matches.values()
        if m.resource_id in self.platform.data_topology
    ]
    
    # 检查约束违反
    violations = self.platform.find_constraint_violations("operation", involved_nodes)
    
    if not violations:
        return ConstraintResult(satisfied=True)
    
    # 尝试自动解决
    resolutions = []
    for violation in violations:
        if "CRS" in violation:
            resolutions.append(f"建议: 统一坐标系统到 EPSG:4326")
        elif "大小" in violation:
            resolutions.append(f"建议: 分块处理或采样数据")
    
    return ConstraintResult(
        satisfied=False,
        violations=violations,
        suggested_resolutions=resolutions
    )
```

---

## 上下文融合引擎

**文件**: `modeling/context_fusion.py`

`ContextFusionEngine` 将三个空间的信息融合，生成 LLM 可用的上下文：

```python
class ContextFusionEngine:
    def __init__(self, platform: PlatformModel, user: UserModel, agent: AgentModel):
        self.platform = platform
        self.user = user
        self.agent = agent
    
    def fuse(self, current_message: Optional[str] = None) -> FusedContext:
        """执行三维上下文融合"""
        
        # 1. 更新用户状态
        if current_message:
            self._update_user_state(current_message)
        
        # 2. 更新 Agent 注意力
        self._update_agent_attention()
        
        # 3. 生成融合上下文
        fused = FusedContext(
            platform=self.platform,
            user=self.user,
            agent=self.agent
        )
        
        # 4. 生成摘要
        fused.platform_summary = self._generate_platform_summary()
        fused.user_summary = self._generate_user_summary()
        fused.agent_summary = self._generate_agent_summary()
        
        # 5. 生成建议
        fused.suggested_actions = self._generate_suggestions()
        
        return fused
```

### 动态 System Prompt 生成

```python
def generate_system_prompt(self, fused: FusedContext) -> str:
    """生成动态 System Prompt"""
    
    prompt = f"""你是地理建模平台的 AI 助手。

## 当前上下文

### 用户状态
{fused.user_summary}
- Vibe: {fused.user.current_vibe.value}
- 连续错误: {fused.user.consecutive_errors} 次

### 平台状态
{fused.platform_summary}

### 关注重点
{fused.agent_summary}

## 行动建议
{chr(10).join(f"- {s}" for s in fused.suggested_actions)}

## 响应指南
"""
    
    # 根据 Vibe 添加响应指南
    if fused.user.current_vibe == UserVibe.DEBUGGING:
        prompt += """
- 首先确认问题
- 提供清晰的诊断步骤
- 给出具体的解决方案
"""
    elif fused.user.current_vibe == UserVibe.LEARNING:
        prompt += """
- 用简单的语言解释概念
- 提供具体的示例
- 循序渐进地引导
"""
    
    return prompt
```

---

## API接口说明

### 用户状态 API

**获取用户建模状态**:

```bash
GET /api/user/{user_id}/modeling-status
```

**响应示例**:

```json
{
  "user_id": "test-user",
  "current_vibe": "exploratory",
  "vibe_confidence": 0.75,
  "current_intent": {
    "primary_intent": "explore",
    "confidence": 0.8,
    "ambiguity_level": 0.2
  },
  "interaction_count": 15,
  "consecutive_errors": 0,
  "static_profile": {
    "expertise_level": "intermediate",
    "preferred_language": "zh-CN"
  }
}
```

**记录用户交互**:

```bash
POST /api/user/{user_id}/interaction
Content-Type: application/json

{
  "type": "query",
  "content": "如何运行噪声模型？"
}
```

---

## 总结

本实现完整覆盖了 Tri-Space Context Fusion 架构的核心概念：

| 架构组件 | 实现状态 | 核心代码 |
|----------|----------|----------|
| User Modeling | ✅ | `modeling/user_model.py` |
| Platform Modeling | ✅ | `modeling/platform_model.py` |
| Agent Modeling | ✅ | `modeling/agent_model.py` |
| Vibe Sensing | ✅ | `UserModel.infer_vibe()` |
| Dynamic Attention | ✅ | `AgentModel.update_attention_for_context()` |
| Context Fusion | ✅ | `ContextFusionEngine.fuse()` |
| Perception-Alignment Loop | ✅ | `loops/perception_alignment.py` |
| Reasoning-Actuation Loop | ✅ | `loops/reasoning_actuation.py` |
| 用户持久化 | ✅ | `UserModelManager` |

---

*文档最后更新: 2025年1月*
