from fastapi import APIRouter

from chronos.api.v1 import auth, chat, executions, files, incidents, runbooks, settings, skills, topology, webhooks

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(incidents.router)
api_router.include_router(auth.router)
api_router.include_router(webhooks.router)
api_router.include_router(chat.router)
api_router.include_router(runbooks.router)
api_router.include_router(skills.router)
api_router.include_router(topology.router)
api_router.include_router(executions.router)
api_router.include_router(settings.router)
api_router.include_router(files.router)
