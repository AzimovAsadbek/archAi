import { redirect } from 'next/navigation';

/** `/admin` has no dashboard of its own — users are the first thing to look at. */
export default function AdminIndexPage() {
  redirect('/admin/users');
}
