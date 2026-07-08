import { DEFAULT_LOCALE, type Locale } from './types'

/**
 * Message catalogue. Each locale exports the SAME shape — TypeScript
 * enforces this via `Messages` (inferred from the English catalogue below).
 * Plurals/parameters are pure functions so the call site reads naturally
 * and translators don't need a separate ICU runtime.
 *
 * Keys are nested by feature for grep-ability. Add features here, never
 * inline a new user-facing string in a component. English is the source
 * of truth for the shape; every other locale must conform to `Messages`.
 */

// ─── English (source of truth for the Messages shape) ──────────────────────

const en = {
  common: {
    save:        'Save changes',
    saving:      'Saving…',
    cancel:      'Cancel',
    tryAgain:    'Try again',
    loading:     'Loading…',
    optional:    '(optional)',
    redirecting: 'Redirecting…',
  },
  toast: {
    dismiss: 'Dismiss',
    undo:    'Undo',
  },
  auth: {
    identify: {
      title:                 'Sign in or create an account',
      subtitle:              'Enter your email or phone number to continue',
      identifierLabel:       'Email or phone',
      identifierPlaceholder: 'you@example.com or +1 (555) 000-0000',
      identifierHelp:        'Use your email or a phone number with country code (e.g. +1 555 000 0000).',
      submit:                'Continue',
      submitting:            'Checking for account…',
    },
    register: {
      title:           'Create your account',
      subtitle:        'Just your name to get started',
      emailLabel:      'Email',
      phoneLabel:      'Phone',
      nameLabel:       'Name',
      namePlaceholder: 'Your name',
      submit:          'Create account',
      submitting:      'Creating account…',
      success:         'Account created! Redirecting…',
    },
    verify: {
      titleEmail:   'Check your email',
      titlePhone:   'Check your phone',
      sentTo:       'We sent a 6-digit code to',
      codeLabel:    'Verification code',
      submit:       'Verify code',
      submitting:   'Verifying…',
      successTitle: 'All set!',
      successHint:  'Taking you to your dashboard…',
      resendIn:     (seconds: number) => `Resend code in ${seconds}s`,
      resend:       'Resend code',
      sending:      'Sending…',
      sent:         'Code sent!',
    },
  },
  workspaces: {
    kicker:  'Welcome',
    heading: 'Your workspaces',
    pick:    'Choose a workspace to continue.',
    none:    'You are not part of any workspace yet.',
  },
  invite: {
    title:          'Invitation',
    nameRequired:   'Please enter your name to accept.',
    nameLabel:      'Your name',
    acceptingAs:    (name: string) => `You'll join as ${name}.`,
    confirmHeading: (workspace: string, role: string) => `Accept invite to ${workspace} as ${role}`,
    confirmBody:    'Accepting will add you to this workspace with the role above.',
    accept:         'Accept invite',
    accepting:      'Accepting…',
    roles: {
      owner:  'owner',
      member: 'member',
    },
    error: {
      notFound: 'This invitation could not be found.',
      expired:  'This invitation has expired.',
      used:     'This invitation has already been accepted.',
      revoked:  'This invitation has been revoked.',
      generic:  'This invitation is no longer valid.',
      goHome:   'Go to dashboard',
    },
    email: {
      subject:  (workspace: string) => `You're invited to join ${workspace}`,
      greeting: 'Hello,',
      body:     (workspace: string, role: string) => `You have been invited to join ${workspace} as ${role}.`,
      cta:      'Accept invitation',
      ignore:   'If you did not expect this, you can ignore this email.',
    },
    errors: {
      accept:   'Failed to accept invite.',
      notFound: 'Invite not found.',
    },
  },
}

export type Messages = typeof en

// ─── Português (Brasil) ─────────────────────────────────────────────────────

const ptBR: Messages = {
  common: {
    save:        'Salvar alterações',
    saving:      'Salvando…',
    cancel:      'Cancelar',
    tryAgain:    'Tentar novamente',
    loading:     'Carregando…',
    optional:    '(opcional)',
    redirecting: 'Redirecionando…',
  },
  toast: {
    dismiss: 'Dispensar',
    undo:    'Desfazer',
  },
  auth: {
    identify: {
      title:                 'Acesse sua conta',
      subtitle:              'Informe seu e-mail ou telefone para continuar',
      identifierLabel:       'E-mail ou telefone',
      identifierPlaceholder: 'voce@exemplo.com ou +55 11 99999-9999',
      identifierHelp:        'Use seu e-mail ou um telefone com código do país (ex.: +55 11 99999-9999).',
      submit:                'Continuar',
      submitting:            'Verificando conta…',
    },
    register: {
      title:           'Crie sua conta',
      subtitle:        'Só seu nome para começar',
      emailLabel:      'E-mail',
      phoneLabel:      'Telefone',
      nameLabel:       'Nome',
      namePlaceholder: 'Seu nome',
      submit:          'Criar conta',
      submitting:      'Criando conta…',
      success:         'Conta criada! Redirecionando…',
    },
    verify: {
      titleEmail:   'Verifique seu e-mail',
      titlePhone:   'Verifique seu telefone',
      sentTo:       'Enviamos um código de 6 dígitos para',
      codeLabel:    'Código de verificação',
      submit:       'Verificar código',
      submitting:   'Verificando…',
      successTitle: 'Tudo certo!',
      successHint:  'Levando você ao seu painel…',
      resendIn:     (seconds: number) => `Reenviar código em ${seconds}s`,
      resend:       'Reenviar código',
      sending:      'Enviando…',
      sent:         'Código enviado!',
    },
  },
  workspaces: {
    kicker:  'Bem-vindo',
    heading: 'Seus workspaces',
    pick:    'Escolha um workspace para continuar.',
    none:    'Você ainda não faz parte de nenhum workspace.',
  },
  invite: {
    title:          'Convite',
    nameRequired:   'Informe seu nome para aceitar.',
    nameLabel:      'Seu nome',
    acceptingAs:    (name: string) => `Você entrará como ${name}.`,
    confirmHeading: (workspace: string, role: string) => `Aceitar convite para ${workspace} como ${role}`,
    confirmBody:    'Ao aceitar, você entrará neste workspace com a função acima.',
    accept:         'Aceitar convite',
    accepting:      'Aceitando…',
    roles: {
      owner:  'proprietário',
      member: 'membro',
    },
    error: {
      notFound: 'Este convite não foi encontrado.',
      expired:  'Este convite expirou.',
      used:     'Este convite já foi aceito.',
      revoked:  'Este convite foi revogado.',
      generic:  'Este convite não é mais válido.',
      goHome:   'Ir para o painel',
    },
    email: {
      subject:  (workspace: string) => `Você foi convidado para ${workspace}`,
      greeting: 'Olá,',
      body:     (workspace: string, role: string) => `Você foi convidado para entrar em ${workspace} como ${role}.`,
      cta:      'Aceitar convite',
      ignore:   'Se você não esperava este e-mail, pode ignorá-lo.',
    },
    errors: {
      accept:   'Não foi possível aceitar o convite.',
      notFound: 'Convite não encontrado.',
    },
  },
}

// ─── Resolver ───────────────────────────────────────────────────────────────

const dictionaries: Record<Locale, Messages> = {
  'en':    en,
  'pt-BR': ptBR,
}

/** Returns the message dictionary for `locale`, falling back to the default. */
export function t(locale: Locale): Messages {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE]
}
