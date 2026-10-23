import os
from pathlib import Path
from urllib.parse import quote
from uuid import uuid4

from fastapi import HTTPException
from fastapi.responses import Response

from app.utils.upload_security import (
    SAFE_DOWNLOAD_HEADERS,
    resolve_existing_upload_path,
    safe_stored_path,
)


BASE_DIR = Path(__file__).resolve().parents[3]
LOCAL_UPLOAD_ROOT = BASE_DIR / "uploads"
S3_SCHEME = "s3://"


def get_storage_backend() -> str:
    backend = os.getenv("DOCUMENT_STORAGE_BACKEND", "local").strip().lower()
    if backend not in {"local", "s3"}:
        raise RuntimeError(
            "DOCUMENT_STORAGE_BACKEND must be either 'local' or 's3'."
        )
    return backend


def _s3_settings() -> tuple[str, str]:
    bucket = os.getenv("DOCUMENT_STORAGE_BUCKET", "").strip()
    region = os.getenv("DOCUMENT_STORAGE_REGION", "").strip()
    if not bucket or not region:
        raise RuntimeError(
            "DOCUMENT_STORAGE_BUCKET and DOCUMENT_STORAGE_REGION are required "
            "when DOCUMENT_STORAGE_BACKEND=s3."
        )
    return bucket, region


def _s3_client(*, diagnostic=False):
    try:
        import boto3
    except ImportError as exc:
        raise RuntimeError(
            "boto3 is required when DOCUMENT_STORAGE_BACKEND=s3."
        ) from exc

    _bucket, region = _s3_settings()
    endpoint_url = os.getenv("DOCUMENT_STORAGE_ENDPOINT_URL", "").strip() or None
    from botocore.config import Config
    # Only the non-gating HEAD diagnostic uses this short, single-attempt budget.
    # Real document operations retain their existing SDK timeout/retry policy.
    config = Config(connect_timeout=0.5, read_timeout=0.5,
                    retries={"total_max_attempts": 1}, max_pool_connections=1) if diagnostic else None
    return boto3.client("s3", region_name=region, endpoint_url=endpoint_url, config=config)


def _s3_locator(bucket: str, key: str) -> str:
    return f"{S3_SCHEME}{bucket}/{key}"


def _parse_s3_locator(locator: str) -> tuple[str, str]:
    if not locator.startswith(S3_SCHEME):
        raise HTTPException(status_code=403, detail="Invalid stored file location.")
    remainder = locator[len(S3_SCHEME) :]
    bucket, separator, key = remainder.partition("/")
    if not separator or not bucket or not key or ".." in Path(key).parts:
        raise HTTPException(status_code=403, detail="Invalid stored file location.")
    configured_bucket, _region = _s3_settings()
    if bucket != configured_bucket:
        raise HTTPException(status_code=403, detail="Invalid stored file location.")
    return bucket, key


def store_document(
    content: bytes,
    *,
    namespace: str,
    filename_extension: str,
    content_type: str | None,
) -> str:
    safe_namespace = namespace.strip("/").replace("..", "")
    stored_name = f"{uuid4().hex}{filename_extension}"

    if get_storage_backend() == "s3":
        bucket, _region = _s3_settings()
        key = f"{safe_namespace}/{stored_name}"
        extra = {
            "Bucket": bucket,
            "Key": key,
            "Body": content,
            "ContentType": content_type or "application/octet-stream",
            "ServerSideEncryption": "AES256",
        }
        try:
            _s3_client().put_object(**extra)
        except Exception as exc:
            raise HTTPException(status_code=503, detail="Document storage is temporarily unavailable.") from exc
        return _s3_locator(bucket, key)

    upload_dir = LOCAL_UPLOAD_ROOT / safe_namespace
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_path = safe_stored_path(upload_dir, stored_name)
    stored_path.write_bytes(content)
    return str(stored_path)


def read_document(locator: str | None, *, legacy_upload_dir: Path) -> bytes:
    if not locator:
        raise HTTPException(status_code=404, detail="No file uploaded.")

    if locator.startswith(S3_SCHEME):
        bucket, key = _parse_s3_locator(locator)
        try:
            response = _s3_client().get_object(Bucket=bucket, Key=key)
            body = response["Body"]
            try:
                return body.read()
            finally:
                body.close()
        except Exception as exc:
            error_code = (getattr(exc, "response", None) or {}).get("Error", {}).get("Code")
            if error_code in {"NoSuchKey", "404", "NotFound"}:
                raise HTTPException(status_code=404, detail="Uploaded file not found.") from exc
            raise HTTPException(status_code=503, detail="Document storage is temporarily unavailable.") from exc

    path = _resolve_local_or_legacy_path(locator, legacy_upload_dir)
    return path.read_bytes()


def delete_document(locator: str | None, *, legacy_upload_dir: Path) -> None:
    if not locator:
        return

    if locator.startswith(S3_SCHEME):
        bucket, key = _parse_s3_locator(locator)
        try:
            _s3_client().delete_object(Bucket=bucket, Key=key)
        except Exception as exc:
            raise HTTPException(status_code=503, detail="Document storage is temporarily unavailable.") from exc
        return

    try:
        path = _resolve_local_or_legacy_path(locator, legacy_upload_dir)
    except HTTPException as exc:
        if exc.status_code == 404:
            return
        raise
    path.unlink()


def _resolve_local_or_legacy_path(locator: str, legacy_upload_dir: Path) -> Path:
    try:
        return resolve_existing_upload_path(LOCAL_UPLOAD_ROOT, locator)
    except HTTPException as exc:
        if exc.status_code != 403:
            raise

    return resolve_existing_upload_path(legacy_upload_dir, locator)


def document_download_response(
    locator: str | None,
    *,
    filename: str | None,
    legacy_upload_dir: Path,
) -> Response:
    content = read_document(locator, legacy_upload_dir=legacy_upload_dir)
    safe_name = (filename or "document").replace("\r", "").replace("\n", "")
    headers = {
        **SAFE_DOWNLOAD_HEADERS,
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(safe_name)}",
    }
    return Response(
        content=content,
        media_type="application/octet-stream",
        headers=headers,
    )


def document_storage_healthcheck() -> None:
    if get_storage_backend() == "s3":
        bucket, _region = _s3_settings()
        client = _s3_client(diagnostic=True)
        try:
            client.head_bucket(Bucket=bucket)
        finally:
            client.close()
        return

    LOCAL_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    if not os.access(LOCAL_UPLOAD_ROOT, os.R_OK | os.W_OK):
        raise RuntimeError("Local document storage is not readable and writable.")
