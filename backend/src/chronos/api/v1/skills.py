from fastapi import APIRouter, HTTPException, Request, status

from chronos.agent.skills.loader import SkillLoader

router = APIRouter(prefix="/skills", tags=["skills"])

def get_loader(request: Request) -> SkillLoader:
    loader = getattr(request.app.state, "skill_loader", None)
    if loader is None:
        raise RuntimeError("Skill loader is not initialized")
    return loader


@router.get("")
async def list_skills(request: Request):
    loader = get_loader(request)
    return [s.model_dump() for s in loader.catalog]


@router.get("/{name}")
async def get_skill(request: Request, name: str):
    loader = get_loader(request)
    content = loader.load_full_content(name)
    if content is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    meta = next((s for s in loader.catalog if s.name == name), None)
    return {"meta": meta.model_dump() if meta else None, "content": content}
