'use client'

import {useEffect, useState, useMemo} from 'react'
import {
  TextField,
  Button,
  Stack,
  Typography,
  Card,
  CardContent,
  Divider,
  Alert,
  FormHelperText,
  Avatar,
  IconButton,
  Switch,
  Tooltip,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import {isHttpUrl, suggestHttpUrls, httpUrlError} from '@/lib/url'

// --- helpers ---------------------------------------------------------------

function splitAllowlist(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// URL validation centralized in '@/lib/url'

// --- component -------------------------------------------------------------

export default function Admin() {
  // Settings state
  const [threshold, setThreshold] = useState<number>(2)
  const [allowlist, setAllowlist] = useState<string>('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // Quick-add Approved Song state
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('The Monkees')
  const [chartUrl, setChartUrl] = useState('')
  const [lyricsUrl, setLyricsUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // Users management state
  type UserRow = {
    id: string
    name: string | null
    email: string | null
    image: string | null
    isAdmin: boolean
    createdAt: string
    proposalsCount: number
    votesCount: number
    canDelete: boolean
  }
  const [users, setUsers] = useState<UserRow[]>([])
  const [usersMsg, setUsersMsg] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [addUserEmail, setAddUserEmail] = useState('')
  const [addUserName, setAddUserName] = useState('')
  const [addUserAdmin, setAddUserAdmin] = useState(false)
  const [addingUser, setAddingUser] = useState(false)

  // Derived URL warnings (non-blocking)
  const chartWarn = useMemo(
    () => !!chartUrl && !isHttpUrl(chartUrl),
    [chartUrl],
  )
  const chartSuggestions = useMemo(
    () => (chartWarn ? suggestHttpUrls(chartUrl) : []),
    [chartWarn, chartUrl],
  )
  const lyricsWarn = useMemo(
    () => !!lyricsUrl && !isHttpUrl(lyricsUrl),
    [lyricsUrl],
  )
  const lyricsSuggestions = useMemo(
    () => (lyricsWarn ? suggestHttpUrls(lyricsUrl) : []),
    [lyricsWarn, lyricsUrl],
  )
  const youtubeWarn = useMemo(
    () => !!youtubeUrl && !isHttpUrl(youtubeUrl),
    [youtubeUrl],
  )
  const youtubeSuggestions = useMemo(
    () => (youtubeWarn ? suggestHttpUrls(youtubeUrl) : []),
    [youtubeWarn, youtubeUrl],
  )

  async function loadSettings() {
    setSettingsMsg(null)
    const res = await fetch('/api/settings', {cache: 'no-store'})
    if (!res.ok) {
      setSettingsMsg({
        type: 'error',
        text: `Failed to load settings (${res.status})`,
      })
      return
    }
    const j = await res.json()
    setThreshold(j.voteThreshold)
    setAllowlist((j.adminAllowlist || []).join(', '))
  }

  useEffect(() => {
    // first paint load
    loadSettings()
    loadUsers()
  }, [])

  async function saveSettings() {
    setSavingSettings(true)
    setSettingsMsg(null)
    try {
      const body = {
        voteThreshold: Number.isFinite(threshold) ? threshold : 0,
        adminAllowlist: splitAllowlist(allowlist),
      }
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
      }
      setSettingsMsg({type: 'success', text: 'Settings saved.'})
      await loadSettings()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setSettingsMsg({
        type: 'error',
        text: `Save failed: ${message}`,
      })
    } finally {
      setSavingSettings(false)
    }
  }

  async function addApprovedSong() {
    setAdding(true)
    setAddMsg(null)
    try {
      if (!title.trim()) throw new Error('Title is required.')
      if (!artist.trim()) throw new Error('Artist is required.')

      // POST to an admin-only endpoint that creates an APPROVED proposal immediately.
      // Implement this on the server to enforce admin and set status = 'APPROVED'.
      // Suggested route: POST /api/admin/proposals
      const res = await fetch('/api/admin/proposals', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          title: title.trim(),
          artist: artist.trim(),
          chartUrl: chartUrl.trim() || null,
          lyricsUrl: lyricsUrl.trim() || null,
          youtubeUrl: youtubeUrl.trim() || null,
          status: 'APPROVED', // server should ignore/force APPROVED anyway
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
      }

      setAddMsg({type: 'success', text: 'Approved song added to the setlist.'})
      // reset form (keep artist default)
      setTitle('')
      setArtist('The Monkees')
      setChartUrl('')
      setLyricsUrl('')
      setYoutubeUrl('')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setAddMsg({
        type: 'error',
        text: `Add failed: ${message}`,
      })
    } finally {
      setAdding(false)
    }
  }

  // --- Users management ---------------------------------------------------
  async function loadUsers() {
    setLoadingUsers(true)
    setUsersMsg(null)
    try {
      const res = await fetch('/api/admin/users', {cache: 'no-store'})
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as UserRow[]
      setUsers(data)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setUsersMsg({type: 'error', text: `Failed to load users: ${message}`})
    } finally {
      setLoadingUsers(false)
    }
  }

  async function addUser() {
    setAddingUser(true)
    setUsersMsg(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          email: addUserEmail,
          name: addUserName || undefined,
          isAdmin: addUserAdmin,
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
      }
      setAddUserEmail('')
      setAddUserName('')
      setAddUserAdmin(false)
      setUsersMsg({type: 'success', text: 'User added/updated.'})
      await loadUsers()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setUsersMsg({type: 'error', text: `Add user failed: ${message}`})
    } finally {
      setAddingUser(false)
    }
  }

  async function toggleAdmin(u: UserRow) {
    setUsersMsg(null)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({isAdmin: !u.isAdmin}),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await loadUsers()
      setUsersMsg({
        type: 'success',
        text: `${u.email} is now ${!u.isAdmin ? 'Admin' : 'User'}.`,
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setUsersMsg({type: 'error', text: `Update failed: ${message}`})
    }
  }

  async function deleteUser(u: UserRow) {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        `Delete ${u.email}? This will also delete ${u.proposalsCount} proposal(s) and ${u.votesCount} vote(s).`,
      )
    ) {
      return
    }
    setUsersMsg(null)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {method: 'DELETE'})
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
      }
      await loadUsers()
      setUsersMsg({type: 'success', text: `Deleted ${u.email}.`})
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setUsersMsg({type: 'error', text: `Delete failed: ${message}`})
    }
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h5">Admin</Typography>

      {/* Users management */}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Manage Users</Typography>
            {usersMsg && <Alert severity={usersMsg.type}>{usersMsg.text}</Alert>}

            <Stack direction={{xs: 'column', sm: 'row'}} spacing={2} alignItems={{sm: 'center'}}>
              <TextField
                label="Email"
                value={addUserEmail}
                onChange={(e) => setAddUserEmail(e.target.value)}
                sx={{minWidth: 260}}
              />
              <TextField
                label="Name (optional)"
                value={addUserName}
                onChange={(e) => setAddUserName(e.target.value)}
                sx={{minWidth: 200}}
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <AdminPanelSettingsIcon fontSize="small" />
                <Switch
                  checked={addUserAdmin}
                  onChange={(e) => setAddUserAdmin(e.target.checked)}
                />
                <Typography variant="body2">Admin</Typography>
              </Stack>
              <Button variant="contained" onClick={addUser} disabled={addingUser}>
                {addingUser ? 'Saving…' : 'Add / Update'}
              </Button>
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">
                {loadingUsers ? 'Loading users…' : `${users.length} users`}
              </Typography>
              <Stack spacing={1}>
                {users.map((u) => (
                  <Stack
                    key={u.id}
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    sx={{p: 1, borderRadius: 1, bgcolor: '#18191a'}}
                  >
                    <Avatar src={u.image || undefined} sx={{width: 28, height: 28}}>
                      {(u.name || u.email || '?').charAt(0).toUpperCase()}
                    </Avatar>
                    <Stack sx={{flex: 1}}>
                      <Typography variant="body2">{u.name || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {u.email}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption">User</Typography>
                      <Switch
                        size="small"
                        checked={u.isAdmin}
                        onChange={() => toggleAdmin(u)}
                        inputProps={{'aria-label': 'Toggle admin'}}
                      />
                      <Typography variant="caption">Admin</Typography>
                    </Stack>
                    <Tooltip
                      title={
                        (u.proposalsCount || u.votesCount)
                          ? `Delete user (and ${u.proposalsCount} proposal${u.proposalsCount === 1 ? '' : 's'}, ${u.votesCount} vote${u.votesCount === 1 ? '' : 's'})`
                          : 'Delete user'
                      }
                    >
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => deleteUser(u)}
                          aria-label="Delete user"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Settings Card */}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Settings</Typography>
            {settingsMsg && (
              <Alert severity={settingsMsg.type}>{settingsMsg.text}</Alert>
            )}

            <TextField
              label="Vote Threshold"
              type="number"
              value={threshold}
              onChange={(e) =>
                setThreshold(parseInt(e.target.value || '0', 10))
              }
              inputProps={{min: 1}}
            />

            <TextField
              label="Admin Allowlist (emails, comma-separated)"
              value={allowlist}
              onChange={(e) => setAllowlist(e.target.value)}
              helperText="Only allow-listed Google accounts are admins."
            />

            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={saveSettings}
                disabled={savingSettings}
              >
                {savingSettings ? 'Saving...' : 'Save'}
              </Button>
              <Button
                variant="outlined"
                onClick={loadSettings}
                disabled={savingSettings}
              >
                Reload
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Divider flexItem />

      {/* Quick Add Approved Song */}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Add Approved Song</Typography>
            <Typography variant="body2" color="text.secondary">
              Creates a song directly in the Setlist (status = APPROVED). Use
              this to add known staples without the voting flow.
            </Typography>

            {addMsg && <Alert severity={addMsg.type}>{addMsg.text}</Alert>}

            <TextField
              label="Title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <TextField
              label="Artist"
              required
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              helperText='Defaults visually to "The Monkees".'
            />

            <TextField
              label="Chart URL"
              value={chartUrl}
              onChange={(e) => setChartUrl(e.target.value)}
              error={chartWarn}
            />
            {chartUrl && chartWarn && (
              <>
                <FormHelperText error>
                  {httpUrlError(chartUrl) || "This doesn’t look like a valid URL."} Submission will still
                  proceed.
                </FormHelperText>
                {chartSuggestions.length > 0 && (
                  <Stack direction="row" spacing={1}>
                    {chartSuggestions.map((s) => (
                      <Button key={s} size="small" variant="text" onClick={() => setChartUrl(s)}>
                        Use {s}
                      </Button>
                    ))}
                  </Stack>
                )}
              </>
            )}

            <TextField
              label="Lyrics URL"
              value={lyricsUrl}
              onChange={(e) => setLyricsUrl(e.target.value)}
              error={lyricsWarn}
            />
            {lyricsUrl && lyricsWarn && (
              <>
                <FormHelperText error>
                  {httpUrlError(lyricsUrl) || "This doesn’t look like a valid URL."} Submission will still
                  proceed.
                </FormHelperText>
                {lyricsSuggestions.length > 0 && (
                  <Stack direction="row" spacing={1}>
                    {lyricsSuggestions.map((s) => (
                      <Button key={s} size="small" variant="text" onClick={() => setLyricsUrl(s)}>
                        Use {s}
                      </Button>
                    ))}
                  </Stack>
                )}
              </>
            )}

            <TextField
              label="YouTube URL"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              error={youtubeWarn}
            />
            {youtubeUrl && youtubeWarn && (
              <>
                <FormHelperText error>
                  {httpUrlError(youtubeUrl) || "This doesn’t look like a valid URL."} Submission will still
                  proceed.
                </FormHelperText>
                {youtubeSuggestions.length > 0 && (
                  <Stack direction="row" spacing={1}>
                    {youtubeSuggestions.map((s) => (
                      <Button key={s} size="small" variant="text" onClick={() => setYoutubeUrl(s)}>
                        Use {s}
                      </Button>
                    ))}
                  </Stack>
                )}
              </>
            )}

            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={addApprovedSong}
                disabled={adding}
              >
                {adding ? 'Adding...' : 'Add to Setlist'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setTitle('')
                  setArtist('The Monkees')
                  setChartUrl('')
                  setLyricsUrl('')
                  setYoutubeUrl('')
                  setAddMsg(null)
                }}
                disabled={adding}
              >
                Reset
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
