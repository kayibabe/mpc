import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Copy, Check, AlertCircle, Download, Eye, EyeOff } from 'lucide-react';

export default function TotpSetup() {
  const [step, setStep] = useState('generate'); // generate, confirm, backup, complete
  const [secret, setSecret] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [backupCodes, setBackupCodes] = useState([]);
  const [confirmCode, setConfirmCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [loading, setLoading] = useState(false);

  const generateSecret = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await base44.functions.invoke('generateTotpSecret', {});
      setSecret(response.data.secret);
      setQrCodeUrl(response.data.qrCodeUrl);
      
      // Generate backup codes
      const backupResponse = await base44.functions.invoke('generateBackupCodes', {});
      setBackupCodes(backupResponse.data.backupCodes);
      
      setStep('confirm');
    } catch (err) {
      setError('Failed to generate TOTP secret: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (confirmCode.length !== 6) {
      setError('Code must be 6 digits');
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      const response = await base44.functions.invoke('verifyTotp', {
        token: confirmCode,
        secret: secret, // Pass secret during setup when not yet saved to DB
      });

      if (response.data.verified) {
        // Save the secret and backup codes to UserSecurity
        try {
          const currentUser = await base44.auth.me();
          const existing = await base44.entities.UserSecurity.filter(
            { user_id: currentUser.id },
            '-created_date',
            1
          );

          if (existing.length > 0) {
            await base44.entities.UserSecurity.update(existing[0].id, {
              totp_secret: secret,
              is_totp_enabled: true,
              backup_codes: JSON.stringify(backupCodes),
              totp_enabled_date: new Date().toISOString(),
            });
          } else {
            await base44.entities.UserSecurity.create({
              user_id: currentUser.id,
              totp_secret: secret,
              is_totp_enabled: true,
              backup_codes: JSON.stringify(backupCodes),
              totp_enabled_date: new Date().toISOString(),
            });
          }
        } catch (dbErr) {
          setError('Failed to save TOTP settings: ' + dbErr.message);
          setVerifying(false);
          return;
        }

        setStep('backup');
      } else {
        setError('Invalid code. Please try again.');
      }
    } catch (err) {
      setError('Verification failed: ' + err.message);
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadBackupCodes = () => {
    const content = `TOTP Backup Codes - Zomba City HIMS\nGenerated: ${new Date().toLocaleString('en-GB')}\n\n${backupCodes.join('\n')}\n\nStore these codes in a secure location. Each code can only be used once.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container max-w-md mx-auto py-12">
      <div className="bg-card rounded-xl border border-border p-6 space-y-6">
        <div>
          <h1 className="section-title mb-2">Set Up Two-Factor Authentication</h1>
          <p className="text-sm text-muted-foreground">
            Secure your clinic account with authenticator app verification.
          </p>
        </div>

        {step === 'generate' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator to scan the QR code.
            </p>
            <button
              onClick={generateSecret}
              disabled={loading}
              className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Generating...' : 'Get Started'}
            </button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            {qrCodeUrl && (
              <div className="flex justify-center">
                <img src={qrCodeUrl} alt="TOTP QR Code" className="w-48 h-48 border border-border rounded-lg p-2" />
              </div>
            )}

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Or enter this key manually:</p>
              <div className="flex items-center gap-2">
                <code className="font-mono text-sm font-semibold flex-1 break-all">{secret}</code>
                <button
                  onClick={() => copyToClipboard(secret)}
                  className="p-1.5 hover:bg-muted rounded text-muted-foreground"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <form onSubmit={handleConfirm} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">Enter the 6-digit code from your app:</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength="6"
                  pattern="[0-9]{6}"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-center font-mono text-2xl tracking-widest"
                  autoFocus
                />
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 rounded-lg flex gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={confirmCode.length !== 6 || verifying}
                className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {verifying ? 'Verifying...' : 'Verify & Continue'}
              </button>
            </form>
          </div>
        )}

        {step === 'backup' && (
          <div className="space-y-4">
            <div className="p-3 bg-destructive/10 rounded-lg">
              <p className="text-sm text-destructive font-medium">⚠️ Save your backup codes now</p>
              <p className="text-xs text-destructive/80 mt-1">
                You won't see these again. If you lose access to your authenticator app, use a backup code to regain access to your account.
              </p>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg space-y-2">
              <button
                onClick={() => setShowBackupCodes(!showBackupCodes)}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                {showBackupCodes ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showBackupCodes ? 'Hide' : 'Show'} Backup Codes
              </button>

              {showBackupCodes && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {backupCodes.map((code, idx) => (
                    <div key={idx} className="px-2 py-1 bg-background rounded text-xs font-mono border border-border/50">
                      {code}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={downloadBackupCodes}
              className="w-full px-4 py-2.5 border border-border rounded-lg font-medium hover:bg-muted flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Codes
            </button>

            <button
              onClick={() => setStep('complete')}
              className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90"
            >
              I've Saved My Codes
            </button>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-chart-2/20 flex items-center justify-center">
                <Check className="w-6 h-6 text-chart-2" />
              </div>
            </div>
            <div>
              <h2 className="font-semibold mb-1">Two-Factor Authentication Enabled</h2>
              <p className="text-sm text-muted-foreground">
                Your account is now protected. You will need to enter a code from your authenticator app when logging in.
              </p>
            </div>
            <button
              onClick={() => window.location.href = '/'}
              className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90"
            >
              Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}