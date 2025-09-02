'use client'
import React from 'react'
import {Button} from '@mui/material'

function DiscordIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.317 4.369A19.79 19.79 0 0016.684 3a14.61 14.61 0 00-.716 1.486 17.052 17.052 0 00-5.937 0A14.53 14.53 0 009.315 3 19.736 19.736 0 005.682 4.369C3.136 7.858 2.36 11.234 2.66 14.563a19.87 19.87 0 006.036 3.083c.169-.33.321-.672.455-1.024-.25-.094-.49-.203-.721-.325a11.7 11.7 0 01-1.17-.71c.173-.124.34-.254.5-.389 3.997 1.874 8.318 1.874 12.316 0 .161.135.328.265.5.389-.37.224-.766.466-1.17.71-.231.122-.47.231-.72.325.134.352.286.694.455 1.024a19.87 19.87 0 006.036-3.083c.371-3.694-.632-7.025-2.651-10.194zM10.257 13.525c-1.181 0-2.143-1.084-2.143-2.419 0-1.335.962-2.419 2.143-2.419 1.19 0 2.152 1.084 2.143 2.419 0 1.335-.952 2.419-2.143 2.419zm6.486 0c-1.181 0-2.143-1.084-2.143-2.419 0-1.335.962-2.419 2.143-2.419 1.19 0 2.152 1.084 2.143 2.419 0 1.335-.952 2.419-2.143 2.419z" />
    </svg>
  )
}

export default function DiscordButton({
  channelId,
  guildId,
  label = 'Discord',
}: {
  channelId: string
  guildId?: string
  label?: string
}) {
  const href = guildId
    ? `https://discord.com/channels/${guildId}/${channelId}`
    : `https://discord.com/channels/${channelId}`

  return (
    <Button
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      variant="contained"
      size="small"
      startIcon={<DiscordIcon />}
      sx={{
        bgcolor: '#5865F2',
        color: '#ffffff',
        '&:hover': {bgcolor: '#4752C4'},
        textTransform: 'none',
      }}
      aria-label="Open Discord channel"
    >
      {label}
    </Button>
  )
}
