"""
Loops 模块
双循环机制：感知-对齐循环、推理-执行循环
"""

from .perception_alignment import (
    PerceptionAlignmentLoop,
    AlignmentResult,
    AlignmentAction
)

from .reasoning_actuation import (
    ReasoningActuationLoop,
    GroundingResult,
    GroundingStatus,
    ResourceMatch,
    ConstraintViolation,
    ExecutionResult,
    ExecutionStatus
)

__all__ = [
    # Perception-Alignment Loop
    "PerceptionAlignmentLoop",
    "AlignmentResult",
    "AlignmentAction",
    
    # Reasoning-Actuation Loop
    "ReasoningActuationLoop",
    "GroundingResult",
    "GroundingStatus",
    "ResourceMatch",
    "ConstraintViolation",
    "ExecutionResult",
    "ExecutionStatus"
]
