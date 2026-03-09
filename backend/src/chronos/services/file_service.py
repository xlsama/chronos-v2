import uuid
from pathlib import Path

from fastapi import UploadFile

from chronos.core.config import settings
from chronos.schemas.file_upload import FileUploadResponse

ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
ALLOWED_TEXT_TYPES = {"text/plain", "text/csv", "text/x-log", "application/json", "application/xml"}
ALLOWED_TYPES = ALLOWED_IMAGE_TYPES | ALLOWED_TEXT_TYPES


def _upload_dir() -> Path:
    path = Path(settings.UPLOAD_DIR)
    if not path.is_absolute():
        from chronos.core.config import PROJECT_ROOT

        path = PROJECT_ROOT / path
    return path


async def save_upload(file: UploadFile) -> FileUploadResponse:
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_TYPES:
        raise ValueError(f"Unsupported file type: {content_type}")

    data = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(data) > max_bytes:
        raise ValueError(f"File too large: {len(data)} bytes (max {max_bytes})")

    file_id = uuid.uuid4().hex
    filename = file.filename or "upload"
    dest_dir = _upload_dir() / file_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / filename
    dest_path.write_bytes(data)

    url = f"/api/v1/files/{file_id}/{filename}"

    text_content = None
    if content_type in ALLOWED_TEXT_TYPES:
        text_content = data.decode("utf-8", errors="replace")

    return FileUploadResponse(
        file_id=file_id,
        filename=filename,
        content_type=content_type,
        size=len(data),
        url=url,
        text_content=text_content,
    )


def get_file_path(file_id: str, filename: str) -> Path | None:
    path = _upload_dir() / file_id / filename
    if path.is_file():
        return path
    return None
