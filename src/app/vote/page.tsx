'use client'
import {useEffect, useState} from 'react'
import {
  Card,
  CardContent,
  CardActions,
  IconButton,
  LinearProgress,
  Typography,
  Stack,
  Tooltip,
} from '@mui/material'
import ThumbUpOffAltIcon from '@mui/icons-material/ThumbUpOffAlt'
import ThumbUpAltIcon from '@mui/icons-material/ThumbUpAlt'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import {useSession} from 'next-auth/react'

type Item = {
  id: string
  title: string
  artist: string
  votes: number
  mine: boolean
  threshold: number
}

export default function Vote() {
  const {data: session} = useSession()
  const isAdmin = Boolean(session?.user?.isAdmin)
  const canVote = Boolean(session?.user)

  const [items, setItems] = useState<Item[]>([])
  const [busyVote, setBusyVote] = useState<Record<string, boolean>>({})
  const [busyDelete, setBusyDelete] = useState<Record<string, boolean>>({})

  async function load() {
    const res = await fetch('/api/proposals/pending', {cache: 'no-store'})
    if (!res.ok) return
    setItems(await res.json())
  }

  useEffect(() => {
    load()
    // Only subscribe to SSE when authenticated
    if (!canVote) return
    const es = new EventSource('/api/stream')
    es.onmessage = () => load()
    return () => es.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canVote])

  async function toggleVote(id: string, mine: boolean) {
    try {
      setBusyVote((b) => ({...b, [id]: true}))
      const method = mine ? 'DELETE' : 'POST'
      const res = await fetch(`/api/proposals/${id}/vote`, {method})
      if (res.ok) await load()
    } finally {
      setBusyVote((b) => ({...b, [id]: false}))
    }
  }

  async function deleteProposal(id: string, title?: string) {
    if (!isAdmin) return
    const ok = confirm(
      `Delete "${title ?? 'this request'}"? This cannot be undone.`,
    )
    if (!ok) return
    try {
      setBusyDelete((m) => ({...m, [id]: true}))
      const res = await fetch(`/api/proposals/${id}`, {method: 'DELETE'})
      if (res.ok) {
        // Optimistic removal (also reload to stay synced with any server broadcasting)
        setItems((arr) => arr.filter((p) => p.id !== id))
      }
    } finally {
      setBusyDelete((m) => ({...m, [id]: false}))
    }
  }

  return (
    <Stack spacing={2}>
      {!canVote && (
        <Typography variant="body2" color="text.secondary">
          Viewing as guest — sign in to vote on requests.
        </Typography>
      )}
      {items.map((p) => {
        const pct = Math.min(100, (p.votes / p.threshold) * 100)
        const VIcon = p.mine ? ThumbUpAltIcon : ThumbUpOffAltIcon
        const label = p.mine ? 'Unvote' : 'Vote'
        const voting = !!busyVote[p.id]
        const removing = !!busyDelete[p.id]

        return (
          <Card key={p.id}>
            <CardContent>
              <Typography variant="h6">
                {p.title} — {p.artist}
              </Typography>
              <LinearProgress variant="determinate" value={pct} sx={{my: 1}} />
              <Typography variant="body2">
                {p.votes} / {p.threshold}
              </Typography>
            </CardContent>
            <CardActions sx={{justifyContent: 'space-between'}}>
              <Tooltip title={canVote ? label : 'Sign in to vote'}>
                <span>
                  <IconButton
                    aria-label={label}
                    onClick={() => toggleVote(p.id, p.mine)}
                    disabled={!canVote || voting || removing}
                    color={p.mine ? 'primary' : 'default'}
                  >
                    <VIcon />
                  </IconButton>
                </span>
              </Tooltip>

              {isAdmin && (
                <Tooltip title="Delete request">
                  <span>
                    <IconButton
                      aria-label="Delete"
                      onClick={() => deleteProposal(p.id, p.title)}
                      disabled={removing || voting}
                      color="default"
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </CardActions>
          </Card>
        )
      })}
    </Stack>
  )
}
