import { FirebaseError } from 'firebase/app'

export function mapAuthError(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return 'Erro ao processar a solicitação'
  }
  switch (error.code) {
    case 'auth/weak-password':
      return 'A senha deve ter no mínimo 6 caracteres'
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha inválidos'
    case 'auth/invalid-email':
      return 'E-mail inválido'
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Tente novamente mais tarde'
    default:
      return error.message
  }
}
