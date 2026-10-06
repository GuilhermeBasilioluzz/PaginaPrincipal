import type { Metadata } from 'next'
import { CatalogView } from '@/components/catalog/CatalogView'
import { catalogMetadata } from '@/lib/catalogMetadata'

type Props = { params: Promise<{ loja: string; colecao: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { loja, colecao } = await params
  return catalogMetadata(loja, colecao)
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { loja, colecao } = await params
  return <CatalogView slug={loja} collectionSlug={colecao} searchParams={await searchParams} />
}
