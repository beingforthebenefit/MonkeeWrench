'use client'

import {useEffect, useMemo, useState} from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  IconButton,
  Tooltip,
  Stack,
  FormHelperText,
} from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import {httpUrlError, isHttpUrl, suggestHttpUrls} from '@/lib/url'

type ProposalLike = {
  id: string
  title: string
  artist: string
  chartUrl?: string | null
  lyricsUrl?: string | null
  youtubeUrl?: string | null
}

export default function EditProposalButton({
  proposal,
  onSaved,
  size = 'medium',
}: {
  proposal: ProposalLike
  onSaved?: (updated: ProposalLike) => void
  size?: 'small' | 'medium' | 'large'
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState(proposal.title)
  const [artist, setArtist] = useState(proposal.artist)
  const [chartUrl, setChartUrl] = useState(proposal.chartUrl ?? '')
  const [lyricsUrl, setLyricsUrl] = useState(proposal.lyricsUrl ?? '')
  const [youtubeUrl, setYoutubeUrl] = useState(proposal.youtubeUrl ?? '')

  // when opening, if any of the URLs are undefined (not provided by caller), fetch details
  useEffect(() => {
    if (!open) return
    const needsFetch =
      proposal.chartUrl === undefined ||
      proposal.lyricsUrl === undefined ||
      proposal.youtubeUrl === undefined
    if (!needsFetch) return
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/proposals/${proposal.id}`)
        if (!res.ok) throw new Error()
        const j = await res.json()
        setTitle(j.title)
        setArtist(j.artist)
        setChartUrl(j.chartUrl ?? '')
        setLyricsUrl(j.lyricsUrl ?? '')
        setYoutubeUrl(j.youtubeUrl ?? '')
      } finally {
        setLoading(false)
      }
    })()
  }, [
    open,
    proposal.id,
    proposal.chartUrl,
    proposal.lyricsUrl,
    proposal.youtubeUrl,
  ])

  const chartInvalid = useMemo(
    () => chartUrl.trim() !== '' && !isHttpUrl(chartUrl.trim()),
    [chartUrl],
  )
  const chartSuggestions = useMemo(
    () => (chartInvalid ? suggestHttpUrls(chartUrl) : []),
    [chartInvalid, chartUrl],
  )
  const lyricsInvalid = useMemo(
    () => lyricsUrl.trim() !== '' && !isHttpUrl(lyricsUrl.trim()),
    [lyricsUrl],
  )
  const lyricsSuggestions = useMemo(
    () => (lyricsInvalid ? suggestHttpUrls(lyricsUrl) : []),
    [lyricsInvalid, lyricsUrl],
  )
  const youtubeInvalid = useMemo(
    () => youtubeUrl.trim() !== '' && !isHttpUrl(youtubeUrl.trim()),
    [youtubeUrl],
  )
  const youtubeSuggestions = useMemo(
    () => (youtubeInvalid ? suggestHttpUrls(youtubeUrl) : []),
    [youtubeInvalid, youtubeUrl],
  )

  const formInvalid =
    !title.trim() ||
    !artist.trim() ||
    chartInvalid ||
    lyricsInvalid ||
    youtubeInvalid

  type PatchBody = {
    title: string
    artist: string
    chartUrl: string | null
    lyricsUrl: string | null
    youtubeUrl: string | null
  }

  async function save() {
    if (formInvalid) return
    setSaving(true)
    try {
      const body: PatchBody = {
        title: title.trim(),
        artist: artist.trim(),
        chartUrl: chartUrl.trim() || null,
        lyricsUrl: lyricsUrl.trim() || null,
        youtubeUrl: youtubeUrl.trim() || null,
      }
      const res = await fetch(`/api/proposals/${proposal.id}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Save failed')
      setOpen(false)
      onSaved?.({
        id: proposal.id,
        title: body.title,
        artist: body.artist,
        chartUrl: body.chartUrl,
        lyricsUrl: body.lyricsUrl,
        youtubeUrl: body.youtubeUrl,
      })
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Tooltip title="Edit">
        <span>
          <IconButton
            size={size}
            aria-label="Edit"
            onClick={() => setOpen(true)}
            disabled={saving}
          >
            <EditOutlinedIcon />
          </IconButton>
        </span>
      </Tooltip>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit Song</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{pt: 1}}>
            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              required
              disabled={loading || saving}
            />
            <TextField
              label="Artist"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              fullWidth
              required
              disabled={loading || saving}
            />
            <div>
              <TextField
                label="Chart URL"
                value={chartUrl}
                onChange={(e) => setChartUrl(e.target.value)}
                fullWidth
                error={chartInvalid}
                disabled={loading || saving}
              />
              {chartInvalid && (
                <>
                  <FormHelperText error>
                    {httpUrlError(chartUrl) || 'Must be a valid http(s) URL'}
                  </FormHelperText>
                  {chartSuggestions.length > 0 && (
                    <Stack direction="row" spacing={1} sx={{mt: 0.5}}>
                      {chartSuggestions.map((s) => (
                        <Button
                          key={s}
                          size="small"
                          variant="text"
                          onClick={() => setChartUrl(s)}
                        >
                          Use {s}
                        </Button>
                      ))}
                    </Stack>
                  )}
                </>
              )}
            </div>

            <div>
              <TextField
                label="Lyrics URL"
                value={lyricsUrl}
                onChange={(e) => setLyricsUrl(e.target.value)}
                fullWidth
                error={lyricsInvalid}
                disabled={loading || saving}
              />
              {lyricsInvalid && (
                <>
                  <FormHelperText error>
                    {httpUrlError(lyricsUrl) || 'Must be a valid http(s) URL'}
                  </FormHelperText>
                  {lyricsSuggestions.length > 0 && (
                    <Stack direction="row" spacing={1} sx={{mt: 0.5}}>
                      {lyricsSuggestions.map((s) => (
                        <Button
                          key={s}
                          size="small"
                          variant="text"
                          onClick={() => setLyricsUrl(s)}
                        >
                          Use {s}
                        </Button>
                      ))}
                    </Stack>
                  )}
                </>
              )}
            </div>

            <div>
              <TextField
                label="YouTube URL"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                fullWidth
                error={youtubeInvalid}
                disabled={loading || saving}
              />
              {youtubeInvalid && (
                <>
                  <FormHelperText error>
                    {httpUrlError(youtubeUrl) || 'Must be a valid http(s) URL'}
                  </FormHelperText>
                  {youtubeSuggestions.length > 0 && (
                    <Stack direction="row" spacing={1} sx={{mt: 0.5}}>
                      {youtubeSuggestions.map((s) => (
                        <Button
                          key={s}
                          size="small"
                          variant="text"
                          onClick={() => setYoutubeUrl(s)}
                        >
                          Use {s}
                        </Button>
                      ))}
                    </Stack>
                  )}
                </>
              )}
            </div>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={saving || loading || formInvalid}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
