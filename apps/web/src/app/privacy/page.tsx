export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-2xl text-muted-foreground">
        <h1 className="text-3xl font-bold text-foreground mb-6">Privacy Policy</h1>
        <p className="mb-4">
          VisionTest AI takes your privacy seriously. We collect only the data necessary to provide our visual regression testing services.
        </p>
        <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">Data We Collect</h2>
        <ul className="list-disc list-inside mb-4 space-y-2">
          <li>Account information (email, name)</li>
          <li>Test screenshots and baselines</li>
          <li>Test execution logs</li>
        </ul>
        <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">Data Security</h2>
        <p className="mb-4">
          All data is encrypted in transit and at rest. Screenshots are stored securely and access is restricted to authorized team members only.
        </p>
        <p className="text-muted-foreground text-sm mt-8">
          Last updated: January 2026
        </p>
      </div>
    </div>
  );
}
