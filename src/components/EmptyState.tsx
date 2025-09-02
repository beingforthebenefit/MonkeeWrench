'use client'
import React from 'react'
import {Stack, Typography} from '@mui/material'

export default function EmptyState({
  icon,
  title,
  message,
}: {
  icon?: React.ReactNode
  title: string
  message?: string
}) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1}
      sx={{py: 4, textAlign: 'center', color: 'text.secondary'}}
    >
      {icon}
      <Typography variant="subtitle1" color="text.secondary">
        {title}
      </Typography>
      {message ? (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      ) : null}
    </Stack>
  )
}
