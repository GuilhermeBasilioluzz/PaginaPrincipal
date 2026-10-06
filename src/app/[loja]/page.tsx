import type { Metadata } from 'next'
import { CatalogView } from '@/components/catalog/CatalogView'
import { catalogMetadata } from '@/lib/catalogMetadata'

type Props = { params: Promise<{ loja: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return catalogMetadata((await params).loja)
}

export default async function StorePage({ params, searchParams }: Props) {
  const { loja } = await params
  return <CatalogView slug={loja} searchParams={await searchParams} />
}
