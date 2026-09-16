from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="FLOWPILOT_", env_file=ROOT / ".env", extra="ignore"
    )
    database_url: str = "sqlite:///./flowpilot.db"


def fixture_path(name: str) -> Path:
    return ROOT / "fixtures" / name
