"""Synthetic S3 failures must never produce successful document metadata."""
import asyncio
import io
import threading
from unittest.mock import Mock
import pytest
from botocore.exceptions import ClientError, ReadTimeoutError
from backend.tests.test_documents_sprint1 import documents_api, A, B
from app.services import document_storage as storage

PDF=b"%PDF-1.4\nSynthetic only\n%%EOF"
SECRET="private-key private-document private-token"

@pytest.fixture
def s3(monkeypatch):
    monkeypatch.setenv('DOCUMENT_STORAGE_BACKEND','s3')
    monkeypatch.setenv('DOCUMENT_STORAGE_BUCKET','synthetic-private-bucket')
    monkeypatch.setenv('DOCUMENT_STORAGE_REGION','ca-central-1')
    fake=Mock()
    fake.get_object.side_effect=lambda **_: {'Body':io.BytesIO(PDF)}
    monkeypatch.setattr(storage,'_s3_client',lambda **_:fake)
    return fake


def create_record(c):
    return c.post('/self-documents/',headers=A,json={'matter_type':'permanent_residence','document_key':'synthetic','document_name':'Synthetic'}).json()['id']


def upload(c, doc):
    return c.post(f'/self-documents/{doc}/upload',headers=A,files={'file':('synthetic.pdf',PDF,'application/pdf')})


@pytest.mark.parametrize('error', [ReadTimeoutError(endpoint_url=SECRET),ClientError({'Error':{'Code':'AccessDenied','Message':SECRET}},'PutObject')])
def test_failed_upload_is_safe_and_metadata_unchanged(documents_api,s3,error):
    c=documents_api; doc=create_record(c)
    before=c.get('/self-documents/',headers=A).json()
    s3.put_object.side_effect=error
    response=upload(c,doc)
    assert response.status_code==503 and SECRET not in response.text
    assert c.get('/self-documents/',headers=A).json()==before
    assert before[0]['completed'] is False and before[0]['file_url'] is None
    assert before[0]['uploaded_at'] is None
    from app.data.db import get_db
    from app.models.self_document_model import SelfDocument
    session = c.app.dependency_overrides[get_db]()
    try:
        assert next(session).get(SelfDocument, doc).file_path is None
    finally:
        session.close()
    s3.delete_object.assert_not_called()
    s3.put_object.side_effect=None
    assert upload(c,doc).status_code==200
    assert c.get(f'/self-documents/{doc}/file',headers=A).content==PDF


@pytest.mark.parametrize('error,status', [
    (ReadTimeoutError(endpoint_url=SECRET),503),
    (ClientError({'Error':{'Code':'AccessDenied','Message':SECRET}},'GetObject'),503),
    (ClientError({'Error':{'Code':'NoSuchKey','Message':SECRET}},'GetObject'),404),
])
def test_download_failure_is_safe_and_owned(documents_api,s3,error,status):
    c=documents_api; doc=create_record(c); assert upload(c,doc).status_code==200
    before=c.get('/self-documents/',headers=A).json()
    s3.get_object.side_effect=error
    r=c.get(f'/self-documents/{doc}/file',headers=A)
    assert r.status_code==status and SECRET not in r.text
    calls=s3.get_object.call_count
    assert c.get(f'/self-documents/{doc}/file',headers=B).status_code==404
    assert c.get(f'/self-documents/{doc}/file').status_code==401
    assert s3.get_object.call_count==calls
    assert c.post(f'/self-documents/{doc}/upload',headers=B,files={'file':('other.pdf',PDF,'application/pdf')}).status_code==404
    assert c.get('/self-documents/',headers=A).json()==before


def test_failed_replacement_delete_preserves_previous_locator(documents_api,s3):
    c=documents_api; doc=create_record(c); assert upload(c,doc).status_code==200
    before=c.get('/self-documents/',headers=A).json()
    s3.delete_object.side_effect=ReadTimeoutError(endpoint_url=SECRET)
    assert upload(c,doc).status_code==503
    assert c.get('/self-documents/',headers=A).json()==before
    # The successful new PUT can leave an orphan if old-object deletion fails;
    # it is never published as a successful replacement or a new stored locator.
    assert s3.put_object.call_count==2


def test_body_closed_on_read_failure_and_invalid_locator_never_fetches(s3,tmp_path):
    body=Mock(); body.read.side_effect=ReadTimeoutError(endpoint_url=SECRET)
    s3.get_object.side_effect=None; s3.get_object.return_value={'Body':body}
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as e:
        storage.read_document('s3://synthetic-private-bucket/synthetic',legacy_upload_dir=tmp_path)
    assert e.value.status_code==503
    body.close.assert_called_once()
    calls=s3.get_object.call_count
    for locator in ('s3://other-bucket/private','s3://synthetic-private-bucket/../private'):
        with pytest.raises(HTTPException) as e: storage.read_document(locator,legacy_upload_dir=tmp_path)
        assert e.value.status_code==403
    assert s3.get_object.call_count==calls


def test_probe_sdk_budget_is_diagnostic_only(monkeypatch):
    import boto3
    monkeypatch.setenv('DOCUMENT_STORAGE_BUCKET','synthetic')
    monkeypatch.setenv('DOCUMENT_STORAGE_REGION','ca-central-1')
    monkeypatch.setenv('DOCUMENT_STORAGE_BACKEND','s3')
    client=Mock(); factory=Mock(return_value=client)
    monkeypatch.setattr(boto3,'client',factory)
    storage.document_storage_healthcheck()
    config=factory.call_args.kwargs['config']
    assert config.connect_timeout==.5 and config.read_timeout==.5
    assert config.retries=={'total_max_attempts':1}
    assert config.max_pool_connections==1
    client.close.assert_called_once()
    storage._s3_client()
    assert factory.call_args.kwargs['config'] is None


def test_slow_upload_does_not_block_event_loop(monkeypatch):
    from fastapi import UploadFile
    from types import SimpleNamespace
    from app.routes import self_document_routes as route
    entered,release=threading.Event(),threading.Event()
    doc=SimpleNamespace(file_path=None)
    monkeypatch.setattr(route,'get_owned_self_document_or_404',lambda *_:doc)
    def blocked(*_,**kw):
        entered.set(); assert release.wait(3); return 's3://synthetic-private-bucket/new'
    monkeypatch.setattr(route,'store_document',blocked)
    monkeypatch.setattr(route,'delete_document',lambda *_,**kw:None)
    async def exercise():
        upload=UploadFile(io.BytesIO(PDF),filename='synthetic.pdf',headers={'content-type':'application/pdf'})
        db=Mock(); task=asyncio.create_task(route.upload_self_document_file(1,upload,db,SimpleNamespace(id=1)))
        try:
            for _ in range(100):
                if entered.is_set():break
                await asyncio.sleep(.005)
            assert entered.is_set() and not task.done()
            # A callback on this same event loop runs while PUT is still blocked.
            assert await asyncio.wait_for(asyncio.sleep(.01,result='responsive'),.2)=='responsive'
        finally:
            release.set(); await task
    asyncio.run(exercise())
