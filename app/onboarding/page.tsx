export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Onboarding</p>
      <h1 className="text-2xl font-semibold">Create your first workspace</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This is a stub route: the post-login dispatcher sends users with zero
        workspace memberships here. Replace it with your app&apos;s onboarding flow
        (create a <code>workspaces</code> row + an <code>owner</code> membership) —
        see <code>docs/tenancy.md</code>.
      </p>
    </main>
  )
}
