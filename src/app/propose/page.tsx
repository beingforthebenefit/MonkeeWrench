import {redirect} from 'next/navigation'

// Retired page: proposals and voting live on /proposals now
export default function Page() {
  redirect('/proposals')
}
