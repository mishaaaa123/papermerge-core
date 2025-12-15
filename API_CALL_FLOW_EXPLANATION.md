# Complete API Call Flow: Frontend to Backend

## Overview

This document explains the entire process of how API calls flow from the React frontend to the FastAPI backend, including routing, authentication, and how to redirect document calls.

---

## 1. Frontend Flow

### 1.1 User Interaction → React Router

**Location:** `frontend/apps/ui/src/features/shared_nodes/components/SharedCommander/SharedCommander.tsx`

When a user clicks on a node:

```typescript
// Line 96-129: onClick handler
const onClick = (node: NType) => {
  // ... secondary panel logic ...
  
  switch (node.ctype) {
    case "folder":
      navigate(`/shared/folder/${node.id}?page_size=${lastPageSize}`)
      break
    case "document":
      navigate(`/shared/document/${node.id}`)  // ← Routes to document view
      break
  }
}
```

**What happens:**
- React Router navigates to `/shared/document/{id}` or `/shared/folder/{id}`
- URL changes in the browser

---

### 1.2 React Router → Page Loader

**Location:** `frontend/apps/ui/src/features/shared_nodes/pages/SharedDocumentView.tsx`

```typescript
// Lines 13-28: Loader function
export async function loader({params, request}: LoaderFunctionArgs) {
  const documentId = params.documentId  // Extract from URL
  
  // Update Redux store
  store.dispatch(mainPanelComponentUpdated("sharedViewer"))
  store.dispatch(
    currentSharedNodeChanged({
      id: documentId, 
      ctype: "document",  // ← Sets node type
      panel: "main"
    })
  )
  
  return {documentId, urlParams: url.searchParams}
}
```

**What happens:**
- Extracts `documentId` from URL params
- Updates Redux store with node ID and type (`"document"` or `"folder"`)
- Sets the panel component to `"sharedViewer"` (for documents) or `"sharedCommander"` (for folders)

---

### 1.3 Component Renders → RTK Query Hook

**Location:** `frontend/apps/ui/src/features/shared_nodes/components/SharedViewer/SharedViewer.tsx`

```typescript
// Line 37-38: Hooks fetch data
const {doc} = useCurrentSharedDoc()        // ← Calls API #1
const {docVer} = useCurrentSharedDocVer()  // ← Calls API #2 (problematic)
```

**Location:** `frontend/apps/ui/src/features/shared_nodes/hooks/useCurrentSharedDoc.ts`

```typescript
// Hook implementation
export default function useCurrentSharedDoc() {
  const currentNodeID = useAppSelector(selectCurrentSharedNodeID)
  const currentSharedRootID = useAppSelector(selectCurrentSharedRootID)
  
  // RTK Query hook
  const {data: doc, ...rest} = useGetSharedDocumentQuery({
    nodeID: currentNodeID,           // ← From Redux store
    currentSharedRootID: currentSharedRootID
  })
  
  return {doc, ...rest}
}
```

**What happens:**
- Hook reads `currentNodeID` from Redux store (set by loader)
- Calls `useGetSharedDocumentQuery` with the node ID

---

### 1.4 RTK Query → API Slice

**Location:** `frontend/apps/ui/src/features/shared_nodes/store/apiSlice.ts`

```typescript
// Lines 120-131: getSharedDocument endpoint
getSharedDocument: builder.query<DocumentType, GetSharedNodeArgs>({
  query: (args: GetSharedNodeArgs) => {
    if (args.currentSharedRootID) {
      return `/shared-documents/${args.nodeID}?shared_root_id=${args.currentSharedRootID}`
    }
    return `/shared-documents/${args.nodeID}`  // ← Builds API URL
  },
  providesTags: (_result, _error, arg) => [
    {type: "SharedDocument", id: arg.nodeID}
  ]
})
```

**What happens:**
- RTK Query builds the API URL: `/shared-documents/{nodeID}`
- Prepares HTTP request with authentication headers

---

### 1.5 RTK Query Base → HTTP Request

**Location:** `frontend/apps/ui/src/features/api/slice.ts`

