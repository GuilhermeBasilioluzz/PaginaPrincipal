// Mensagens mostradas depois de salvar/excluir. A URL leva só um código curto, nunca texto livre.
export const COLLECTION_FLASH: Record<string, string> = {
  created: 'Coleção criada. Agora escolha as peças.', saved: 'Coleção atualizada.', deleted: 'Coleção excluída.',
  added: 'Peças adicionadas.', removed: 'Peça removida da coleção.', invalid: 'Confira os dados informados.',
  none: 'Marque ao menos uma peça.', automatic: 'A coleção automática monta sozinha; não dá para escolher peças manualmente.',
  forbidden: 'Você não tem permissão para fazer isso.', not_found: 'Esta coleção não existe mais.', generic: 'Algo deu errado. Tente novamente.',
}
