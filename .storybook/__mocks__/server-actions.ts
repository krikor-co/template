// Stub for all actions.ts files in Storybook.
// Server actions import DB clients and third-party SDKs that cannot run in the
// browser. This stub exports no-op functions so the module graph resolves
// without errors. Stories never submit forms so these are never invoked.
const noOp = async () => ({})

// RegisterForm/actions.ts
export const registerAction = noOp

// LoginForm/actions.ts
export const sendLoginOtp = noOp

// VerifyForm/actions.ts
export const verifyOtpAction = noOp