```typescript
// Lines 15-50: Base query configuration
const baseQuery = fetchBaseQuery({
  baseUrl: `${getBaseURL()}/api`,  // ← Prepends /api prefix
  prepareHeaders: (headers, {getState}) => {
    const state = getState() as RootState
    const token = state.auth.token
    
    if (token) {
      headers.set("authorization", `Bearer ${token}`)  // ← Adds auth token
    }
    
    // ... Remote-User headers ...
    headers.set("Content-Type", "application/json")
    return headers
  }
})
```

**What happens:**
- Prepends `/api` to the URL: `/api/shared-documents/{id}`
- Adds `Authorization: Bearer {token}` header
- Makes HTTP GET request to `http://localhost:8080/api/shared-documents/{id}`

---

## 2. Nginx Proxy Layer

**Location:** `docker/standard/bundles/nginx/nginx.default.conf`

```nginx
# Lines 42-49: API request routing
location ~ ^/api(/?)(.*)  {
    auth_request /verify;  # ← Verifies authentication first
    
    auth_request_set $auth_cookie $upstream_http_set_cookie;
    add_header Set-Cookie $auth_cookie;
    auth_request_set $auth_status $upstream_status;
    
    # Proxy to FastAPI backend
    proxy_pass http://127.0.0.1:8000/$2$is_args$args;  # ← Strips /api prefix
}
```

**What happens:**
1. Request arrives: `GET /api/shared-documents/{id}`
2. Nginx matches `/api(/?)(.*)` pattern
3. `$2` captures `shared-documents/{id}` (everything after `/api`)
4. Calls `/verify` endpoint to check authentication
5. If authenticated, proxies to: `http://127.0.0.1:8000/shared-documents/{id}`
   - **Note:** `/api` prefix is stripped, so FastAPI receives `/shared-documents/{id}`

---

### 2.1 Authentication Verification

```nginx
# Lines 83-92: Internal auth verification
location = /verify {
    internal;
    proxy_pass http://127.0.0.1:4010;  # ← Auth server
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    
    proxy_set_header X-Original-URI $request_uri;
    proxy_set_header X-Original-Remote-Addr $remote_addr;
    proxy_set_header X-Original-Host $host;
}
```

