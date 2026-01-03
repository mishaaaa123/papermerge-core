type UUID = string

type FileItem = {
  nodeID?: UUID
  buffer: ArrayBuffer
  docVerID?: UUID
  passwordHash?: string // SHA-256 hash of the password used to decrypt this file
}

class FileManager {
  private files: FileItem[] = []
  private downloading: Set<string> = new Set() // Track ongoing downloads by docVerID
  private downloadResolvers: Map<string, Array<(file: FileItem) => void>> = new Map() // Track promise resolvers (multiple waiters)

  store(item: FileItem): void {
    // Remove existing items with same nodeID or docVerID to avoid duplicates
    this.files = this.files.filter(file => {
      // Keep items that don't match either identifier
      if (item.nodeID && file.nodeID === item.nodeID) return false
      if (item.docVerID && file.docVerID === item.docVerID) return false
      return true
    })
    this.files.push(item)
    // Mark download as complete and resolve any waiting promises
    if (item.docVerID) {
      const resolvers = this.downloadResolvers.get(item.docVerID)
      if (resolvers && resolvers.length > 0) {
        resolvers.forEach(resolver => resolver(item))
        this.downloadResolvers.delete(item.docVerID)
        console.log("[fileManager] Resolved", resolvers.length, "waiting promise(s) for docVerID:", item.docVerID)
      }
      this.downloading.delete(item.docVerID)
    }
    console.log("[fileManager] Stored file:", {
      docVerID: item.docVerID,
      nodeID: item.nodeID,
      bufferSize: item.buffer?.byteLength || 0,
      totalCachedFiles: this.files.length
    })
  }

  /**
   * Check if a download is already in progress for this docVerID
   * Returns a promise that resolves when the download completes, or null if not downloading
   */
  waitForDownload(docVerID: UUID): Promise<FileItem> | null {
    if (!this.downloading.has(docVerID)) {
      return null
    }
    
    // Return a promise that will be resolved when the file is stored
    return new Promise<FileItem>((resolve) => {
      // Check if file is already cached (race condition: might have been stored between check and now)
      const cachedFile = this.getByDocVerID(docVerID)
      if (cachedFile && cachedFile.buffer) {
        resolve(cachedFile)
        return
      }
      
      // Store resolver to be called when file is stored (support multiple waiters)
      const resolvers = this.downloadResolvers.get(docVerID) || []
      resolvers.push(resolve)
      this.downloadResolvers.set(docVerID, resolvers)
      console.log("[fileManager] Waiting for in-progress download for docVerID:", docVerID, "- total waiters:", resolvers.length)
    })
  }

  /**
   * Mark that a download is starting
   */
  startDownload(docVerID: UUID): void {
    if (this.downloading.has(docVerID)) {
      console.log("[fileManager] Download already marked as in progress for docVerID:", docVerID)
      return
    }
    this.downloading.add(docVerID)
    console.log("[fileManager] Marked download as starting for docVerID:", docVerID)
  }

  get(nodeID: UUID): FileItem | undefined {
    return this.files.find(file => file.nodeID === nodeID)
  }

  getBuffer(nodeID: UUID): ArrayBuffer | undefined {
    const item = this.get(nodeID)
    return item?.buffer
  }

  getAll(): FileItem[] {
    return [...this.files] // Return a copy to prevent external mutations
  }

  getByDocVerID(docVerID: UUID): FileItem | undefined {
    const found = this.files.find(file => file.docVerID === docVerID)
    console.log("[fileManager] Cache lookup by docVerID:", {
      docVerID,
      found: !!found,
      hasBuffer: !!(found?.buffer),
      bufferSize: found?.buffer?.byteLength || 0,
      totalCachedFiles: this.files.length,
      allDocVerIDs: this.files.map(f => f.docVerID).filter(Boolean)
    })
    return found
  }

  /**
   * Validates that the provided password matches the password hash stored with the cached file.
   * Returns true if password matches or if file is not password-protected.
   * Returns false if password doesn't match.
   */
  async validatePassword(docVerID: UUID, password: string | undefined): Promise<boolean> {
    const fileItem = this.getByDocVerID(docVerID)
    
    // If file is not in cache, validation passes (will be downloaded)
    if (!fileItem) {
      return true
    }
    
    // If file has no password hash, it's not password-protected
    if (!fileItem.passwordHash) {
      return true
    }
    
    // If file is password-protected but no password provided, validation fails
    if (!password) {
      return false
    }
    
    // Hash the provided password and compare with stored hash
    const { hashPassword } = await import("@/utils/passwordHash")
    const providedHash = await hashPassword(password)
    
    return providedHash === fileItem.passwordHash
  }

  update(nodeID: UUID, updates: Partial<Omit<FileItem, "nodeID">>): boolean {
    const index = this.files.findIndex(file => file.nodeID === nodeID)
    if (index === -1) return false

    this.files[index] = {
      ...this.files[index],
      ...updates
    }
    return true
  }

  delete(nodeID: UUID): boolean {
    const initialLength = this.files.length
    this.files = this.files.filter(file => file.nodeID !== nodeID)
    return this.files.length < initialLength
  }

  deleteByDocVerID(docVerID: UUID): number {
    const initialLength = this.files.length
    this.files = this.files.filter(file => file.docVerID !== docVerID)
    return initialLength - this.files.length // Return count of deleted items
  }

  has(nodeID: UUID): boolean {
    return this.files.some(file => file.nodeID === nodeID)
  }

  count(): number {
    return this.files.length
  }

  clear(): void {
    this.files = []
  }

  filter(predicate: (item: FileItem) => boolean): FileItem[] {
    return this.files.filter(predicate)
  }

  getTotalSize(): number {
    return this.files.reduce((total, file) => total + file.buffer.byteLength, 0)
  }
}

export const fileManager = new FileManager()

// Usage examples:
/*
// Store a file
fileManager.store({
  nodeID: 'node-123',
  buffer: arrayBuffer,
  docVerID: 'doc-456'
})

// Get a file
const fileItem = fileManager.get('node-123')
const buffer = fileManager.getBuffer('node-123')

// Get all files for a document version
const docFiles = fileManager.getByDocVerID('doc-456')

// Update a file (e.g., add docVerID to existing file)
*/
