from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, BaseModel, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[4]


Permission = Literal[
    "view", "edit", "authorize_test", "send_email", "close", "publish_knowledge", "manage_data"
]


class IncidentPrincipal(BaseModel):
    subject: str = Field(min_length=1, max_length=100, pattern=r".*\S.*")
    token_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    permissions: list[Permission]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="FLOWPILOT_", env_file=ROOT / ".env", extra="ignore", populate_by_name=True
    )
    database_url: str = "sqlite:///./flowpilot.db"
    vision_storage_dir: Path = ROOT / ".cache/vision/assessments"
    vision_model_dir: Path = ROOT / ".cache/vision/model"
    gemini_api_key: SecretStr | None = Field(
        default=None, validation_alias=AliasChoices("GEMINI_API_KEY", "FLOWPILOT_GEMINI_API_KEY")
    )
    gemini_model: str = "gemini-3.5-flash-lite"
    reasoning_enabled: bool = True
    elevenlabs_api_key: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("ELEVENLABS_API_KEY", "FLOWPILOT_ELEVENLABS_API_KEY"),
    )
    incident_voice_enabled: bool = False
    reasoning_timeout_seconds: float = Field(default=12, gt=0, le=30)
    incident_interpretation_thinking: Literal["low", "medium", "high"] = "low"
    incident_generation_thinking: Literal["low", "medium", "high"] = "medium"
    incident_auth_mode: Literal["demo", "configured"] = "demo"
    incident_auto_process: bool = False
    incident_gateway_root: Path | None = None
    incident_gateway_pre_seconds: int = Field(default=300, ge=0, le=86400)
    incident_gateway_post_seconds: int = Field(default=60, ge=0, le=86400)
    incident_principals: list[IncidentPrincipal] = Field(default_factory=list)
    incident_artifact_limit_bytes: int = Field(default=20 * 1024 * 1024, ge=1, le=100 * 1024 * 1024)
    incident_retention_days: int = Field(default=90, ge=1, le=3650)
    incident_external_data_policy: Literal["synthetic_only", "permitted", "disabled"] = (
        "synthetic_only"
    )
    incident_jev_enabled: bool = False
    jev_gateway: Literal["typesafe", "openrouter"] = "typesafe"
    jev_api_key: SecretStr | None = None
    openrouter_api_key: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("OPENROUTER_API_KEY", "FLOWPILOT_OPENROUTER_API_KEY"),
    )
    jev_model: str = "jev-latest"
    jev_timeout_seconds: float = Field(default=3, gt=0, le=30)
    jev_min_probability: float = Field(default=0.75, ge=0, le=1)
    jev_answer_min_probability: float = Field(default=0.9, ge=0, le=1)
    incident_email_recipients: list[str] = Field(default_factory=list)
    incident_smtp_host: str | None = None
    incident_smtp_port: int = Field(default=587, ge=1, le=65535)
    incident_smtp_username: str | None = None
    incident_smtp_password: SecretStr | None = None
    incident_smtp_from: str | None = None
    incident_smtp_starttls: bool = True

    @property
    def jev_key(self) -> SecretStr | None:
        return self.openrouter_api_key if self.jev_gateway == "openrouter" else self.jev_api_key


def fixture_path(name: str) -> Path:
    return ROOT / "fixtures" / name
