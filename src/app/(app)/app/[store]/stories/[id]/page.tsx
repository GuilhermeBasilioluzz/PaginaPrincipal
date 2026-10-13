import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { StoryConvertForm } from '@/components/StoryConvertForm'
import { can } from '@/lib/permissions'
import { getMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { storyThumbPath } from '@/lib/stories'

export const metadata = { title: 'Transformar Story em produto' }
export const dynamic = 'force-dynamic'

export default async function ConvertStoryPage({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: slug, id } = await params
  const membership = await getMembership(slug)
  if (!membership || !/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const { store, role } = membership
  if (!can(role, 'edit_products') || !store.is_active) redirect(`/app/${slug}/stories`)

  const supabase = await createClient()
  const { data: story } = await supabase.from('story_items').select('id, path, caption, status').eq('id', id).eq('store_id', store.id).maybeSingle()
  if (!story) notFound()
  if (story.status !== 'pending') redirect(`/app/${slug}/stories`)
  const [{ data: categories }, signed] = await Promise.all([
    supabase.from('categories').select('id, name').eq('store_id', store.id).order('position').order('name'),
    supabase.storage.from('stories').createSignedUrl(storyThumbPath(story.path), 3600),
  ])

  return (
    <div className="card narrow stack">
      <Link href={`/app/${slug}/stories`} className="link small">← Stories</Link>
      <h1>Transformar em produto</h1>
      {signed.data?.signedUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={signed.data.signedUrl} alt="Story recebido" width={240} height={320} style={{ maxWidth: '12rem', height: 'auto', borderRadius: '0.5rem' }} />
      )}
      <StoryConvertForm storeId={store.id} slug={slug} storyId={story.id} caption={story.caption ?? ''} categories={categories ?? []} />
    </div>
  )
}
