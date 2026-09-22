export type TutorialStep = {
  text: string
  images: string[]
}

export type TutorialTopic = {
  id: string
  title: string
  steps: TutorialStep[]
}

function img(n: number): string {
  return `/tutorial/${n}.png`
}

export const TUTORIAL_TOPICS: TutorialTopic[] = [
  {
    id: 'perfil',
    title: 'Menu de Perfil',
    steps: [
      {
        text: 'No topo do painel, clique no ícone de engrenagem para abrir o menu da sua conta. Ele reúne seis opções: Alterar Nome, Alterar Email, Alterar Senha, Políticas de Privacidade, Exportar Meus Dados e Excluir Conta. Cada uma abre uma janela própria, explicadas uma a uma a seguir.',
        images: [img(1)],
      },
      {
        text: 'Em Alterar Nome, a tela mostra o seu nome atual logo acima do campo. Digite o novo nome no campo "Novo nome" e clique em Salvar para confirmar. Não é preciso digitar a senha para essa alteração.',
        images: [img(36)],
      },
      {
        text: 'Em Alterar Email, a tela mostra o seu email atual. Digite o novo endereço no campo "Novo e-mail" e a sua senha atual no campo "Senha atual" para confirmar que é você, depois clique em Enviar Link. Nenhum email é trocado nesse momento.',
        images: [img(35)],
      },
      {
        text: 'Ao clicar em Enviar Link, o Dinlux envia um link de confirmação para o novo endereço de email que você digitou, e a sua sessão é encerrada automaticamente. Abra a caixa de entrada desse novo email e clique no link recebido para confirmar a troca. Só depois de clicar no link o email da sua conta é atualizado de fato.',
        images: [],
      },
      {
        text: 'Depois de confirmar o link, volte ao Dinlux e faça login novamente usando o novo email e a mesma senha de antes, já que a senha não muda nesse processo.',
        images: [],
      },
      {
        text: 'Em Alterar Senha, informe a senha atual, depois a nova senha e confirme repetindo a nova senha no terceiro campo. O ícone de olho em cada campo permite mostrar ou esconder o que foi digitado. Clique em Salvar para concluir.',
        images: [img(37)],
      },
      {
        text: 'Em Políticas de Privacidade fica o texto completo dos termos de privacidade do Dinlux, com rolagem própria, e no topo da janela aparece a data em que você aceitou esse termo, ou um aviso caso essa data não possa ser confirmada. Clique em Fechar para sair.',
        images: [img(38)],
      },
      {
        text: 'Em Exportar Meus Dados você baixa uma cópia de tudo o que está registrado na sua conta. Escolha Exportar em JSON para um arquivo de dados bruto, ou Exportar em PDF para um documento pronto para leitura.',
        images: [img(39)],
      },
      {
        text: 'Em Excluir Conta, o aviso deixa claro que bancos, cartões, simulações, extratos e avisos são apagados de forma permanente e que essa ação não pode ser desfeita. Digite sua senha atual no campo indicado e clique em Excluir conta para confirmar, ou em Cancelar para desistir e fechar a janela sem apagar nada.',
        images: [img(40)],
      },
    ],
  },
  {
    id: 'listas',
    title: 'Listas',
    steps: [
      {
        text: 'Na seção Listas, todas as suas listas ficam no painel à esquerda. Clique em "Nova", no canto superior direito desse painel, para criar uma lista.',
        images: [img(2)],
      },
      {
        text: 'Clique nos três pontinhos ao lado do nome de uma lista para Lançar (debitar de um banco ou cartão o valor dos itens já marcados como feitos), Renomear ou Excluir a lista.',
        images: [img(3)],
      },
      {
        text: 'Ao selecionar uma lista, os itens dela aparecem no painel à direita. No topo você vê quantos itens já foram marcados, o valor Total, quanto já foi Feito e quanto ainda Falta. Use o botão + no canto superior direito para adicionar um item, informando nome, quantidade e preço, ambos opcionais.',
        images: [img(4)],
      },
      {
        text: 'Marque a caixinha ao lado de um item para indicar que ele já foi comprado ou concluído. O item fica riscado e os valores de Feito e Falta são atualizados automaticamente.',
        images: [img(5), img(6)],
      },
      {
        text: 'Clique nos três pontinhos ao lado de um item para Editar ou Excluir esse item.',
        images: [img(7)],
      },
    ],
  },
  {
    id: 'extrato',
    title: 'Importar Extrato',
    steps: [
      {
        text: 'Escolha, no painel à esquerda, o banco para o qual deseja importar o extrato.',
        images: [img(8)],
      },
      {
        text: 'Arraste o arquivo do extrato para a área pontilhada ou clique em "Selecionar arquivo" para escolher no seu computador. São aceitos arquivos .csv e .ofx. Antes de importar, o sistema pergunta o seu saldo atual nesse banco; depois de informado, o extrato é lido e uma prévia dos lançamentos é exibida, com um botão "Salvar Lançamento" para confirmar a importação.',
        images: [img(9)],
      },
    ],
  },
  {
    id: 'financas',
    title: 'Finanças',
    steps: [
      {
        text: 'A tela de Finanças mostra o banco selecionado, com o saldo atual, o cartão de crédito vinculado (limite, limite disponível, dias de fechamento e vencimento) e o extrato importado. Use as setas para navegar entre bancos e entre cartões.',
        images: [img(10)],
      },
      {
        text: 'Clique no valor do saldo para editá-lo diretamente.',
        images: [img(11)],
      },
      {
        text: 'Clique nos três pontinhos no cabeçalho do banco para Renomear, Criar um novo banco, Excluir o Extrato importado ou Excluir o banco.',
        images: [img(12)],
      },
      {
        text: 'Ao criar um novo banco, informe o nome e o saldo atual. Você também pode adicionar um ou mais cartões de crédito já nessa etapa, com bandeira, limite e dias de fechamento e vencimento.',
        images: [img(13)],
      },
      {
        text: 'Clique no ícone de engrenagem no cartão para Editar, Criar um novo cartão, ajustar o Limite Disponível manualmente ou Excluir o cartão.',
        images: [img(14)],
      },
      {
        text: 'Ao criar ou editar um cartão, informe bandeira, limite, dias de fechamento e vencimento, e se ele cobra juros no parcelamento; nesse caso, informe a taxa mensal.',
        images: [img(15)],
      },
    ],
  },
  {
    id: 'simulacoes',
    title: 'Simulações',
    steps: [
      {
        text: 'No topo da tela de Simulações ficam as abas de cada simulação. Simulações desativadas aparecem esmaecidas. Clique em uma aba para selecioná-la.',
        images: [img(16)],
      },
      {
        text: 'Clique nos três pontinhos de uma aba para Renomear, Ativar/Desativar ou Excluir a simulação.',
        images: [img(17)],
      },
      {
        text: 'No canto superior direito do canvas fica a legenda de Bancos e cartões, que mostra a cor usada para cada um. Use o botão + na parte inferior para lançar uma nova compra ou economia nessa simulação.',
        images: [img(18)],
      },
      {
        text: 'Ao lançar uma compra no débito, informe nome, valor total, o banco e o número de parcelas.',
        images: [img(19)],
      },
      {
        text: 'No crédito, escolha também o cartão. Se o cartão cobrar juros a partir de determinada parcela, o valor da taxa é exibido logo abaixo. Em seguida informe a data da compra, que já vem preenchida com a data de hoje mas pode ser alterada para uma data anterior, e por fim o número de parcelas.',
        images: [img(20)],
      },
      {
        text: 'Cada compra parcelada vira um grupo de bolhas conectadas no canvas, uma para cada parcela, coloridas conforme o banco ou cartão usado.',
        images: [img(22)],
      },
      {
        text: 'Clique em uma bolha de economia para ver os detalhes: meta, valor mensal, banco, datas de início e fim, e o progresso já guardado. Você também pode Editar ou Excluir por ali.',
        images: [img(23)],
      },
      {
        text: 'Compras com muitas parcelas formam grupos maiores no canvas, com todas as bolhas do grupo conectadas entre si.',
        images: [img(24)],
      },
      {
        text: 'Você pode arrastar uma bolha para fora do grupo para criar um novo grupo separado, reorganizando os lançamentos como preferir.',
        images: [img(25)],
      },
    ],
  },
  {
    id: 'graficos',
    title: 'Gráficos',
    steps: [
      {
        text: 'Na Home, a aba Simulações do painel de gráficos mostra, para cada simulação ativa, o progresso de cada banco ou cartão usado nela em barras percentuais.',
        images: [img(26)],
      },
      {
        text: 'Logo abaixo, o gráfico "Progresso Geral" mostra a evolução do progresso entre todas as suas simulações.',
        images: [img(27)],
      },
      {
        text: 'A aba Movimentações mostra, para cada banco, a proporção entre entradas e saídas registradas.',
        images: [img(28)],
      },
      {
        text: 'A aba Cartões mostra, para cada cartão de crédito, quanto do limite já foi usado e quanto ainda está disponível.',
        images: [img(29)],
      },
    ],
  },
  {
    id: 'avisos',
    title: 'Avisos',
    steps: [
      {
        text: 'Na seção Avisos, o painel à esquerda lista os bancos e cartões que têm parcelas ou economias com períodos para confirmar. Clique em um deles para abrir os avisos daquele banco.',
        images: [img(30)],
      },
      {
        text: 'Cada lançamento (compra parcelada ou economia) aparece com um cabeçalho; clique nele para expandir ou recolher a lista de períodos. Cada período mostra o mês, o valor e se já foi confirmado.',
        images: [img(31)],
      },
      {
        text: 'Períodos com o prazo já vencido aparecem como Atrasada; os que ainda estão dentro do prazo aparecem como Pendente. Marque a caixinha assim que confirmar o pagamento ou a economia daquele mês.',
        images: [img(32)],
      },
      {
        text: 'Os três pontinhos com a opção Excluir só aparecem quando o lançamento já foi finalizado: no caso de uma economia, depois que a data de término dela é alcançada; no caso de uma compra (em débito ou no crédito), depois que todas as parcelas já foram confirmadas. Excluir apaga esse lançamento por completo, ele some tanto dos Avisos quanto da simulação onde foi criado, e não pode ser desfeito.',
        images: [img(33)],
      },
      {
        text: 'Se você confirmar ou desmarcar períodos e tentar sair sem finalizar, o sistema pergunta se você quer manter as alterações feitas ou descartar tudo e voltar ao estado anterior.',
        images: [img(34)],
      },
    ],
  },
]
