from pathlib import Path

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="FLOWPILOT_", env_file=ROOT / ".env", extra="ignore", populate_by_name=True
    )
    database_url: str = "sqlite:///./flowpilot.db"
    gemini_api_key: SecretStr | None = Field(
        default=None, validation_alias=AliasChoices("GEMINI_API_KEY", "FLOWPILOT_GEMINI_API_KEY")
    )
    gemini_model: str = "gemini-3.5-flash-lite"
    reasoning_enabled: bool = True
    reasoning_timeout_seconds: float = Field(default=30, gt=0, le=30)


def fixture_path(name: str) -> Path:
    return ROOT / "fixtures" / name
