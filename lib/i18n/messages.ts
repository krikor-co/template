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
      title:            'Welcome back',
      subtitle:         'Enter your email to continue',
      emailLabel:       'Email',
      emailPlaceholder: 'you@example.com',
      submit:           'Log in',
      submitting:       'Checking for account…',
    },
    verify: {
      title:          'Check your email',
      subtitleBefore: 'We sent a 6-digit code to',
      codeLabel:      'Verification code',
      submit:         'Verify code',
      submitting:     'Verifying…',
      success:        'Verified! Redirecting…',
      resendWait:     (seconds: number) => `Resend code in ${seconds}s`,
      resend:         'Resend code',
      resendSending:  'Sending…',
      resendSent:     'Code sent!',
    },
    register: {
      title:           'Create your account',
      subtitle:        'Just your name to get started',
      emailLabel:      'Email',
      nameLabel:       'Name',
      namePlaceholder: 'Your name',
      submit:          'Create account',
      submitting:      'Creating account…',
      success:         'Account created! Redirecting…',
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
      title:            'Bem-vindo de volta',
      subtitle:         'Digite seu e-mail para continuar',
      emailLabel:       'E-mail',
      emailPlaceholder: 'voce@exemplo.com',
      submit:           'Entrar',
      submitting:       'Verificando conta…',
    },
    verify: {
      title:          'Confira seu e-mail',
      subtitleBefore: 'Enviamos um código de 6 dígitos para',
      codeLabel:      'Código de verificação',
      submit:         'Verificar código',
      submitting:     'Verificando…',
      success:        'Verificado! Redirecionando…',
      resendWait:     (seconds: number) => `Reenviar código em ${seconds}s`,
      resend:         'Reenviar código',
      resendSending:  'Enviando…',
      resendSent:     'Código enviado!',
    },
    register: {
      title:           'Crie sua conta',
      subtitle:        'Só seu nome para começar',
      emailLabel:      'E-mail',
      nameLabel:       'Nome',
      namePlaceholder: 'Seu nome',
      submit:          'Criar conta',
      submitting:      'Criando conta…',
      success:         'Conta criada! Redirecionando…',
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
