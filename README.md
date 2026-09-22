# Dinlux Web

Versão web do aplicativo Dinlux, construída com **React + TypeScript + Vite**. Reproduz as
mesmas funcionalidades do aplicativo Android cadastro de bancos e cartões, importação de
extrato bancário (OFX/CSV), simulações de compras e economias, listas que viram lançamentos
financeiros, dashboards de gráficos e o módulo de Avisos em uma aplicação de página única (SPA)
acessível pelo navegador.

O backend é o mesmo do aplicativo Android: **Firebase Authentication** para login/cadastro e
**Cloud Firestore** para persistência de dados, no mesmo projeto Firebase.

## Explicação

### Estrutura do projeto

- `src/pages/Landing`: página pública inicial (apresentação do produto, botão de criar conta e
  link para baixar o `.apk` do aplicativo Android).
- `src/pages/Panel`: layout do painel autenticado (barra lateral de navegação e barra superior
  com menu de configurações), montado em `/painel`.
- `src/pages/Home`: tela inicial do painel, com os dashboards de gráficos.
- `src/pages/Finance`: cadastro de bancos e cartões.
- `src/pages/Simulations`: simulações de compras e economias.
- `src/pages/Listas`: listas de tarefas/compras.
- `src/pages/ImportExtrato`: importação de extrato bancário.
- `src/pages/Avisos`: módulo de avisos (mestre/detalhe: lista de bancos + chat de mensagens).
- `src/pages/Tutorial`: tutorial em slides.
- `src/lib`: funções de acesso ao Firebase/Firestore, compartilhadas entre as páginas.
- `src/components`: componentes reutilizáveis de UI (cabeçalho, modais etc.).

### Roteamento

A aplicação usa `react-router-dom`. A rota `/` é a página pública (Landing) e `/painel` é a área
autenticada, com sub-rotas para cada seção listada acima.

## Pré-requisitos

- **Node.js** (recomendado a versão LTS mais recente, 20.x ou superior) e o **npm** que já vem
  junto com ele.
- **Git** instalado.
- Um arquivo `.env.local` na raiz do projeto com as credenciais do projeto Firebase (o repositório
  já inclui um `.env.example` com as chaves esperadas, mas sem os valores eles precisam ser
  obtidos com quem administra o projeto Firebase "dinlux", ou substituídos pelos valores de um
  projeto Firebase próprio, criado no [console do Firebase](https://console.firebase.google.com),
  em Configurações do projeto > Seus apps > app Web > "Configuração do SDK").

## Execução no Windows

1. Baixe e instale o Node.js em `https://nodejs.org` (instalador `.msi`, versão LTS). O instalador
   já inclui o npm.
2. Clone o repositório (via `git clone`, usando a URL HTTPS ou SSH do repositório) ou baixe o
   `.zip` do código e extraia em uma pasta local.
3. Abra um terminal (PowerShell ou Prompt de Comando) na pasta do projeto:
   ```bash
   cd caminho\para\Dinlux_Web
   ```
4. Instale as dependências:
   ```bash
   npm install
   ```
5. Crie o arquivo de variáveis de ambiente a partir do exemplo:
   ```bash
   copy .env.example .env.local
   ```
   Depois abra `.env.local` em um editor de texto e preencha cada variável
   (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
   `VITE_FIREBASE_APP_ID`) com os valores do projeto Firebase, conforme os pré-requisitos.
6. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
   O terminal exibe uma mensagem parecida com:
   ```
   VITE ready
   ➜  Local:   http://localhost:5173/
   ```
7. Abra `http://localhost:5173/` em um navegador. A página inicial (Landing) deve aparecer com a
   logo do Dinlux, um texto de apresentação e os botões "Criar Conta" e "Baixar para Android".
   Criando uma conta ou entrando com uma conta já existente do mesmo projeto Firebase, a
   aplicação redireciona para `/painel`, com a barra lateral de navegação e o dashboard de
   gráficos.
8. Para encerrar o servidor, volte ao terminal e pressione `Ctrl+C`.

### Build de produção (opcional)

Para gerar os arquivos estáticos otimizados (usados em um deploy real, por exemplo no Firebase
Hosting):

```bash
npm run build
```

Os arquivos são gerados na pasta `dist/`. Para conferir o resultado do build localmente antes de
publicar, use:

```bash
npm run preview
```

que sobe um servidor local servindo o conteúdo de `dist/` (por padrão em
`http://localhost:4173/`).

## Execução no Linux

1. Instale o Node.js. A forma recomendada é via **nvm** (Node Version Manager), que evita
   conflitos com a versão do Node que já vem em alguns repositórios de pacotes das
   distribuições. Siga o script de instalação indicado na página oficial do projeto
   (`https://github.com/nvm-sh/nvm`, seção "Install & Update Script").
   Depois de instalar, feche e reabra o terminal (ou rode `source ~/.bashrc`), e instale a versão
   LTS do Node:
   ```bash
   nvm install --lts
   nvm use --lts
   ```
   Alternativamente, em distribuições baseadas em Debian/Ubuntu, é possível instalar direto pelo
   gerenciador de pacotes (`sudo apt install nodejs npm`), mas a versão disponível nos
   repositórios costuma ser mais antiga que a recomendada.
2. Clone o repositório:
   ```bash
   git clone <URL-do-repositorio>
   cd Dinlux_Web
   ```
3. Instale as dependências:
   ```bash
   npm install
   ```
4. Crie o arquivo de variáveis de ambiente a partir do exemplo:
   ```bash
   cp .env.example .env.local
   ```
   Preencha `.env.local` com os valores do projeto Firebase, como descrito no passo 5 da seção do
   Windows.
5. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
6. Abra `http://localhost:5173/` em um navegador — o comportamento esperado é o mesmo descrito no
   passo 7 da seção do Windows.
7. Para encerrar o servidor, volte ao terminal e pressione `Ctrl+C`.

O build de produção (`npm run build`) e a pré-visualização (`npm run preview`) funcionam da mesma
forma descrita na seção do Windows.

## Observação sobre o download do aplicativo Android

O botão "Baixar para Android" da página inicial aponta para `public/downloads/dinlux.apk`. Esse
arquivo precisa existir nessa pasta para o botão funcionar; ele corresponde ao `.apk` gerado a
partir do projeto do aplicativo Android (pasta `app/release/dinlux.apk` depois de um build de
release no Android Studio, ou via `./gradlew assembleRelease` na raiz daquele projeto).
