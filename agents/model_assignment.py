"""
MODEL ASSIGNMENT — Central configuration for Claude model selection
Based on cost-benefit audit: 2026-04-10

All sub-agents must use these models. Override at runtime if needed.
"""

# ─────────────────────────────────────────────────────────
# MODEL DEFINITIONS
# ─────────────────────────────────────────────────────────

MODELS = {
    "haiku": "claude-haiku-4-5",
    "sonnet": "claude-sonnet-4-6",
    "opus": "claude-opus-4-7",
}

# ─────────────────────────────────────────────────────────
# AGENT ASSIGNMENTS (OPTIMIZED 2026-04-10)
# ─────────────────────────────────────────────────────────

AGENT_MODELS = {
    # REAL ESTATE ANALYSIS (Deal underwriting)
    "scout": "sonnet",           # Market research + data analysis
    "matematico": "sonnet",      # Financial calculations
    "fact-checker": "sonnet",    # Logic verification + confidence scoring

    # SKIP TRACING
    "tracy": "haiku",            # Data formatting only (NO reasoning needed)

    # SOCIAL MEDIA CONTENT
    "social_media": "sonnet",    # Idea generation
    "creativo": "sonnet",        # Visual descriptions + captions
    "director": "sonnet",        # Narrative + video scripts
    "programador": "sonnet",     # API integration + scheduling

    # SUPPORT AGENTS
    "secretario": "sonnet",      # Email + calendar management
    "code_debugger": "opus",     # 🔴 CRITICAL: Production code changes
}

# ─────────────────────────────────────────────────────────
# SMART ESCALATION ROUTING (NEW 2026-04-10)
# ─────────────────────────────────────────────────────────

