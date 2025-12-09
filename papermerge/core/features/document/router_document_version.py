import logging
import uuid
import tempfile
from pathlib import Path
from typing import Annotated, Optional

from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, HTTPException, Security, Depends, status, Request, Query

from papermerge.core import schema, utils, dbapi, orm
from papermerge.core.features.auth import get_current_user
from papermerge.core.features.auth import scopes
from papermerge.core.routers.common import OPEN_API_GENERIC_JSON_DETAIL
from papermerge.core.db import common as dbapi_common
from papermerge.core import exceptions as exc
from papermerge.core.db.engine import get_db
from papermerge.core.features.document.response import DocumentFileResponse
from papermerge.core.utils.encryption import (
    decrypt_file_content,
    verify_password,
)
from papermerge.core.rate_limiter import (  # pyright: ignore[reportMissingImports]
    limiter,
    DOWNLOAD_RATE_LIMIT,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/document-versions", tags=["document-versions"])


@router.api_route(
    "/{document_version_id}/download",
    methods=["GET", "HEAD"],
    response_class=DocumentFileResponse,
    status_code=200,
    responses={
        200: {
            "description": "Binary file download",
            "content": {
                "application/octet-stream": {},
                "application/pdf": {},
                "image/png": {},
                "image/jpeg": {},
                "image/tiff": {}
            }
        },
        404: {
            "description": "Document version not found"
        }
    }
)
@limiter.limit(DOWNLOAD_RATE_LIMIT)
@utils.docstring_parameter(scope=scopes.DOCUMENT_DOWNLOAD)
async def download_document_version(
    request: Request,
    document_version_id: uuid.UUID,
    user: Annotated[
        schema.User, Security(get_current_user, scopes=[scopes.DOCUMENT_DOWNLOAD])
    ],
    db_session: AsyncSession = Depends(get_db),
    password: Optional[str] = Query(None, description="Password for password-protected files"),
):
    """Downloads given document version

    Required scope: `{scope}`
    
    If the document is password-protected, the password parameter must be provided.
    """
    request.state.user_id = str(user.id)
    logger.info(
        "Download request received user_id=%s document_version_id=%s",
        user.id,
        document_version_id,
    )
    try:
        doc_id = await dbapi.get_doc_id_from_doc_ver_id(
            db_session, doc_ver_id=document_version_id
        )
        if not await dbapi_common.has_node_perm(
                db_session,
                node_id=doc_id,
                codename=scopes.NODE_VIEW,
                user_id=user.id,
        ):
            logger.warning(
                "User %s lacks node.view permission for doc_id=%s", user.id, doc_id
            )
            raise exc.HTTP403Forbidden()

        doc_ver: orm.DocumentVersion = await dbapi.get_doc_ver(
            db_session,
            document_version_id=document_version_id,
        )
    except NoResultFound:
        logger.warning(
            "Document version %s not found for user %s",
            document_version_id,
            user.id,
        )
        error = schema.Error(messages=["Document version not found"])
        raise HTTPException(status_code=404, detail=error.model_dump())

    if not doc_ver.file_path.exists():
        logger.error(
            "File path %s missing for document_version_id=%s user_id=%s",
            doc_ver.file_path,
            document_version_id,
            user.id,
        )
        error = schema.Error(messages=["Document version file not found"])
        raise HTTPException(status_code=404, detail=error.model_dump())

    # Handle password-protected files
    if doc_ver.is_password_protected:
        if not password:
            error = schema.Error(messages=["Password required for this protected file"])
            raise HTTPException(status_code=403, detail=error.model_dump())
        
        # Verify password
        if not verify_password(password, doc_ver.password_hash):
            logger.warning(
                "Incorrect password provided for document_version_id=%s user_id=%s",
                document_version_id,
                user.id,
            )
            error = schema.Error(messages=["Incorrect password"])
            raise HTTPException(status_code=403, detail=error.model_dump())
        
        # Decrypt the file
        try:
            with open(doc_ver.file_path, "rb") as f:
                encrypted_content = f.read()
            
            decrypted_content = decrypt_file_content(
                encrypted_content,
                password,
                doc_ver.encryption_salt
            )
            
            # Create a temporary file with decrypted content
            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(doc_ver.file_name).suffix) as tmp_file:
                tmp_file.write(decrypted_content)
                tmp_path = Path(tmp_file.name)
            
            # Return decrypted file (will be cleaned up by FastAPI)
            return DocumentFileResponse(
                tmp_path,
                filename=doc_ver.file_name,
                content_disposition_type="attachment"
            )
        except ValueError as e:
            logger.error(
                "Decryption failed for document_version_id=%s user_id=%s: %s",
                document_version_id,
                user.id,
                str(e),
            )
            error = schema.Error(messages=["Failed to decrypt file"])
            raise HTTPException(status_code=500, detail=error.model_dump())

    # Return unencrypted file
    return DocumentFileResponse(
        doc_ver.file_path,
        filename=doc_ver.file_name,  # Will be in Content-Disposition header
        content_disposition_type="attachment"
    )

