# Papermerge DMS - Codebase Overview

## 🏗️ Architecture Overview

Papermerge is a **Document Management System (DMS)** built with:
- **Backend**: FastAPI (Python) with SQLAlchemy ORM
- **Frontend**: React + TypeScript with Redux Toolkit
- **Database**: PostgreSQL (with Alembic migrations)
- **Deployment**: Docker Compose with Nginx reverse proxy

---

## 📁 Project Structure

```
papermerge-core/
├── papermerge/              # Backend Python application
│   ├── app.py              # FastAPI application entry point
│   ├── celery_app.py        # Celery task queue configuration
│   └── core/               # Core backend modules
│       ├── features/       # Feature-based modules (main business logic)
│       ├── db/             # Database configuration
│       ├── routers/        # Shared router utilities
│       └── schemas/         # Pydantic schemas
│
├── frontend/               # Frontend React application
│   └── apps/ui/            # Main UI application
│       └── src/
│           ├── app/        # App setup, store, routing
│           ├── features/  # Feature-based frontend modules
│           └── components/# Reusable UI components
│
└── docker/                 # Docker configuration
    └── standard/           # Standard deployment setup
```

---

## 🔑 Key Concepts

### 1. **Feature-Based Architecture**

The codebase uses a **feature-based modular structure**. Each feature is self-contained with:
- `router.py` - API endpoints
- `db/api.py` - Database operations
- `db/orm.py` - SQLAlchemy models
- `schema.py` - Pydantic schemas
- `tests/` - Feature tests

**Main Features:**
- `document/` - Document management (upload, versions, pages)
- `nodes/` - Folders and documents (hierarchical structure)
- `users/` - User management
- `groups/` - User groups
- `roles/` - Role-based permissions
- `shared_nodes/` - Document/folder sharing
- `tags/` - Tagging system
- `search/` - Full-text search
- `custom_fields/` - Metadata fields
- `document_types/` - Document categories
- `audit/` - Audit logging

### 2. **Node Hierarchy**

Documents and folders are both **Nodes** (polymorphic inheritance):
```
Node (base class)
├── Document (has versions, pages, OCR)
└── Folder (contains other nodes)
```

**Key Files:**
- `papermerge/core/features/nodes/db/orm.py` - Node, Folder models
- `papermerge/core/features/document/db/orm.py` - Document model
- `papermerge/core/db/nodes.py` - Node utilities

### 3. **Document Versioning**

Each document can have multiple versions:
```
Document
└── DocumentVersion (1, 2, 3, ...)
    └── Page (1, 2, 3, ...)  # Each version has pages
```

**Key Files:**
- `papermerge/core/features/document/db/orm.py` - DocumentVersion, Page models
- `papermerge/core/features/document/db/api.py` - Version management logic
- `papermerge/core/features/document/router_document_version.py` - Version API

### 4. **Authentication & Authorization**

**Two Authentication Methods:**
1. **Token-based** (JWT from external auth server)
2. **Remote User** (headers from reverse proxy)

**Scope-Based Permissions:**
- Users have **scopes** (permissions) like `node.view`, `document.upload`
- Scopes come from:
  - Token (external auth server)
  - Roles (local database)
  - Groups (local database)
- Superusers have all scopes

**Key Files:**
- `papermerge/core/features/auth/dependencies.py` - Auth dependencies
- `papermerge/core/features/auth/scopes.py` - All permission scopes
- `papermerge/core/features/auth/__init__.py` - `get_current_user()` function

**Example Usage:**
```python
@router.get("/documents/")
async def get_documents(
    user: Annotated[schema.User, Security(get_current_user, scopes=[scopes.NODE_VIEW])],
    db_session: AsyncSession = Depends(get_db),
):
    # User must have NODE_VIEW scope
```

### 5. **Ownership & Sharing**

**Ownership Model:**
- Every node has an **owner** (user or group)
- Ownership stored in `ownership` table
- Users can own nodes directly or through groups

**Sharing:**
- Documents/folders can be **shared** with users/groups
- Sharing grants specific **roles** (which have permissions)
- Shared nodes appear in recipient's "Shared" section

**Key Files:**
- `papermerge/core/features/ownership/db/` - Ownership logic
- `papermerge/core/features/shared_nodes/` - Sharing functionality

---

## 🔄 Request Flow

### Backend Request Flow:

