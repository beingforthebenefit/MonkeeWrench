import {redirect} from 'next/navigation'

// Retired page: the old proposal-based setlist; real setlists live on /setlists
export default function Page() {
  redirect('/setlists')
}
