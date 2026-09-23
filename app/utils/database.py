from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.models import Base

# ✅ MySQL Database URL
#DATABASE_URL = "mysql+pymysql://root:Love1718@localhost/neopay_schemaz"
DATABASE_URL = "mysql+pymysql://root:vichitra321@localhost/vichitrapay_db"

#DATABASE_URL = "mysql+pymysql://neopay_rajv:RajGau0963@localhost/neopay_schemaz"

# ✅ Create engine and session
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Checks connection before using it
    pool_size=0,  # No persistent connections
    max_overflow=-1,  # Unlimited overflow (temporary) connections
    echo=True #or SQL logs during dev
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ✅ Create DB Session
# def get_db():
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()
def get_db():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except:
        db.rollback()
        raise
    finally:
        db.close()


# ✅ Create tables on DB Init
def init_db():
    Base.metadata.create_all(bind=engine)
