
import requests
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.staticfiles import StaticFiles
from routers.authenticate import router as auth_router
from routers.merchant  import router as merchants_router
from routers.admin import router as admin_router
from routers.live import router as live
from routers import live_payin, live_payout, tsp


from contextlib import asynccontextmanager
from utils.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ✅ Run on startup
    init_db()
    yield
    # ✅ Run on shutdown (if needed)



app = FastAPI(
    title="VICHITRAPAY",
    description="API DOCS For Vichitrapay",
    version="1.0.0",
    lifespan=lifespan,
    #docs_url=None,  # Disable /docs
    #redoc_url=None
)



import os
SECRET_KEY = os.urandom(24).hex()
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)




app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allow all headers
)


app.include_router(admin_router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Login"])
app.include_router(live,prefix="/live", tags=["Live"])
app.include_router(merchants_router, prefix="/api/v1/merchant", tags=["Merchants"])
app.include_router(tsp.router)
app.include_router(live_payin.router)
app.include_router(live_payout.router)

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def index():
  return "Welcome to Vichitrapay"





if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True,  log_level="debug")
    #uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="debug")
