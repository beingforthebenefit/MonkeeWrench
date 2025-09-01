import { prisma } from '@/lib/db'
import {
  Button, Card, CardContent, Container, Table, TableBody,
  TableCell, TableHead, TableRow, Typography, Stack
} from '@mui/material'
import YouTubeIcon from '@mui/icons-material/YouTube'
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks'
import DescriptionIcon from '@mui/icons-material/Description'

export const dynamic = 'force-dynamic'

export default async function SetlistPage() {
  const items = await prisma.proposal.findMany({
    where: { status: 'APPROVED' },
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true, title: true, artist: true,
      chartUrl: true, lyricsUrl: true, youtubeUrl: true, updatedAt: true,
    },
  })

  type SetlistItem = {
    id: string
    title: string
    artist: string
    chartUrl: string | null
    lyricsUrl: string | null
    youtubeUrl: string | null
    updatedAt: Date
  }

  return (
    <Container sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h5">Setlist</Typography>
        <Card>
          <CardContent sx={{ p: 0 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width="40%">Title</TableCell>
                  <TableCell width="30%">Artist</TableCell>
                  <TableCell>Links</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((i: SetlistItem) => (
                  <TableRow key={i.id} hover>
                    <TableCell>{i.title}</TableCell>
                    <TableCell>{i.artist}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        {i.chartUrl && (
                          <Button href={i.chartUrl} target="_blank" rel="noreferrer" size="small" startIcon={<DescriptionIcon />}>
                            Chart
                          </Button>
                        )}
                        {i.lyricsUrl && (
                          <Button href={i.lyricsUrl} target="_blank" rel="noreferrer" size="small" startIcon={<LibraryBooksIcon />}>
                            Lyrics
                          </Button>
                        )}
                        {i.youtubeUrl && (
                          <Button href={i.youtubeUrl} target="_blank" rel="noreferrer" size="small" startIcon={<YouTubeIcon />}>
                            YouTube
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  )
}
