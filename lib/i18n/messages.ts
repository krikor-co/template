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
