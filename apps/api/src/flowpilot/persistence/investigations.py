from sqlalchemy.orm import Session

from flowpilot.investigations.models import Investigation
from flowpilot.persistence.database import InvestigationSnapshot


class InvestigationRepository:
    def __init__(self, session: Session):
        self.session = session

    def save(self, investigation: Investigation) -> None:
        self.session.merge(
            InvestigationSnapshot(
                id=investigation.id,
                schema_version=investigation.schema_version,
                payload=investigation.model_dump(mode="json"),
            )
        )
        self.session.flush()

    def get(self, investigation_id: str) -> Investigation | None:
        record = self.session.get(InvestigationSnapshot, investigation_id)
        return Investigation.model_validate(record.payload) if record else None
