"""
三维上下文融合框架测试脚本
测试 Tri-Space Context Fusion 的各个组件
"""

import asyncio
from datetime import datetime

# 导入三维建模模块
from agent_service.modeling import (
    create_default_platform_model,
    create_default_agent_model,
    UserModel,
    StaticProfile,
    ExpertiseLevel,
    UserVibe,
    IntentType,
    DataNode,
    DataType,
    ContextFusionEngine
)

# 导入双循环模块
from agent_service.loops import (
    PerceptionAlignmentLoop,
    ReasoningActuationLoop,
    AlignmentAction
)

# 导入增强版 Prompt 构建器
from agent_service.prompts_enhanced import (
    EnhancedPromptBuilder,
    build_enhanced_system_prompt
)


def test_user_modeling():
    """测试用户建模"""
    print("\n" + "="*60)
    print("🧪 测试用户建模 (User Modeling)")
    print("="*60)
    
    # 创建用户模型
    profile = StaticProfile(
        user_id="test_user",
        user_name="测试用户",
        expertise_level=ExpertiseLevel.INTERMEDIATE,
        domain_knowledge=["GIS", "遥感"]
    )
    user = UserModel(profile=profile)
    
    # 测试不同消息的 Vibe 识别
    test_messages = [
        ("帮我调用滑坡模型", UserVibe.PRODUCTION),
        ("有哪些模型可以用？", UserVibe.EXPLORATORY),
        ("代码报错了，FileNotFoundError", UserVibe.DEBUGGING),
        ("什么是缓冲区分析？", UserVibe.LEARNING),
        ("看看数据", UserVibe.UNCERTAIN),
    ]
    
    from agent_service.modeling.user_model import analyze_message_vibe
    
    print("\n消息 Vibe 识别测试:")
    for msg, expected_vibe in test_messages:
        vibe, confidence, intent = analyze_message_vibe(msg)
        status = "✅" if vibe == expected_vibe else "❌"
        print(f"  {status} \"{msg}\"")
        print(f"      → Vibe: {vibe.value} (期望: {expected_vibe.value}), 置信度: {confidence:.0%}")
    
    print("\n用户上下文输出:")
    print(user.to_context_string())


def test_platform_modeling():
    """测试平台建模"""
    print("\n" + "="*60)
    print("🧪 测试平台建模 (Platform Modeling)")
    print("="*60)
    
    platform = create_default_platform_model()
    
    # 添加测试数据
    test_files = [
        DataNode(id="dem.tif", name="dem.tif", path="./dem.tif", 
                 data_type=DataType.RASTER, size_bytes=1024*1024*50),
        DataNode(id="landuse.shp", name="landuse.shp", path="./landuse.shp",
                 data_type=DataType.VECTOR, size_bytes=1024*1024*10),
        DataNode(id="points.csv", name="points.csv", path="./points.csv",
                 data_type=DataType.TABLE, size_bytes=1024*100),
    ]
    
    for node in test_files:
        platform.add_data_node(node)
    
    print("\n注册的服务:")
    for name, service in platform.services.items():
        print(f"  - {name}: {service.description}")
    
    print("\n数据拓扑:")
    for id, node in platform.data_topology.items():
        print(f"  - {node.name} ({node.data_type.value})")
    
    print("\n平台上下文输出:")
    print(platform.to_context_string())


def test_perception_alignment_loop():
    """测试感知-对齐循环"""
    print("\n" + "="*60)
    print("🧪 测试感知-对齐循环 (Perception-Alignment Loop)")
    print("="*60)
    
    # 创建模型
    profile = StaticProfile(user_id="test", user_name="Test", 
                           expertise_level=ExpertiseLevel.INTERMEDIATE)
    user = UserModel(profile=profile)
    agent = create_default_agent_model()
    
    # 创建循环
    pa_loop = PerceptionAlignmentLoop(user, agent)
    
    # 测试不同消息
    test_messages = [
        "帮我调用滑坡灾害提取模型",
        "有什么模型推荐吗？",
        "报错了：FileNotFoundError: dem.tif not found",
        "Buffer 分析怎么做？",
        "处理一下数据",
    ]
    
    print("\n对齐结果测试:")
    for msg in test_messages:
        result = pa_loop.run(msg)
        print(f"\n📝 \"{msg}\"")
        print(f"   Vibe: {result.detected_vibe.value}")
        print(f"   意图: {result.detected_intent.value}")
        print(f"   模糊度: {result.ambiguity_level:.0%}")
        print(f"   对齐动作: {result.action.value}")
        print(f"   响应风格: {result.response_style}")
        
        if result.clarification_questions:
            print(f"   需要澄清: {result.clarification_questions}")
        if result.suggestions:
            print(f"   建议: {result.suggestions}")


