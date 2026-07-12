from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.base_all_models import Base
from app.db.session import engine
from app.api.routes import auth

app = FastAPI(title="TransitOps API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(auth.router)


@app.get("/")
def health_check():
    return {"status": "TransitOps API running"}
