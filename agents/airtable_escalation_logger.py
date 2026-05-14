#!/usr/bin/env python3
"""
Airtable Escalation Logger — Registra escalamientos de modelos en Airtable
"""

import requests
import json
import time
from datetime import datetime
from typing import Optional, Dict

class AirtableEscalationLogger:
    """Logger que registra escalamientos automáticos en Airtable"""

    # Credenciales desde CLAUDE.md
    TOKEN = "[REDACTED_AIRTABLE_PAT]"
    BASE_ID = "[REDACTED_AIRTABLE_BASE_ID]"
    BASE_URL = "https://api.airtable.com/v0/[REDACTED_AIRTABLE_BASE_ID]"

    # Tabla de métricas (creada manualmente en Airtable)
    METRICS_TABLE_ID = "[REDACTED_AIRTABLE_TABLE_ID]"

    HEADERS = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    }

    @classmethod
    def log_escalation(
        cls,
        task_id: str,
        agent_name: str,
        task_type: str,
        initial_model: str,
        final_model: str,
        escalation_reason: str,
        input_tokens: int,
        output_tokens: int,
        cost_usd: float,
        confidence_score: Optional[float] = None,
        execution_time_ms: Optional[int] = None
    ) -> bool:
        """
        Registra un escalamiento en Airtable

        Args:
            task_id: ID único de la tarea
            agent_name: Nombre del agente
            task_type: Tipo de tarea (code_development, market_research, etc)
            initial_model: Modelo inicial (haiku/sonnet/opus)
            final_model: Modelo final después de escalamiento
            escalation_reason: Razón del escalamiento
            input_tokens: Tokens de entrada usados
            output_tokens: Tokens de salida usados
            cost_usd: Costo en USD
            confidence_score: Puntuación de confianza (0-10)
            execution_time_ms: Tiempo de ejecución en ms

        Returns:
            True si se registró exitosamente, False si falló
        """

        escalated = initial_model != final_model

        record = {
            "fields": {
                "task_id": task_id,
                "agent_name": agent_name,
                "task_type": task_type,
                "initial_model": initial_model,
                "final_model": final_model,
                "escalated": escalated,
                "escalation_reason": escalation_reason,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cost_usd": round(cost_usd, 4),
                "timestamp": datetime.utcnow().strftime("%Y-%m-%d"),
            }
        }

        # Campos opcionales
        if confidence_score is not None:
            record["fields"]["confidence_score"] = round(confidence_score, 1)

        if execution_time_ms is not None:
            record["fields"]["execution_time_ms"] = execution_time_ms

        try:
            url = f"{cls.BASE_URL}/{cls.METRICS_TABLE_ID}"
            response = requests.post(
                url,
                headers=cls.HEADERS,
                json=record,
                timeout=10
            )

            if response.status_code == 200:
                print(f"✅ Escalamiento registrado: {task_id} ({initial_model} → {final_model})")
                return True
            else:
                print(f"⚠️  Error al registrar en Airtable: {response.status_code}")
                print(f"   Respuesta: {response.text}")
                return False

        except Exception as e:
            print(f"❌ Error al conectar con Airtable: {str(e)}")
            return False

    @classmethod
    def create_table_schema(cls) -> Dict:
        """
        Retorna el esquema de la tabla que necesita ser creada en Airtable manualmente

        Campo | Tipo | Descripción
        """
        return {
            "name": "Model Router Metrics",
            "fields": [
                {
                    "name": "task_id",
                    "type": "singleLineText",
                    "description": "ID único de la tarea"
                },
                {
                    "name": "agent_name",
                    "type": "singleLineText",
                    "description": "Nombre del agente (scout, tracy, etc)"
                },
                {
                    "name": "task_type",
                    "type": "singleLineText",
                    "description": "Tipo de tarea"
                },
                {
                    "name": "initial_model",
                    "type": "singleSelect",
                    "options": ["haiku", "sonnet", "opus"]
                },
                {
                    "name": "final_model",
                    "type": "singleSelect",
                    "options": ["haiku", "sonnet", "opus"]
                },
                {
                    "name": "escalated",
                    "type": "checkbox",
                    "description": "¿Se escaló automáticamente?"
                },
                {
                    "name": "escalation_reason",
                    "type": "singleLineText",
                    "description": "Por qué se escaló (si aplica)"
                },
                {
                    "name": "input_tokens",
                    "type": "number"
                },
                {
                    "name": "output_tokens",
                    "type": "number"
                },
                {
                    "name": "cost_usd",
                    "type": "number",
                    "precision": 4
                },
                {
                    "name": "confidence_score",
                    "type": "number",
                    "precision": 1,
                    "description": "Puntuación 0-10"
                },
                {
                    "name": "execution_time_ms",
                    "type": "number",
                    "description": "Tiempo de ejecución en milisegundos"
                },
                {
                    "name": "timestamp",
                    "type": "date",
                    "description": "Fecha y hora UTC del registro"
                }
            ]
        }


# Test
if __name__ == "__main__":
    # Prueba de registro
    success = AirtableEscalationLogger.log_escalation(
        task_id="test_001",
        agent_name="scout",
        task_type="market_research",
        initial_model="sonnet",
        final_model="opus",
        escalation_reason="tokens_estimated > 8000",
        input_tokens=8500,
        output_tokens=3200,
        cost_usd=0.30,
        confidence_score=8.5,
        execution_time_ms=4532
    )

    print(f"\nRegistro exitoso: {success}")

    # Mostrar esquema de tabla
    print("\nEsquema de tabla necesario:")
    schema = AirtableEscalationLogger.create_table_schema()
    print(json.dumps(schema, indent=2, ensure_ascii=False))
