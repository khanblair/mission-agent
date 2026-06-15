from pathlib import Path

import yaml
from pydantic import Field
from pydantic_settings import BaseSettings

_ROOT = Path(__file__).parent.parent
_cfg: dict = yaml.safe_load((_ROOT / "config.yaml").read_text())


class Settings(BaseSettings):
    deepseek_api_key: str = Field(default="", alias="DEEPSEEK_API_KEY")

    gmat_path: str = _cfg["gmat"]["path"]
    gmat_binary: str = _cfg["gmat"]["binary"]
    gmat_timeout: int = _cfg["gmat"]["timeout"]
    gmat_mock_when_missing: bool = _cfg["gmat"].get("mock_when_missing", True)

    host: str = _cfg["server"]["host"]
    port: int = _cfg["server"]["port"]

    llm_model: str = _cfg["llm"]["model"]
    llm_max_tokens: int = _cfg["llm"]["max_tokens"]
    llm_temperature: float = _cfg["llm"]["temperature"]

    root_dir: Path = _ROOT
    data_dir: Path = _ROOT / "data"
    workspaces_dir: Path = _ROOT / "data" / "workspaces"
    db_path: Path = _ROOT / "data" / "missions.db"
    templates_dir: Path = _ROOT / "server" / "templates"
    prompts_dir: Path = _ROOT / "server" / "prompts"
    web_dist_dir: Path = _ROOT / "web" / "dist"

    model_config = {"env_file": str(_ROOT / ".env"), "populate_by_name": True}


settings = Settings()
