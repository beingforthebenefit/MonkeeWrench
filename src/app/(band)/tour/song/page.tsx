import ChartScreen from '@/components/ChartScreen'
import DemoBanner from '@/components/tour/DemoBanner'
import {pageSession} from '@/lib/guard'
import {DEMO_CHART, DEMO_CUES, DEMO_SONG} from '@/lib/tour-demo'

export const metadata = {title: 'Sample song'}

/** The tour's song: the same for every band, saved nowhere. */
export default async function TourSong() {
  await pageSession()
  return (
    <>
      <DemoBanner what="song" />
      <ChartScreen
        song={DEMO_SONG}
        source={DEMO_CHART}
        version={3}
        versions={3}
        editedBy="Sam"
        editedAt="2026-01-01T12:00:00.000Z"
        cues={DEMO_CUES}
        demo
      />
    </>
  )
}
