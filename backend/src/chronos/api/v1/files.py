from fastapi import APIRouter, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from chronos.services import file_service

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_file(file: UploadFile):
    try:
        result = await file_service.save_upload(file)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return result


@router.get("/{file_id}/{filename}")
async def get_file(file_id: str, filename: str):
    path = file_service.get_file_path(file_id, filename)
    if path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return FileResponse(path)
