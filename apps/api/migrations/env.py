from alembic import context
from flowpilot.persistence.database import Base
from flowpilot.settings import Settings
from sqlalchemy import create_engine, pool

config = context.config
url = config.get_main_option("sqlalchemy.url") or Settings().database_url

if context.is_offline_mode():
    context.configure(url=url, target_metadata=Base.metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = create_engine(url, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()
