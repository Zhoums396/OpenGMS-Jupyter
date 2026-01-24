"""
Skills 系统测试脚本
验证技能注册、路由和执行
"""

import asyncio
import sys
sys.path.insert(0, '/Users/zms/Documents/Projects/OpenGMS-Jupyter/agent-service')

from agent_service.skills import (
    # Base
    Skill,
    SkillResult,
    SkillContext,
    SkillStatus,
    
    # Registry
    SkillRegistry,
    get_skill_registry,
    register_all_skills,
    
    # Router
    SkillRouter,
    create_router,
    
    # Skills
    InsertCodeSkill,
    DiagnoseErrorSkill,
    SearchModelsSkill,
    ReadDataSkill
)


def test_skill_registry():
    """测试技能注册表"""
    print("\n" + "="*50)
    print("测试 1: 技能注册表")
    print("="*50)
    
    # 注册所有技能
    registry = register_all_skills()
    
    print(f"✓ 注册了 {len(registry.list_names())} 个技能")
    print(f"  技能列表: {registry.list_names()}")
    print(f"  类别: {registry.list_categories()}")
    
    # 按类别获取
    notebook_skills = registry.get_by_category("notebook")
    print(f"  Notebook 技能: {[s.name for s in notebook_skills]}")
    
    return True


def test_skill_params():
    """测试技能参数"""
    print("\n" + "="*50)
    print("测试 2: 技能参数规格")
    print("="*50)
    
    skill = InsertCodeSkill()
    
    print(f"技能: {skill.name}")
    print(f"描述: {skill.description}")
    print(f"类别: {skill.category}")
    print(f"需要前端: {skill.requires_frontend}")
    
    print("\n参数规格:")
    for param in skill.get_param_specs():
        print(f"  - {param.name} ({param.param_type.value}): {param.description}")
        print(f"    必需: {param.required}, 默认: {param.default}")
    
    # 测试参数验证
    valid, errors = skill.validate_params(code="print('hello')")
    print(f"\n参数验证 (有 code): valid={valid}, errors={errors}")
    
    valid, errors = skill.validate_params()  # 缺少必需参数
    print(f"参数验证 (无 code): valid={valid}, errors={errors}")
    
    return True


async def test_skill_execution():
    """测试技能执行"""
    print("\n" + "="*50)
    print("测试 3: 技能执行")
    print("="*50)
    
    # 创建上下文
    context = SkillContext(
        user_id="test_user",
        notebook_active=True,
        notebook_name="test.ipynb",
        working_directory="/tmp"
    )
    
    # 测试 InsertCodeSkill
    skill = InsertCodeSkill()
    result = await skill.execute(
        context,
        code="import pandas as pd\ndf = pd.DataFrame()",
        position="below"
    )
    
    print(f"\nInsertCodeSkill 执行结果:")
    print(f"  状态: {result.status.value}")
    print(f"  消息: {result.message}")
    print(f"  前端动作: {result.frontend_action}")
    print(f"  执行时间: {result.execution_time_ms}ms")
    
    # 测试 DiagnoseErrorSkill
    context.last_error = "ModuleNotFoundError: No module named 'geopandas'"
    skill = DiagnoseErrorSkill()
    result = await skill.execute(context)
    
    print(f"\nDiagnoseErrorSkill 执行结果:")
    print(f"  状态: {result.status.value}")
    print(f"  诊断: {result.error_diagnosis}")
    print(f"  修复建议: {result.suggested_fixes}")
    
    # 测试 SearchModelsSkill
    skill = SearchModelsSkill()
    result = await skill.execute(context, keyword="flood")
    
    print(f"\nSearchModelsSkill 执行结果:")
    print(f"  状态: {result.status.value}")
    print(f"  消息: {result.message}")
    print(f"  输出: {result.output}")
    
    return True


async def test_skill_router():
    """测试技能路由器"""
    print("\n" + "="*50)
    print("测试 4: 技能路由器")
    print("="*50)
    
    # 先注册技能
    register_all_skills()
    
    router = create_router()
    context = SkillContext(
        notebook_active=True,
        last_error=None
    )
    
    # 测试关键词路由
    test_inputs = [
        "帮我搜索一下洪水相关的模型",
        "插入一段读取 shapefile 的代码",
        "我的代码报错了",
        "运行这个模型",
    ]
    
    for user_input in test_inputs:
        decision = router.route(user_input, context)
        print(f"\n输入: '{user_input}'")
        print(f"  策略: {decision.strategy_used.value}")
        print(f"  选中技能: {decision.selected_skills}")
        print(f"  置信度: {decision.confidence}")
        print(f"  理由: {decision.reasoning}")
    
    return True


def test_tool_description():
    """测试工具描述生成"""
    print("\n" + "="*50)
    print("测试 5: 工具描述生成")
    print("="*50)
    
    registry = register_all_skills()
    
    # 生成工具描述
    desc = registry.get_tools_description(category="notebook")
    print("\nNotebook 技能描述:")
    print(desc)
    
    return True


async def test_preconditions():
    """测试前置条件检查"""
    print("\n" + "="*50)
    print("测试 6: 前置条件检查")
    print("="*50)
    
    skill = InsertCodeSkill()
    
    # 没有 Notebook 的上下文
    context = SkillContext(
        notebook_active=False
    )
    
    result = await skill.execute(context, code="print('test')")
    
    print(f"无 Notebook 环境执行结果:")
    print(f"  状态: {result.status.value}")
    print(f"  错误: {result.error}")
    
    # 有 Notebook 的上下文
    context.notebook_active = True
    result = await skill.execute(context, code="print('test')")
    
    print(f"\n有 Notebook 环境执行结果:")
    print(f"  状态: {result.status.value}")
    
    return True


async def main():
    """运行所有测试"""
    print("="*60)
    print("       OpenGeoLab AI Agent - Skills 系统测试")
    print("="*60)
    
    tests = [
        ("技能注册表", test_skill_registry),
        ("技能参数规格", test_skill_params),
        ("技能执行", test_skill_execution),
        ("技能路由器", test_skill_router),
        ("工具描述生成", test_tool_description),
        ("前置条件检查", test_preconditions),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            if asyncio.iscoroutinefunction(test_func):
                result = await test_func()
            else:
                result = test_func()
            results.append((name, "PASS" if result else "FAIL"))
        except Exception as e:
            print(f"\n❌ 测试 '{name}' 出错: {e}")
            import traceback
            traceback.print_exc()
            results.append((name, "ERROR"))
    
    # 打印总结
    print("\n" + "="*60)
    print("                    测试总结")
    print("="*60)
    for name, status in results:
        icon = "✅" if status == "PASS" else "❌"
        print(f"  {icon} {name}: {status}")
    
    passed = sum(1 for _, s in results if s == "PASS")
    total = len(results)
    print(f"\n  总计: {passed}/{total} 通过")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())