@router.get(
    "/{doc_ver_id}/download-url",
    responses={
        status.HTTP_403_FORBIDDEN: {
            "description": f"No `{scopes.DOCUMENT_DOWNLOAD}` permission on the node",
            "content": OPEN_API_GENERIC_JSON_DETAIL,
        }
    },
)
@limiter.limit(DOWNLOAD_RATE_LIMIT)
@utils.docstring_parameter(scope=scopes.DOCUMENT_DOWNLOAD)
async def get_doc_ver_download_url(
    request: Request,
    doc_ver_id: uuid.UUID,
    user: Annotated[schema.User, Security(get_current_user, scopes=[scopes.DOCUMENT_DOWNLOAD])],
    db_session: AsyncSession = Depends(get_db),
) -> schema.DownloadURL:
    """
    Returns URL for downloading given document version

    Required scope: `{scope}`
    For this action user requires "node.view" permission as well.
    """
    request.state.user_id = str(user.id)
    logger.info(
        "Download URL requested user_id=%s document_version_id=%s",
        user.id,
        doc_ver_id,
    )
    try:
        doc_id = await dbapi.get_doc_id_from_doc_ver_id(
            db_session, doc_ver_id=doc_ver_id
        )
        if not await dbapi_common.has_node_perm(
            db_session,
            node_id=doc_id,
            codename=scopes.NODE_VIEW,
            user_id=user.id,
        ):
            logger.warning(
                "User %s lacks node.view permission for doc_id=%s", user.id, doc_id
            )
            raise exc.HTTP403Forbidden()

        result = await dbapi.get_doc_version_download_url(
            db_session,
            doc_ver_id=doc_ver_id,
        )
    except NoResultFound:
        logger.warning(
            "Document version %s not found when generating download URL for user %s",
            doc_ver_id,
            user.id,
        )
        raise exc.HTTP404NotFound()

    return result



@router.get(
    "/{document_version_id}",
    response_model=schema.DocumentVersion
)
@utils.docstring_parameter(scope=scopes.NODE_VIEW)
async def document_version_details(
    document_version_id: uuid.UUID,
    user: Annotated[schema.User, Security(get_current_user, scopes=[scopes.NODE_VIEW])],
    db_session=Depends(get_db),
):
    """Get document version details

    Required scope: `{scope}`
    """
    try:
        doc_id = await dbapi.get_doc_id_from_doc_ver_id(
            db_session, doc_ver_id=document_version_id
        )
        if not await dbapi_common.has_node_perm(
                db_session,
                node_id=doc_id,
                codename=scopes.NODE_VIEW,
                user_id=user.id,
        ):
            raise exc.HTTP403Forbidden()
        doc_ver: orm.DocumentVersion = await dbapi.get_doc_ver(
            db_session, document_version_id=document_version_id
        )
    except NoResultFound:
        error = schema.Error(messages=["Page not found"])
        raise HTTPException(status_code=404, detail=error.model_dump())

    return schema.DocumentVersion.model_validate(doc_ver)
