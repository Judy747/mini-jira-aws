/** Prefer thumbnail; fall back to full image while Lambda is processing. */
export function taskImageSrc(task) {
  if (!task) return null
  return task.thumbnailUrl || task.imageUrl || null
}

export async function uploadTaskImage({ api, file, taskId }) {
  const { data: presign } = await api.post('/uploads/presign', {
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    taskId,
  })
  const method = presign.method || 'PUT'
  if (method !== 'PUT') {
    throw new Error(`Expected presigned PUT upload, got ${method}`)
  }
  const putRes = await fetch(presign.uploadUrl, {
    method,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!putRes.ok) {
    throw new Error(`S3 upload failed (${putRes.status})`)
  }
  return {
    imageUrl: presign.publicUrl,
    imageKey: presign.key,
    thumbnailUrl: presign.thumbnailUrl,
  }
}