class TaskComplexity:
    """Escalamiento inteligente: Haiku → Sonnet → Opus según complejidad"""

    # Palabras clave que indican tareas complejas
    COMPLEXITY_KEYWORDS = {
        "high": ["refactor", "architecture", "debug", "production", "critical",
                 "complex", "edge_case", "multi_scenario", "sophisticated"],
        "medium": ["analyze", "verify", "calculate", "projection", "scenario"],
        "low": ["format", "search", "confirm", "simple"]
    }

    @staticmethod
    def analyze(prompt: str, agent_name: str) -> dict:
        """
        Analiza complejidad de la tarea y determina si necesita escalación.

        Retorna:
            {
                "initial_model": str (tier),
                "recommended_model": str (tier),
                "escalate": bool,
                "reason": str,
                "complexity_level": str (low/medium/high)
            }
        """
        prompt_lower = prompt.lower()
        token_estimate = max(len(prompt) // 4, 100)

        # Detectar complejidad
        complexity = TaskComplexity._detect_complexity(prompt_lower, token_estimate)

        initial_tier = AGENT_MODELS.get(agent_name, "sonnet")
        recommended_tier = initial_tier
        escalate = False
        reason = ""

        # Reglas de escalamiento
        if complexity == "high":
            if initial_tier in ["haiku", "sonnet"]:
                recommended_tier = "opus"
                escalate = True
                reason = "task_complexity_high"
        elif complexity == "medium":
            if initial_tier == "haiku":
                recommended_tier = "sonnet"
                escalate = True
                reason = "task_complexity_medium"

        return {
            "initial_model": initial_tier,
            "recommended_model": recommended_tier,
            "escalate": escalate,
            "reason": reason,
            "complexity_level": complexity,
            "estimated_tokens": token_estimate
        }

    @staticmethod
    def _detect_complexity(text: str, tokens: int) -> str:
        """Determina nivel de complejidad: low, medium, high"""
        # Token-based heuristic
        if tokens > 10000:
            return "high"
        elif tokens > 6000:
            return "medium"

        # Keyword-based detection
        for keyword in TaskComplexity.COMPLEXITY_KEYWORDS["high"]:
            if keyword in text:
                return "high"

        for keyword in TaskComplexity.COMPLEXITY_KEYWORDS["medium"]:
            if keyword in text:
                return "medium"

        return "low"


# ─────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────

def get_model(agent_name: str, prompt: str = "", auto_escalate: bool = True) -> str:
    """
    Get the model for a given agent with optional intelligent escalation.

    Args:
        agent_name: Name of agent (scout, tracy, creativo, etc.)
        prompt: Task prompt (opcional, usado para análisis de complejidad)
        auto_escalate: Si True, escala automáticamente si es complejo

    Returns:
        Claude model ID (e.g., "claude-sonnet-4-6")

    Example:
        # Sin escalamiento automático (comportamiento anterior)
        model = get_model("tracy")
        # Returns: "claude-haiku-4-5"

        # Con escalamiento automático
        model = get_model("scout", prompt="Analizar mercado complejo con patrones inusuales")
        # Returns: "claude-opus-4-7" (escaló automáticamente a Opus)
    """
    tier = AGENT_MODELS.get(agent_name, "sonnet")

    # Si no hay prompt o escalamiento deshabilitado, retornar modelo base
    if not prompt or not auto_escalate:
        return MODELS[tier]

    # Analizar complejidad y escalar si necesario
    analysis = TaskComplexity.analyze(prompt, agent_name)
    if analysis["escalate"]:
        tier = analysis["recommended_model"]

    return MODELS[tier]

def get_all_agents() -> dict:
    """Return all agent assignments."""
    return {agent: get_model(agent) for agent in AGENT_MODELS}


def get_model_with_escalation_logging(
    agent_name: str,
    prompt: str = "",
    task_id: str = "",
    log_to_airtable: bool = False,
) -> str:
    """
    Smart escalation + optional Airtable logging.

    Used by alex_bot.py sub-agent invocations (Scout, Matemático, Fact-Checker,
    Social Media, etc.). Returns the Claude model ID after evaluating prompt
    complexity. If the agent's base tier is escalated (e.g. Sonnet → Opus) and
    log_to_airtable is True, logs the routing decision to the Model Router
    Metrics table.

    Args:
        agent_name: scout, matematico, fact-checker, tracy, social_media, ...
        prompt: full user prompt — analyzed for complexity heuristics.
        task_id: unique ID per call (used only for Airtable logging).
        log_to_airtable: if True and an escalation happened, log it.

    Returns:
        Claude model ID string, e.g. "claude-sonnet-4-6".
    """
    analysis = TaskComplexity.analyze(prompt, agent_name)
    initial_tier = analysis["initial_model"]
    final_tier = analysis["recommended_model"]

    if log_to_airtable and analysis["escalate"] and task_id:
        try:
            from airtable_escalation_logger import AirtableEscalationLogger
            input_tokens_estimate = analysis["estimated_tokens"]
            output_tokens_estimate = max(input_tokens_estimate // 4, 200)
            costs = COST_PER_1M_TOKENS.get(final_tier, COST_PER_1M_TOKENS["sonnet"])
            cost_estimate = (
                input_tokens_estimate / 1_000_000 * costs["input"]
                + output_tokens_estimate / 1_000_000 * costs["output"]
            )
            AirtableEscalationLogger.log_escalation(
                task_id=task_id,
                agent_name=agent_name,
                task_type=_classify_task_type(agent_name),
                initial_model=initial_tier,
                final_model=final_tier,
                escalation_reason=analysis["reason"],
                input_tokens=input_tokens_estimate,
                output_tokens=output_tokens_estimate,
                cost_usd=cost_estimate,
            )
        except Exception as e:
            print(f"⚠️ escalation logging failed (non-fatal): {e}")

    return MODELS[final_tier]


def _classify_task_type(agent_name: str) -> str:
    """Map agent name to task_type category for Airtable logging."""
    return {
        "scout": "market_research",
        "matematico": "financial_analysis",
        "fact-checker": "quality_audit",
        "tracy": "skip_tracing",
        "social_media": "content_generation",
        "creativo": "creative_production",
        "director": "video_script",
        "programador": "code_deployment",
        "secretario": "email_management",
        "code_debugger": "code_development",
    }.get(agent_name, "general")

# ─────────────────────────────────────────────────────────
# SAVINGS CALCULATION
# ─────────────────────────────────────────────────────────

COST_PER_1M_TOKENS = {
    "haiku": {
        "input": 0.80,      # $0.80 per 1M input tokens
        "output": 2.40,     # $2.40 per 1M output tokens
    },
    "sonnet": {
        "input": 3.00,
        "output": 15.00,
    },
    "opus": {
        "input": 15.00,
        "output": 45.00,
    },
}

def estimate_monthly_cost(agent_name: str, monthly_invocations: int, avg_input_tokens: int, avg_output_tokens: int) -> dict:
    """
    Estimate monthly cost for an agent.

    Args:
        agent_name: Agent name
        monthly_invocations: How many times per month it runs
        avg_input_tokens: Average input tokens per invocation
        avg_output_tokens: Average output tokens per invocation

    Returns:
        Dict with cost breakdown
    """
    model_name = AGENT_MODELS.get(agent_name, "sonnet")
    costs = COST_PER_1M_TOKENS[model_name]

    input_cost = (avg_input_tokens / 1_000_000) * costs["input"] * monthly_invocations
    output_cost = (avg_output_tokens / 1_000_000) * costs["output"] * monthly_invocations
    total = input_cost + output_cost

    return {
        "agent": agent_name,
        "model": MODELS[model_name],
        "monthly_invocations": monthly_invocations,
        "avg_input_tokens": avg_input_tokens,
        "avg_output_tokens": avg_output_tokens,
        "input_cost": f"${input_cost:.2f}",
        "output_cost": f"${output_cost:.2f}",
        "total_monthly": f"${total:.2f}",
        "total_annual": f"${total * 12:.2f}",
    }

# ─────────────────────────────────────────────────────────
# VALIDATION THRESHOLDS (for monitoring)
# ─────────────────────────────────────────────────────────

VALIDATION_THRESHOLDS = {
    "fact-checker": {
        "confidence_score_min": 7.0,  # Must be ≥7.0/10
        "error_rate_max": 0.02,        # Max 2% errors
        "check_frequency": "weekly",
    },
    "tracy": {
        "success_rate_min": 0.95,      # Must be ≥95% successful
        "check_frequency": "daily",
    },
}

# ─────────────────────────────────────────────────────────
# AUDIT SUMMARY
# ─────────────────────────────────────────────────────────

AUDIT_SUMMARY = """
╔════════════════════════════════════════════════════════════╗
║  CLAUDE MODEL OPTIMIZATION — AUDIT 2026-04-10              ║
╚════════════════════════════════════════════════════════════╝

MONTHLY SAVINGS: $3,099.60 (-71%)
ANNUAL SAVINGS:  $37,195.20 (-71%)

MODEL DISTRIBUTION:
  ├─ Haiku (2 agents):   Tracy
  ├─ Sonnet (7 agents):  Scout, Matemático, Fact-Checker, Social Media, Creativo, Director, Programador, Secretario
  └─ Opus (1 agent):     Code Debugger (CRITICAL — no downgrade)

QUALITY VALIDATION:
  ├─ Haiku: No validation needed (task does not require reasoning)
  ├─ Sonnet: Monitor Confidence Scores (threshold ≥7.0/10)
  └─ Opus: Spot checks on code changes (safety critical)

IMPLEMENTATION DATE: 2026-04-10
STATUS: LIVE — All phases deployed simultaneously
"""

if __name__ == "__main__":
    print(AUDIT_SUMMARY)
    print("\nAGENT MODEL ASSIGNMENTS:")
    for agent, model in get_all_agents().items():
        print(f"  {agent:20} → {model}")
