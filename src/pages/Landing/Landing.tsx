import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import logoFull from '../../assets/logo-full.png'
import AuthModal from '../../components/AuthModal/AuthModal'
import Header from '../../components/Header/Header'
import { useAuth } from '../../context/AuthContext'
import { clearEmailChangeRequested, wasEmailChangeRequested } from '../../lib/emailChangeNotice'
import './Landing.css'

const APK_DOWNLOAD_URL = '#'

const FEATURES = [
  { title: 'Contas e cartões', color: 'var(--color-cyan)' },
  { title: 'Extratos', color: 'var(--color-sky-blue)' },
  { title: 'Simulações', color: 'var(--color-income)' },
  { title: 'Listas', color: 'var(--color-warning)' },
  { title: 'Avisos', color: 'var(--color-alert-red)' },
]

const ABOUT = [
  {
    title: 'O que é Dinlux?',
    paragraphs: [
      'Nascido de uma constatação simples: a maioria dos aplicativos de controle financeiro promete gratuidade, mas cobra por isso mais cedo ou mais tarde, seja em assinaturas premium, anúncios invasivos ou limites artificiais de uso. O Dinlux propõe o oposto. É uma ferramenta de controle financeiro pessoal totalmente gratuita, sem letras miúdas, pensada para qualquer pessoa que queira organizar bancos, cartões, compras parceladas, metas de economia e extratos bancários em um único lugar, sem pagar nada por isso.',
      'O projeto foi desenvolvido como Trabalho de Conclusão de Curso (TCC) do curso de Ciência da Computação da Universidade Estadual de Mato Grosso do Sul (UEMS), campus de Dourados, sob a orientação do professor André Chastel Lima e autoria da aluna Luana Barros Muniz em 2026. Mais do que cumprir um requisito acadêmico, o trabalho carrega um propósito pessoal: transformar uma necessidade real, a de entender e organizar a própria vida financeira, em um produto funcional, testado e pronto para ser usado de verdade.',
    ],
  },
  {
    title: 'Personalidade',
    paragraphs: [
      'A personalidade do Dinlux está justamente nesse compromisso com o essencial. Ele não tenta ser um super-aplicativo cheio de recursos que ninguém usa; ele resolve problemas concretos do dia a dia financeiro: quanto de limite ainda resta no cartão, quanto falta pagar de uma compra parcelada, se vale a pena ativar aquela simulação de economia, o que aconteceu no extrato do mês. A simulação financeira é o coração do app, o usuário monta projetos de compra ou economia, visualiza tudo organizado em um canvas visual e acompanha o progresso de cada lançamento ao longo do tempo, com cálculo automático de juros (Tabela Price) quando necessário. Há também um módulo de Avisos, que funciona como um lembrete contínuo de parcelas e períodos a confirmar, e a possibilidade de exportar todos os dados do usuário, em JSON ou PDF, a qualquer momento, um gesto direto de respeito à privacidade e ao direito do usuário sobre os próprios dados, alinhado à LGPD.',
    ],
  },
  {
    title: 'Desenvolvimento',
    paragraphs: [
      'Dinlux foi construído como um aplicativo nativo Android, escrito em Kotlin, escolhida por unir segurança de tipos, concisão e suporte nativo a programação assíncrona (coroutines), essencial para lidar com operações de rede sem travar a interface. O ambiente de desenvolvimento principal foi o Android Studio, IDE oficial do ecossistema Android, usada para depuração, testes em diferentes tamanhos de tela e versões do sistema operacional, e visualização em tempo real da interface. Parte do trabalho de apoio, scripts, documentação e organização de artefatos do projeto, foi conduzida no Visual Studio Code (VS Code), editor leve e versátil usado como complemento ao Android Studio. Como banco de dados, o app utiliza o Firebase Firestore, um banco NoSQL orientado a documentos, hospedado na nuvem pelo Google, que garante persistência segura, sincronização automática entre sessões e suporte a uso offline com sincronização posterior, e o Firebase Authentication cuida de todo o fluxo de login, criação de conta e recuperação de senha. A arquitetura segue o padrão MVVM (Model-View-ViewModel), que separa claramente a lógica de negócio da interface, tornando o código mais organizado, testável e fácil de manter.',
    ],
  },
]

export default function Landing() {
  const { user, loading } = useAuth()
  const [emailChanged] = useState(wasEmailChangeRequested)
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(emailChanged ? 'login' : null)

  useEffect(() => {
    if (emailChanged) clearEmailChangeRequested()
  }, [emailChanged])

  if (!loading && user) {
    return <Navigate to="/painel" replace />
  }

  return (
    <>
      <Header onLogin={() => setAuthMode('login')} onSignup={() => setAuthMode('signup')} />
      <main className="landing">
        <section className="landing-hero">
          <div className="container landing-hero-inner">
            <img className="landing-hero-logo" src={logoFull} alt="Dinlux - Gestão Financeira" />
            <p className="landing-hero-subtitle">
              Organize as suas finanças pessoais em um só lugar. Crie simulações de compras e
              economias, importe os seus extratos com total privacidade, acompanhe cada lançamento
              por banco e cartão. Transforme listas de tarefas e compras em lançamentos financeiros
              e consulte dashboards claros sobre suas movimentações. Tudo isto disponível na versão
              web e no aplicativo para Android.
            </p>
            <div className="landing-hero-actions">
              <button type="button" className="btn btn-light" onClick={() => setAuthMode('signup')}>
                Criar Conta
              </button>
              <a className="btn btn-light" href="#download">
                Baixar para Android
              </a>
            </div>
          </div>
        </section>

        <section id="recursos" className="landing-features">
          <div className="container">
            <h2>Recursos</h2>
            <div className="landing-features-grid">
              {FEATURES.map((feature) => (
                <div className="landing-feature-card" key={feature.title}>
                  <span className="landing-feature-dot" style={{ background: feature.color }} />
                  <h3>{feature.title}</h3>
                  <p>Texto em breve.</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="sobre" className="landing-about">
          <div className="container">
            <h2>Sobre</h2>
            {ABOUT.map((block) => (
              <article key={block.title}>
                <h3>{block.title}</h3>
                {block.paragraphs.map((text) => (
                  <p key={text}>{text}</p>
                ))}
              </article>
            ))}
          </div>
        </section>

        <section id="download" className="landing-download">
          <div className="container landing-download-inner">
            <div>
              <h2>Disponível para Android</h2>
              <p>Baixe o aplicativo e leve o Dinlux com você.</p>
            </div>
            <a className="btn btn-solid" href={APK_DOWNLOAD_URL} download>
              Baixar para Android
            </a>
          </div>
        </section>

        <footer className="landing-footer">
          <div className="container">
            <p>Dinlux · Projeto acadêmico (TCC)</p>
          </div>
        </footer>
      </main>

      {authMode && <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          notice={emailChanged ? 'Enviamos um link de confirmação para o novo e-mail. Depois de clicar nele, entre com o novo endereço e sua senha.' : undefined}
        />}
    </>
  )
}
