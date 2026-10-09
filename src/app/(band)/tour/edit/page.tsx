import ChartEditor from '@/components/ChartEditor'
import DemoBanner from '@/components/tour/DemoBanner'
import {formatLength} from '@/lib/gig'
import {pageSession} from '@/lib/guard'
import {DEMO_CHART, DEMO_SONG} from '@/lib/tour-demo'

export const metadata = {title: 'Sample chart'}

/** The tour's song in the editor: type away, nothing saves. */
export default async function TourEdit() {
  await pageSession()
  return (
    <>
      <DemoBanner what="song" />
      <ChartEditor
        songId={DEMO_SONG.id}
        initialFields={{
          title: DEMO_SONG.title,
          writer: DEMO_SONG.writer ?? '',
          leadSinger: DEMO_SONG.leadSinger ?? '',
          guitars: '',
          length: formatLength(DEMO_SONG.seconds),
          keys: '',
          percussion: '',
          youtubeUrl: '',
          lyricsUrl: '',
          status: 'READY',
          notes: '',
        }}
        initialSource={DEMO_CHART}
        baseNumber={3}
        demo
      />
    </>
  )
}
