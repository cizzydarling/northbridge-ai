from pathlib import Path
from io import BytesIO
from zipfile import BadZipFile, ZipFile

from fastapi import HTTPException, UploadFile


MAX_UPLOAD_BYTES = 15 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".heic",
    ".heif",
    ".doc",
    ".docx",
}

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/octet-stream",
    "application/zip",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

EXTENSION_BY_SIGNATURE = {
    ".pdf": b"%PDF-",
    ".jpg": b"\xff\xd8\xff",
    ".jpeg": b"\xff\xd8\xff",
    ".png": b"\x89PNG\r\n\x1a\n",
    ".doc": b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",
}

SAFE_DOWNLOAD_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
}


def get_safe_upload_extension(filename: str | None) -> str:
    extension = Path(filename or "").suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed types: {allowed}.",
        )

    return extension


def _looks_like_docx(content: bytes) -> bool:
    try:
        with ZipFile(BytesIO(content)) as docx:
            names = set(docx.namelist())
            return "[Content_Types].xml" in names and any(
                name.startswith("word/") for name in names
            )
    except (BadZipFile, OSError):
        return False


def validate_upload_content(file: UploadFile, content: bytes, extension: str) -> None:
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="File is too large. Maximum upload size is 15 MB.",
        )

    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type and content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file type does not match an allowed document format.",
        )

    if extension == ".webp":
        if not content.startswith(b"RIFF") or b"WEBP" not in content[:16]:
            raise HTTPException(status_code=400, detail="Invalid WebP file.")
        return

    if extension in {".heic", ".heif"}:
        if b"ftypheic" not in content[:32] and b"ftypheif" not in content[:32]:
            raise HTTPException(status_code=400, detail="Invalid HEIC/HEIF file.")
        return

    if extension == ".docx":
        if not _looks_like_docx(content):
            raise HTTPException(status_code=400, detail="Invalid DOCX file.")
        return

    signature = EXTENSION_BY_SIGNATURE.get(extension)
    if signature and not content.startswith(signature):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file contents do not match the file extension.",
        )


def safe_stored_path(upload_dir: Path, stored_name: str) -> Path:
    resolved_dir = upload_dir.resolve()
    resolved_path = (upload_dir / stored_name).resolve()

    if resolved_dir not in resolved_path.parents and resolved_path != resolved_dir:
        raise HTTPException(status_code=400, detail="Invalid upload path.")

    return resolved_path


def resolve_existing_upload_path(upload_dir: Path, file_path: str | None) -> Path:
    if not file_path:
        raise HTTPException(status_code=404, detail="No file uploaded.")

    resolved_dir = upload_dir.resolve()
    resolved_path = Path(file_path).resolve()

    if resolved_dir not in resolved_path.parents:
        raise HTTPException(status_code=403, detail="Invalid stored file path.")

    if not resolved_path.exists() or not resolved_path.is_file():
        raise HTTPException(status_code=404, detail="Uploaded file not found.")

    return resolved_path


def delete_existing_upload_file(upload_dir: Path, file_path: str | None) -> None:
    if not file_path:
        return

    try:
        resolved_path = resolve_existing_upload_path(upload_dir, file_path)
    except HTTPException as exc:
        if exc.status_code == 404:
            return
        raise

    resolved_path.unlink()