def test_reasoning_actuation_loop():
    """测试推理-执行循环"""
    print("\n" + "="*60)
    print("🧪 测试推理-执行循环 (Reasoning-Actuation Loop)")
    print("="*60)
    
    # 创建平台模型并添加数据
    platform = create_default_platform_model()
    
    test_files = [
        DataNode(id="firstYear.tif", name="FirstYearImage.tif", path="./FirstYearImage.tif",
                 data_type=DataType.RASTER, size_bytes=1024*1024*50),
        DataNode(id="secondYear.tif", name="SecondYearImage.tif", path="./SecondYearImage.tif",
                 data_type=DataType.RASTER, size_bytes=1024*1024*45),
        DataNode(id="vector.shp", name="boundary.shp", path="./boundary.shp",
                 data_type=DataType.VECTOR, size_bytes=1024*1024*5),
    ]
    for node in test_files:
        platform.add_data_node(node)
    
    agent = create_default_agent_model()
    
    # 创建循环
    ra_loop = ReasoningActuationLoop(platform, agent)
    
    # 测试资源落地
    required_params = {
        "input-firstYearImage": "第一年遥感影像",
        "input-secondYearImage": "第二年遥感影像",
        "input-boundary": "研究区边界",
    }
    
    grounding = ra_loop.ground_resources("ogms_model_invoke", required_params)
    
    print("\n资源落地结果:")
    print(f"   状态: {grounding.status.value}")
    print(f"   是否就绪: {grounding.is_ready}")
    
    print("\n   资源匹配:")
    for match in grounding.resource_matches:
        if match.matched_resource:
            print(f"   ✅ {match.param_name} → {match.matched_resource.path} "
                  f"({match.match_confidence:.0%}, {match.match_reason})")
        else:
            print(f"   ❌ {match.param_name} → 未找到")
    
    if grounding.missing_resources:
        print(f"\n   缺失资源: {grounding.missing_resources}")
    
    if grounding.violations:
        print("\n   约束违反:")
        for v in grounding.violations:
            print(f"   ⚠️ {v.description}")
    
    print("\n落地 Prompt 片段:")
    print(ra_loop.generate_grounding_prompt_section(grounding))


def test_context_fusion():
    """测试三维上下文融合"""
    print("\n" + "="*60)
    print("🧪 测试三维上下文融合 (Tri-Space Context Fusion)")
    print("="*60)
    
    # 创建所有模型
    platform = create_default_platform_model()
    
    # 添加测试数据
    test_files = [
        DataNode(id="dem.tif", name="dem.tif", path="./dem.tif",
                 data_type=DataType.RASTER, size_bytes=1024*1024*50),
        DataNode(id="landuse.shp", name="landuse.shp", path="./landuse.shp",
                 data_type=DataType.VECTOR, size_bytes=1024*1024*10),
    ]
    for node in test_files:
        platform.add_data_node(node)
    
    profile = StaticProfile(user_id="test", user_name="测试用户",
                           expertise_level=ExpertiseLevel.INTERMEDIATE,
                           domain_knowledge=["GIS", "遥感"])
    user = UserModel(profile=profile)
    agent = create_default_agent_model()
    
    # 创建融合引擎
    fusion_engine = ContextFusionEngine(platform, user, agent)
    
    # 测试融合
    test_message = "帮我用滑坡模型分析一下这些数据"
    fused = fusion_engine.fuse(test_message)
    
    print(f"\n测试消息: \"{test_message}\"")
    print(f"\n融合质量: {fused.fusion_quality:.0%}")
    print(f"\n平台摘要: {fused.platform_summary}")
    print(f"用户摘要: {fused.user_summary}")
    print(f"Agent摘要: {fused.agent_summary}")
    
    print(f"\n建议动作: {fused.suggested_actions}")
    print(f"警告: {fused.warnings}")
    
    print("\n" + "="*60)
    print("生成的 System Prompt 片段:")
    print("="*60)
    prompt = fusion_engine.generate_system_prompt("")
    # 只打印三维上下文部分
    if "三维上下文融合" in prompt:
        start = prompt.find("三维上下文融合")
        print(prompt[start-10:start+2000] + "...")


def test_enhanced_prompt_builder():
    """测试增强版 Prompt 构建器"""
    print("\n" + "="*60)
    print("🧪 测试增强版 Prompt 构建器")
    print("="*60)
    
    # 模拟 Notebook 上下文
    context = {
        "notebookName": "analysis.ipynb",
        "workingDirectory": "/home/user/project",
        "workspaceFiles": {
            "totalFiles": 3,
            "vector": [{"name": "boundary.shp", "path": "./boundary.shp", "size": 1024000}],
            "raster": [{"name": "dem.tif", "path": "./dem.tif", "size": 52428800}],
            "table": [{"name": "data.csv", "path": "./data.csv", "size": 10240}],
            "other": []
        }
    }
    
    # 创建构建器
    builder = EnhancedPromptBuilder()
    
    # 测试不同消息
    test_messages = [
        "帮我调用滑坡模型",
        "有什么模型推荐？",
        "报错了怎么办？",
    ]
    
    for msg in test_messages:
        print(f"\n{'='*40}")
        print(f"消息: \"{msg}\"")
        print('='*40)
        
        builder.initialize(context, user_name="TestUser")
        prompt = builder.build_prompt(context, msg, include_tri_space=True)
        
        # 打印 Prompt 长度和关键片段
        print(f"Prompt 长度: {len(prompt)} 字符")
        
        # 检查是否包含关键元素
        checks = [
            ("三维上下文融合", "三维上下文融合" in prompt),
            ("用户状态", "用户状态" in prompt),
            ("对齐动作", "对齐动作" in prompt),
            ("行动指令", "行动指令" in prompt),
        ]
        
        for name, present in checks:
            status = "✅" if present else "❌"
            print(f"  {status} 包含 {name}")


def main():
    """运行所有测试"""
    print("\n" + "🚀 " + "="*56 + " 🚀")
    print("   Tri-Space Context Fusion 框架测试")
    print("🚀 " + "="*56 + " 🚀")
    
    test_user_modeling()
    test_platform_modeling()
    test_perception_alignment_loop()
    test_reasoning_actuation_loop()
    test_context_fusion()
    test_enhanced_prompt_builder()
    
    print("\n" + "="*60)
    print("✅ 所有测试完成!")
    print("="*60)


if __name__ == "__main__":
    main()
