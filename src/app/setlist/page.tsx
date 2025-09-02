'use client'
import {useEffect, useMemo, useState} from 'react'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {
  Card,
  CardContent,
  Container,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Stack,
  IconButton,
  Button,
  Tooltip,
  CircularProgress,
} from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import YouTubeIcon from '@mui/icons-material/YouTube'
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks'
import DescriptionIcon from '@mui/icons-material/Description'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import {useSession} from 'next-auth/react'
import EditProposalButton from '@/components/EditProposalButton'
import EmptyState from '@/components/EmptyState'
import QueueMusicIcon from '@mui/icons-material/QueueMusic'

type Item = {
  id: string
  title: string
  artist: string
  chartUrl: string | null
  lyricsUrl: string | null
  youtubeUrl: string | null
  updatedAt: string
  setlistOrder: number | null
}

function Row({
  item,
  editing,
  isAdmin,
  onDelete,
  onEdited,
}: {
  item: Item
  editing: boolean
  isAdmin: boolean
  onDelete: (id: string) => void
  onEdited: (id: string, updated: Partial<Item>) => void
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({id: item.id})
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    background: isDragging ? 'rgba(255,255,255,0.03)' : undefined,
  }
  return (
    <TableRow key={item.id} hover ref={setNodeRef} style={style}>
      <TableCell sx={{width: 0, pr: 1}}>
        {editing && (
          <Tooltip title="Drag to reorder">
            <IconButton size="small" {...attributes} {...listeners}>
              <DragIndicatorIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </TableCell>
      <TableCell sx={{width: '40%'}}>{item.title}</TableCell>
      <TableCell sx={{width: '30%'}}>{item.artist}</TableCell>
      <TableCell>
        <Stack direction="row" spacing={1}>
          {item.chartUrl && (
            <Button
              href={item.chartUrl}
              target="_blank"
              rel="noreferrer"
              size="small"
              startIcon={<DescriptionIcon />}
              disabled={editing}
            >
              Chart
            </Button>
          )}
          {item.lyricsUrl && (
            <Button
              href={item.lyricsUrl}
              target="_blank"
              rel="noreferrer"
              size="small"
              startIcon={<LibraryBooksIcon />}
              disabled={editing}
            >
              Lyrics
            </Button>
          )}
          {item.youtubeUrl && (
            <Button
              href={item.youtubeUrl}
              target="_blank"
              rel="noreferrer"
              size="small"
              startIcon={<YouTubeIcon />}
              disabled={editing}
            >
              YouTube
            </Button>
          )}
        </Stack>
      </TableCell>

      {isAdmin && (
        <TableCell align="right" sx={{width: 0, whiteSpace: 'nowrap'}}>
          <Tooltip title="Edit song">
            <span>
              <EditProposalButton
                proposal={{
                  id: item.id,
                  title: item.title,
                  artist: item.artist,
                  chartUrl: item.chartUrl,
                  lyricsUrl: item.lyricsUrl,
                  youtubeUrl: item.youtubeUrl,
                }}
                size="small"
                onSaved={(u) =>
                  onEdited(item.id, {
                    title: u.title,
                    artist: u.artist,
                    chartUrl: u.chartUrl ?? null,
                    lyricsUrl: u.lyricsUrl ?? null,
                    youtubeUrl: u.youtubeUrl ?? null,
                  })
                }
              />
            </span>
          </Tooltip>
          <Tooltip title="Delete song">
            <span>
              <IconButton
                size="small"
                onClick={() => onDelete(item.id)}
                disabled={editing} // don’t allow delete while reordering to avoid weird states
                aria-label={`Delete ${item.title}`}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </TableCell>
      )}
    </TableRow>
  )
}

export default function SetlistPage() {
  const {data: session} = useSession()
  const isAdmin = Boolean(session?.user?.isAdmin)

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Item[]>([])
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 6}}),
  )

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/proposals/approved', {cache: 'no-store'})
      const data: Item[] = await res.json()
      // sort defensively in case some setlistOrder is null
      data.sort((a, b) => {
        const ao = a.setlistOrder ?? Number.MAX_SAFE_INTEGER
        const bo = b.setlistOrder ?? Number.MAX_SAFE_INTEGER
        if (ao !== bo) return ao - bo
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })
      setItems(data)
      setError(null)
    } catch {
      setError('Failed to load setlist')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Only subscribe to SSE when authenticated
    if (!session?.user) return
    const es = new EventSource('/api/stream')
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg?.type === 'setlist_reordered') load()
      } catch {}
    }
    return () => es.close()
  }, [session?.user])

  function onDragEnd(ev: DragEndEvent) {
    const {active, over} = ev
    if (!over || active.id === over.id) return
    const from = items.findIndex((i) => i.id === active.id)
    const to = items.findIndex((i) => i.id === over.id)
    setItems(arrayMove(items, from, to))
  }

  async function save() {
    setSaving(true)
    setError(null)
    const orderedIds = items.map((i) => i.id)
    const prev = items.slice()
    try {
      const res = await fetch('/api/setlist/reorder', {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ids: orderedIds}),
      })
      if (!res.ok) throw new Error('bad status')
      setEditing(false)
    } catch {
      setItems(prev)
      setError('Failed to save order')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!isAdmin) return
    const name = items.find((i) => i.id === id)?.title
    if (
      !confirm(
        `Delete "${name ?? 'this song'}" from the setlist? This cannot be undone.`,
      )
    )
      return
    const prev = items
    setItems(items.filter((i) => i.id !== id)) // optimistic
    try {
      const res = await fetch(`/api/proposals/${id}`, {method: 'DELETE'})
      if (!res.ok) throw new Error()
    } catch {
      setItems(prev) // revert on failure
      alert('Delete failed.')
    }
  }

  const ids = useMemo(() => items.map((i) => i.id), [items])

  return (
    <Container sx={{py: 4}}>
      <Stack spacing={2}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="h5">Setlist</Typography>
          {isAdmin && (
            <Stack direction="row" spacing={1}>
              {!editing ? (
                <Button variant="outlined" onClick={() => setEditing(true)}>
                  Reorder
                </Button>
              ) : (
                <>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setEditing(false)
                      load()
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button variant="contained" onClick={save} disabled={saving}>
                    {saving ? (
                      <CircularProgress
                        size={18}
                        sx={{color: 'white', mr: 1}}
                      />
                    ) : null}
                    Save order
                  </Button>
                </>
              )}
            </Stack>
          )}
        </Stack>

        {error && (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        )}

        <Card>
          <CardContent sx={{p: 0}}>
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <SortableContext
                items={ids}
                strategy={verticalListSortingStrategy}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{width: 0}} />
                      <TableCell width="40%">Title</TableCell>
                      <TableCell width="30%">Artist</TableCell>
                      <TableCell>Links</TableCell>
                      {isAdmin && (
                        <TableCell align="right" sx={{width: 0}}>
                          Actions
                        </TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 5 : 4}>
                          <Typography sx={{p: 2}}>Loading…</Typography>
                        </TableCell>
                      </TableRow>
                    ) : !items.length ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 5 : 4}>
                          <EmptyState
                            icon={
                              <QueueMusicIcon
                                fontSize="large"
                                color="disabled"
                              />
                            }
                            title="No songs in the setlist"
                            message="Songs that reach the vote threshold appear here."
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((i) => (
                        <Row
                          key={i.id}
                          item={i}
                          editing={editing}
                          isAdmin={isAdmin}
                          onDelete={handleDelete}
                          onEdited={(id, updated) =>
                            setItems((arr) =>
                              arr.map((it) =>
                                it.id === id ? {...it, ...updated} : it,
                              ),
                            )
                          }
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </SortableContext>
            </DndContext>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  )
}
