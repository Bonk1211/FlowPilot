from alembic import command
from alembic.config import Config
from flowpilot.demo import load_scenario
from flowpilot.persistence.database import make_engine
from flowpilot.persistence.investigations import InvestigationRepository
from flowpilot.settings import ROOT
from sqlalchemy import inspect
from sqlalchemy.orm import Session


def test_migration_snapshot_round_trip_and_update(tmp_path):
    url = f"sqlite:///{(tmp_path / 'test.db').as_posix()}"
    config = Config(str(ROOT / "apps/api/alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    engine = make_engine(url)
    investigation = load_scenario().investigation
    with Session(engine) as session, session.begin():
        repo = InvestigationRepository(session)
        assert repo.get("missing") is None
        repo.save(investigation)
    with Session(engine) as session, session.begin():
        repo = InvestigationRepository(session)
        assert repo.get(investigation.id) == investigation
        updated = investigation.model_copy(update={"title": "Updated operator report"})
        repo.save(updated)
    with Session(engine) as session:
        assert InvestigationRepository(session).get(investigation.id) == updated
    engine.dispose()
    command.downgrade(config, "base")
    engine = make_engine(url)
    assert "investigation_snapshots" not in inspect(engine).get_table_names()
    engine.dispose()