1. **Request arrives** → Nginx (`docker/standard/bundles/nginx/nginx.default.conf`)
2. **Auth check** → Auth server validates token/headers
3. **FastAPI app** → `papermerge/app.py` receives request
4. **Router discovery** → `papermerge/core/router_loader.py` auto-discovers feature routers
5. **Endpoint handler** → Feature router (e.g., `document/router.py`)
6. **Auth dependency** → `get_current_user()` checks scopes
7. **Database operation** → Feature `db/api.py` functions
8. **Response** → Pydantic schema serialization

### Frontend Request Flow:

1. **User action** → React component
2. **RTK Query hook** → `features/*/hooks/` or `features/api/slice.ts`
3. **HTTP request** → `httpClient.ts` (axios wrapper)
4. **Backend API** → FastAPI endpoint
5. **State update** → Redux store updated with response
6. **UI re-render** → Component updates

---

## 🗄️ Database Schema

### Core Models:

**Nodes (Hierarchical Structure):**
- `nodes` - Base table for all nodes (polymorphic)
- `folders` - Folder nodes
- `documents` - Document nodes

**Document System:**
- `document_versions` - Document versions
- `pages` - Pages within versions
- `document_types` - Document categories
- `custom_fields` - Metadata field definitions
- `custom_field_values` - Metadata values

**User System:**
- `users` - User accounts
- `groups` - User groups
- `user_groups` - User-group associations
- `roles` - Permission roles
- `permissions` - Individual permissions
- `roles_permissions_association` - Role-permission mapping
- `user_roles` - User-role associations

**Organization:**
- `tags` - Tags
- `node_tags_association` - Node-tag associations
- `ownership` - Node ownership
- `shared_nodes` - Shared node records
- `special_folders` - Home/inbox folders
- `audit_logs` - Audit trail

**Key Files:**
- `papermerge/core/orm.py` - Central model exports
- `papermerge/core/alembic/versions/` - Database migrations

---

## 🎨 Frontend Architecture

### State Management:
- **Redux Toolkit** with RTK Query
- Store: `frontend/apps/ui/src/app/store.ts`
- Feature slices: `frontend/apps/ui/src/features/*/storage/`

### Routing:
- **React Router** v6
- Routes: `frontend/apps/ui/src/router.tsx`
- Page loaders fetch initial data

### UI Framework:
- **Mantine UI** component library
- Custom components in `components/`
- Feature-specific components in `features/*/components/`

### Key Frontend Features:
- **Dual Panel** - Commander-like file browser
- **Document Viewer** - PDF viewer with page navigation
- **Search** - Full-text search interface
- **Sharing UI** - Share modal with user/group/role selection
- **Custom Fields** - Dynamic metadata forms

---

## 🔧 Configuration

### Environment Variables:

**Backend (`config.py`):**
- `PAPERMERGE__DATABASE__URL` - PostgreSQL connection
- `PAPERMERGE__MAIN__MEDIA_ROOT` - File storage path
- `PAPERMERGE__MAIN__API_PREFIX` - API path prefix
- `PAPERMERGE__REDIS__URL` - Redis for caching
- `PAPERMERGE__OCR__AUTOMATIC` - Auto OCR setting
- `PAPERMERGE__DOWNLOADS__MAX_PER_USER` - Rate limiting

**Frontend:**
- `VITE_BASE_URL` - Backend API URL
- `VITE_REMOTE_USER` - Dev mode user
- `VITE_REMOTE_USER_ID` - Dev mode user ID

### Docker Compose:
- `webapp` - Main FastAPI application + Nginx
- `db` - PostgreSQL database
- `path_template_worker` - Background worker for path templates

---

## 📝 Key Code Patterns

### 1. **Router Pattern**
```python
# papermerge/core/features/document/router.py
router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/")
async def create_document(
    user: require_scopes(scopes.NODE_CREATE),
    db_session: AsyncSession = Depends(get_db),
):
    # Handler logic
```

### 2. **Database API Pattern**
```python
# papermerge/core/features/document/db/api.py
async def create_document(
    db_session: AsyncSession,
    user_id: UUID,
    title: str,
) -> schema.Document:
    # Database operations
    doc = orm.Document(...)
    db_session.add(doc)
    await db_session.commit()
    return schema.Document.model_validate(doc)
```

