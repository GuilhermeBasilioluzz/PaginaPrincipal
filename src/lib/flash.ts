// Mensagens mostradas depois de salvar/excluir. A URL leva só um código curto, nunca texto livre.
export const COLLECTION_FLASH: Record<string, string> = {
  created: 'Coleção criada. Agora escolha as peças.', saved: 'Coleção atualizada.', deleted: 'Coleção excluída.',
  added: 'Peças adicionadas.', removed: 'Peça removida da coleção.', invalid: 'Confira os dados informados.',
  none: 'Marque ao menos uma peça.', automatic: 'A coleção automática monta sozinha; não dá para escolher peças manualmente.',
  forbidden: 'Você não tem permissão para fazer isso.', not_found: 'Esta coleção não existe mais.', generic: 'Algo deu errado. Tente novamente.',
}

export const STOCK_FLASH: Record<string, string> = {
  stock: 'Estoque atualizado.', reserved: 'Reserva criada.', confirmed: 'Reserva confirmada.',
  picked_up: 'Retirada registrada: a peça foi baixada do estoque.', cancelled: 'Reserva cancelada: a peça foi liberada.',
  insufficient: 'Não há estoque suficiente para isso.',
  below_reserved: 'Não dá para deixar o estoque abaixo do que já está reservado. Cancele ou conclua reservas antes.',
  not_reservable: 'Esta peça está indisponível ou arquivada e não pode ser reservada.',
  closed: 'Esta reserva já foi encerrada.', transition: 'Esta mudança de situação não é permitida.',
  expiry: 'O prazo da reserva precisa ser no futuro.', invalid: 'Confira os dados informados.',
  forbidden: 'Você não tem permissão para fazer isso (ou a loja está desativada).',
  not_found: 'Item não encontrado.', generic: 'Algo deu errado. Tente novamente.',
}