**What happens:**
- Nginx makes internal request to auth server (`:4010`)
- Auth server validates the `Bearer` token
- Returns 200 if valid, 401 if invalid
- If 401, Nginx returns 401 to client (doesn't proxy to FastAPI)

---

## 3. FastAPI Backend

### 3.1 Router Discovery

**Location:** `papermerge/app.py`

```python
# Lines 45-50: Auto-discover routers
features_path = Path(__file__).parent / "core"
routers = discover_routers(features_path)  # ← Scans for router files

for router, feature_name in routers:
    app.include_router(router, prefix=prefix)  # prefix = "/api" (default)
```

**Location:** `papermerge/core/router_loader.py`

```python
# Lines 38-46: Discovers router_*.py files
for file in module_path.glob("router_*.py"):
    router_module_name = file.stem  # e.g., "router_folders", "router_documents"
    module = importlib.import_module(
        f"papermerge.core.features.{feature_name}.{router_module_name}"
    )
    if hasattr(module, 'router'):
        routers.append((module.router, f"{feature_name}_{router_module_name}"))
```

**What happens:**
- Scans `papermerge/core/features/shared_nodes/` directory
- Finds `router.py`, `router_folders.py`, `router_documents.py`
- Imports each router and registers with FastAPI app
- Each router has its own `prefix` (e.g., `/shared-folders`, `/shared-documents`)

---

### 3.2 FastAPI Route Matching

**Location:** `papermerge/core/features/shared_nodes/router_documents.py`

```python
# Lines 17-27: Router definition
router = APIRouter(prefix="/shared-documents", tags=["shared-documents"])

@router.get("/{document_id}")
async def get_shared_document_details(
    document_id: uuid.UUID,  # ← FastAPI validates UUID format
    user: Annotated[schema.User, Security(get_current_user, scopes=[scopes.NODE_VIEW])],
    shared_root_id: uuid.UUID | None = None,
    db_session: AsyncSession = Depends(get_db),
) -> schema.Document:
```

**What happens:**
1. FastAPI receives: `GET /shared-documents/{id}`
2. Matches router with prefix `/shared-documents`
3. Matches route pattern `/{document_id}`
4. Validates `document_id` is a valid UUID (returns 422 if invalid)
5. Calls `get_current_user` dependency to authenticate user
6. Executes `get_shared_document_details` handler

---

### 3.3 Authentication Dependency

**Location:** `papermerge/core/features/auth/dependencies.py` (inferred)

```python
# Pseudo-code for get_current_user
async def get_current_user(
    token: str = Depends(oauth2_scheme),  # Extracts Bearer token
    db_session: AsyncSession = Depends(get_db)
) -> schema.User:
    # Validates JWT token
    # Returns User object or raises HTTPException(401)
```

**What happens:**
- Extracts `Authorization: Bearer {token}` header
- Validates JWT token
- Returns `User` object if valid
- Raises 401 if invalid

---

### 3.4 Database Query

**Location:** `papermerge/core/features/shared_nodes/router_documents.py`

```python
# Lines 43-48: Call database API
doc = await dbapi.get_shared_doc(
    db_session,
    document_id=document_id,
    shared_root_id=shared_root_id,
    user_id=user.id,
)
```

**Location:** `papermerge/core/features/shared_nodes/db/api.py`

```python
# get_shared_doc function
async def get_shared_doc(
    db_session: AsyncSession,
    document_id: uuid.UUID,
    shared_root_id: uuid.UUID | None,
    user_id: uuid.UUID,
) -> schema.Document:
    # Queries database for shared document
    # Checks permissions
    # Returns Document schema object
```

**What happens:**
- Queries `SharedNode` table to verify user has access
- Loads document from `Node` table
- Validates node type is "document"
- Returns `Document` schema object

---

### 3.5 Response Serialization

FastAPI automatically:
1. Serializes `schema.Document` to JSON
2. Sets `Content-Type: application/json`
3. Returns HTTP 200 with JSON body

---

## 4. Response Flow (Back to Frontend)

1. **FastAPI** → Returns JSON response
2. **Nginx** → Proxies response to client
3. **RTK Query** → Receives response, updates Redux cache
4. **React Hook** → Returns `{doc, isLoading, ...}` to component
5. **Component** → Re-renders with new data

---

## 5. Redirecting Document Calls to `/api/shared-documents/{id}`

### Current Problem

The frontend sometimes calls `/api/shared-folders/{id}` when it should call `/api/shared-documents/{id}` for documents.

### Solution Options

#### Option 1: Fix Frontend Logic (Recommended)

**Location:** `frontend/apps/ui/src/features/shared_nodes/components/SharedCommander/SharedCommander.tsx`

**Current code (lines 77-82):**
```typescript
const skipFolderQuery =
  currentNodeID == SHARED_FOLDER_ROOT_ID || !currentNodeID

const {data: currentFolder} = useGetSharedFolderQuery(
  skipFolderQuery ? skipToken : {nodeID: currentNodeID, currentSharedRootID}
)
```

**Problem:** Always calls folder query, even for documents.

**Fix:**
```typescript
// Check node type from data.items
const currentNode = data?.items?.find(item => item.id === currentNodeID)
const isFolder = currentNode?.ctype === "folder"
const isDocument = currentNode?.ctype === "document"

// Only call folder query for folders
const skipFolderQuery =
  currentNodeID == SHARED_FOLDER_ROOT_ID || !currentNodeID || !isFolder

const {data: currentFolder} = useGetSharedFolderQuery(
  skipFolderQuery ? skipToken : {nodeID: currentNodeID, currentSharedRootID}
)

// Call document query for documents
const skipDocumentQuery =
  currentNodeID == SHARED_FOLDER_ROOT_ID || !currentNodeID || !isDocument

const {data: currentDocument} = useGetSharedDocumentQuery(
  skipDocumentQuery ? skipToken : {nodeID: currentNodeID, currentSharedRootID}
)

// Use breadcrumb from folder OR document
const breadcrumb = currentFolder?.breadcrumb || currentDocument?.breadcrumb || SHARED_NODES_ROOT_BREADCRUMB
```

---

#### Option 2: Backend Redirect (Not Recommended)

**Location:** `papermerge/core/features/shared_nodes/router_folders.py`

Add node type check and redirect:

```python
@router.get("/{folder_id}")
async def get_shared_folder_details(
    folder_id: uuid.UUID,
    user: Annotated[schema.User, Security(get_current_user, scopes=[scopes.NODE_VIEW])],
    shared_root_id: uuid.UUID | None = None,
    db_session: AsyncSession=Depends(get_db),
) -> schema.Folder:
    # Check node type
    node_stmt = select(orm.Node).where(orm.Node.id == folder_id)
    node = (await db_session.scalars(node_stmt)).first()
    
    if node and node.ctype == "document":
        # Redirect to documents endpoint
        from fastapi.responses import RedirectResponse
        url = f"/api/shared-documents/{folder_id}"
        if shared_root_id:
            url += f"?shared_root_id={shared_root_id}"
        return RedirectResponse(url=url, status_code=307)
    
    # ... rest of folder logic ...
```

**Why not recommended:**
- Adds unnecessary database query
- Creates redirect chain (inefficient)
- Frontend should know node type from `data.items`

---

#### Option 3: Unified Endpoint (Alternative)

Create a single endpoint that handles both:

**Location:** `papermerge/core/features/shared_nodes/router.py`

```python
@router.get("/node/{node_id}")
async def get_shared_node(
    node_id: uuid.UUID,
    user: Annotated[schema.User, Security(get_current_user, scopes=[scopes.NODE_VIEW])],
    shared_root_id: uuid.UUID | None = None,
    db_session: AsyncSession = Depends(get_db),
) -> Union[schema.Document, schema.Folder]:
    # Check node type
    node = await db_session.get(orm.Node, node_id)
    
    if node.ctype == "document":
        return await dbapi.get_shared_doc(db_session, node_id, shared_root_id, user.id)
    else:
        return await dbapi.get_shared_folder(db_session, node_id, shared_root_id, user.id)
```

**Frontend change:**
```typescript
getSharedNode: builder.query<NodeType, GetSharedNodeArgs>({
  query: (args) => `/shared-nodes/node/${args.nodeID}`
})
```

**Why not recommended:**
- Breaks RESTful API design (separate endpoints for different resources)
- Requires frontend changes anyway

---

## 6. Summary: Complete Flow Diagram

```
User clicks document
    ↓
React Router: navigate("/shared/document/{id}")
    ↓
Page Loader: Updates Redux store (nodeID, ctype="document")
    ↓
SharedViewer component renders
    ↓
useCurrentSharedDoc() hook
    ↓
useGetSharedDocumentQuery({nodeID, currentSharedRootID})
    ↓
RTK Query: GET /api/shared-documents/{id}
    ↓
Nginx: /api(/?)(.*) → proxy_pass http://127.0.0.1:8000/$2
    ↓
Nginx: /verify → auth_request (validates Bearer token)
    ↓
FastAPI: Receives GET /shared-documents/{id}
    ↓
FastAPI: Matches router with prefix="/shared-documents"
    ↓
FastAPI: Validates UUID format (422 if invalid)
    ↓
FastAPI: get_current_user dependency (validates JWT, returns User)
    ↓
FastAPI: get_shared_document_details handler
    ↓
Database: get_shared_doc() queries SharedNode + Node tables
    ↓
FastAPI: Returns schema.Document (JSON)
    ↓
Nginx: Proxies response to client
    ↓
RTK Query: Updates Redux cache
    ↓
React Hook: Returns {doc, ...} to component
    ↓
Component: Re-renders with document data
```

---

## 7. Key Takeaways

1. **Frontend determines endpoint:** The frontend chooses `/shared-documents/{id}` vs `/shared-folders/{id}` based on node type from `data.items`.

2. **Nginx strips `/api` prefix:** FastAPI receives `/shared-documents/{id}`, not `/api/shared-documents/{id}`.

3. **Authentication happens twice:**
   - Nginx: `/verify` endpoint (auth server on port 4010)
   - FastAPI: `get_current_user` dependency (validates JWT)

4. **FastAPI validates automatically:**
   - UUID format (422 if invalid)
   - Authentication (401 if invalid)
   - Permissions (403 if no access)

5. **Best fix:** Update frontend to check `node.ctype` before calling folder vs. document endpoints.