### 3. **Frontend RTK Query Pattern**
```typescript
// frontend/apps/ui/src/features/documents/hooks/useDocuments.ts
export const useGetDocumentsQuery = (params) => {
  return api.useGetDocumentsQuery(params)
}
```

---

## 🚀 Development Workflow

### Starting the Application:

1. **Backend:**
   ```bash
   cd papermerge-core
   docker compose up -d
   # Or for development:
   poetry install
   poetry run task server
   ```

2. **Frontend:**
   ```bash
   cd frontend
   yarn workspace ui dev
   ```

### Testing:
- Backend tests: `pytest` in feature directories
- Frontend tests: `vitest` (configured but not heavily used)

### Database Migrations:
- Alembic migrations: `papermerge/core/alembic/versions/`
- Run migrations: `alembic upgrade head`

---

## 🔍 Important Files Reference

### Backend Entry Points:
- `papermerge/app.py` - FastAPI app initialization
- `papermerge/core/router_loader.py` - Auto-discovers feature routers
- `papermerge/core/db/engine.py` - Database connection

### Core Models:
- `papermerge/core/orm.py` - All model exports
- `papermerge/core/features/nodes/db/orm.py` - Node, Folder
- `papermerge/core/features/document/db/orm.py` - Document, DocumentVersion, Page
- `papermerge/core/features/users/db/orm.py` - User
- `papermerge/core/features/shared_nodes/db/orm.py` - SharedNode

### Core APIs:
- `papermerge/core/features/document/db/api.py` - Document operations
- `papermerge/core/features/nodes/db/api.py` - Node operations
- `papermerge/core/features/shared_nodes/db/api.py` - Sharing operations

### Frontend Entry Points:
- `frontend/apps/ui/src/main.tsx` - React app entry
- `frontend/apps/ui/src/app/store.ts` - Redux store
- `frontend/apps/ui/src/router.tsx` - Routes

### Frontend API:
- `frontend/apps/ui/src/features/api/slice.ts` - RTK Query API slice
- `frontend/apps/ui/src/httpClient.ts` - HTTP client configuration

---

## 🎯 Key Business Logic Areas

### Document Upload:
1. File received → `document/router.py` POST endpoint
2. Validation → Check file type (PDF/JPEG/PNG/TIFF)
3. Conversion → Images converted to PDF via `img2pdf`
4. Storage → File saved to `MEDIA_ROOT/docvers/{version_id}/`
5. Page creation → `Page` records created for each page
6. Version creation → `DocumentVersion` record created
7. OCR scheduling → Optional OCR task queued

### Document Sharing:
1. User selects nodes → Frontend `ShareNodesModal`
2. API call → `shared_nodes/router.py` POST endpoint
3. Validation → Check user_ids/group_ids, role_ids
4. Record creation → `SharedNode` records created
5. Query logic → `get_paginated_shared_nodes()` filters by user/group
6. Frontend display → Shared nodes appear in "Shared" section

### Permission Checking:
1. Request arrives → `get_current_user()` dependency
2. Extract scopes → From token or remote user headers
3. Augment scopes → Add scopes from roles/groups
4. Check required → Compare required scopes vs user scopes
5. Allow/deny → Return user or raise 403 Forbidden

---

## 📚 Additional Resources

- **OpenAPI Docs**: `http://localhost:8000/docs` (when running)
- **Alembic Migrations**: `papermerge/core/alembic/versions/`
- **Constants**: `papermerge/core/constants.py`
- **Types**: `papermerge/core/types.py`
- **Schemas**: `papermerge/core/schema.py` (main schema exports)

---

## 🔄 Data Flow Example: Sharing a Document

1. **Frontend**: User clicks "Share" → `ShareNodesModal.tsx`
2. **Validation**: Client validates user/group and role selection
3. **API Call**: `POST /api/shared-nodes/` with `{node_ids, user_ids, role_ids}`
4. **Router**: `shared_nodes/router.py` → `create_shared_nodes()`
5. **Auth**: `get_current_user()` checks `SHARED_NODE_CREATE` scope
6. **Database**: `shared_nodes/db/api.py` → `create_shared_nodes()`
   - Validates inputs
   - Creates `SharedNode` records
7. **Response**: 204 No Content
8. **Frontend**: Success notification, modal closes
9. **Recipient**: When viewing shared nodes, `get_paginated_shared_nodes()` filters by user/group membership

---

This overview should give you a solid foundation for understanding the codebase structure and how different components interact!

